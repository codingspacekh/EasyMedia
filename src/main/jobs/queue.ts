// Background FFmpeg jobs (P9, P10, N12): limited concurrency, progress events, cancel.
// Output is written to a temporary file and renamed only on success (ARCHITECTURE §9).
import { spawn } from 'node:child_process';
import { rename, rm } from 'node:fs/promises';
import { JobCancelledError } from '../../core/model/errors.ts';
import type { Seconds } from '../../core/model/time.ts';
import type { JobEvent, JobHandle } from '../../core/ports.ts';
import { explainFfmpegError } from '../ffmpeg/errors.ts';
import { createProgressParser } from '../ffmpeg/progress.ts';
import { tempPathFor } from '../media/jobs.ts';

export interface JobSpec {
  label: string;
  /** FFmpeg inputs and options; the queue appends progress flags and the output path. */
  args: string[];
  output: string;
  /** Length of the result, for progress. */
  duration?: Seconds;
}

export type RunProcess = (
  bin: string,
  args: string[],
  onStdout: (chunk: string) => void,
) => { done: Promise<{ code: number; stderr: string }>; kill(): void };

interface FileOps {
  rename(from: string, to: string): Promise<void>;
  rm(path: string): Promise<void>;
}

interface Job {
  id: string;
  spec: JobSpec;
  state: 'waiting' | 'running' | 'finished';
  cancelled: boolean;
  kill?: () => void;
  resolve: () => void;
  reject: (error: Error) => void;
}

const QUIET_WITH_PROGRESS = [
  '-hide_banner',
  '-loglevel',
  'error',
  '-nostats',
  '-progress',
  'pipe:1',
  '-y',
];
const MAX_STDERR = 64 * 1024;

export const spawnProcess: RunProcess = (bin, args, onStdout) => {
  const child = spawn(bin, args, { windowsHide: true });
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', onStdout);
  child.stderr
    .setEncoding('utf8')
    .on('data', (d: string) => (stderr = (stderr + d).slice(-MAX_STDERR)));
  const done = new Promise<{ code: number; stderr: string }>((resolve) => {
    child.on('error', (e) => resolve({ code: -1, stderr: e.message }));
    child.on('close', (code) => resolve({ code: code ?? -1, stderr }));
  });
  return { done, kill: () => child.kill() };
};

const nodeFiles: FileOps = {
  rename,
  rm: (path) => rm(path, { force: true }),
};

export function createJobQueue({
  ffmpeg,
  concurrency = 1,
  run = spawnProcess,
  fs = nodeFiles,
}: {
  ffmpeg: string;
  concurrency?: number;
  run?: RunProcess;
  fs?: FileOps;
}) {
  const listeners = new Set<(event: JobEvent) => void>();
  const waiting: Job[] = [];
  let running = 0;
  let nextId = 1;

  const emit = (event: JobEvent) => listeners.forEach((listener) => listener(event));
  const base = (job: Job) => ({ jobId: job.id, label: job.spec.label });

  function pump(): void {
    while (running < concurrency && waiting.length > 0) void start(waiting.shift()!);
  }

  async function start(job: Job): Promise<void> {
    running++;
    job.state = 'running';
    emit({ type: 'started', ...base(job) });
    const temp = tempPathFor(job.spec.output, job.id);
    let last = 0;
    const progress = (ratio: number) => {
      last = ratio;
      emit({ type: 'progress', ...base(job), ratio });
    };
    const child = run(
      ffmpeg,
      [...QUIET_WITH_PROGRESS, ...job.spec.args, temp],
      createProgressParser(job.spec.duration ?? 0, progress),
    );
    job.kill = child.kill;
    const { code, stderr } = await child.done;
    try {
      if (job.cancelled) {
        await fs.rm(temp);
        emit({ type: 'cancelled', ...base(job) });
        job.reject(new JobCancelledError());
      } else if (code === 0) {
        await fs.rename(temp, job.spec.output);
        if (last < 1) progress(1);
        emit({ type: 'done', ...base(job) });
        job.resolve();
      } else {
        await fs.rm(temp);
        const error = explainFfmpegError(stderr);
        emit({ type: 'error', ...base(job), message: error.message });
        job.reject(error);
      }
    } finally {
      job.state = 'finished';
      running--;
      pump();
    }
  }

  function cancel(job: Job): void {
    if (job.state === 'waiting') {
      waiting.splice(waiting.indexOf(job), 1);
      job.state = 'finished';
      emit({ type: 'cancelled', ...base(job) });
      job.reject(new JobCancelledError());
    } else if (job.state === 'running') {
      job.cancelled = true;
      job.kill?.();
    }
  }

  return {
    run(spec: JobSpec): JobHandle {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      const done = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
      done.catch(() => {}); // callers that never await must not cause unhandled rejections
      const job: Job = {
        id: `job-${nextId++}`,
        spec,
        state: 'waiting',
        cancelled: false,
        resolve,
        reject,
      };
      waiting.push(job);
      emit({ type: 'queued', ...base(job) });
      pump();
      return { id: job.id, done, cancel: () => cancel(job) };
    },
    onEvent(listener: (event: JobEvent) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { JobCancelledError, MediaError } from '../../../../src/core/model/errors.ts';
import type { JobEvent } from '../../../../src/core/ports.ts';
import { createJobQueue, spawnProcess, type RunProcess } from '../../../../src/main/jobs/queue.ts';

/** A fake ffmpeg process the test controls by hand. */
function fakeRunner() {
  const runs: {
    args: string[];
    stdout: (s: string) => void;
    finish: (code: number, stderr?: string) => void;
    killed: boolean;
  }[] = [];
  const run: RunProcess = (_bin, args, onStdout) => {
    let finish!: (r: { code: number; stderr: string }) => void;
    const done = new Promise<{ code: number; stderr: string }>((r) => (finish = r));
    const entry = {
      args,
      stdout: onStdout,
      finish: (code: number, stderr = '') => finish({ code, stderr }),
      killed: false,
    };
    runs.push(entry);
    return { done, kill: () => ((entry.killed = true), entry.finish(-1)) };
  };
  return { run, runs };
}

function fakeFs() {
  const calls: string[] = [];
  return {
    calls,
    fs: {
      rename: async (from: string, to: string) => void calls.push(`rename ${from} → ${to}`),
      rm: async (path: string) => void calls.push(`rm ${path}`),
    },
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const out = join('/out', 'proxy.mp4');

function setup(concurrency = 1) {
  const runner = fakeRunner();
  const files = fakeFs();
  const queue = createJobQueue({ ffmpeg: 'ffmpeg', concurrency, run: runner.run, fs: files.fs });
  const events: string[] = [];
  queue.onEvent((e: JobEvent) =>
    events.push(e.type === 'progress' ? `progress ${e.ratio}` : e.type),
  );
  return { ...runner, ...files, queue, events };
}

describe('N12 background job queue', () => {
  it('runs ffmpeg quietly with progress on stdout, writing to a temporary file', async () => {
    const { queue, runs } = setup();
    queue.run({ label: 'Proxy', args: ['-i', 'in.mp4'], output: out, duration: 10 });
    await tick();
    expect(runs[0]!.args).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostats',
      '-progress',
      'pipe:1',
      '-y',
      '-i',
      'in.mp4',
      join('/out', 'proxy.partial-job-1.mp4'),
    ]);
  });

  it('reports queued → started → progress → done and moves the file into place', async () => {
    const { queue, runs, events, calls } = setup();
    const job = queue.run({ label: 'Proxy', args: [], output: out, duration: 10 });
    await tick();
    runs[0]!.stdout('out_time_us=5000000\n');
    runs[0]!.finish(0);
    await job.done;
    expect(events).toEqual(['queued', 'started', 'progress 0.5', 'progress 1', 'done']);
    expect(calls).toEqual([`rename ${join('/out', 'proxy.partial-job-1.mp4')} → ${out}`]);
  });

  it('runs one job at a time by default; the next starts when the first ends', async () => {
    const { queue, runs } = setup();
    const first = queue.run({ label: 'A', args: [], output: out });
    queue.run({ label: 'B', args: [], output: join('/out', 'b.mp4') });
    await tick();
    expect(runs).toHaveLength(1);
    runs[0]!.finish(0);
    await first.done;
    await tick();
    expect(runs).toHaveLength(2);
  });

  it('can run several jobs at once when allowed', async () => {
    const { queue, runs } = setup(2);
    queue.run({ label: 'A', args: [], output: out });
    queue.run({ label: 'B', args: [], output: join('/out', 'b.mp4') });
    await tick();
    expect(runs).toHaveLength(2);
  });

  it('a failed job explains the error, removes the temporary file and does not create the output', async () => {
    const { queue, runs, events, calls } = setup();
    const job = queue.run({ label: 'Proxy', args: [], output: out });
    await tick();
    runs[0]!.finish(1, 'in.mp4: Invalid data found when processing input');
    await expect(job.done).rejects.toThrow(MediaError);
    await expect(job.done).rejects.toThrow(/damaged/);
    expect(events).toEqual(['queued', 'started', 'error']);
    expect(calls).toEqual([`rm ${join('/out', 'proxy.partial-job-1.mp4')}`]);
  });

  it('cancelling a running job stops ffmpeg and leaves no file behind', async () => {
    const { queue, runs, events, calls } = setup();
    const job = queue.run({ label: 'Proxy', args: [], output: out });
    await tick();
    job.cancel();
    await expect(job.done).rejects.toThrow(JobCancelledError);
    expect(runs[0]!.killed).toBe(true);
    expect(events).toEqual(['queued', 'started', 'cancelled']);
    expect(calls).toEqual([`rm ${join('/out', 'proxy.partial-job-1.mp4')}`]);
  });

  it('cancelling a waiting job means it never starts, and the queue carries on', async () => {
    const { queue, runs } = setup();
    const first = queue.run({ label: 'A', args: [], output: out });
    const waiting = queue.run({ label: 'B', args: [], output: join('/out', 'b.mp4') });
    const third = queue.run({ label: 'C', args: [], output: join('/out', 'c.mp4') });
    waiting.cancel();
    await expect(waiting.done).rejects.toThrow(JobCancelledError);
    await tick();
    runs[0]!.finish(0);
    await first.done;
    await tick();
    expect(runs.map((r) => r.args.at(-1))).toEqual([
      join('/out', 'proxy.partial-job-1.mp4'),
      join('/out', 'c.partial-job-3.mp4'),
    ]);
    runs[1]!.finish(0);
    await third.done;
  });

  it('cancelling a finished job does nothing', async () => {
    const { queue, runs, events } = setup();
    const job = queue.run({ label: 'A', args: [], output: out });
    await tick();
    runs[0]!.finish(0);
    await job.done;
    job.cancel();
    await tick();
    expect(events.at(-1)).toBe('done');
  });

  it('cancelAll stops the running job and drops waiting ones (the app is quitting)', async () => {
    const { queue, runs, calls } = setup();
    const first = queue.run({ label: 'Preparing preview', args: ['-i', 'a.mp4'], output: out });
    const second = queue.run({ label: 'Thumbnails', args: ['-i', 'b.mp4'], output: '/out/b.jpg' });
    await tick();
    queue.cancelAll();
    await expect(first.done).rejects.toThrow(JobCancelledError);
    await expect(second.done).rejects.toThrow(JobCancelledError);
    expect(runs.map((r) => r.killed)).toEqual([true]); // the second never started
    expect(calls.some((c) => c.startsWith('rename'))).toBe(false);
  });

  it('listeners can stop listening', async () => {
    const { queue } = setup();
    const seen: string[] = [];
    const stop = queue.onEvent((e) => seen.push(e.type));
    stop();
    queue.run({ label: 'A', args: [], output: out });
    expect(seen).toEqual([]);
  });

  it('A17 prepares the input just before ffmpeg starts and cleans up afterwards', async () => {
    const { queue, runs } = setup();
    const steps: string[] = [];
    const job = queue.run({
      label: 'Export audio',
      args: [],
      output: out,
      prepare: async () => void steps.push('prepare'),
      cleanUp: async () => void steps.push('clean up'),
    });
    await tick();
    expect([steps, runs.length]).toEqual([['prepare'], 1]);
    runs[0]!.finish(0);
    await job.done;
    expect(steps).toEqual(['prepare', 'clean up']);
  });

  it('a failed preparation fails the job without running ffmpeg, and still cleans up', async () => {
    const { queue, runs, events } = setup();
    let cleaned = false;
    const job = queue.run({
      label: 'Export audio',
      args: [],
      output: out,
      prepare: async () => {
        throw new MediaError('There is not enough space on the disk.');
      },
      cleanUp: async () => void (cleaned = true),
    });
    await expect(job.done).rejects.toThrow(/not enough space/);
    expect([runs.length, cleaned]).toEqual([0, true]);
    expect(events).toEqual(['queued', 'started', 'error']);
    // the queue carries on with the next job
    queue.run({ label: 'B', args: [], output: join('/out', 'b.mp4') });
    await tick();
    expect(runs).toHaveLength(1);
  });

  it('a cancelled job is cleaned up too', async () => {
    const { queue } = setup();
    let cleaned = 0;
    const job = queue.run({
      label: 'A',
      args: [],
      output: out,
      cleanUp: async () => void cleaned++,
    });
    await tick();
    job.cancel();
    await expect(job.done).rejects.toThrow(JobCancelledError);
    const waiting = queue.run({
      label: 'B',
      args: [],
      output: out,
      cleanUp: async () => void cleaned++,
    });
    const later = queue.run({
      label: 'C',
      args: [],
      output: out,
      cleanUp: async () => void cleaned++,
    });
    later.cancel();
    await expect(later.done).rejects.toThrow(JobCancelledError);
    waiting.cancel();
    await expect(waiting.done).rejects.toThrow(JobCancelledError);
    expect(cleaned).toBe(3);
  });

  it('cancelling stops the process at once, even one that ignores a polite stop (quit, Cancel)', async () => {
    const child = spawnProcess(
      process.execPath,
      ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
      () => {},
    );
    await new Promise((r) => setTimeout(r, 300)); // let it start and set up its handler
    const started = Date.now();
    child.kill();
    await child.done;
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

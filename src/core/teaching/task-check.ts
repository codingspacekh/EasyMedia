// T6: the task checker. A teacher sets what an exported file must be (format, resolution,
// duration ± a tolerance, mono / stereo, sample rate; for an animation, AN17, the frame rate and
// whether it loops) and saves it as a small file for the students; a student opens it with their
// export (a video, sound, GIF, web page or PNG sequence) and sees pass or fail for each row.
import { EditError } from '../model/errors.ts';
import type { ProbeInfo } from '../ports.ts';
import { group } from './file-size.ts';

export interface TaskSpec {
  name: string;
  /** File type as the media probe names it: mp4, mov, avi, wmv, mpg, gif, mp3, m4a, aac, wav, flac. */
  container?: string;
  width?: number;
  height?: number;
  duration?: number;
  /** How far the duration may be out, in seconds (default 0.5). */
  tolerance?: number;
  channels?: 1 | 2;
  sampleRate?: number;
  /** AN17: frames per second. */
  fps?: number;
  /** AN17: plays again and again (an animated GIF or a web page). */
  loop?: boolean;
}

/** What is checked: a probed file, or a PNG sequence with its number of pictures (AN17). */
export type CheckedFile = ProbeInfo & { frames?: number };

export interface CheckRow {
  label: string;
  expected: string;
  actual: string;
  pass: boolean;
}

/** M14: gif for animation tasks (AN15); M16: html (a web animation) and png (a PNG sequence). */
export const TASK_FORMATS = [
  'mp4',
  'mov',
  'avi',
  'wmv',
  'mpg',
  'gif',
  'html',
  'png',
  'mp3',
  'm4a',
  'aac',
  'wav',
  'flac',
];
const DEFAULT_TOLERANCE = 0.5;
const KIND = 'easymedia-task-check';

const channels = (n: number) => (n === 1 ? '1 (mono)' : n === 2 ? '2 (stereo)' : String(n));

/** AN17: a PNG sequence as one file to check: the first picture, and how many there are. */
export function sequenceInfo(first: ProbeInfo, frames: number): CheckedFile {
  return { ...first, frames, sizeBytes: first.sizeBytes * frames };
}

/**
 * The same frame rate. A GIF keeps each frame's time in hundredths of a second, so 24 fps is
 * stored as 4/100 s (25 fps): for a GIF the rates match when they round to the same time.
 */
function sameRate(container: string, expected: number, actual: number): boolean {
  if (container === 'gif') return Math.round(100 / expected) === Math.round(100 / actual);
  return Math.abs(expected - actual) < 0.01;
}

const showFps = (fps: number) => `${Math.round(fps * 100) / 100} fps`;
const looping = (loop: boolean) => (loop ? 'plays again and again' : 'plays once');

export function checkFile(spec: TaskSpec, info: CheckedFile): { rows: CheckRow[]; pass: boolean } {
  const rows: CheckRow[] = [];
  const row = (label: string, expected: string, actual: string, pass: boolean) =>
    rows.push({ label, expected, actual, pass });
  if (spec.container)
    row(
      'File format',
      spec.container.toUpperCase(),
      info.container.toUpperCase(),
      info.container === spec.container,
    );
  if (spec.width && spec.height) {
    const v = info.video;
    row(
      'Resolution',
      `${spec.width} × ${spec.height}`,
      v ? `${v.width} × ${v.height}` : 'no picture',
      !!v && v.width === spec.width && v.height === spec.height,
    );
  }
  const sequence = info.frames !== undefined;
  if (spec.fps && !sequence) {
    const fps = info.video?.fps;
    row(
      'Frame rate',
      showFps(spec.fps),
      fps ? showFps(fps) : 'unknown',
      !!fps && sameRate(info.container, spec.fps, fps),
    );
  }
  if (sequence && spec.duration !== undefined && spec.fps) {
    const wanted = Math.round(spec.duration * spec.fps);
    row(
      'Frames',
      `${wanted} (${spec.duration} s × ${spec.fps} fps)`,
      String(info.frames),
      info.frames === wanted,
    );
  } else if (spec.duration !== undefined && !sequence) {
    const tolerance = spec.tolerance ?? DEFAULT_TOLERANCE;
    const d = info.duration;
    row(
      'Duration',
      `${spec.duration.toFixed(2)} s ± ${tolerance.toFixed(2)} s`,
      d === undefined ? 'no length' : `${d.toFixed(2)} s`,
      d !== undefined && Math.abs(d - spec.duration) <= tolerance + 1e-9,
    );
  }
  const a = info.audio;
  if (spec.channels)
    row(
      'Channels',
      channels(spec.channels),
      a ? channels(a.channels) : 'no sound',
      a?.channels === spec.channels,
    );
  if (spec.sampleRate)
    row(
      'Sample rate',
      `${group(spec.sampleRate)} Hz`,
      a ? `${group(a.sampleRate)} Hz` : 'no sound',
      a?.sampleRate === spec.sampleRate,
    );
  if (spec.loop !== undefined)
    row(
      'Looping',
      looping(spec.loop),
      info.loop === undefined ? 'not set in the file' : looping(info.loop),
      info.loop === spec.loop,
    );
  return { rows, pass: rows.every((r) => r.pass) };
}

export function serializeTaskSpec(spec: TaskSpec): string {
  return JSON.stringify({ kind: KIND, version: 1, ...spec }, null, 2);
}

/** Reads a task check file; throws an EditError the teacher or student can act on. */
export function parseTaskSpec(text: string): TaskSpec {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (data?.kind !== KIND) throw new EditError('This file is not an EasyMedia task check.');
  const positive = (key: keyof TaskSpec) => {
    const v = data[key];
    if (v === undefined) return undefined;
    if (typeof v !== 'number' || !(v > 0)) throw new EditError(`The task's ${key} is not valid.`);
    return v;
  };
  const spec: TaskSpec = { name: typeof data.name === 'string' ? data.name : 'Task' };
  if (data.container !== undefined) {
    if (typeof data.container !== 'string' || !TASK_FORMATS.includes(data.container))
      throw new EditError("The task's file format is not valid.");
    spec.container = data.container;
  }
  const width = positive('width');
  const height = positive('height');
  if ((width === undefined) !== (height === undefined))
    throw new EditError('The task needs both a width and a height.');
  if (width && height) Object.assign(spec, { width, height });
  const duration = positive('duration');
  if (duration !== undefined) spec.duration = duration;
  const tolerance = data.tolerance;
  if (tolerance !== undefined) {
    if (typeof tolerance !== 'number' || tolerance < 0)
      throw new EditError("The task's tolerance is not valid.");
    spec.tolerance = tolerance;
  }
  if (data.channels !== undefined) {
    if (data.channels !== 1 && data.channels !== 2)
      throw new EditError('The task must ask for 1 or 2 channels.');
    spec.channels = data.channels;
  }
  const sampleRate = positive('sampleRate');
  if (sampleRate !== undefined) spec.sampleRate = sampleRate;
  const fps = positive('fps');
  if (fps !== undefined) spec.fps = fps;
  if (data.loop !== undefined) {
    if (typeof data.loop !== 'boolean') throw new EditError("The task's looping is not valid.");
    spec.loop = data.loop;
  }
  if (
    !spec.container &&
    !width &&
    duration === undefined &&
    !spec.channels &&
    !sampleRate &&
    !fps &&
    spec.loop === undefined
  )
    throw new EditError('This task has nothing to check.');
  return spec;
}

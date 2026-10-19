// A18 + N4: undo steps keep their samples on disk, as Audacity does, so memory does not grow
// with the history. Only large samples move (small ones stay in memory); a step on disk is
// loaded again just before it is undone or redone. Where the samples are kept is up to the
// caller (a port): these functions only swap samples for keys and back.
import type { AudioChange, AudioHistory, AudioOp, Samples, StoredSamples } from './history.ts';
import type { Channels } from './pcm.ts';

const isStored = (s: Samples): s is StoredSamples => !Array.isArray(s);
const size = (c: Channels) => c.reduce((n, a) => n + a.length, 0);

/** Every sample field of an operation (a removed track has one per clip). */
function samplesOf(op: AudioOp): Samples[] {
  if (op.type === 'splice') return [op.insert];
  if (op.type === 'source') return [op.source];
  if (op.type === 'add-clip') return [op.clip.source];
  if (op.type === 'insert') return op.track.clips.map((c) => c.source);
  return [];
}

/** The operation with its sample fields replaced by `samples` (in the order of samplesOf). */
function withSamples(op: AudioOp, samples: Samples[]): AudioOp {
  if (op.type === 'splice') return { ...op, insert: samples[0]! };
  if (op.type === 'source') return { ...op, source: samples[0]! };
  if (op.type === 'add-clip') return { ...op, clip: { ...op.clip, source: samples[0]! } };
  if (op.type === 'insert')
    return {
      ...op,
      track: { ...op.track, clips: op.track.clips.map((c, i) => ({ ...c, source: samples[i]! })) },
    };
  return op;
}

/** The step with each sample field passed through `swap`; the same object if nothing changed. */
async function swapAll(
  change: AudioChange,
  swap: (s: Samples) => Promise<Samples>,
): Promise<AudioChange> {
  let changed = false;
  const undo = await Promise.all(
    change.undo.map(async (op) => {
      const before = samplesOf(op);
      if (!before.length) return op;
      const after = await Promise.all(before.map(swap));
      if (after.every((s, i) => s === before[i])) return op;
      changed = true;
      return withSamples(op, after);
    }),
  );
  return changed ? { ...change, undo } : change;
}

/** Moves the step's samples of at least `minSamples` (all channels together) to disk. */
export function stashChange(
  change: AudioChange,
  save: (channels: Channels) => Promise<string>,
  minSamples: number,
): Promise<AudioChange> {
  return swapAll(change, async (s) =>
    isStored(s) || size(s) < minSamples
      ? s
      : { stored: await save(s), count: s.length, length: s[0]!.length },
  );
}

/** Brings the step's samples back from disk. */
export function loadChange(
  change: AudioChange,
  load: (key: string) => Promise<Float32Array[]>,
): Promise<AudioChange> {
  return swapAll(change, async (s) => (isStored(s) ? load(s.stored) : s));
}

/** The keys of the samples this step keeps on disk. */
export function changeRefs(change: AudioChange): string[] {
  return change.undo.flatMap((op) => samplesOf(op).flatMap((s) => (isStored(s) ? [s.stored] : [])));
}

/** Every key the history still needs (anything else on disk can be deleted). */
export function historyRefs(h: AudioHistory): string[] {
  return [...h.past, ...h.future].flatMap(changeRefs);
}

/** Whether the step still holds samples in memory that are big enough to move to disk. */
export function hasLooseSamples(change: AudioChange, minSamples: number): boolean {
  return change.undo.some((op) => samplesOf(op).some((s) => !isStored(s) && size(s) >= minSamples));
}

/** The history with step `old` (found by identity) replaced by `next`. */
export function replaceChange(h: AudioHistory, old: AudioChange, next: AudioChange): AudioHistory {
  if (old === next) return h;
  const past = h.past.indexOf(old);
  if (past >= 0) return { ...h, past: h.past.map((c, i) => (i === past ? next : c)) };
  const future = h.future.indexOf(old);
  if (future >= 0) return { ...h, future: h.future.map((c, i) => (i === future ? next : c)) };
  return h;
}

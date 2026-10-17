// A18 + N4: undo steps keep their samples on disk, as Audacity does, so memory does not grow
// with the history. Only large samples move (small ones stay in memory); a step on disk is
// loaded again just before it is undone or redone. Where the samples are kept is up to the
// caller (a port): these functions only swap samples for keys and back.
import type { AudioChange, AudioHistory, AudioOp, Samples, StoredSamples } from './history.ts';
import type { Channels } from './pcm.ts';

const isStored = (s: Samples): s is StoredSamples => !Array.isArray(s);
const size = (c: Channels) => c.reduce((n, a) => n + a.length, 0);

/** Every sample field of the step's operations. */
function samplesOf(op: AudioOp): Samples | null {
  if (op.type === 'splice') return op.insert;
  if (op.type === 'channels') return op.channels;
  if (op.type === 'insert') return op.track.channels;
  return null;
}

function withSamples(op: AudioOp, samples: Samples): AudioOp {
  if (op.type === 'splice') return { ...op, insert: samples };
  if (op.type === 'channels') return { ...op, channels: samples };
  if (op.type === 'insert') return { ...op, track: { ...op.track, channels: samples } };
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
      if (!before) return op;
      const after = await swap(before);
      if (after === before) return op;
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
  return change.undo.flatMap((op) => {
    const s = samplesOf(op);
    return s && isStored(s) ? [s.stored] : [];
  });
}

/** Every key the history still needs (anything else on disk can be deleted). */
export function historyRefs(h: AudioHistory): string[] {
  return [...h.past, ...h.future].flatMap(changeRefs);
}

/** Whether the step still holds samples in memory that are big enough to move to disk. */
export function hasLooseSamples(change: AudioChange, minSamples: number): boolean {
  return change.undo.some((op) => {
    const s = samplesOf(op);
    return s !== null && !isStored(s) && size(s) >= minSamples;
  });
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

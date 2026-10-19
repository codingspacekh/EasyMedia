// Unlimited undo / redo for Audio mode (A18) with the Memento pattern (P5, ARCHITECTURE §3).
// Audio edits change samples, often in a small region of a long clip, so instead of keeping
// whole projects (as the video history does) each step keeps only what it removed: the samples
// of the changed region, a clip's or track's old settings, or a removed clip or track. Every
// step is an operation whose inverse is worked out while it is applied, so undo and redo are
// the same thing. Moving, trimming and splitting clips keep no samples at all.
import type { Id } from '../model/types.ts';
import type { AudioClip, AudioDoc, AudioTrack, Channels } from './pcm.ts';

type Meta = Partial<Pick<AudioTrack, 'name' | 'gain' | 'pan' | 'channelCount'>>;
type ClipMeta = Partial<Pick<AudioClip, 'offset' | 'in' | 'out'>>;

/** Samples an undo step keeps on disk instead of in memory (as Audacity; see stored.ts). */
export interface StoredSamples {
  stored: string;
  count: number;
  length: number;
}
/** Samples of an undo step: in memory, or on disk. */
export type Samples = Channels | StoredSamples;
/** A clip kept by an undo step (its samples may be on disk). */
export type OpClip = Omit<AudioClip, 'source'> & { source: Samples };
/** A track kept by an undo step. */
export type OpTrack = Omit<AudioTrack, 'clips'> & { clips: readonly OpClip[] };

export type AudioOp =
  /** Removes `remove` heard samples at `at` (counted from the clip's `in`) and puts `insert` there. */
  | { type: 'splice'; clip: Id; at: number; remove: number; insert: Samples }
  | { type: 'clip'; clip: Id; set: ClipMeta }
  | { type: 'source'; clip: Id; source: Samples }
  | { type: 'add-clip'; track: Id; index: number; clip: OpClip }
  | { type: 'remove-clip'; clip: Id }
  | { type: 'meta'; track: Id; set: Meta }
  | { type: 'insert'; index: number; track: OpTrack }
  | { type: 'remove'; track: Id }
  | { type: 'move'; track: Id; to: number }
  | { type: 'rate'; rate: number };

export interface AudioChange {
  label: string;
  /** The operations that take the document back to before this change, in order. */
  undo: AudioOp[];
}

export interface AudioHistory {
  readonly past: readonly AudioChange[];
  readonly present: AudioDoc;
  readonly future: readonly AudioChange[];
}

/** What an edit can do; every call takes effect at once on `doc`. */
export interface AudioEdit {
  readonly doc: AudioDoc;
  splice(clip: Id, at: number, remove: number, insert: Channels): void;
  setClip(clip: Id, set: ClipMeta): void;
  /** New samples for a clip (the same length, or set `in` and `out` after it). */
  setSource(clip: Id, source: Channels): void;
  addClip(track: Id, clip: AudioClip): void;
  removeClip(clip: Id): void;
  setMeta(track: Id, set: Meta): void;
  addTrack(track: AudioTrack, index?: number): void;
  removeTrack(track: Id): void;
  moveTrack(track: Id, to: number): void;
  setRate(rate: number): void;
}

export function createAudioHistory(doc: AudioDoc): AudioHistory {
  return { past: [], present: doc, future: [] };
}

/**
 * Runs an edit as one undoable step called `label`. If it throws (e.g. EditError), the
 * history is unchanged; if it does nothing, no step is added.
 */
export function editAudio(
  history: AudioHistory,
  label: string,
  edit: (tx: AudioEdit) => void,
): AudioHistory {
  let doc = history.present;
  const undo: AudioOp[] = [];
  const run = (op: AudioOp) => {
    const result = applyOp(doc, op);
    doc = result.doc;
    undo.unshift(result.inverse);
  };
  edit({
    get doc() {
      return doc;
    },
    splice: (clip, at, remove, insert) => run({ type: 'splice', clip, at, remove, insert }),
    setClip: (clip, set) => run({ type: 'clip', clip, set }),
    setSource: (clip, source) => run({ type: 'source', clip, source }),
    addClip: (track, clip) =>
      run({ type: 'add-clip', track, index: trackOf(doc, track).clips.length, clip }),
    removeClip: (clip) => run({ type: 'remove-clip', clip }),
    setMeta: (track, set) => run({ type: 'meta', track, set }),
    addTrack: (track, index = doc.tracks.length) => run({ type: 'insert', index, track }),
    removeTrack: (track) => run({ type: 'remove', track }),
    moveTrack: (track, to) => run({ type: 'move', track, to }),
    setRate: (rate) => run({ type: 'rate', rate }),
  });
  if (undo.length === 0) return history;
  return { past: [...history.past, { label, undo }], present: doc, future: [] };
}

export function undoAudio(history: AudioHistory): AudioHistory {
  const last = history.past.at(-1);
  if (!last) return history;
  const { doc, change } = replay(history.present, last);
  return { past: history.past.slice(0, -1), present: doc, future: [change, ...history.future] };
}

export function redoAudio(history: AudioHistory): AudioHistory {
  const [next, ...rest] = history.future;
  if (!next) return history;
  const { doc, change } = replay(history.present, next);
  return { past: [...history.past, change], present: doc, future: rest };
}

export const canUndoAudio = (h: AudioHistory): boolean => h.past.length > 0;
export const canRedoAudio = (h: AudioHistory): boolean => h.future.length > 0;

/** Applies a stored change and returns the change that reverses it. */
function replay(doc: AudioDoc, change: AudioChange): { doc: AudioDoc; change: AudioChange } {
  const reverse: AudioOp[] = [];
  for (const op of change.undo) {
    const result = applyOp(doc, op);
    doc = result.doc;
    reverse.unshift(result.inverse);
  }
  return { doc, change: { label: change.label, undo: reverse } };
}

function indexOf(doc: AudioDoc, id: Id): number {
  const index = doc.tracks.findIndex((t) => t.id === id);
  if (index < 0) throw new RangeError(`No audio track ${id}.`);
  return index;
}

const trackOf = (doc: AudioDoc, id: Id): AudioTrack => doc.tracks[indexOf(doc, id)]!;

/** The track holding clip `id`, and where. */
function findClip(doc: AudioDoc, id: Id): { t: number; c: number; clip: AudioClip } {
  for (const [t, track] of doc.tracks.entries()) {
    const c = track.clips.findIndex((x) => x.id === id);
    if (c >= 0) return { t, c, clip: track.clips[c]! };
  }
  throw new RangeError(`No audio clip ${id}.`);
}

function withTrack(doc: AudioDoc, index: number, track: AudioTrack): AudioDoc {
  return { ...doc, tracks: doc.tracks.map((t, i) => (i === index ? track : t)) };
}

function withClip(doc: AudioDoc, t: number, c: number, clip: AudioClip): AudioDoc {
  const track = doc.tracks[t]!;
  return withTrack(doc, t, { ...track, clips: track.clips.map((x, i) => (i === c ? clip : x)) });
}

/** Samples in memory; samples still on disk are a mistake of the caller (load them first). */
function need(samples: Samples): Channels {
  if (!Array.isArray(samples))
    throw new Error('This undo step is on disk: load it (loadChange) before applying it.');
  return samples as Channels;
}

const ready = (clip: OpClip): AudioClip => ({ ...clip, source: need(clip.source) });

function checkClip(clip: AudioClip): void {
  const length = clip.source[0]?.length ?? 0;
  if (!(clip.in >= 0 && clip.out <= length && clip.in < clip.out && clip.offset >= 0))
    throw new RangeError('A clip must use some of its samples and start at 0 s or later.');
}

function applyOp(doc: AudioDoc, op: AudioOp): { doc: AudioDoc; inverse: AudioOp } {
  switch (op.type) {
    case 'splice': {
      const { t, c, clip } = findClip(doc, op.clip);
      const insert = need(op.insert);
      if (insert.length !== clip.source.length)
        throw new RangeError('A splice needs one array per channel.');
      const at = clip.in + op.at;
      if (op.at < 0 || op.remove < 0 || at + op.remove > clip.out)
        throw new RangeError('A splice must stay inside the clip.');
      const length = clip.source[0]!.length;
      const removed = clip.source.map((s) => s.slice(at, at + op.remove));
      const source = clip.source.map((s, ch) => {
        const added = insert[ch]!;
        const out = new Float32Array(length - op.remove + added.length);
        out.set(s.subarray(0, at), 0);
        out.set(added, at);
        out.set(s.subarray(at + op.remove), at + added.length);
        return out;
      });
      const out = clip.out - op.remove + insert[0]!.length;
      return {
        doc: withClip(doc, t, c, { ...clip, source, out }),
        inverse: {
          type: 'splice',
          clip: op.clip,
          at: op.at,
          remove: insert[0]!.length,
          insert: removed,
        },
      };
    }
    case 'clip': {
      const { t, c, clip } = findClip(doc, op.clip);
      const next = { ...clip, ...op.set };
      checkClip(next);
      const before = Object.fromEntries(
        Object.keys(op.set).map((k) => [k, clip[k as keyof ClipMeta]]),
      ) as ClipMeta;
      return {
        doc: withClip(doc, t, c, next),
        inverse: { type: 'clip', clip: op.clip, set: before },
      };
    }
    case 'source': {
      const { t, c, clip } = findClip(doc, op.clip);
      return {
        doc: withClip(doc, t, c, { ...clip, source: need(op.source) }),
        inverse: { type: 'source', clip: op.clip, source: clip.source },
      };
    }
    case 'add-clip': {
      const t = indexOf(doc, op.track);
      const track = doc.tracks[t]!;
      const clips = [...track.clips];
      clips.splice(op.index, 0, ready(op.clip));
      return {
        doc: withTrack(doc, t, { ...track, clips }),
        inverse: { type: 'remove-clip', clip: op.clip.id },
      };
    }
    case 'remove-clip': {
      const { t, c, clip } = findClip(doc, op.clip);
      const track = doc.tracks[t]!;
      return {
        doc: withTrack(doc, t, { ...track, clips: track.clips.filter((_, i) => i !== c) }),
        inverse: { type: 'add-clip', track: track.id, index: c, clip },
      };
    }
    case 'meta': {
      const index = indexOf(doc, op.track);
      const track = doc.tracks[index]!;
      const before = Object.fromEntries(
        Object.keys(op.set).map((k) => [k, track[k as keyof Meta]]),
      ) as Meta;
      return {
        doc: withTrack(doc, index, { ...track, ...op.set }),
        inverse: { type: 'meta', track: op.track, set: before },
      };
    }
    case 'insert': {
      const tracks = [...doc.tracks];
      tracks.splice(op.index, 0, { ...op.track, clips: op.track.clips.map(ready) });
      return { doc: { ...doc, tracks }, inverse: { type: 'remove', track: op.track.id } };
    }
    case 'remove': {
      const index = indexOf(doc, op.track);
      return {
        doc: { ...doc, tracks: doc.tracks.filter((_, i) => i !== index) },
        inverse: { type: 'insert', index, track: doc.tracks[index]! },
      };
    }
    case 'move': {
      const index = indexOf(doc, op.track);
      const tracks = [...doc.tracks];
      const [track] = tracks.splice(index, 1);
      tracks.splice(op.to, 0, track!);
      return { doc: { ...doc, tracks }, inverse: { type: 'move', track: op.track, to: index } };
    }
    case 'rate':
      return { doc: { ...doc, rate: op.rate }, inverse: { type: 'rate', rate: doc.rate } };
  }
}

/** For the History panel: the labels of what has been done, oldest first. */
export const historyLabels = (h: AudioHistory): string[] => h.past.map((c) => c.label);

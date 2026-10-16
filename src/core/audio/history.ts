// Unlimited undo / redo for Audio mode (A18) with the Memento pattern (P5, ARCHITECTURE §3).
// Audio edits change samples, often in a small region of a long track, so instead of keeping
// whole projects (as the video history does) each step keeps only what it removed: the samples
// of the changed region, a track's old settings, or a removed track. Every step is an operation
// whose inverse is worked out while it is applied, so undo and redo are the same thing.
import type { Id } from '../model/types.ts';
import type { AudioDoc, AudioTrack, Channels } from './pcm.ts';

type Meta = Partial<Pick<AudioTrack, 'name' | 'offset' | 'gain' | 'pan'>>;

/** Samples an undo step keeps on disk instead of in memory (as Audacity; see stored.ts). */
export interface StoredSamples {
  stored: string;
  count: number;
  length: number;
}
/** Samples of an undo step: in memory, or on disk. */
export type Samples = Channels | StoredSamples;
/** A track kept by an undo step (its samples may be on disk). */
export type OpTrack = Omit<AudioTrack, 'channels'> & { channels: Samples };

export type AudioOp =
  /** Removes `remove` samples at `at` and puts `insert` there (one array per channel). */
  | { type: 'splice'; track: Id; at: number; remove: number; insert: Samples }
  | { type: 'meta'; track: Id; set: Meta }
  | { type: 'insert'; index: number; track: OpTrack }
  | { type: 'remove'; track: Id }
  | { type: 'move'; track: Id; to: number }
  | { type: 'channels'; track: Id; channels: Samples }
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
  splice(track: Id, at: number, remove: number, insert: Channels): void;
  setMeta(track: Id, set: Meta): void;
  addTrack(track: AudioTrack, index?: number): void;
  removeTrack(track: Id): void;
  moveTrack(track: Id, to: number): void;
  setChannels(track: Id, channels: Channels): void;
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
    splice: (track, at, remove, insert) => run({ type: 'splice', track, at, remove, insert }),
    setMeta: (track, set) => run({ type: 'meta', track, set }),
    addTrack: (track, index = doc.tracks.length) => run({ type: 'insert', index, track }),
    removeTrack: (track) => run({ type: 'remove', track }),
    moveTrack: (track, to) => run({ type: 'move', track, to }),
    setChannels: (track, channels) => run({ type: 'channels', track, channels }),
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

function withTrack(doc: AudioDoc, index: number, track: AudioTrack): AudioDoc {
  return { ...doc, tracks: doc.tracks.map((t, i) => (i === index ? track : t)) };
}

/** Samples in memory; samples still on disk are a mistake of the caller (load them first). */
function need(samples: Samples): Channels {
  if (!Array.isArray(samples))
    throw new Error('This undo step is on disk: load it (loadChange) before applying it.');
  return samples as Channels;
}

function applyOp(doc: AudioDoc, op: AudioOp): { doc: AudioDoc; inverse: AudioOp } {
  switch (op.type) {
    case 'splice': {
      const index = indexOf(doc, op.track);
      const track = doc.tracks[index]!;
      const length = track.channels[0]!.length;
      const insert = need(op.insert);
      if (insert.length !== track.channels.length)
        throw new RangeError('A splice needs one array per channel.');
      if (op.at < 0 || op.remove < 0 || op.at + op.remove > length)
        throw new RangeError('A splice must stay inside the track.');
      const removed = track.channels.map((c) => c.slice(op.at, op.at + op.remove));
      const channels = track.channels.map((c, ch) => {
        const added = insert[ch]!;
        const out = new Float32Array(length - op.remove + added.length);
        out.set(c.subarray(0, op.at), 0);
        out.set(added, op.at);
        out.set(c.subarray(op.at + op.remove), op.at + added.length);
        return out;
      });
      return {
        doc: withTrack(doc, index, { ...track, channels }),
        inverse: {
          type: 'splice',
          track: op.track,
          at: op.at,
          remove: insert[0]!.length,
          insert: removed,
        },
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
      tracks.splice(op.index, 0, { ...op.track, channels: need(op.track.channels) });
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
    case 'channels': {
      const index = indexOf(doc, op.track);
      const track = doc.tracks[index]!;
      return {
        doc: withTrack(doc, index, { ...track, channels: need(op.channels) }),
        inverse: { type: 'channels', track: op.track, channels: track.channels },
      };
    }
    case 'rate':
      return { doc: { ...doc, rate: op.rate }, inverse: { type: 'rate', rate: doc.rate } };
  }
}

/** For the History panel: the labels of what has been done, oldest first. */
export const historyLabels = (h: AudioHistory): string[] => h.past.map((c) => c.label);

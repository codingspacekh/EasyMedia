// Editing in Audio mode. Two ways, as students know them from the coursebooks and Video mode:
// - clips (A2, A5): split at the playhead, move, trim at the edges, join and delete clips;
// - a selected time range on one or more tracks (A5, A6, A15, Audacity style): cut, copy,
//   paste, trim, insert silence or apply an effect to it.
// Every function works through an AudioEdit, so it becomes one undoable step (history.ts).
import { EditError } from '../model/errors.ts';
import type { Seconds } from '../model/time.ts';
import type { Id } from '../model/types.ts';
import { mixDown, stereoToMono } from './dsp/channels.ts';
import { dbToGain } from './dsp/volume.ts';
import type { AudioEdit } from './history.ts';
import {
  clipChannels,
  clipEnd,
  clipLength,
  clipsInOrder,
  concatChannels,
  createClip,
  createTrack,
  matchChannels,
  silence,
  toSamples,
  trackEnd,
  trackStart,
  type AudioClip,
  type AudioDoc,
  type AudioTrack,
  type Channels,
} from './pcm.ts';

/** What the student has selected: a time range (start = end for just a cursor) on some tracks. */
export interface Selection {
  start: Seconds;
  end: Seconds;
  tracks: readonly Id[];
}

/** Copied sound (the clipboard). */
export interface CopiedSound {
  channels: Channels;
}

/** Makes ids for new clips. */
export type NewId = () => Id;

export const NO_TRACK = 'Select a track first: click on its waveform.';
export const NO_RANGE =
  'Select some sound first: drag across the waveform, or type the Selection start and end.';
export const NO_SOUND = 'There is no sound in the selection.';
export const NO_CLIP = 'Click a clip first to select it.';
export const OVERLAP =
  'This sound overlaps another clip on the same track. Move it to an empty place.';

/** Seconds rounded to a whole sample, so clips always line up with samples. */
const snap = (t: Seconds, rate: number): Seconds => toSamples(t, rate) / rate;

function selectedTracks(doc: AudioDoc, sel: Pick<Selection, 'tracks'>): AudioTrack[] {
  const tracks = doc.tracks.filter((t) => sel.tracks.includes(t.id));
  if (tracks.length === 0) throw new EditError(NO_TRACK);
  return tracks;
}

function needRange(sel: Selection): void {
  if (!(sel.end > sel.start)) throw new EditError(NO_RANGE);
}

const trackById = (doc: AudioDoc, id: Id): AudioTrack => doc.tracks.find((t) => t.id === id)!;

/** The clip and the track it is on. */
export function findClip(doc: AudioDoc, id: Id): { track: AudioTrack; clip: AudioClip } | null {
  for (const track of doc.tracks) {
    const clip = track.clips.find((c) => c.id === id);
    if (clip) return { track, clip };
  }
  return null;
}

function needClip(doc: AudioDoc, id: Id): { track: AudioTrack; clip: AudioClip } {
  const found = findClip(doc, id);
  if (!found)
    throw new EditError('This clip could not be found. It may already have been deleted.');
  return found;
}

/** First and last sample of a clip on the time line. */
function span(clip: AudioClip, rate: number): { s: number; e: number } {
  const s = toSamples(clip.offset, rate);
  return { s, e: s + clipLength(clip) };
}

/** Moves every clip of `track` that starts at or after `from` by `delta` seconds. */
function shiftFrom(tx: AudioEdit, trackId: Id, from: Seconds, delta: Seconds, except?: Id): void {
  if (delta === 0) return;
  const { rate } = tx.doc;
  for (const c of trackById(tx.doc, trackId).clips)
    if (c.id !== except && c.offset >= from - 0.5 / rate)
      tx.setClip(c.id, { offset: snap(Math.max(0, c.offset + delta), rate) });
}

// ---- clips ----

/**
 * Split: every clip of the given tracks under `time` becomes two clips (sharing the same
 * samples). Returns the ids of the new right-hand halves.
 */
export function splitAt(tx: AudioEdit, trackIds: readonly Id[], time: Seconds, newId: NewId): Id[] {
  const made: Id[] = [];
  for (const t of selectedTracks(tx.doc, { tracks: trackIds })) {
    const id = splitClipAt(tx, t.id, time, newId);
    if (id) made.push(id);
  }
  if (made.length === 0) throw new EditError('Move the playhead over a clip to split it.');
  return made;
}

/** Splits the clip of one track under `time` (not on an edge); null when there is none. */
function splitClipAt(tx: AudioEdit, trackId: Id, time: Seconds, newId: NewId): Id | null {
  const { rate } = tx.doc;
  const at = toSamples(time, rate);
  const clip = trackById(tx.doc, trackId).clips.find((c) => {
    const { s, e } = span(c, rate);
    return at > s && at < e;
  });
  if (!clip) return null;
  const cut = clip.in + at - span(clip, rate).s;
  const id = newId();
  tx.setClip(clip.id, { out: cut });
  tx.addClip(trackId, { id, offset: at / rate, source: clip.source, in: cut, out: clip.out });
  return id;
}

/** Whether `clip` would overlap another clip of `track` at `offset` with `length` samples. */
function overlaps(
  track: AudioTrack,
  id: Id,
  offset: Seconds,
  length: number,
  rate: number,
): boolean {
  const s = toSamples(offset, rate);
  return track.clips.some((c) => {
    if (c.id === id) return false;
    const o = span(c, rate);
    return s < o.e && o.s < s + length;
  });
}

/** Drag a clip along its track to start at `offset`. */
export function moveClip(tx: AudioEdit, id: Id, offset: Seconds): void {
  const { track, clip } = needClip(tx.doc, id);
  const to = snap(Math.max(0, offset), tx.doc.rate);
  if (overlaps(track, id, to, clipLength(clip), tx.doc.rate)) throw new EditError(OVERLAP);
  if (to !== clip.offset) tx.setClip(id, { offset: to });
}

/**
 * Drag a clip's start or end edge to `time`. Only the heard part changes, so the edge can be
 * dragged back out later. It stops at the next clip and at the clip's own samples, and keeps
 * at least one sample.
 */
export function trimClip(tx: AudioEdit, id: Id, side: 'start' | 'end', time: Seconds): void {
  const { track, clip } = needClip(tx.doc, id);
  const { rate } = tx.doc;
  const { s, e } = span(clip, rate);
  const others = track.clips.filter((c) => c.id !== id).map((c) => span(c, rate));
  let at = toSamples(time, rate);
  if (side === 'start') {
    const limit = Math.max(0, s - clip.in, ...others.filter((o) => o.e <= s).map((o) => o.e));
    at = Math.min(e - 1, Math.max(limit, at));
    if (at !== s) tx.setClip(id, { in: clip.in + at - s, offset: at / rate });
  } else {
    const limit = Math.min(
      s + clip.source[0]!.length - clip.in,
      ...others.filter((o) => o.s >= e).map((o) => o.s),
    );
    at = Math.max(s + 1, Math.min(limit, at));
    if (at !== e) tx.setClip(id, { out: clip.in + at - s });
  }
}

/** Delete the clips (the gap they leave stays, as on the video timeline). */
export function deleteClips(tx: AudioEdit, ids: readonly Id[]): void {
  if (ids.length === 0) throw new EditError(NO_CLIP);
  for (const id of ids) {
    needClip(tx.doc, id);
    tx.removeClip(id);
  }
}

/** Join a clip with the one that starts where it ends. */
export function joinClip(tx: AudioEdit, id: Id): void {
  const { track, clip } = needClip(tx.doc, id);
  const { rate } = tx.doc;
  const end = span(clip, rate).e;
  const next = track.clips.find((c) => c.id !== id && span(c, rate).s === end);
  if (!next)
    throw new EditError('There is no clip right after this one to join. Drag them together first.');
  tx.removeClip(next.id);
  if (next.source === clip.source && next.in === clip.out) {
    tx.setClip(id, { out: next.out }); // the two halves of a split: no samples copied
    return;
  }
  const joined = concatChannels(clipChannels(clip), clipChannels(next));
  tx.setSource(id, joined);
  tx.setClip(id, { in: 0, out: joined[0]!.length });
}

// ---- a selected time range ----

/** The sound of `track` from sample `a` to `b` (on the time line), silence in the gaps. */
function render(track: AudioTrack, rate: number, a: number, b: number): Float32Array[] {
  const out = silence(Math.max(0, b - a), track.channelCount);
  for (const clip of track.clips) {
    const { s, e } = span(clip, rate);
    const from = Math.max(a, s);
    const to = Math.min(b, e);
    if (to <= from) continue;
    clip.source.forEach((c, ch) =>
      out[ch]!.set(c.subarray(clip.in + from - s, clip.in + to - s), from - a),
    );
  }
  return out;
}

/**
 * The selected sound of a track (from its first to its last selected sample with sound,
 * silence in gaps), or null when the selection misses all its clips.
 */
export function soundIn(
  track: AudioTrack,
  rate: number,
  sel: Pick<Selection, 'start' | 'end'>,
): Float32Array[] | null {
  const a = toSamples(sel.start, rate);
  const b = toSamples(sel.end, rate);
  const hit = track.clips.map((c) => span(c, rate)).filter((o) => o.s < b && o.e > a);
  if (!hit.length) return null;
  const from = Math.max(a, Math.min(...hit.map((o) => o.s)));
  const to = Math.min(b, Math.max(...hit.map((o) => o.e)));
  return render(track, rate, from, to);
}

/** A5 Delete (and the second half of Cut): removes the selected time from the selected tracks. */
export function deleteRange(tx: AudioEdit, sel: Selection): void {
  needRange(sel);
  const { rate } = tx.doc;
  const a = toSamples(sel.start, rate);
  const b = toSamples(sel.end, rate);
  for (const t of selectedTracks(tx.doc, sel)) {
    for (const clip of t.clips) {
      const { s, e } = span(clip, rate);
      if (e <= a) continue; // all before the selection
      if (s >= b) {
        tx.setClip(clip.id, { offset: (s - (b - a)) / rate }); // after it: closes up
        continue;
      }
      const from = Math.max(a, s) - s;
      const to = Math.min(b, e) - s;
      if (from === 0 && to === clipLength(clip)) {
        tx.removeClip(clip.id);
        continue;
      }
      tx.splice(clip.id, from, to - from, silence(0, clip.source.length));
      if (s > a) tx.setClip(clip.id, { offset: a / rate });
    }
  }
}

/** A5 Copy: the selected part of the first selected track that has sound there. */
export function copyRange(doc: AudioDoc, sel: Selection): CopiedSound {
  needRange(sel);
  for (const t of selectedTracks(doc, sel)) {
    const sound = soundIn(t, doc.rate, sel);
    if (sound) return { channels: sound };
  }
  throw new EditError(NO_SOUND);
}

/**
 * Puts `channels` into a track at `time` as a new clip: a clip under `time` is split and
 * everything from `time` on moves later to make room.
 */
function insertAt(tx: AudioEdit, id: Id, time: Seconds, channels: Channels, newId: NewId): void {
  const { rate } = tx.doc;
  const t = trackById(tx.doc, id);
  const data = matchChannels(channels, t.channelCount);
  const at = snap(Math.max(0, time), rate);
  splitClipAt(tx, id, at, newId);
  shiftFrom(tx, id, at, data[0]!.length / rate);
  tx.addClip(id, createClip({ id: newId(), channels: data, offset: at }));
}

/** A5 / A6 Paste into the first selected track at the cursor, replacing a selection. */
export function paste(tx: AudioEdit, sel: Selection, copied: CopiedSound, newId: NewId): void {
  const [target] = selectedTracks(tx.doc, sel);
  if (sel.end > sel.start) deleteRange(tx, { ...sel, tracks: [target!.id] });
  insertAt(tx, target!.id, sel.start, copied.channels, newId);
}

/** A5 Trim to selection: keeps only the selected sound, where it is. */
export function trimToSelection(tx: AudioEdit, sel: Selection): void {
  needRange(sel);
  const { rate } = tx.doc;
  const a = toSamples(sel.start, rate);
  const b = toSamples(sel.end, rate);
  for (const t of selectedTracks(tx.doc, sel)) {
    for (const clip of t.clips) {
      const { s, e } = span(clip, rate);
      if (e <= a || s >= b) {
        tx.removeClip(clip.id);
        continue;
      }
      const set: Partial<AudioClip> = {};
      if (e > b) set.out = clip.in + b - s;
      if (s < a) Object.assign(set, { in: clip.in + a - s, offset: a / rate });
      if (Object.keys(set).length) tx.setClip(clip.id, set);
    }
  }
}

/** A5 Insert silence of `length` seconds at the cursor; a selection is replaced by it. */
export function insertSilence(tx: AudioEdit, sel: Selection, length: Seconds, newId: NewId): void {
  if (!(length > 0)) throw new EditError('The silence must be longer than 0 seconds.');
  const { rate } = tx.doc;
  for (const t of selectedTracks(tx.doc, sel)) {
    if (sel.end > sel.start) deleteRange(tx, { ...sel, tracks: [t.id] });
    insertAt(tx, t.id, sel.start, silence(toSamples(length, rate), t.channelCount), newId);
  }
}

/**
 * Runs an effect on the selected part of every clip in the selection. The effect may return a
 * different length (Change speed): the clips after it move up or back.
 */
export function applyToSelection(
  tx: AudioEdit,
  sel: Selection,
  process: (channels: Channels, rate: number) => Channels,
): void {
  needRange(sel);
  const { rate } = tx.doc;
  const a = toSamples(sel.start, rate);
  const b = toSamples(sel.end, rate);
  let applied = false;
  for (const t of selectedTracks(tx.doc, sel)) {
    // Last clip first, so moving the later clips never moves one still to be done.
    for (const clip of clipsInOrder(t).reverse()) {
      const { s, e } = span(clip, rate);
      const from = Math.max(a, s) - s;
      const to = Math.min(b, e) - s;
      if (to <= from) continue;
      const heard = clipChannels(clip).map((c) => c.subarray(from, to));
      const processed = process(heard, rate);
      tx.splice(clip.id, from, to - from, processed);
      const delta = processed[0]!.length - (to - from);
      shiftFrom(tx, t.id, clipEnd(clip, rate), delta / rate, clip.id);
      applied = true;
    }
  }
  if (!applied) throw new EditError(NO_SOUND);
}

/** A15 Mix stereo down to mono, for every selected stereo track. */
export function stereoToMonoTracks(tx: AudioEdit, ids: readonly Id[]): void {
  const stereo = tx.doc.tracks.filter((t) => ids.includes(t.id) && t.channelCount === 2);
  if (stereo.length === 0) throw new EditError('The selected track is already mono.');
  for (const t of stereo) {
    // Each clip's samples are mixed once, even when split clips share them.
    const done = new Map<Channels, Channels>();
    for (const clip of t.clips) {
      const mono = done.get(clip.source) ?? stereoToMono(clip.source);
      done.set(clip.source, mono);
      tx.setSource(clip.id, mono);
    }
    tx.setMeta(t.id, { channelCount: 1 });
  }
}

/** A2 Move track up (−1) or down (+1). */
export function moveTrackBy(tx: AudioEdit, id: Id, delta: number): void {
  const index = tx.doc.tracks.findIndex((t) => t.id === id);
  const to = Math.max(0, Math.min(tx.doc.tracks.length - 1, index + delta));
  if (index >= 0 && to !== index) tx.moveTrack(id, to);
}

/** Moves all the clips of a track so it starts at `start`. */
function startTrackAt(tx: AudioEdit, t: AudioTrack, start: Seconds): void {
  const delta = snap(start, tx.doc.rate) - trackStart(t);
  if (t.clips.length && delta !== 0) shiftFrom(tx, t.id, 0, delta);
}

/** A2 Align end to end (splice): each selected track starts where the one above it ends. */
export function alignEndToEnd(tx: AudioEdit, ids: readonly Id[]): void {
  const tracks = tx.doc.tracks.filter((t) => ids.includes(t.id));
  if (tracks.length < 2)
    throw new EditError('Select two or more tracks first (Ctrl/Cmd + A selects them all).');
  const { rate } = tx.doc;
  let end = trackEnd(tracks[0]!, rate);
  for (const t of tracks.slice(1)) {
    startTrackAt(tx, t, end);
    end = trackEnd(trackById(tx.doc, t.id), rate) || end;
  }
}

/** A2 Align start to the cursor (or to zero). */
export function alignStartTo(tx: AudioEdit, ids: readonly Id[], time: Seconds): void {
  for (const t of tx.doc.tracks) if (ids.includes(t.id)) startTrackAt(tx, t, Math.max(0, time));
}

/** Where the last track ends: the length of the whole mix. */
export function docDuration(doc: AudioDoc): Seconds {
  return Math.max(0, ...doc.tracks.map((t) => trackEnd(t, doc.rate)));
}

/**
 * The tracks mixed together with their gain and pan, clipped to −1…1 (for Mix and render,
 * playback and export). Starts at `from` (default: where the earliest track starts). A mix is
 * stereo when any track is stereo or panned, unless `channels` says otherwise.
 */
export function mixTracks(
  doc: AudioDoc,
  tracks: readonly AudioTrack[],
  options: { from?: Seconds; channels?: number } = {},
): { channels: Float32Array[]; start: Seconds } {
  const { rate } = doc;
  const sounding = tracks.filter((t) => t.clips.length > 0);
  const count =
    options.channels ?? (sounding.some((t) => t.channelCount === 2 || t.pan !== 0) ? 2 : 1);
  const starts = sounding.map((t) => toSamples(trackStart(t), rate));
  const first = options.from !== undefined ? toSamples(options.from, rate) : Math.min(...starts);
  const last = Math.max(first, ...sounding.map((t) => toSamples(trackEnd(t, rate), rate)));
  const parts = sounding.flatMap((t) => {
    const g = dbToGain(t.gain);
    const gains = count === 2 ? [g * (1 - Math.max(0, t.pan)), g * (1 + Math.min(0, t.pan))] : [g];
    return t.clips.map((c) => ({
      at: toSamples(c.offset, rate) - first,
      channels: clipChannels(c),
      gains,
    }));
  });
  return {
    channels: mixDown(parts, count, sounding.length ? last - first : 0),
    start: sounding.length ? first / rate : 0,
  };
}

/** A6 Mix and render the selected tracks into one track (in place of them, or as a new track). */
export function mixAndRender(
  tx: AudioEdit,
  ids: readonly Id[],
  { id, name, newTrack = false }: { id: Id; name: string; newTrack?: boolean },
): void {
  const tracks = tx.doc.tracks.filter((t) => ids.includes(t.id));
  if (tracks.length === 0) throw new EditError(NO_TRACK);
  const sounding = tracks.filter((t) => t.clips.length > 0);
  if (sounding.length === 0) throw new EditError(NO_SOUND);
  const mix = mixTracks(tx.doc, sounding);
  const bits = Math.max(0, ...tracks.map((t) => t.bits ?? 0));
  const mixed = createTrack({
    id,
    name,
    channels: mix.channels,
    offset: mix.start,
    ...(bits ? { bits } : {}),
  });
  if (newTrack) {
    tx.addTrack(mixed);
    return;
  }
  const index = tx.doc.tracks.findIndex((t) => t.id === tracks[0]!.id);
  for (const t of tracks) tx.removeTrack(t.id);
  tx.addTrack(mixed, index);
}

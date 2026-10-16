// Audacity-style editing (A2, A5, A6, A15): select a time range on one or more tracks, then cut,
// copy, paste, trim, insert silence or apply an effect to it. Every function works through an
// AudioEdit, so it becomes one undoable step (history.ts).
import { EditError } from '../model/errors.ts';
import type { Seconds } from '../model/time.ts';
import type { Id } from '../model/types.ts';
import { mixDown, stereoToMono } from './dsp/channels.ts';
import { dbToGain } from './dsp/volume.ts';
import type { AudioEdit } from './history.ts';
import {
  concatChannels,
  createTrack,
  matchChannels,
  silence,
  sliceChannels,
  toSamples,
  trackEnd,
  trackLength,
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
export interface AudioClip {
  channels: Channels;
}

export const NO_TRACK = 'Select a track first: click on its waveform.';
export const NO_RANGE =
  'Select some sound first: drag across the waveform, or type the Selection start and end.';
export const NO_SOUND = 'There is no sound in the selection.';

/** Seconds rounded to a whole sample, so tracks always line up with samples. */
const snap = (t: Seconds, rate: number): Seconds => toSamples(t, rate) / rate;

function selectedTracks(doc: AudioDoc, sel: Selection): AudioTrack[] {
  const tracks = doc.tracks.filter((t) => sel.tracks.includes(t.id));
  if (tracks.length === 0) throw new EditError(NO_TRACK);
  return tracks;
}

function needRange(sel: Selection): void {
  if (!(sel.end > sel.start)) throw new EditError(NO_RANGE);
}

function track(tx: AudioEdit, id: Id): AudioTrack {
  return tx.doc.tracks.find((t) => t.id === id)!;
}

/** The selected samples [from, to) inside a track, or null when the selection misses its sound. */
export function rangeIn(
  t: AudioTrack,
  rate: number,
  sel: Pick<Selection, 'start' | 'end'>,
): { from: number; to: number } | null {
  const start = toSamples(t.offset, rate);
  const length = trackLength(t);
  const clamp = (n: number) => Math.max(0, Math.min(length, n));
  const from = clamp(toSamples(sel.start, rate) - start);
  const to = clamp(toSamples(sel.end, rate) - start);
  return to > from ? { from, to } : null;
}

/** A5 Delete (and the second half of Cut): removes the selected time from the selected tracks. */
export function deleteRange(tx: AudioEdit, sel: Selection): void {
  needRange(sel);
  const { rate } = tx.doc;
  const a = toSamples(sel.start, rate);
  const b = toSamples(sel.end, rate);
  for (const t of selectedTracks(tx.doc, sel)) {
    const s = toSamples(t.offset, rate);
    const length = trackLength(t);
    if (s + length <= a) continue; // all before the selection
    if (s >= b) {
      tx.setMeta(t.id, { offset: (s - (b - a)) / rate }); // after it: closes up
      continue;
    }
    const from = Math.max(0, a - s);
    const to = Math.min(length, b - s);
    tx.splice(t.id, from, to - from, silence(0, t.channels.length));
    if (s > a) tx.setMeta(t.id, { offset: a / rate });
  }
}

/** A5 Copy: the selected part of the first selected track that has sound there. */
export function copyRange(doc: AudioDoc, sel: Selection): AudioClip {
  needRange(sel);
  for (const t of selectedTracks(doc, sel)) {
    const r = rangeIn(t, doc.rate, sel);
    if (r) return { channels: sliceChannels(t.channels, r.from, r.to) };
  }
  throw new EditError(NO_SOUND);
}

/**
 * Puts `channels` into a track at `time`, pushing later sound on. Before the start or after the
 * end of the sound, the gap is filled with silence. An empty track starts at `time`.
 */
function insertAt(tx: AudioEdit, id: Id, time: Seconds, channels: Channels): void {
  const t = track(tx, id);
  const { rate } = tx.doc;
  const data = matchChannels(channels, t.channels.length);
  const length = trackLength(t);
  if (length === 0) {
    tx.setChannels(id, data);
    tx.setMeta(id, { offset: snap(Math.max(0, time), rate) });
    return;
  }
  const at = toSamples(time, rate) - toSamples(t.offset, rate);
  const count = t.channels.length;
  if (at < 0) {
    tx.splice(id, 0, 0, concatChannels(data, silence(-at, count)));
    tx.setMeta(id, { offset: snap(time, rate) });
  } else if (at > length) {
    tx.splice(id, length, 0, concatChannels(silence(at - length, count), data));
  } else {
    tx.splice(id, at, 0, data);
  }
}

/** A5 / A6 Paste into the first selected track at the cursor, replacing a selection. */
export function paste(tx: AudioEdit, sel: Selection, clip: AudioClip): void {
  const [target] = selectedTracks(tx.doc, sel);
  if (sel.end > sel.start) deleteRange(tx, { ...sel, tracks: [target!.id] });
  insertAt(tx, target!.id, sel.start, clip.channels);
}

/** A5 Trim to selection: keeps only the selected sound, where it is. */
export function trimToSelection(tx: AudioEdit, sel: Selection): void {
  needRange(sel);
  const { rate } = tx.doc;
  for (const t of selectedTracks(tx.doc, sel)) {
    const length = trackLength(t);
    const r = rangeIn(t, rate, sel);
    const empty = silence(0, t.channels.length);
    if (!r) {
      if (length > 0) tx.splice(t.id, 0, length, empty);
      continue;
    }
    if (r.to < length) tx.splice(t.id, r.to, length - r.to, empty);
    if (r.from > 0) {
      tx.splice(t.id, 0, r.from, empty);
      tx.setMeta(t.id, { offset: (toSamples(t.offset, rate) + r.from) / rate });
    }
  }
}

/** A5 Insert silence of `length` seconds at the cursor; a selection is replaced by it. */
export function insertSilence(tx: AudioEdit, sel: Selection, length: Seconds): void {
  if (!(length > 0)) throw new EditError('The silence must be longer than 0 seconds.');
  const { rate } = tx.doc;
  for (const t of selectedTracks(tx.doc, sel)) {
    if (sel.end > sel.start) deleteRange(tx, { ...sel, tracks: [t.id] });
    insertAt(tx, t.id, sel.start, silence(toSamples(length, rate), t.channels.length));
  }
}

/**
 * Runs an effect on the selected part of every selected track. The effect may return a
 * different length (Change speed): the sound after it moves up or back.
 */
export function applyToSelection(
  tx: AudioEdit,
  sel: Selection,
  process: (channels: Channels, rate: number) => Channels,
): void {
  needRange(sel);
  const { rate } = tx.doc;
  let applied = false;
  for (const t of selectedTracks(tx.doc, sel)) {
    const r = rangeIn(t, rate, sel);
    if (!r) continue;
    tx.splice(t.id, r.from, r.to - r.from, process(sliceChannels(t.channels, r.from, r.to), rate));
    applied = true;
  }
  if (!applied) throw new EditError(NO_SOUND);
}

/** A15 Mix stereo down to mono, for every selected stereo track. */
export function stereoToMonoTracks(tx: AudioEdit, ids: readonly Id[]): void {
  const stereo = tx.doc.tracks.filter((t) => ids.includes(t.id) && t.channels.length === 2);
  if (stereo.length === 0) throw new EditError('The selected track is already mono.');
  for (const t of stereo) tx.setChannels(t.id, stereoToMono(t.channels));
}

/** A2 Move track up (−1) or down (+1). */
export function moveTrackBy(tx: AudioEdit, id: Id, delta: number): void {
  const index = tx.doc.tracks.findIndex((t) => t.id === id);
  const to = Math.max(0, Math.min(tx.doc.tracks.length - 1, index + delta));
  if (index >= 0 && to !== index) tx.moveTrack(id, to);
}

/** A2 Align end to end (splice): each selected track starts where the one above it ends. */
export function alignEndToEnd(tx: AudioEdit, ids: readonly Id[]): void {
  const tracks = tx.doc.tracks.filter((t) => ids.includes(t.id));
  if (tracks.length < 2)
    throw new EditError('Select two or more tracks first (Ctrl/Cmd + A selects them all).');
  const { rate } = tx.doc;
  let end = trackEnd(tracks[0]!, rate);
  for (const t of tracks.slice(1)) {
    const offset = snap(end, rate);
    if (offset !== t.offset) tx.setMeta(t.id, { offset });
    end = offset + trackLength(t) / rate;
  }
}

/** A2 Align start to the cursor (or to zero). */
export function alignStartTo(tx: AudioEdit, ids: readonly Id[], time: Seconds): void {
  const offset = snap(Math.max(0, time), tx.doc.rate);
  for (const t of tx.doc.tracks)
    if (ids.includes(t.id) && t.offset !== offset) tx.setMeta(t.id, { offset });
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
  const count =
    options.channels ?? (tracks.some((t) => t.channels.length === 2 || t.pan !== 0) ? 2 : 1);
  const starts = tracks.map((t) => toSamples(t.offset, rate));
  const first = options.from !== undefined ? toSamples(options.from, rate) : Math.min(...starts);
  const last = Math.max(first, ...tracks.map((t, i) => starts[i]! + trackLength(t)));
  const parts = tracks.map((t, i) => {
    const g = dbToGain(t.gain);
    const gains = count === 2 ? [g * (1 - Math.max(0, t.pan)), g * (1 + Math.min(0, t.pan))] : [g];
    return { at: starts[i]! - first, channels: t.channels, gains };
  });
  return {
    channels: mixDown(parts, count, tracks.length ? last - first : 0),
    start: tracks.length ? first / rate : 0,
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
  if (tracks.every((t) => trackLength(t) === 0)) throw new EditError(NO_SOUND);
  const sounding = tracks.filter((t) => trackLength(t) > 0);
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

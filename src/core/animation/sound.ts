// AN28: sounds in an animation (syllabus 20.1: sound is a secondary component). Each sound is a
// file or a built-in sound effect heard from a frame, trimmed, louder or quieter, faded in and
// out; several may overlap and are mixed. The rules for a sound, the mix the app plays while
// the animation plays, where each sound goes in an export (FFmpeg) and when the web page plays
// each one are worked out here, so every one of them hears the same thing.
import { EditError } from '../model/errors.ts';
import type { AnimSound, AnimationDoc } from './types.ts';

/** The loudest a sound can be made: twice as loud as its file. */
export const MAX_VOLUME = 200;

/** The file types a sound can be added from (the ones Audio mode opens). */
export const SOUND_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] as const;

const seconds = (s: number) => `${Math.round(s * 100) / 100} s`;

/** The seconds of the file that are heard (after the trim). */
export const heardSeconds = (s: AnimSound): number =>
  Math.max(0, s.length ?? s.duration - (s.offset ?? 0));

/** The frame after the last one the sound is heard in (where its bar ends on the timeline). */
export const endFrame = (s: AnimSound, fps: number): number => s.start + heardSeconds(s) * fps;

/** Why a sound cannot be kept as it is (an EditError the student can act on), or nothing. */
export function validateSound(s: AnimSound): void {
  if (!Number.isInteger(s.start) || s.start < 0)
    throw new EditError('A sound starts at frame 0 or later.');
  if (!(s.volume >= 0 && s.volume <= MAX_VOLUME))
    throw new EditError(`The volume must be between 0 and ${MAX_VOLUME} %.`);
  const offset = s.offset ?? 0;
  if (!(offset >= 0) || offset >= s.duration)
    throw new EditError(
      `The sound is ${seconds(s.duration)} long: start it in the file before its end.`,
    );
  const left = s.duration - offset;
  if (s.length !== undefined && !(s.length >= 0.01 && s.length <= left + 1e-6))
    throw new EditError(`The length must be between 0.01 s and ${seconds(left)} (what is left).`);
  const fadeIn = s.fadeIn ?? 0;
  const fadeOut = s.fadeOut ?? 0;
  if (!(fadeIn >= 0) || !(fadeOut >= 0)) throw new EditError('A fade cannot be less than 0 s.');
  if (fadeIn + fadeOut > heardSeconds(s) + 1e-6)
    throw new EditError(
      `The fades together cannot be longer than the sound (${seconds(heardSeconds(s))}).`,
    );
}

/** The sounds that are heard: not muted and not at 0 %. */
export const soundsHeard = (doc: AnimationDoc): AnimSound[] =>
  (doc.sounds ?? []).filter((s) => !s.muted && s.volume > 0);

/** How loud (0–2) the sound is `t` seconds into the part heard, with its fades. */
export function gainAt(s: AnimSound, t: number): number {
  const heard = heardSeconds(s);
  let gain = s.volume / 100;
  if (s.fadeIn && t < s.fadeIn) gain *= Math.max(0, t / s.fadeIn);
  if (s.fadeOut && t > heard - s.fadeOut) gain *= Math.max(0, (heard - t) / s.fadeOut);
  return gain;
}

/**
 * AN15: a sound in an exported video. FFmpeg reads `heard` seconds of the file from `offset`,
 * sets its volume and fades as the sound has them, cuts `cut` seconds from its front (an export
 * that starts after the sound did) and keeps `duration` seconds, placed `at` seconds into the
 * video.
 */
export interface SoundPiece {
  path: string;
  offset: number;
  heard: number;
  /** 0–2. */
  volume: number;
  fadeIn: number;
  fadeOut: number;
  cut: number;
  duration: number;
  at: number;
}

/**
 * The sounds heard in the frames `first` to `last` (both exported), as pieces placed in the
 * export's own time: a sound running before `first` joins in part-way, and one running past the
 * end is cut there.
 */
export function soundPieces(
  doc: AnimationDoc,
  first = 0,
  last = doc.stage.length - 1,
): SoundPiece[] {
  const { fps } = doc.stage;
  const begin = first / fps;
  const end = (last + 1) / fps;
  return soundsHeard(doc).flatMap((s) => {
    const start = s.start / fps;
    const heard = heardSeconds(s);
    const from = Math.max(begin, start);
    const to = Math.min(end, start + heard);
    if (to - from < 0.001) return [];
    return [
      {
        path: s.path,
        offset: s.offset ?? 0,
        heard,
        volume: s.volume / 100,
        fadeIn: s.fadeIn ?? 0,
        fadeOut: s.fadeOut ?? 0,
        cut: from - start,
        duration: to - from,
        at: from - begin,
      },
    ];
  });
}

/**
 * AN28: what the web page starts when it plays from `frame` (until frame `end`, not shown): each
 * sound heard then, `wait` seconds from now, from `into` seconds of its heard part (`from`
 * seconds into its file), for `duration` seconds, with the gain at the points of its fades
 * (seconds from its own start, joined by straight lines).
 */
export interface PageSound {
  id: string;
  wait: number;
  into: number;
  from: number;
  duration: number;
  gains: { t: number; gain: number }[];
}

export function pageSounds(doc: AnimationDoc, frame: number, end: number): PageSound[] {
  const { fps } = doc.stage;
  const now = frame / fps;
  const stop = end / fps;
  return soundsHeard(doc).flatMap((s) => {
    const start = s.start / fps;
    const heard = heardSeconds(s);
    const from = Math.max(now, start);
    const to = Math.min(stop, start + heard);
    if (to - from < 0.001) return [];
    const into = from - start;
    const duration = to - from;
    // The gain where it starts, at the ends of its fades, and where it stops.
    const marks = [into, s.fadeIn ?? 0, heard - (s.fadeOut ?? 0), into + duration]
      .filter((t) => t >= into && t <= into + duration)
      .sort((a, b) => a - b)
      .filter((t, i, all) => i === 0 || t - all[i - 1]! > 1e-6);
    return [
      {
        id: s.id,
        wait: from - now,
        into,
        from: (s.offset ?? 0) + into,
        duration,
        gains: marks.map((t) => ({ t: t - into, gain: gainAt(s, t) })),
      },
    ];
  });
}

/** Decoded samples of a sound: one array per channel (a mono sound is heard on both sides). */
export interface SoundSamples {
  sampleRate: number;
  channels: readonly Float32Array[];
}

/**
 * AN28: the animation's sound, stereo at `rate`, from frame `first` to frame `end` (not heard),
 * every sound heard there mixed with its volume and fades — what the app plays while the
 * animation plays. A sound whose samples are not known (still loading, not found) is left out.
 */
export function mixSounds(
  doc: AnimationDoc,
  samplesOf: (sound: AnimSound) => SoundSamples | null,
  rate: number,
  first: number,
  end: number,
): Float32Array[] {
  const { fps } = doc.stage;
  const length = Math.max(0, Math.round(((end - first) / fps) * rate));
  const out = [new Float32Array(length), new Float32Array(length)];
  const begin = first / fps;
  for (const s of soundsHeard(doc)) {
    const samples = samplesOf(s);
    if (!samples || samples.channels.length === 0) continue;
    const start = s.start / fps;
    const heard = heardSeconds(s);
    const from = Math.max(0, Math.ceil((start - begin) * rate));
    const to = Math.min(length, Math.floor((start + heard - begin) * rate));
    const offset = s.offset ?? 0;
    for (let i = from; i < to; i++) {
      const t = begin + i / rate - start;
      const k = Math.floor((offset + t) * samples.sampleRate);
      const gain = gainAt(s, t);
      for (let ch = 0; ch < 2; ch++) {
        const source = samples.channels[Math.min(ch, samples.channels.length - 1)]!;
        if (k < source.length) out[ch]![i]! += source[k]! * gain;
      }
    }
  }
  return out;
}

/** T7: rough bytes a second of each kind of sound file (WAV: 48 kHz, 16 bits, stereo). */
const FILE_BYTES_PER_SECOND: Record<string, number> = {
  wav: 192_000,
  flac: 100_000,
  mp3: 16_000,
  m4a: 16_000,
  aac: 16_000,
  ogg: 16_000,
};

/** T7: the estimated size of the sound files the web page carries inside it. */
export function soundFileBytes(doc: AnimationDoc): number {
  return soundsHeard(doc).reduce((sum, s) => {
    const ext = /\.(\w+)$/.exec(s.path)?.[1]?.toLowerCase() ?? '';
    return sum + s.duration * (FILE_BYTES_PER_SECOND[ext] ?? 16_000);
  }, 0);
}

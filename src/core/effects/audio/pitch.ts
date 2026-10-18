// A9 Change pitch: higher or lower, the length stays the same. Set by key (from C to F, up or
// down, as Audacity), by semitones or by percent; the three stay in step.
import { changePitch } from '../../audio/dsp/pitch.ts';
import type { AudioEffectDef, Params } from '../types.ts';

const KEYS = [
  'C',
  'C♯ / D♭',
  'D',
  'D♯ / E♭',
  'E',
  'F',
  'F♯ / G♭',
  'G',
  'G♯ / A♭',
  'A',
  'A♯ / B♭',
  'B',
] as const;
const UP = 0;
const DOWN = 1;

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const toPercent = (semitones: number) => round((2 ** (semitones / 12) - 1) * 100, 2);
/** The key's note in the middle octave (A = 440 Hz). */
const frequency = (key: number) => 440 * 2 ** ((key - 9) / 12);

/** The "to" key and the direction that a number of semitones means. */
function keysFor(params: Params, semitones: number): Params {
  const toKey = (((params.fromKey! + Math.round(semitones)) % 12) + 12) % 12;
  return { ...params, semitones, toKey, direction: semitones < 0 ? DOWN : UP };
}

export const pitch: AudioEffectDef = {
  id: 'audio.pitch',
  label: 'Change pitch…',
  group: 'Time & pitch',
  syllabus: '11.2 changing the pitch',
  why: 'Changing the pitch makes a sound higher or lower without making it longer or shorter. Two clips recorded in different keys can be brought into the same key so they sound right together, and a voice can be made deeper or lighter. The pitch is the frequency of the sound: the higher the frequency, the higher the pitch.',
  params: {
    fromKey: { label: 'From key', min: 0, max: 11, step: 1, default: 0, choices: KEYS },
    toKey: { label: 'To key', min: 0, max: 11, step: 1, default: 0, choices: KEYS },
    direction: {
      label: 'Direction',
      min: 0,
      max: 1,
      step: 1,
      default: UP,
      choices: ['Up', 'Down'],
    },
    semitones: { label: 'Semitones', min: -24, max: 24, step: 0.01, default: 0 },
    percent: { label: 'Percent change', unit: '%', min: -75, max: 300, step: 0.01, default: 0 },
  },
  link(params, changed) {
    if (changed === 'semitones')
      return { ...keysFor(params, params.semitones!), percent: toPercent(params.semitones!) };
    if (changed === 'percent') {
      const semitones = round(12 * Math.log2(1 + params.percent! / 100), 2);
      return keysFor(params, semitones);
    }
    if (changed === 'fromKey' || changed === 'toKey' || changed === 'direction') {
      const gap = (((params.toKey! - params.fromKey!) % 12) + 12) % 12;
      const semitones = params.direction === DOWN && gap > 0 ? gap - 12 : gap;
      return { ...params, semitones, percent: toPercent(semitones) };
    }
    return params;
  },
  note(_channels, _rate, { fromKey, semitones }) {
    const from = frequency(fromKey!);
    const to = from * 2 ** (semitones! / 12);
    return `Frequency: ${from.toFixed(1)} Hz → ${to.toFixed(1)} Hz. The length stays the same.`;
  },
  process: (channels, rate, { semitones }) => changePitch(channels, rate, semitones!),
};

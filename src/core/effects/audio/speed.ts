// A8 Change speed: faster or slower, and higher or lower, like a record at another speed.
import { changeSpeed } from '../../audio/dsp/speed.ts';
import type { AudioEffectDef } from '../types.ts';

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

export const speed: AudioEffectDef = {
  id: 'audio.speed',
  label: 'Change speed…',
  group: 'Time & pitch',
  syllabus: '11.2 altering clip speed',
  why: 'Changing the speed plays the sound faster or slower, like a record at another speed, so the pitch changes too: a faster voice sounds squeaky and fun, slower music can feel more relaxing, and musicians slow a song down to practise it. The length changes as well.',
  params: {
    speed: { label: 'Speed multiplier', min: 0.1, max: 10, step: 0.001, default: 1 },
    percent: { label: 'Percent change', unit: '%', min: -90, max: 900, step: 0.1, default: 0 },
  },
  link: (params, changed) =>
    changed === 'percent'
      ? { ...params, speed: round(1 + params.percent! / 100, 3) }
      : { ...params, percent: round((params.speed! - 1) * 100, 1) },
  note(channels, rate, { speed: s }) {
    const before = channels[0]!.length / rate;
    return `Length: ${before.toFixed(2)} s → ${(before / s!).toFixed(2)} s`;
  },
  process: (channels, _rate, { speed: s }) => changeSpeed(channels, s!),
};

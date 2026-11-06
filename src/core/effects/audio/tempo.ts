// A21 Change tempo: faster or slower, the pitch stays the same (as Audacity's Change Tempo).
// Change speed (A8) changes both, like a record; Change pitch (A9) changes only the pitch.
import { changeTempo } from '../../audio/dsp/pitch.ts';
import type { AudioEffectDef } from '../types.ts';

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

export const tempo: AudioEffectDef = {
  id: 'audio.tempo',
  label: 'Change tempo…',
  group: 'Time & pitch',
  syllabus: '11.2 altering clip speed',
  why: 'Changing the tempo makes a sound faster or slower without changing its pitch, so a voice still sounds like the same person. Speech can be sped up to fit the time it has without sounding squeaky, for example a voiceover a few seconds too long, and a song can be slowed down to learn it in the same key. The length changes; Change speed changes the pitch as well.',
  params: {
    tempo: { label: 'Tempo multiplier', min: 0.1, max: 10, step: 0.001, default: 1 },
    percent: { label: 'Percent change', unit: '%', min: -90, max: 900, step: 0.1, default: 0 },
  },
  link: (params, changed) =>
    changed === 'percent'
      ? { ...params, tempo: round(1 + params.percent! / 100, 3) }
      : { ...params, percent: round((params.tempo! - 1) * 100, 1) },
  note(channels, rate, { tempo: t }) {
    const before = channels[0]!.length / rate;
    return `Length: ${before.toFixed(2)} s → ${(before / t!).toFixed(2)} s. The pitch stays the same.`;
  },
  process: (channels, rate, { tempo: t }) => changeTempo(channels, rate, t!),
};

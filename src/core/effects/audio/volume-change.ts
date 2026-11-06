// A23 Volume change: from one volume to another across the selection (as Audacity's Adjustable
// Fade), e.g. the music from 100 % down to 30 % before a voice starts. A straight line in %:
// the same rule as Video mode's volume changes and the volume boxes, which are all in %.
import { peak, volumeRamp } from '../../audio/dsp/volume.ts';
import type { AudioEffectDef } from '../types.ts';

export const volumeChange: AudioEffectDef = {
  id: 'audio.volumechange',
  label: 'Volume change…',
  group: 'Volume',
  syllabus: '11.2 fading in and out',
  why: 'A volume change makes the selected sound get gradually quieter or louder, from one volume to another, for example the music from 100 % down to 30 % just before a voice starts, so the voice can be heard over it. Unlike a fade, it does not have to go all the way to silence, and the change is smooth instead of sudden.',
  params: {
    from: { label: 'Volume at the start', unit: '%', min: 0, max: 400, step: 1, default: 100 },
    to: { label: 'Volume at the end', unit: '%', min: 0, max: 400, step: 1, default: 30 },
  },
  note(channels, rate, { from, to }) {
    if (Math.max(from!, to!) > 100 && peak(channels) * (Math.max(from!, to!) / 100) > 1)
      return 'The loudest parts will clip (distort) at this volume. Use a lower volume.';
    const seconds = channels[0]!.length / rate;
    return `The volume goes in a straight line from ${from} % at the start of the selection to ${to} % at its end (${seconds.toFixed(2)} s).`;
  },
  process: (channels, _rate, { from, to }) => volumeRamp(channels, from! / 100, to! / 100),
};

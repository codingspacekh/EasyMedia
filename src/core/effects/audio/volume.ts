// A3, A4, A7: Amplify, Normalise, Fade in and Fade out on the selected sound.
import {
  amplify as gain,
  fadeIn as rampUp,
  fadeOut as rampDown,
  gainToDb,
  maxGainDb,
  normalise as level,
  peak,
} from '../../audio/dsp/volume.ts';
import { EditError } from '../../model/errors.ts';
import type { AudioEffectDef } from '../types.ts';

const db = (value: number) => `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)} dB`;

export const amplify: AudioEffectDef = {
  id: 'audio.amplify',
  label: 'Amplify…',
  group: 'Volume',
  syllabus: '11.2 amplify',
  why: 'Amplify makes the selected sound louder or quieter by a number of decibels (dB). Use it to balance parts recorded at different volumes, or lower the music (about −6 dB) so a voiceover can be heard. The value suggested makes the loudest part as loud as it can be without clipping (distortion).',
  params: {
    gain: { label: 'Amplification', unit: 'dB', min: -50, max: 50, step: 0.01, default: 0 },
    allowClipping: { label: 'Allow clipping', min: 0, max: 1, step: 1, default: 0, toggle: true },
  },
  // Rounded down, so the suggestion itself never clips.
  suggest: (channels, params) => ({ ...params, gain: Math.floor(maxGainDb(channels) * 100) / 100 }),
  check(channels, { gain: g, allowClipping }) {
    const most = maxGainDb(channels);
    if (!allowClipping && peak(channels) > 0 && g! > most + 1e-6)
      throw new EditError(
        `This would clip (distort) the loudest parts. Use at most ${most.toFixed(2)} dB, or tick Allow clipping.`,
      );
  },
  note(channels, _rate, { gain: g }) {
    const p = peak(channels);
    return p === 0 ? 'The selection is silent.' : `New peak amplitude: ${db(gainToDb(p) + g!)}`;
  },
  process: (channels, _rate, { gain: g }) => gain(channels, g!),
};

export const normalise: AudioEffectDef = {
  id: 'audio.normalise',
  label: 'Normalise…',
  group: 'Volume',
  syllabus: '11.2 normalising, removing DC offset',
  why: 'Normalising makes a quiet recording louder: it finds the loudest peak and raises everything by the same amount, so that peak reaches the level you choose (0 dB or just below). Removing the DC offset centres the waveform on the 0 line again; an offset, often caused by a faulty recording device, causes clicks, distortion and a loss of volume.',
  params: {
    removeDc: { label: 'Remove DC offset', min: 0, max: 1, step: 1, default: 1, toggle: true },
    normalisePeak: {
      label: 'Normalise the peak',
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      toggle: true,
    },
    peak: { label: 'Maximum peak', unit: 'dB', min: -50, max: 6, step: 0.1, default: -1 },
  },
  note: (_channels, _rate, { peak: p, normalisePeak }) =>
    normalisePeak && p! > 0
      ? 'Above 0 dB the loudest parts are clipped: they will sound distorted.'
      : null,
  process: (channels, _rate, { removeDc, normalisePeak, peak: p }) =>
    level(channels, { peakDb: normalisePeak ? p! : null, removeDc: Boolean(removeDc) }),
};

export const fadeIn: AudioEffectDef = {
  id: 'audio.fadein',
  label: 'Fade in',
  group: 'Volume',
  syllabus: '11.2 fading in and out',
  why: 'A sound that starts suddenly can feel harsh. Fading in gives a softer, gentler start, for example when the beginning of a recording is not smooth.',
  params: {},
  process: (channels) => rampUp(channels),
};

export const fadeOut: AudioEffectDef = {
  id: 'audio.fadeout',
  label: 'Fade out',
  group: 'Volume',
  syllabus: '11.2 fading in and out',
  why: 'Fading out gives a smooth, gentle end, for example when a piece of music has no clear ending or has to stop at the end of a video.',
  params: {},
  process: (channels) => rampDown(channels),
};

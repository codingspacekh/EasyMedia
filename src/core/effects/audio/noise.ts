// A13 Noise reduction, in two steps as Audacity: get a noise profile, then reduce.
import { reduceNoise } from '../../audio/dsp/noise.ts';
import { EditError } from '../../model/errors.ts';
import type { AudioEffectDef } from '../types.ts';

export const NEED_PROFILE =
  'First get a noise profile: select a part with only background noise, then click Get noise profile.';

export const noiseReduction: AudioEffectDef = {
  id: 'audio.noise',
  label: 'Noise reduction…',
  group: 'Repair & channels',
  syllabus: '11.2 noise reduction',
  why: 'Noise reduction removes background sound that is there all the time, such as hiss, hum, buzzing or fan noise. It cannot remove sounds that come and go, such as traffic, clicks or an audience. First it learns what the noise sounds like from a part with only noise; then it turns down whatever is no louder than that noise.',
  needsNoiseProfile: true,
  params: {
    reductionDb: { label: 'Noise reduction', unit: 'dB', min: 0, max: 48, step: 1, default: 12 },
    sensitivity: { label: 'Sensitivity', min: 0, max: 24, step: 0.01, default: 6 },
    smoothing: { label: 'Frequency smoothing (bands)', min: 0, max: 12, step: 1, default: 3 },
    output: {
      label: 'Result',
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      choices: ['Reduce noise', 'Hear only what is removed'],
    },
  },
  note: (_channels, _rate, { reductionDb, sensitivity }) =>
    `The noise becomes ${reductionDb} dB quieter; sound more than ${sensitivity} dB louder than the noise is kept.`,
  process(channels, rate, params, context) {
    if (!context?.noiseProfile) throw new EditError(NEED_PROFILE);
    return reduceNoise(channels, rate, context.noiseProfile, {
      reductionDb: params.reductionDb!,
      sensitivity: params.sensitivity!,
      smoothing: params.smoothing!,
      residue: params.output === 1,
    });
  },
};

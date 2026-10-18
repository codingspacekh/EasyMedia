// A10 Echo and Delay: the sound repeated after a delay, each repeat quieter (the decay).
import {
  delay as repeat,
  echo as feedback,
  echoTimes,
  type DelayType,
} from '../../audio/dsp/echo.ts';
import { gainToDb, peak } from '../../audio/dsp/volume.ts';
import type { Channels } from '../../audio/pcm.ts';
import type { AudioEffectDef } from '../types.ts';

/** A warning when the echoes added to the sound go above full level, or ''. */
function clipping(out: Channels): string {
  const p = peak(out);
  return p > 1
    ? ` The echoes add up to ${gainToDb(p).toFixed(1)} dB above full level, so the loudest parts will be clipped (distorted): use a smaller decay, or Amplify the sound down first.`
    : '';
}

export const echo: AudioEffectDef = {
  id: 'audio.echo',
  label: 'Echo…',
  group: 'Space',
  syllabus: '11.2 delay / echo',
  why: 'An echo repeats the sound after a short delay, and each repeat is quieter by the decay factor (it loses decibels each time). It makes a sound more distinctive or suggests a large space, as sound bouncing back off walls.',
  params: {
    delay: { label: 'Delay time', unit: 's', min: 0.01, max: 10, step: 0.01, default: 1 },
    decay: { label: 'Decay factor', min: 0, max: 1, step: 0.01, default: 0.5 },
  },
  note(channels, rate, params) {
    const length = (channels[0]?.length ?? 0) / rate;
    const heard = [1, 2, 3]
      .filter((k) => k * params.delay! < length)
      .map((k) => `${(k * params.delay!).toFixed(2)} s (×${(params.decay! ** k).toFixed(2)})`);
    const more = 4 * params.delay! < length ? '…' : '';
    const when = heard.length
      ? `Echoes at ${heard.join(', ')}${more}.`
      : 'The delay is longer than the selection, so there is no echo.';
    return when + clipping(echo.process(channels, rate, params));
  },
  process: (channels, rate, { delay, decay }) => feedback(channels, rate, delay!, decay!),
};

const TYPES: readonly DelayType[] = ['regular', 'bouncing', 'reverse'];
const WHAT = [
  'Equal gaps',
  'Each echo comes closer to the one before',
  'The echoes get further apart',
];

export const delay: AudioEffectDef = {
  id: 'audio.delay',
  label: 'Delay…',
  group: 'Space',
  syllabus: '11.2 delay / echo',
  why: 'Delay plays a set number of echoes, each quieter than the one before. Regular keeps the same time between echoes; Bouncing ball makes them come closer and closer together, like a ball bouncing to a stop; Reverse bouncing ball makes them further and further apart.',
  params: {
    type: {
      label: 'Type',
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      choices: ['Regular', 'Bouncing ball', 'Reverse bouncing ball'],
    },
    delay: { label: 'Delay time', unit: 's', min: 0.01, max: 10, step: 0.01, default: 0.5 },
    echoes: { label: 'Echoes', min: 1, max: 50, step: 1, default: 5 },
    decayDb: { label: 'Decay per echo', unit: 'dB', min: 0, max: 60, step: 0.5, default: 6 },
    longer: {
      label: 'Make the sound longer for the last echoes',
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      toggle: true,
    },
  },
  note(channels, rate, params) {
    const times = echoTimes(TYPES[params.type!]!, params.delay!, params.echoes!);
    const out = delay.process(channels, rate, params);
    const before = (channels[0]?.length ?? 0) / rate;
    const after = (out[0]?.length ?? 0) / rate;
    const length = after > before ? ` Length: ${before.toFixed(2)} s → ${after.toFixed(2)} s.` : '';
    return `${WHAT[params.type!]}: echoes at ${times.map((t) => t.toFixed(2)).join(', ')} s.${length}${clipping(out)}`;
  },
  process: (channels, rate, params) =>
    repeat(channels, rate, {
      type: TYPES[params.type!]!,
      delay: params.delay!,
      echoes: params.echoes!,
      decayDb: params.decayDb!,
      keepLength: params.longer === 0,
    }),
};

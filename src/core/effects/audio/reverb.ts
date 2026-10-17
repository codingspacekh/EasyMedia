// A11 Reverb: the sound as if played in a larger room. Presets as on design screen 19.
import { reverb as room, ringSeconds, type ReverbSettings } from '../../audio/dsp/reverb.ts';
import type { AudioEffectDef, Params } from '../types.ts';

const CUSTOM = 0;
/** Room size, reverberance, damping and wet level (%) of each preset, after Custom. */
const PRESETS: readonly (readonly [number, number, number, number])[] = [
  [30, 30, 60, 20], // Small room
  [60, 40, 50, 30], // Vocal: Audacity's settings in Book B 11.2.13
  [85, 60, 40, 35], // Hall
  [100, 90, 25, 45], // Cathedral
];

const settings = (p: Params): ReverbSettings => ({
  roomSize: p.roomSize! / 100,
  reverberance: p.reverberance! / 100,
  damping: p.damping! / 100,
  wet: p.wet! / 100,
  tail: p.tail === 1,
});

const percent = (label: string, value: number) => ({
  label,
  unit: '%',
  min: 0,
  max: 100,
  step: 1,
  default: value,
});

export const reverb: AudioEffectDef = {
  id: 'audio.reverb',
  label: 'Reverb…',
  group: 'Space',
  syllabus: '11.2 reverberation',
  why: 'Reverb makes a sound seem to be played in a larger room, where it bounces off the walls and dies away slowly. A small amount gives a voice a fuller, richer, softer feel; a lot sounds like a hall or a cave. Reverberance sets how long it rings on, room size how big the room sounds.',
  params: {
    preset: {
      label: 'Preset',
      min: 0,
      max: PRESETS.length,
      step: 1,
      default: 2,
      choices: ['Custom', 'Small room', 'Vocal', 'Hall', 'Cathedral'],
    },
    roomSize: percent('Room size', 60),
    reverberance: percent('Reverberance', 40),
    damping: percent('Damping', 50),
    wet: percent('Wet / dry: the wet part', 30),
    tail: {
      label: 'Let it ring on after the selection (makes the sound longer)',
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      toggle: true,
    },
  },
  link(params, changed) {
    if (changed === 'preset') {
      const values = PRESETS[params.preset! - 1];
      if (!values) return params;
      const [roomSize, reverberance, damping, wet] = values;
      return { ...params, roomSize, reverberance, damping, wet };
    }
    return changed === 'tail' ? params : { ...params, preset: CUSTOM };
  },
  note(channels, rate, params) {
    const ring = ringSeconds(settings(params));
    const before = (channels[0]?.length ?? 0) / rate;
    const longer =
      params.tail === 1 ? ` Length: ${before.toFixed(2)} s → ${(before + ring).toFixed(2)} s.` : '';
    return `It rings on for about ${ring.toFixed(1)} s after a sound stops.${longer}`;
  },
  process: (channels, rate, params) => room(channels, rate, settings(params)),
};

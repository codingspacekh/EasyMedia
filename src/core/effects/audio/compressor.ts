// A19 Compressor (design screen 18): evens out loud and quiet parts. Not file compression.
import { compress, compressedDb, type CompressorSettings } from '../../audio/dsp/compressor.ts';
import type { AudioEffectDef, Params } from '../types.ts';

const CUSTOM = 0;
const SILENCE_DB = -60;
/** Threshold (dB), ratio, attack (s), release (s) of each preset, after Custom. */
const PRESETS: readonly (readonly [number, number, number, number])[] = [
  [-18, 2, 0.2, 1], // Gentle
  [-20, 3, 0.2, 1], // Voice: design screen 18
  [-24, 2.5, 0.1, 1.5], // Music
  [-30, 6, 0.05, 0.5], // Strong
];

const settings = (p: Params): CompressorSettings => ({
  thresholdDb: p.thresholdDb!,
  ratio: p.ratio!,
  attack: p.attack!,
  release: p.release!,
  makeUp: p.makeUp === 1,
});
const minus = (db: number) => `${db < 0 ? '−' : ''}${Math.abs(db)}`;

export const compressor: AudioEffectDef = {
  id: 'audio.compressor',
  label: 'Compressor…',
  group: 'Volume',
  syllabus: '11.2 compression · dynamic range',
  why: 'Dynamic range compression makes the loudest parts quieter (and, with make-up gain, the whole sound louder), so loud and quiet parts are closer together. A voiceover with some words very loud and others very quiet is hard to follow; compressed, it can be heard clearly over music. Too much sounds flat and lifeless. This is not file compression: the file does not get smaller. File compression happens when you export (MP3, AAC: lossy, data removed for ever; FLAC: lossless, nothing lost) and makes the file smaller.',
  params: {
    preset: {
      label: 'Preset',
      min: 0,
      max: PRESETS.length,
      step: 1,
      default: 2,
      choices: ['Custom', 'Gentle', 'Voice', 'Music', 'Strong'],
    },
    thresholdDb: { label: 'Threshold', unit: 'dB', min: -60, max: 0, step: 0.5, default: -20 },
    ratio: { label: 'Ratio', unit: ': 1', min: 1, max: 20, step: 0.1, default: 3 },
    attack: { label: 'Attack time', unit: 's', min: 0.01, max: 1, step: 0.01, default: 0.2 },
    release: { label: 'Release time', unit: 's', min: 0.1, max: 5, step: 0.1, default: 1 },
    makeUp: {
      label: 'Make-up gain: raise to 0 dB after compressing',
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      toggle: true,
    },
  },
  link(params, changed) {
    if (changed === 'preset') {
      const values = PRESETS[params.preset! - 1];
      if (!values) return params;
      const [thresholdDb, ratio, attack, release] = values;
      return { ...params, thresholdDb, ratio, attack, release };
    }
    return changed === 'makeUp' ? params : { ...params, preset: CUSTOM };
  },
  note: (_channels, _rate, { thresholdDb, ratio, makeUp }) =>
    `Sounds louder than ${minus(thresholdDb!)} dB are reduced: every ${ratio} dB above the threshold comes out as 1 dB.` +
    (makeUp ? ' Then the whole selection is raised so its loudest part is at 0 dB.' : ''),
  curve: (params) => (inputDb) => compressedDb(inputDb, settings(params)),
  shape(params, levelsDb) {
    const after = levelsDb.map((db) => compressedDb(db, settings(params)));
    if (params.makeUp !== 1 || !after.length) return after;
    const lift = -Math.max(...after);
    // Silence (shown at −60 dB) stays silent; make-up gain cannot raise what is not there.
    return after.map((db, i) => (levelsDb[i]! <= SILENCE_DB ? db : db + lift));
  },
  process: (channels, rate, params) => compress(channels, rate, settings(params)),
};

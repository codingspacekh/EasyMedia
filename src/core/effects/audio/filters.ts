// A12 Graphic EQ with presets (design screen 20), High-pass and Low-pass filters (screen 17).
import {
  EQ_BANDS,
  filterResponseDb,
  graphicEq,
  highPass,
  lowPass,
} from '../../audio/dsp/filters.ts';
import type { AudioEffectDef, ParamSpec, Params } from '../types.ts';

const bandName = (hz: number) => (hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`);
const BAND_KEYS = EQ_BANDS.map((hz) => `b${hz}`);
const CUSTOM = 0;
/** dB for each band, 31 Hz → 16 kHz; the presets after Custom. */
const PRESETS: Record<string, readonly number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass boost': [10, 10, 7, 4, 2, 0, 0, 0, 0, 0],
  'Bass cut': [-10, -10, -7, -4, -2, 0, 0, 0, 0, 0],
  'Treble boost': [0, 0, 0, 0, 0, 2, 4, 7, 10, 10], // Book B 11.2.14
  'Treble cut': [0, 0, 0, 0, 0, -2, -4, -7, -10, -10],
  Telephone: [-20, -20, -12, -3, 0, 2, 2, -3, -20, -20], // about 300–3400 Hz
  'Walkie-talkie': [-20, -20, -20, -8, 0, 5, 5, -8, -20, -20],
};
const PRESET_NAMES = ['Custom', ...Object.keys(PRESETS)];

const gainsOf = (p: Params) => BAND_KEYS.map((k) => p[k] ?? 0);
const listed = (p: Params, keep: (db: number) => boolean) =>
  EQ_BANDS.map((hz, i) => [hz, gainsOf(p)[i]!] as const)
    .filter(([, db]) => keep(db))
    .map(([hz, db]) => `${bandName(hz)} ${db > 0 ? '+' : '−'}${Math.abs(db)}`);

export const graphicEqualiser: AudioEffectDef = {
  id: 'audio.eq',
  label: 'Graphic EQ…',
  group: 'Frequency',
  syllabus: '11.2 equalisation',
  why: 'Equalisation (EQ) makes chosen frequencies louder or quieter. The sliders on the left are the bass (low frequencies), those on the right the treble (high frequencies). Boost the bass for a fuller sound, boost the treble for a clearer voice, or cut both ends to sound like a telephone.',
  params: {
    preset: {
      label: 'Preset',
      min: 0,
      max: PRESET_NAMES.length - 1,
      step: 1,
      default: 1,
      choices: PRESET_NAMES,
    },
    ...Object.fromEntries(
      EQ_BANDS.map((hz, i): [string, ParamSpec] => [
        BAND_KEYS[i]!,
        { label: bandName(hz), unit: 'dB', min: -20, max: 20, step: 0.5, default: 0, band: true },
      ]),
    ),
  },
  link(params, changed) {
    if (changed === 'preset') {
      const gains = PRESETS[PRESET_NAMES[params.preset!]!];
      if (!gains) return params;
      return { ...params, ...Object.fromEntries(BAND_KEYS.map((k, i) => [k, gains[i]!])) };
    }
    return { ...params, preset: CUSTOM };
  },
  note(_channels, _rate, params) {
    const louder = listed(params, (db) => db > 0);
    const quieter = listed(params, (db) => db < 0);
    if (!louder.length && !quieter.length) return 'Flat: the sound is not changed.';
    return [
      louder.length ? `Louder: ${louder.join(', ')} dB.` : '',
      quieter.length ? `Quieter: ${quieter.join(', ')} dB.` : '',
    ]
      .filter(Boolean)
      .join(' ');
  },
  process: (channels, rate, params) => graphicEq(channels, rate, gainsOf(params)),
};

const ROLLOFFS = [6, 12, 24, 36, 48];
const filterParams = {
  cutoff: { label: 'Cut-off', unit: 'Hz', min: 10, max: 20000, step: 1, default: 1000 },
  rolloff: {
    label: 'Roll-off per octave',
    min: 0,
    max: ROLLOFFS.length - 1,
    step: 1,
    default: 0,
    choices: ROLLOFFS.map((db) => `${db} dB`),
  },
};
/** The cut-off, kept below what the sample rate can hold. */
const cutoffAt = (rate: number, cutoff: number) => Math.min(cutoff, 0.45 * rate);

function filterNote(kind: 'low' | 'high', rate: number, params: Params): string {
  const cutoff = cutoffAt(rate, params.cutoff!);
  const rolloff = ROLLOFFS[params.rolloff!]!;
  const examples = (kind === 'high' ? [1 / 2, 1 / 4, 1 / 10] : [2, 4, 10])
    .map((f) => Math.round(cutoff * f))
    .filter((hz) => hz >= 10 && hz < 0.45 * rate)
    .map((hz) => `${hz} Hz −${Math.round(-filterResponseDb(kind, cutoff, rolloff, hz, rate))} dB`);
  const where = kind === 'high' ? 'below' : 'above';
  return `Tones ${where} ${Math.round(cutoff)} Hz are cut${examples.length ? `: ${examples.join(', ')}` : ''}.`;
}

export const highPassFilter: AudioEffectDef = {
  id: 'audio.highpass',
  label: 'High-pass filter…',
  group: 'Frequency',
  syllabus: '11.2 filters',
  why: 'A high-pass filter lets high frequencies through and cuts the low ones, for example the rumble of a fan or air conditioning. Below the cut-off the sound gets quieter by the roll-off for each octave lower. Apply noise reduction first.',
  params: filterParams,
  note: (_channels, rate, params) => filterNote('high', rate, params),
  process: (channels, rate, { cutoff, rolloff }) =>
    highPass(channels, rate, cutoffAt(rate, cutoff!), ROLLOFFS[rolloff!]!),
};

export const lowPassFilter: AudioEffectDef = {
  id: 'audio.lowpass',
  label: 'Low-pass filter…',
  group: 'Frequency',
  syllabus: '11.2 filters',
  why: 'A low-pass filter lets low frequencies through and cuts the high ones, for example hiss. Above the cut-off the sound gets quieter by the roll-off for each octave higher, so it sounds duller or further away.',
  params: filterParams,
  note: (_channels, rate, params) => filterNote('low', rate, params),
  process: (channels, rate, { cutoff, rolloff }) =>
    lowPass(channels, rate, cutoffAt(rate, cutoff!), ROLLOFFS[rolloff!]!),
};

// M10 exit gate (automated): the Audio mode coursebook tasks with the M10 effects, done with the
// same use cases the buttons call (app/audio.ts) and real FFmpeg, then checked on the exported
// files. Book A 11.20–11.24; Book B Tasks 11k–11p, Activities 11f–11i.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAudioApp, SILENT_OUTPUT } from '../../src/app/audio.ts';
import { audioEffectById } from '../../src/core/effects/registry.ts';
import type { Params } from '../../src/core/effects/types.ts';
import {
  defaultAudioExport,
  type AudioExportSettings,
} from '../../src/core/render/audio-formats.ts';
import { engine, projectFolder } from './helpers.ts';

const TWO_KEYS = 'two_keys_45s.mp3'; // Task_11j.mp3: 0–19 s in C, then F
const TWO_KEYS_SHARP = 'two_keys_43s.mp3'; // Activity_11e.mp3: 0–30.6 s in C♯, then F♯
const PIANO = 'piano_stereo_60s.mp3'; // 11.05 Piano_track.mp3
const BEE = 'bee_voiceover_6s.mp3'; // 11.06 Bee_Voiceover.mp3: a 300 Hz voice
const BEEPS = 'beeps_30s.mp3'; // Task_11o_audio.mp3: a 50 ms beep every 2 s
const VOICE_HISS = 'voice_hiss_9s.mp3'; // Voiceover_1.mp3: voice 0–3.3 s, hiss throughout
const MUSIC_HISS = 'music_hiss_60s.mp3'; // Task_11n_audio.mp3: only hiss in 40–50 s
const LOUD_QUIET = 'loud_quiet_voice_12s.wav'; // 3 s parts at 0.8 and 0.08 (20 dB apart)
const TONES = 'bass_treble_120s.mp3'; // Voiceover_2, Task_11n_audio, Blue_Sky_Blues: 100 Hz + 8 kHz
const RATE = 44100;

let folder: Awaited<ReturnType<typeof projectFolder>>;
beforeAll(async () => {
  folder = await projectFolder([
    TWO_KEYS,
    TWO_KEYS_SHARP,
    PIANO,
    BEE,
    BEEPS,
    TONES,
    VOICE_HISS,
    MUSIC_HISS,
    LOUD_QUIET,
  ]);
});
afterAll(() => folder.cleanUp());

function session() {
  const dialogs = {
    openMedia: vi.fn(async () => [] as string[]),
    exportAudio: vi.fn(async () => null as string | null),
  };
  const audio = createAudioApp({ engine, dialogs, output: SILENT_OUTPUT });
  return {
    audio,
    doc: () => audio.store.get().history.present,
    async open(...names: string[]) {
      dialogs.openMedia.mockResolvedValueOnce(names.map((n) => folder.file(n)));
      await audio.importAudio();
      expect(audio.store.get().message).toBeNull();
    },
    /** The settings as the dialog leaves them after the student changes `change` (P7 link). */
    settings(id: string, change: Params): Params {
      const def = audioEffectById(id)!;
      let params = audio.effectSettings(id);
      for (const [key, value] of Object.entries(change)) {
        params = def.link
          ? def.link({ ...params, [key]: value }, key)
          : { ...params, [key]: value };
      }
      return params;
    },
    async exportAs(name: string, settings: Partial<AudioExportSettings> = {}) {
      const output = folder.file(name);
      dialogs.exportAudio.mockResolvedValueOnce(output);
      const doc = audio.store.get().history.present;
      await audio.exportAudio({
        ...defaultAudioExport({ rate: doc.rate, channels: 2 }),
        ...settings,
      });
      expect(audio.store.get().exporting).toEqual({ state: 'done', output });
      return output;
    },
  };
}

/** Frequency of a steady tone between two times, from its rising zero crossings. */
function frequency(c: Float32Array, from: number, to: number): number {
  const crossings: number[] = [];
  for (let i = Math.round(from * RATE) + 1; i < Math.round(to * RATE); i++) {
    if (c[i - 1]! < 0 && c[i]! >= 0) crossings.push(i - 1 + c[i - 1]! / (c[i - 1]! - c[i]!));
  }
  return ((crossings.length - 1) * RATE) / (crossings.at(-1)! - crossings[0]!);
}
/** Loudness (RMS) between two times. */
function rms(c: Float32Array, from: number, to: number): number {
  const part = c.subarray(Math.round(from * RATE), Math.round(to * RATE));
  return Math.sqrt(part.reduce((s, v) => s + v * v, 0) / part.length);
}
/** Loudness (RMS) of the 50 ms starting at `at` seconds. */
function level(c: Float32Array, at: number): number {
  const part = c.subarray(Math.round(at * RATE), Math.round((at + 0.05) * RATE));
  return Math.sqrt(part.reduce((s, v) => s + v * v, 0) / part.length);
}
/** Level (dB) of one frequency in the second starting at `at` (Goertzel). */
function toneDb(c: Float32Array, freq: number, at: number): number {
  const from = Math.round((at + 0.1) * RATE);
  const n = Math.round(0.8 * RATE);
  const k = 2 * Math.cos((2 * Math.PI * freq) / RATE);
  let [s1, s2] = [0, 0];
  for (let i = 0; i < n; i++) [s1, s2] = [c[from + i]! + k * s1 - s2, s1];
  const power = s1 * s1 + s2 * s2 - k * s1 * s2;
  return 10 * Math.log10((4 * power) / (n * n));
}
/** How much louder (dB) a frequency is at `at` than at `reference`. */
const change = (c: Float32Array, freq: number, at: number, reference: number) =>
  toneDb(c, freq, at) - toneDb(c, freq, reference);
const near = (actual: number, expected: number, within = 0.02) =>
  expect(Math.abs(actual / expected - 1)).toBeLessThan(within);

describe('Book B Task 11k: change the first 19 s from C to F, then speed up 1.4×', () => {
  it('Task_11k.mp3 is about 32 s, and both parts are in the same key', async () => {
    const s = session();
    await s.open(TWO_KEYS);
    s.audio.select({ start: 0, end: 19 }); // 11.2.10 highlight the first 19 seconds
    const pitch = s.settings('audio.pitch', { fromKey: 0, toKey: 5 }); // C → F
    expect(pitch.semitones).toBe(5);
    expect(s.audio.applyEffect('audio.pitch', pitch)).toBeNull();
    expect(s.doc().tracks[0]!.channels[0]!.length / RATE).toBeCloseTo(45, 5); // length kept
    s.audio.selectAll(); // 11.2.11 Ctrl+A, Change Speed 1.400
    expect(
      s.audio.applyEffect('audio.speed', s.settings('audio.speed', { speed: 1.4 })),
    ).toBeNull();
    const file = await s.exportAs('Task_11k.mp3', { channels: 1 });

    const info = await engine.probe(file);
    expect(info.audio).toMatchObject({ codec: 'mp3', channels: 1 });
    expect(info.duration!).toBeCloseTo(32.14, 1); // "from about 45 seconds to about 32 seconds"
    const [out] = (await engine.decodeAudio(file)).channels;
    near(frequency(out!, 2, 12), 349.23 * 1.4); // the first part, now in F (and faster)
    near(frequency(out!, 16, 30), 349.23 * 1.4); // the second part, in F all along
  });
});

describe('Book B Activity 11f: change the first 30.6 s from C♯ to F♯, then slow to 0.9×', () => {
  it('Activity_11f.mp3 is 43.4 ÷ 0.9 = 48.2 s, and both parts are in F♯', async () => {
    const s = session();
    await s.open(TWO_KEYS_SHARP);
    s.audio.select({ start: 0, end: 30.6 });
    const pitch = s.settings('audio.pitch', { fromKey: 1, toKey: 6 }); // C♯ / D♭ → F♯ / G♭
    expect(s.audio.applyEffect('audio.pitch', pitch)).toBeNull();
    s.audio.selectAll();
    expect(
      s.audio.applyEffect('audio.speed', s.settings('audio.speed', { speed: 0.9 })),
    ).toBeNull();
    const file = await s.exportAs('Activity_11f.mp3');

    const info = await engine.probe(file);
    expect(info.audio).toMatchObject({ codec: 'mp3', channels: 2 });
    expect(info.duration!).toBeCloseTo(48.22, 1);
    const [left, right] = (await engine.decodeAudio(file)).channels;
    near(frequency(left!, 3, 30), 369.99 * 0.9);
    near(frequency(right!, 36, 46), 369.99 * 0.9);
  });
});

describe('Book A 11.20: the bee voiceover at the end of the piano music, 5 % lower', () => {
  it('the voiceover ends with the music at 41 s and is at 285 Hz instead of 300 Hz', async () => {
    const s = session();
    await s.open(PIANO);
    s.audio.select({ start: 41, end: 60 }); // the music trimmed to the video's 41 s (11.17)
    s.audio.cut();
    await s.open(BEE);
    const bee = s.doc().tracks[1]!;
    const beeLength = bee.channels[0]!.length / RATE;
    s.audio.timeShift(bee.id, 41 - beeLength); // Time Shift Tool: finish with the piano
    s.audio.selectTrack(bee.id);
    s.audio.select({ start: 41 - beeLength, end: 41 });
    const lower = s.settings('audio.pitch', { percent: -5 });
    expect(lower.direction).toBe(1); // down
    expect(s.audio.applyEffect('audio.pitch', lower)).toBeNull();

    const voice = s.doc().tracks[1]!;
    expect(voice.offset + voice.channels[0]!.length / RATE).toBeCloseTo(41, 3);
    near(frequency(voice.channels[0]!, 1, 5), 285);
    const file = await s.exportAs('BeeProject_sound.mp3');
    expect((await engine.probe(file)).duration!).toBeCloseTo(41, 1);
  });
});

describe('Book B Task 11o: echo, 0.5 s delay and 0.8 decay, between 10 and 20 seconds', () => {
  it('Task_11o.mp3 has echoes ×0.8, ×0.64… after each beep in 10–20 s, and none elsewhere', async () => {
    const s = session();
    await s.open(BEEPS);
    s.audio.select({ start: 10, end: 20 });
    expect(s.audio.applyEffect('audio.echo', { delay: 0.5, decay: 0.8 })).toBeNull();
    const file = await s.exportAs('Task_11o.mp3', { channels: 1 });

    expect((await engine.probe(file)).duration!).toBeCloseTo(30, 1); // the length stays the same
    const [out] = (await engine.decodeAudio(file)).channels;
    const beep = level(out!, 12);
    near(level(out!, 12.5) / beep, 0.8, 0.05);
    near(level(out!, 13) / beep, 0.64, 0.05);
    near(level(out!, 13.5) / beep, 0.512, 0.05);
    expect(level(out!, 4.5)).toBeLessThan(0.01); // before the selection: no echo
    expect(level(out!, 20.5)).toBeLessThan(0.01); // the echoes stop where the selection ends
  });
});

describe('Book A 11.23: echo on the voiceover intro, 0.5 s delay and 0.5 decay', () => {
  it('each echo is half as loud as the one before', async () => {
    const s = session();
    await s.open(BEEPS);
    s.audio.select({ start: 0, end: 6 });
    expect(s.audio.applyEffect('audio.echo', { delay: 0.5, decay: 0.5 })).toBeNull();
    const [voice] = s.doc().tracks[0]!.channels;
    near(level(voice!, 2.5) / level(voice!, 2), 0.5, 0.02);
    near(level(voice!, 3) / level(voice!, 2), 0.25, 0.02);
  });
});

describe('A10 Delay: bouncing ball, through to a WAV file', () => {
  it('4 echoes from 1 s come at 1, 1.75, 2.25 and 2.5 s, 6 dB quieter each; the sound gets longer', async () => {
    const s = session();
    await s.open(BEEPS);
    s.audio.select({ start: 26, end: 30 }); // the last beep, at 28 s
    const params = s.settings('audio.delay', { type: 1, delay: 1, echoes: 4 });
    expect(s.audio.applyEffect('audio.delay', params)).toBeNull();
    const file = await s.exportAs('delay.wav', { format: 'wav', channels: 1 });

    expect((await engine.probe(file)).duration!).toBeCloseTo(32.5, 2);
    const [out] = (await engine.decodeAudio(file)).channels;
    const beep = level(out!, 28);
    for (const [k, at] of [1, 1.75, 2.25, 2.5].entries()) {
      near(level(out!, 28 + at) / beep, 10 ** ((-6 * (k + 1)) / 20), 0.05);
    }
    expect(level(out!, 29.4)).toBeLessThan(0.01); // nothing between the echoes
  });
});

describe('Book B Task 11m: reverb 4–6 s, more treble 8–11.8 s, more bass 11.8–15 s', () => {
  it('Task_11m.mp3: treble +10 dB only in 8–11.8 s, bass boosted only in 11.8–15 s', async () => {
    const s = session();
    await s.open(TONES);
    s.audio.select({ start: 4, end: 6 });
    expect(s.audio.applyEffect('audio.reverb', s.audio.effectSettings('audio.reverb'))).toBeNull();
    s.audio.select({ start: 8, end: 11.8 });
    const treble = s.settings('audio.eq', { preset: 4 }); // Treble boost, as in the book
    expect(s.audio.applyEffect('audio.eq', treble)).toBeNull();
    s.audio.select({ start: 11.8, end: 15 });
    expect(s.audio.applyEffect('audio.eq', s.settings('audio.eq', { preset: 2 }))).toBeNull();
    const file = await s.exportAs('Task_11m.mp3', { channels: 1 });

    const [out] = (await engine.decodeAudio(file)).channels;
    expect(change(out!, 8000, 9, 1)).toBeCloseTo(10, 0); // treble up 10 dB
    expect(Math.abs(change(out!, 100, 9, 1))).toBeLessThan(1); // bass as it was
    expect(change(out!, 100, 13, 1)).toBeGreaterThan(6); // bass up
    expect(Math.abs(change(out!, 8000, 13, 1))).toBeLessThan(1); // treble as it was
    expect(Math.abs(change(out!, 8000, 17, 1))).toBeLessThan(1); // after 15 s: unchanged
    expect(Math.abs(change(out!, 100, 17, 1))).toBeLessThan(1);
  });
});

describe('Book B Task 11n: noise reduction, then a high-pass on 10–20 s; again with a low-pass', () => {
  it('Task_11n_high.mp3 is quieter in 40–50 s and loses the bass in 10–20 s; Task_11n_low.mp3 the treble', async () => {
    const high = session();
    await high.open(MUSIC_HISS);
    high.audio.select({ start: 40, end: 50 }); // background noise only
    expect(high.audio.getNoiseProfile()).toBeNull();
    high.audio.selectAll(); // Ctrl+A, then Noise Reduction… step 2
    expect(
      high.audio.applyEffect('audio.noise', high.audio.effectSettings('audio.noise')),
    ).toBeNull();
    high.audio.select({ start: 10, end: 20 });
    expect(
      high.audio.applyEffect('audio.highpass', high.audio.effectSettings('audio.highpass')),
    ).toBeNull();
    const [h] = (
      await engine.decodeAudio(await high.exportAs('Task_11n_high.mp3', { channels: 1 }))
    ).channels;
    const [original] = (await engine.decodeAudio(folder.file(MUSIC_HISS))).channels;
    expect(20 * Math.log10(rms(h!, 42, 48) / rms(original!, 42, 48))).toBeLessThan(-9); // hiss
    expect(change(h!, 100, 14, 2)).toBeLessThan(-15); // the bass is cut
    expect(Math.abs(change(h!, 8000, 14, 2))).toBeLessThan(1); // the treble passes
    expect(Math.abs(change(h!, 100, 25, 2))).toBeLessThan(1); // only in 10–20 s

    const low = session(); // "start a new project and reopen the file"
    await low.open(MUSIC_HISS);
    low.audio.select({ start: 10, end: 20 });
    expect(
      low.audio.applyEffect('audio.lowpass', low.audio.effectSettings('audio.lowpass')),
    ).toBeNull();
    const [l] = (await engine.decodeAudio(await low.exportAs('Task_11n_low.mp3', { channels: 1 })))
      .channels;
    expect(change(l!, 8000, 14, 2)).toBeLessThan(-15);
    expect(Math.abs(change(l!, 100, 14, 2))).toBeLessThan(1);
  });
});

describe('Book B Task 11l: remove the background noise from Voiceover_1, trim to 4 s', () => {
  it('Task_11l.mp3 is 4 s; the hiss is much quieter and the voice keeps its level', async () => {
    const s = session();
    await s.open(VOICE_HISS);
    const before = s.doc().tracks[0]!.channels[0]!;
    s.audio.select({ start: 3.3, end: 8.09 }); // only background noise
    expect(s.audio.getNoiseProfile()).toBeNull();
    s.audio.selectAll();
    const settings = s.audio.effectSettings('audio.noise');
    expect(settings).toMatchObject({ reductionDb: 12, sensitivity: 6, smoothing: 3 });
    expect(s.audio.applyEffect('audio.noise', settings)).toBeNull();
    const after = s.doc().tracks[0]!.channels[0]!;
    expect(20 * Math.log10(rms(after, 4, 8) / rms(before, 4, 8))).toBeLessThan(-9); // hiss
    expect(Math.abs(toneDb(after, 300, 1) - toneDb(before, 300, 1))).toBeLessThan(1); // voice
    s.audio.select({ start: 4, end: 9 }); // trim to 4 s
    s.audio.cut();
    const file = await s.exportAs('Task_11l.mp3', { channels: 1 });
    expect((await engine.probe(file)).duration!).toBeCloseTo(4, 1);
  });
});

describe('Book A 11.24: EQ presets, and high- and low-pass filters, on the voiceover', () => {
  it('Bass boost, Treble cut, Telephone, Walkie-talkie, and filters at other cut-offs each do what they say', async () => {
    const s = session();
    await s.open(TONES);
    const tried = (id: string, change: Params) => {
      s.audio.select({ start: 0, end: 4 });
      expect(s.audio.applyEffect(id, s.settings(id, change))).toBeNull();
      const out = s.doc().tracks[0]!.channels[0]!;
      const result = { bass: toneDb(out, 100, 2), treble: toneDb(out, 8000, 2) };
      s.audio.undo();
      return result;
    };
    const original = s.doc().tracks[0]!.channels[0]!;
    const bass = toneDb(original, 100, 2);
    const treble = toneDb(original, 8000, 2);
    expect(tried('audio.eq', { preset: 2 }).bass).toBeGreaterThan(bass + 6); // Bass boost
    expect(tried('audio.eq', { preset: 5 }).treble).toBeLessThan(treble - 6); // Treble cut
    for (const preset of [6, 7]) {
      const phone = tried('audio.eq', { preset }); // Telephone, Walkie-talkie
      expect(phone.bass).toBeLessThan(bass - 10);
      expect(phone.treble).toBeLessThan(treble - 10);
    }
    expect(tried('audio.highpass', { cutoff: 300 }).bass).toBeLessThan(bass - 8);
    expect(tried('audio.lowpass', { cutoff: 3000 }).treble).toBeLessThan(treble - 6);
  });
});

describe('Book B Activities 11g and 11h: reverb, bass and treble, then filters on the saved file', () => {
  it('Activity_11g.mp3 then Activity_11h.mp3 have each change in its own place', async () => {
    const g = session();
    await g.open(TONES); // Blue_Sky_Blues.mp3
    g.audio.select({ start: 20, end: 30 }); // lots of reverb
    expect(
      g.audio.applyEffect('audio.reverb', g.settings('audio.reverb', { preset: 4 })),
    ).toBeNull();
    g.audio.select({ start: 40, end: 50 }); // more bass
    expect(g.audio.applyEffect('audio.eq', g.settings('audio.eq', { preset: 2 }))).toBeNull();
    g.audio.select({ start: 60, end: 70 }); // more treble
    expect(g.audio.applyEffect('audio.eq', g.settings('audio.eq', { preset: 4 }))).toBeNull();
    const saved = await g.exportAs('Activity_11g.mp3', { channels: 1 });

    const h = session();
    await h.open('Activity_11g.mp3'); // Activity 11h opens the file saved in 11g
    expect(saved).toBe(folder.file('Activity_11g.mp3'));
    h.audio.select({ start: 80, end: 90 });
    expect(
      h.audio.applyEffect('audio.highpass', h.audio.effectSettings('audio.highpass')),
    ).toBeNull();
    h.audio.select({ start: 100, end: 110 });
    expect(
      h.audio.applyEffect('audio.lowpass', h.audio.effectSettings('audio.lowpass')),
    ).toBeNull();
    const [out] = (await engine.decodeAudio(await h.exportAs('Activity_11h.mp3', { channels: 1 })))
      .channels;

    expect(change(out!, 100, 44, 5)).toBeGreaterThan(6); // 11g: bass 40–50 s
    expect(change(out!, 8000, 64, 5)).toBeCloseTo(10, 0); // 11g: treble 60–70 s
    expect(change(out!, 100, 84, 5)).toBeLessThan(-15); // 11h: high-pass 80–90 s
    expect(change(out!, 8000, 104, 5)).toBeLessThan(-15); // 11h: low-pass 100–110 s
    expect(Math.abs(change(out!, 8000, 115, 5))).toBeLessThan(1); // the end untouched
  });
});

describe('Book B Task 11m (reverb part): a small amount of reverb between 4 and 6 seconds', () => {
  it('the beep at 4 s rings on afterwards; the beep at 8 s, outside the selection, does not', async () => {
    const s = session();
    await s.open(BEEPS); // stand-in for Voiceover_2.mp3
    s.audio.select({ start: 4, end: 6 });
    const settings = s.audio.effectSettings('audio.reverb');
    expect(settings).toMatchObject({ roomSize: 60, reverberance: 40 }); // "may already be set"
    expect(s.audio.applyEffect('audio.reverb', settings)).toBeNull();
    const file = await s.exportAs('Task_11m.mp3', { channels: 1 });

    expect((await engine.probe(file)).duration!).toBeCloseTo(30, 1);
    const [out] = (await engine.decodeAudio(file)).channels;
    expect(level(out!, 4.1)).toBeGreaterThan(0.01); // the reverb rings on after the beep
    expect(level(out!, 8.1)).toBeLessThan(0.005); // no reverb outside the selection
    expect(level(out!, 6.1)).toBeLessThan(0.005); // the tail stops with the selection (as Audacity)
  });
});

describe('Book A 11.21: increase the reverberance by 10 % for the bee voiceover', () => {
  it('more reverberance rings on longer', async () => {
    const ring = async (reverberance: number) => {
      const s = session();
      await s.open(BEEPS);
      s.audio.select({ start: 0, end: 30 });
      const params = s.settings('audio.reverb', { reverberance });
      expect(s.audio.applyEffect('audio.reverb', params)).toBeNull();
      return level(s.doc().tracks[0]!.channels[0]!, 2.6);
    };
    expect(await ring(50)).toBeGreaterThan((await ring(40)) * 1.3);
  });
});

describe('A19 Compressor (Book B 11.2.22): loud and quiet words come closer together', () => {
  it('Voice preset: 20 dB between loud and quiet parts becomes about 8 dB; the peak is at 0 dB', async () => {
    const s = session();
    await s.open(LOUD_QUIET);
    s.audio.selectAll();
    const voice = s.audio.effectSettings('audio.compressor');
    expect(voice).toMatchObject({ thresholdDb: -20, ratio: 3, makeUp: 1 });
    expect(s.audio.applyEffect('audio.compressor', voice)).toBeNull();
    const file = await s.exportAs('voice_compressed.wav', { format: 'wav', channels: 1 });

    const [out] = (await engine.decodeAudio(file)).channels;
    // Loud at 7.5–8.9 s; quiet at 5.4–5.9 s, once the 1 s release has let go after the loud part.
    const gap = 20 * Math.log10(rms(out!, 7.5, 8.9) / rms(out!, 5.4, 5.9));
    expect(gap).toBeGreaterThan(6);
    expect(gap).toBeLessThan(10);
    expect(20 * Math.log10(out!.reduce((m, v) => Math.max(m, Math.abs(v)), 0))).toBeGreaterThan(
      -0.5,
    );
    expect((await engine.probe(file)).duration!).toBeCloseTo(12, 2);
  });
});

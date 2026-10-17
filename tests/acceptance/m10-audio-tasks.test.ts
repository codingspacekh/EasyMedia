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
const RATE = 44100;

let folder: Awaited<ReturnType<typeof projectFolder>>;
beforeAll(async () => {
  folder = await projectFolder([TWO_KEYS, TWO_KEYS_SHARP, PIANO, BEE, BEEPS]);
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
/** Loudness (RMS) of the 50 ms starting at `at` seconds. */
function level(c: Float32Array, at: number): number {
  const part = c.subarray(Math.round(at * RATE), Math.round((at + 0.05) * RATE));
  return Math.sqrt(part.reduce((s, v) => s + v * v, 0) / part.length);
}
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

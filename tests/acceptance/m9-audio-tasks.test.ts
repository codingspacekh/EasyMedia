// M9 exit gate (automated): the Audio mode coursebook tasks, done with the same use cases the
// buttons call (app/audio.ts) and real FFmpeg, then checked on the exported files.
// Book A 11.16–11.19, 11.25–11.27, 11.29; Book B Task 11j and Activity 11e.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAudioApp, SILENT_OUTPUT } from '../../src/app/audio.ts';
import { peak } from '../../src/core/audio/dsp/volume.ts';
import {
  defaultAudioExport,
  type AudioExportSettings,
} from '../../src/core/render/audio-formats.ts';
import { bundledFfmpeg, run } from '../integration/helpers/ffmpeg.ts';
import { engine, projectFolder } from './helpers.ts';

const PIANO = 'piano_stereo_60s.mp3'; // 11.05 Piano_track.mp3: louder burst at 39–40 s
const SONG_DC = 'song_dc_offset_90s.mp3'; // Task_11j_audio_1.mp3 / Activity_11e_audio_1.mp3
const SONG = 'song_48s.mp3'; // Task_11j_audio_2.mp3 / Activity_11e_audio_2.mp3
const VOICE = 'voice_noisy.wav'; // the voiceover intro of Book A 11.25

let folder: Awaited<ReturnType<typeof projectFolder>>;
beforeAll(async () => {
  folder = await projectFolder([PIANO, SONG_DC, SONG, VOICE]);
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
    /** Selects the track by name and a time range on it. */
    pick(name: string, start: number, end: number) {
      const track = audio.store.get().history.present.tracks.find((t) => t.name === name)!;
      audio.select({ start, end, tracks: [track.id] });
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

const rms = (c: Float32Array, rate: number, from: number, to: number) => {
  const part = c.subarray(Math.round(from * rate), Math.round(to * rate));
  return Math.sqrt(part.reduce((s, v) => s + v * v, 0) / part.length);
};
const mean = (c: Float32Array, rate: number, from: number, to: number) => {
  const part = c.subarray(Math.round(from * rate), Math.round(to * rate));
  return part.reduce((s, v) => s + v, 0) / part.length;
};
async function tags(file: string): Promise<Record<string, string>> {
  const { stdout } = await run(bundledFfmpeg().ffprobe, [
    ...['-v', 'error', '-show_entries', 'format_tags', '-of', 'json', file],
  ]);
  return (JSON.parse(stdout) as { format: { tags?: Record<string, string> } }).format.tags ?? {};
}
const sameSamples = (a: readonly Float32Array[], b: readonly Float32Array[]) =>
  a.length === b.length &&
  a.every((c, i) => c.length === b[i]!.length && c.every((v, j) => v === b[i]![j]));

describe('Book B Task 11j: normalise, add a clipped track before it, trim to 45 s, fades, mono, MP3', () => {
  it('Task_11j.mp3 is 45 s, mono, tagged, starts with audio_2 and fades in and out', async () => {
    const s = session();
    // 11.2.1 Import Task_11j_audio_1.mp3; 11.2.2 Normalise with Remove DC offset.
    await s.open(SONG_DC);
    const before = s.doc().tracks[0]!.channels[0]!;
    expect(mean(before, 44100, 1, 5)).toBeGreaterThan(0.15); // it really has an offset
    s.audio.selectAll();
    expect(
      s.audio.applyEffect('audio.normalise', s.audio.effectSettings('audio.normalise')),
    ).toBeNull();
    expect(Math.abs(mean(s.doc().tracks[0]!.channels[0]!, 44100, 1, 5))).toBeLessThan(0.01);
    // 11.2.3 Add Task_11j_audio_2.mp3 as a new track; 11.2.4 keep only its first 19.1 s
    // (Audio position 19.100, selection 19.1 → 48 s, Cut).
    await s.open(SONG);
    s.audio.setPosition(19.1);
    s.pick('song_48s', 19.1, 48);
    s.audio.cut();
    expect(s.doc().tracks[1]!.channels[0]!.length / 44100).toBeCloseTo(19.1, 5);
    // 11.2.5 Move Track Up; Select All; Align End to End; Mix and Render; trim to 45 s.
    s.audio.moveTrack(-1);
    expect(s.doc().tracks.map((t) => t.name)).toEqual(['song_48s', 'song_dc_offset_90s']);
    s.audio.selectAll();
    s.audio.alignEndToEnd();
    expect(s.doc().tracks[1]!.offset).toBeCloseTo(19.1, 5);
    s.audio.mixAndRender();
    expect(s.doc().tracks).toHaveLength(1);
    s.audio.select({ start: 45, end: 200 });
    s.audio.cut();
    // 11.2.6 Fade in the first 3 s, fade out the last 5 s.
    s.audio.select({ start: 0, end: 3 });
    expect(s.audio.applyEffect('audio.fadein', {})).toBeNull();
    s.audio.select({ start: 40, end: 45 });
    expect(s.audio.applyEffect('audio.fadeout', {})).toBeNull();
    // 11.2.7 Mix Stereo Down to Mono.
    s.audio.stereoToMono();
    expect(s.doc().tracks[0]!.channels).toHaveLength(1);
    // 11.2.8 Amplify the quieter part from 19.1 s with the suggested gain, no clipping.
    s.audio.select({ start: 19.1, end: 40 });
    const suggested = s.audio.effectSettings('audio.amplify');
    expect(suggested.allowClipping).toBe(0);
    expect(s.audio.applyEffect('audio.amplify', suggested)).toBeNull();
    // 11.2.9 Export as MP3, Force export to mono, with tags.
    const file = await s.exportAs('Task_11j.mp3', {
      channels: 1,
      tags: { title: 'Task 11j', artist: 'Both artists (credited)', year: '2026' },
    });

    const info = await engine.probe(file);
    expect(info).toMatchObject({
      container: 'mp3',
      audio: { codec: 'mp3', channels: 1, sampleRate: 44100 },
    });
    expect(info.duration!).toBeCloseTo(45, 1);
    expect(await tags(file)).toMatchObject({
      title: 'Task 11j',
      artist: 'Both artists (credited)',
      date: '2026',
    });
    const [out] = (await engine.decodeAudio(file)).channels;
    expect(rms(out!, 44100, 0, 0.05)).toBeLessThan(0.02); // faded in from silence
    expect(rms(out!, 44100, 5, 15)).toBeGreaterThan(0.2); // audio_2 at full level
    expect(rms(out!, 44100, 44.95, 45)).toBeLessThan(0.02); // faded out to silence
    expect(Math.abs(mean(out!, 44100, 25, 35))).toBeLessThan(0.02); // DC offset removed
    expect(peak([out!.subarray(Math.round(20 * 44100), Math.round(39 * 44100))])).toBeGreaterThan(
      0.9,
    );
  });
});

describe('Book B Activity 11e: keep 1:17.2 → end, normalise, add 30.6 s before it', () => {
  it('Activity_11e.mp3 is 30.6 + 12.8 = 43.4 s', async () => {
    const s = session();
    await s.open(SONG_DC);
    s.audio.select({ start: 0, end: 77.2 });
    s.audio.cut();
    s.audio.selectAll();
    expect(
      s.audio.applyEffect('audio.normalise', s.audio.effectSettings('audio.normalise')),
    ).toBeNull();
    await s.open(SONG);
    s.pick('song_48s', 30.6, 48);
    s.audio.cut();
    s.audio.moveTrack(-1);
    s.audio.selectAll();
    s.audio.alignEndToEnd();
    s.audio.mixAndRender();
    const file = await s.exportAs('Activity_11e.mp3');
    const info = await engine.probe(file);
    expect(info.duration!).toBeCloseTo(43.4, 1);
    expect(info.audio).toMatchObject({ codec: 'mp3', channels: 2 });
    const [left] = (await engine.decodeAudio(file)).channels;
    expect(rms(left!, 44100, 10, 20)).toBeGreaterThan(0.2); // audio_2 first
    expect(Math.abs(mean(left!, 44100, 33, 42))).toBeLessThan(0.02); // then audio_1, centred
  });
});

describe('Book A 11.16–11.19, 11.27, 11.29: the BeeProject soundtrack', () => {
  it('import, trim to 41 s, paste the 39 s section at 16 s, trim again, fade out, mono, lossy export', async () => {
    const s = session();
    await s.open(PIANO); // 11.16
    s.audio.select({ start: 41, end: 60 }); // 11.17 trim to the video's length
    s.audio.cut();
    await s.open(PIANO); // 11.18 a copy as a second track
    s.pick('piano_stereo_60s', 39, 40);
    s.audio.copy();
    const [first, second] = s.doc().tracks;
    s.audio.select({ start: 16, end: 16, tracks: [first!.id] });
    s.audio.paste();
    expect(first!.id).not.toBe(second!.id);
    s.audio.select({ start: 0, end: 0, tracks: [second!.id] });
    s.audio.removeTracks();
    expect(s.doc().tracks).toHaveLength(1);
    expect(s.doc().tracks[0]!.channels[0]!.length / 44100).toBeCloseTo(42, 5); // "about 50 s" in the book
    s.pick('piano_stereo_60s', 41, 60); // trim to the right length again (click the track first)
    s.audio.cut();
    expect(s.audio.store.get().message).toBeNull();
    s.audio.select({ start: 36, end: 41 }); // 11.19 fade out the last five seconds
    s.audio.applyEffect('audio.fadeout', {});
    s.audio.stereoToMono(); // 11.27
    const file = await s.exportAs('BeeProject_sound.mp3', { channels: 1 }); // 11.29 lossy

    const info = await engine.probe(file);
    expect(info.duration!).toBeCloseTo(41, 1);
    expect(info.audio).toMatchObject({ codec: 'mp3', channels: 1 });
    const [out] = (await engine.decodeAudio(file)).channels;
    expect(rms(out!, 44100, 16.1, 16.9)).toBeGreaterThan(2 * rms(out!, 44100, 10, 15)); // the paste
    expect(rms(out!, 44100, 40.95, 41)).toBeLessThan(0.02); // faded out
  });

  it('11.25 speed up the voiceover intro, then undo it: the samples are exactly as before', async () => {
    const s = session();
    await s.open(VOICE);
    const original = s.doc().tracks[0]!.channels;
    s.audio.selectAll();
    expect(s.audio.applyEffect('audio.speed', { speed: 1.5, percent: 50 })).toBeNull();
    expect(s.doc().tracks[0]!.channels[0]!.length).toBe(Math.round(original[0]!.length / 1.5));
    s.audio.undo();
    expect(sameSamples(s.doc().tracks[0]!.channels, original)).toBe(true);
  });

  it('11.26 normalise to +2 dB and −1 dB, with and without DC offset; removing them all restores the sound', async () => {
    const s = session();
    await s.open(PIANO);
    const original = s.doc().tracks[0]!.channels;
    s.audio.selectAll();
    for (const [peakDb, removeDc] of [
      [2, 1],
      [2, 0],
      [-1, 1],
      [-1, 0],
    ] as const) {
      const params = { removeDc, normalisePeak: 1, peak: peakDb };
      if (peakDb > 0) expect(s.audio.effectNote('audio.normalise', params)).toMatch(/clipped/);
      expect(s.audio.applyEffect('audio.normalise', params)).toBeNull();
    }
    expect(peak(s.doc().tracks[0]!.channels)).toBeCloseTo(0.891, 2);
    for (let i = 0; i < 4; i++) s.audio.undo();
    expect(sameSamples(s.doc().tracks[0]!.channels, original)).toBe(true);
  });
});

describe('A16 the same sound at other sample rates and resolutions', () => {
  it('WAV 48 kHz / 24-bit, FLAC, M4A and a mono 8 kHz MP3 probe as chosen', async () => {
    const s = session();
    await s.open(VOICE);
    const wav = await s.exportAs('voice48k24.wav', {
      format: 'wav',
      sampleRate: 48000,
      bitDepth: 24,
      channels: 1,
    });
    expect((await engine.probe(wav)).audio).toMatchObject({
      sampleRate: 48000,
      bitDepth: 24,
      channels: 1,
    });
    const phone = await s.exportAs('voice8k.mp3', { sampleRate: 8000, bitRate: 32, channels: 1 });
    expect((await engine.probe(phone)).audio).toMatchObject({ sampleRate: 8000, channels: 1 });
    const flac = await s.exportAs('voice.flac', { format: 'flac', channels: 1 });
    const m4a = await s.exportAs('voice.m4a', { format: 'm4a', channels: 1 });
    const sizes = await Promise.all(
      [wav, flac, m4a, phone].map(async (f) => (await engine.probe(f)).sizeBytes),
    );
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a)); // WAV > FLAC > M4A > 8 kHz MP3
  });
});

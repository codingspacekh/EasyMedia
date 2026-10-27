// Book B (video_audio_editing.pdf) practice questions 1–7: the Bali tourism video, done through
// the app's use cases (what the buttons call), with real FFmpeg, and checked on the files made.
// EQ11-* are stood in for by fixtures of the same kind (scripts/lib/fixtures.ts). The words are
// drawn by a stand-in text renderer: a white block exactly where the app's layout puts them.
// Book inconsistencies, decided as in docs/MILESTONES.md (M12): "Bali1.mp3" / "EQ11-Bali2.mp3"
// in the storyboard are the .mp4 clips; Bali2 is shown 6 s (not 7) so the storyboard times hold
// with no transition; the sound's times are read after its first 2 s are removed.
import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile, copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp, type App } from '../../src/app/app.ts';
import { SILENT_OUTPUT } from '../../src/app/audio.ts';
import {
  addTextItem,
  setClipMuted,
  setClipSpeed,
  setDuration,
  setProjectSettings,
  setText,
  setTextEffects,
  setTextStyle,
  setTitleBackground,
} from '../../src/app/commands.ts';
import { audioEffectById } from '../../src/core/effects/registry.ts';
import { createTextItem } from '../../src/core/model/factory.ts';
import type { MainItem, TextStyle } from '../../src/core/model/types.ts';
import type { Dialogs, TextRenderer } from '../../src/core/ports.ts';
import { defaultAudioExport } from '../../src/core/render/audio-formats.ts';
import { presetSettings } from '../../src/core/render/formats.ts';
import type { Size, TextImageMode } from '../../src/core/text/draw.ts';
import { layoutText } from '../../src/core/text/layout.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import {
  brightness,
  countPixels,
  grayFrame,
  measure,
  rms,
} from '../integration/helpers/measure.ts';
import { engine, projectFolder } from './helpers.ts';

const BALI1 = 'bali1_720p_5.74s.mp4'; // EQ11-Bali1.mp4
const BALI2 = 'bali2_1080p_7.64s.mp4'; // EQ11-Bali2.mp4
const BALI3 = 'bali3_4x3_3s.mp4'; // EQ11-Bali3.mp4
const BAMBOO = 'bamboo_hiss_40s.mp3'; // EQ11-Bamboo.mp3
const RATE = 44100;
const run = promisify(execFile);

let folder: Awaited<ReturnType<typeof projectFolder>>;
const out = (name: string) => folder.file(`out/${name}`);
beforeAll(async () => {
  folder = await projectFolder([BALI1, BALI2, BALI3, BAMBOO]);
  await mkdir(folder.file('out'), { recursive: true });
}, 120_000);
afterAll(() => folder.cleanUp());

/** A white block where the app's layout puts the words (the real app draws them on a canvas). */
const blockText: TextRenderer = {
  async draw(text: string, style: TextStyle, frame: Size, mode: TextImageMode) {
    const measure = (t: string, font: string) => t.length * 0.55 * Number(/(\d+)px/.exec(font)![1]);
    const { box } = layoutText(text, style, frame, measure);
    const px = (style.size * frame.height) / 1080;
    const [width, height] =
      mode === 'frame' ? [frame.width, frame.height] : [frame.width, Math.ceil(box.height + px)];
    const [x, y] = mode === 'frame' ? [box.x, box.y] : [box.x, px / 2];
    const file = folder.file(`text-${Math.random().toString(36).slice(2)}.png`);
    await run(bundledFfmpeg().ffmpeg, [
      ...['-v', 'error', '-f', 'lavfi', '-i'],
      `color=c=white:s=${Math.max(1, Math.round(box.width))}x${Math.max(1, Math.round(box.height))},format=rgba,pad=${width}:${height}:${Math.round(x)}:${Math.round(y)}:color=black@0`,
      ...['-frames:v', '1', '-y', file],
    ]);
    const png = new Uint8Array(await readFile(file));
    return { png, width, height, anchor: { x: box.x + box.width / 2, y: box.y + box.height / 2 } };
  },
};

/** The app as the student uses it, with dialogs that answer as the student would. */
function session() {
  const dialogs = {
    openMedia: vi.fn<Dialogs['openMedia']>(async () => []),
    openProject: vi.fn<Dialogs['openProject']>(async () => null),
    saveProject: vi.fn<Dialogs['saveProject']>(async () => null),
    exportVideo: vi.fn<Dialogs['exportVideo']>(async () => null),
    exportAudio: vi.fn<Dialogs['exportAudio']>(async () => null),
    confirm: vi.fn<Dialogs['confirm']>(async () => true),
    chooseFolder: vi.fn<Dialogs['chooseFolder']>(async () => null),
    unsavedChanges: vi.fn<Dialogs['unsavedChanges']>(async () => 'discard'),
    openTaskCheck: vi.fn<Dialogs['openTaskCheck']>(async () => null),
    saveTaskCheck: vi.fn<Dialogs['saveTaskCheck']>(async () => null),
    openAnimation: vi.fn<Dialogs['openAnimation']>(async () => null),
    saveAnimation: vi.fn<Dialogs['saveAnimation']>(async () => null),
    exportAnimation: vi.fn<Dialogs['exportAnimation']>(async () => null),
  };
  const app: App = createApp({
    engine,
    dialogs,
    files: {
      read: (p) => readFile(p, 'utf8'),
      write: async (p, t) => {
        await mkdir(dirname(p), { recursive: true });
        await writeFile(`${p}.saving`, t);
        await rename(`${p}.saving`, p);
      },
      remove: (p) => rm(p, { force: true }),
      copy: (from, to) => copyFile(from, to),
      saveImage: async (name, png) => {
        const path = folder.file(`${name}.png`);
        await writeFile(path, png);
        return path;
      },
      writeBytes: async (p, b) => {
        await mkdir(dirname(p), { recursive: true });
        await writeFile(p, b);
      },
    },
    text: blockText,
    paths: {
      proxies: folder.file('cache'),
      recovery: folder.file('cache/recovery.mve'),
      snapshots: folder.file('out'),
      learn: folder.file('cache/learn'),
    },
    audioOutput: SILENT_OUTPUT,
  });
  const present = () => app.store.get().history.present;
  return {
    app,
    present,
    async importFiles(...paths: string[]) {
      dialogs.openMedia.mockResolvedValueOnce(paths);
      await app.importMedia();
    },
    /** Adds an imported file to the end of the timeline; gives its timeline item. */
    add(path: string): MainItem {
      app.addToTimeline(present().media.find((m) => m.path === path)!.id);
      return present().timeline.main.at(-1)!;
    },
    async exportVideo(name: string, preset: Parameters<typeof presetSettings>[0] = 'youtube') {
      dialogs.exportVideo.mockResolvedValueOnce(out(name));
      await app.exportVideo({ format: presetSettings(preset, present().settings) });
      expect(app.store.get().exporting).toEqual({ state: 'done', output: out(name) });
      return out(name);
    },
    dialogs,
  };
}

const FULL_HD = { aspect: '16:9' as const, width: 1920, height: 1080 };
/**
 * How much hiss there is: the mean size of the second difference of the samples (a steep
 * high-pass), compared with the loudest sample. A 523 Hz tone hardly changes it; hiss does.
 */
const hiss = (c: Float32Array, from: number, to: number) => {
  let sum = 0;
  const a = Math.round(from * RATE) + 2;
  const b = Math.round(to * RATE);
  for (let i = a; i < b; i++) sum += Math.abs(c[i]! - 2 * c[i - 1]! + c[i - 2]!);
  return sum / (b - a) / peak(c, from, to);
};
const peak = (c: Float32Array, from: number, to: number) =>
  c
    .subarray(Math.round(from * RATE), Math.round(to * RATE))
    .reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('Book B practice questions: the Bali tourism video', { timeout: 600_000 }, () => {
  let sound: string; // Bali_sound.mp3
  let bali1: string;
  let bali3: string;
  let stills: { first: string; last: string };
  let video: string;

  beforeAll(async () => {
    // ---- 1: the sound ----
    const s = session();
    const audio = s.app.audio;
    s.dialogs.openMedia.mockResolvedValueOnce([folder.file(BAMBOO)]);
    await audio.importAudio();
    const track = () => audio.store.get().history.present.tracks[0]!;
    const select = (start: number, end: number) =>
      audio.select({ start, end, tracks: [track().id] });
    const original = (await engine.decodeAudio(folder.file(BAMBOO))).channels[0]!;
    // Noise reduction: the profile from the hiss alone (the first 2 s), then all the sound.
    select(0, 2);
    expect(audio.getNoiseProfile()).toBeNull();
    audio.selectAll();
    expect(audio.applyEffect('audio.noise', audio.effectSettings('audio.noise'))).toBeNull();
    // Amplify from 8 s to the end: the largest gain without clipping (what the dialog suggests).
    select(8, 40);
    const amplify = audio.effectSettings('audio.amplify');
    expect(audioEffectById('audio.amplify')!.params).toHaveProperty('gain');
    expect(audio.applyEffect('audio.amplify', amplify)).toBeNull();
    // Remove the first 2 s; insert silence from 17.7 to 25.4 s; the fades; end at 37.3 s.
    select(0, 2);
    audio.deleteSelection();
    select(17.7, 17.7);
    expect(audio.insertSilence(7.7)).toBeNull();
    select(16.7, 17.7);
    expect(audio.applyEffect('audio.fadeout', {})).toBeNull();
    select(25.4, 26.4);
    expect(audio.applyEffect('audio.fadein', {})).toBeNull();
    select(35.3, 37.3);
    expect(audio.applyEffect('audio.fadeout', {})).toBeNull();
    select(37.3, 60);
    audio.deleteSelection();
    expect(audio.store.get().message).toBeNull();
    s.dialogs.exportAudio.mockResolvedValueOnce(out('Bali_sound.mp3'));
    await audio.exportAudio({
      ...defaultAudioExport({ rate: RATE, channels: 2 }),
      format: 'mp3',
      sampleRate: 44100,
      channels: 2,
    });
    sound = out('Bali_sound.mp3');
    soundChecks.original = original;

    // ---- 2–4: Bali1.mp4 and the stills from its first and last frames ----
    const v = session();
    v.app.edit(setProjectSettings(FULL_HD));
    await v.importFiles(folder.file(BALI1));
    const clip1 = v.add(folder.file(BALI1));
    v.app.edit(setClipMuted(clip1.id, true));
    bali1 = await v.exportVideo('Bali1.mp4');
    const last = (await measure(bali1)).videoDuration - 1 / 30;
    const first = await v.app.snapshot({
      time: 0,
      hideText: true,
      addToTimeline: false,
      duration: 5,
      name: 'Bali1',
    });
    const lastId = await v.app.snapshot({
      time: last,
      hideText: true,
      addToTimeline: false,
      duration: 5,
      name: 'Bali2',
    });
    const pathOf = (id: string | null) => v.present().media.find((m) => m.id === id)!.path;
    stills = { first: pathOf(first), last: pathOf(lastId) };

    // ---- 5: Bali3.mp4, a quarter of the speed ----
    const w = session();
    w.app.edit(setProjectSettings(FULL_HD));
    await w.importFiles(folder.file(BALI3));
    const clip3 = w.add(folder.file(BALI3));
    w.app.edit(setClipMuted(clip3.id, true));
    w.app.edit(setClipSpeed(clip3.id, 0.25));
    bali3 = await w.exportVideo('Bali3.mp4');

    // ---- 6–7: the storyboard, exported for a Blu-ray player ----
    const b = session();
    b.app.edit(setProjectSettings(FULL_HD));
    await b.importFiles(stills.first, stills.last, bali1, folder.file(BALI2), bali3);
    const sans: Partial<TextStyle> = { font: 'Inter' };
    // 0 s: Bali1 for 6 s with the title "Bali" in the top-right corner.
    b.app.addTitle();
    const title = b.present().timeline.main[0]!;
    const still1 = b.present().media.find((m) => m.path === stills.first)!;
    b.app.edit(setTitleBackground(title.id, { kind: 'image', assetId: still1.id }));
    b.app.edit(setText(title.id, 'Bali'));
    b.app.edit(
      setTextStyle(title.id, { ...sans, position: 'top-right', align: 'right', size: 96 }),
    );
    b.app.edit(setDuration(title.id, 6));
    // 6 s: Bali1.mp4; 11.74 s: Bali2 for 6 s with the caption in phrases; then EQ11-Bali2, Bali3.
    b.add(bali1);
    const still2 = b.add(stills.last);
    b.app.edit(setDuration(still2.id, 6));
    const clip2 = b.add(folder.file(BALI2));
    b.app.edit(setClipMuted(clip2.id, true));
    b.add(bali3);
    const starts = (() => {
      let t = 0;
      return b.present().timeline.main.map((m) => {
        const at = t;
        t += m.type === 'video' ? (m.out - m.in) / m.speed : m.duration;
        return at;
      });
    })();
    storyboard.starts = starts;
    const caption = createTextItem(
      'caption',
      'for forested volcanic mountains,\niconic rice paddies,\nbeaches and coral reefs',
      starts[2]!,
      { id: 'caption' },
    );
    b.app.edit(addTextItem({ ...caption, duration: 6, style: { ...caption.style, ...sans } }));
    const credits = createTextItem(
      'credits',
      'Edited by:\nA Student\n\nVideo:\nGBRvideo\n\nAudio:\nKarla Marie',
      starts[4]!,
      { id: 'credits' },
    );
    b.app.edit(
      addTextItem({
        ...credits,
        duration: 12,
        style: { ...credits.style, ...sans, position: 'left', align: 'left', size: 28 },
      }),
    );
    b.app.edit(setTextEffects('credits', { scroll: true }));
    // The sound from 0 s.
    b.app.setPlayhead(0);
    b.dialogs.openMedia.mockResolvedValueOnce([sound]);
    await b.app.addMusic();
    expect(b.app.store.get().message?.kind).not.toBe('error');
    video = await b.exportVideo('Bali_video.mp4', 'bluray');
  }, 600_000);

  const soundChecks: { original: Float32Array } = { original: new Float32Array() };
  const storyboard = { starts: [] as number[] };

  it('1: Bali_sound.mp3 is stereo 44.1 kHz and 37.3 s long', async () => {
    const info = await engine.probe(sound);
    expect(info.audio).toMatchObject({ codec: 'mp3', channels: 2, sampleRate: 44100 });
    expect(Math.abs(info.duration! - 37.3)).toBeLessThan(0.06);
  });

  it('1: the background noise is reduced and the music after 6 s (8 s before the cut) is as loud as it can be', async () => {
    const [left] = (await engine.decodeAudio(sound)).channels;
    // Before: hiss makes the sound rough. After: much smoother, louder music (more amplified).
    expect(hiss(left!, 8, 12)).toBeLessThan(hiss(soundChecks.original, 10, 14) / 3);
    expect(peak(left!, 6.5, 16)).toBeGreaterThan(0.85); // just below clipping (MP3 changes peaks a little)
    expect(peak(left!, 0, 5.5)).toBeLessThan(peak(left!, 6.5, 16) / 2); // the start is not amplified
  });

  it('1: silent from 17.7 to 25.4 s, with the fades around it and at the end', async () => {
    const [left] = (await engine.decodeAudio(sound)).channels;
    expect(peak(left!, 17.75, 25.35)).toBeLessThan(0.01);
    expect(peak(left!, 17.5, 17.7)).toBeLessThan(peak(left!, 15, 16.5) / 3); // fading out
    expect(peak(left!, 25.4, 25.6)).toBeLessThan(peak(left!, 27, 30) / 3); // fading in
    expect(peak(left!, 37.0, 37.25)).toBeLessThan(peak(left!, 33, 35) / 3); // fading out at the end
  });

  it('2: Bali1.mp4 is 1920 × 1080 (16:9) with no sound, as long as the clip', async () => {
    const m = await measure(bali1);
    expect([m.width, m.height]).toEqual([1920, 1080]);
    expect(m.audioDuration).toBeUndefined();
    expect(Math.abs(m.videoDuration - 5.74)).toBeLessThan(0.05);
  });

  it('3–4: the stills Bali1 and Bali2 are its first (dark) and last (bright) frames, ready to import', async () => {
    expect(stills.first).toMatch(/[\\/]Bali1\.png$/);
    expect(stills.last).toMatch(/[\\/]Bali2\.png$/);
    expect((await engine.probe(stills.first)).kind).toBe('image');
    expect(await brightness(stills.first, 0)).toBeLessThan(30);
    expect(await brightness(stills.last, 0)).toBeGreaterThan(190);
  });

  it('5: Bali3.mp4 is 1920 × 1080 with no sound, 4 × as long (12 s), with black at the sides', async () => {
    const m = await measure(bali3);
    expect([m.width, m.height]).toEqual([1920, 1080]);
    expect(m.audioDuration).toBeUndefined();
    expect(Math.abs(m.videoDuration - 12)).toBeLessThan(0.05);
    const frame = await grayFrame(bali3, 6);
    expect(frame.at(100, 540)).toBeLessThan(20); // the black area on the left
  });

  it('6: the storyboard times: 0, 6, 11.74, 17.74 and 25.38 s', () => {
    const want = [0, 6, 11.74, 17.74, 25.38];
    // Clips are whole frames long, so the times may be a few frames later than the book's.
    storyboard.starts.forEach((t, i) => expect(Math.abs(t - want[i]!)).toBeLessThan(0.1));
  });

  it('6–7: Bali_video.mp4 for a Blu-ray player: Full HD H.264 with the sound, 37.4 s', async () => {
    const info = await engine.probe(video);
    expect(info.video).toMatchObject({ codec: 'h264', width: 1920, height: 1080 });
    expect(info.audio).toBeDefined();
    expect(Math.abs((await measure(video)).videoDuration - 37.38)).toBeLessThan(0.1);
  });

  it('6: each part of the storyboard shows the right picture, words and sound', async () => {
    const teal = (r: number, g: number, b: number) => g > 120 && b > 110 && r < 90;
    const orange = (r: number, g: number, b: number) => r > 190 && g > 80 && g < 150 && b < 120;
    // 3 s: the dark still with "Bali" top right.
    const at3 = (await grayFrame(video, 3)).brightBox()!;
    expect(at3.x0).toBeGreaterThan(1300);
    expect(at3.y1).toBeLessThan(400);
    // 9 s: the Bali1 clip, 3 s in (luma 16 + 35 × 3).
    expect(Math.abs((await brightness(video, 9)) - 121)).toBeLessThan(15);
    // 15 s: the bright still with the caption (white words on it).
    expect(await brightness(video, 15)).toBeGreaterThan(190);
    // 21 s: EQ11-Bali2 (teal); 30 s: Bali3 (orange) with credits in the black area on the left.
    expect(await countPixels(video, 21, teal)).toBeGreaterThan(1920 * 1080 * 0.9);
    expect(await countPixels(video, 30, orange)).toBeGreaterThan(1440 * 1080 * 0.8);
    const credits = (await grayFrame(video, 31)).brightBox(200)!; // white words, not the orange
    expect(credits.x0).toBeLessThan(240);
    expect(credits.x1).toBeLessThan(480);
    // The sound plays, with its silent part.
    expect(await rms(video, 2, 10)).toBeGreaterThan(0.05);
    expect(await rms(video, 18, 25)).toBeLessThan(0.005);
  });
});

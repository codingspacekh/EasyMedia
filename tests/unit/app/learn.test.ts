// Learn mode's use cases (M11): inspecting a file (T1), the compression comparison (T3) and the
// task checker (T6). Learn mode never changes the project.
import { describe, expect, it, vi } from 'vitest';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import { serializeTaskSpec, type TaskSpec } from '../../../src/core/teaching/task-check.ts';
import { testApp, VIDEO } from '../../helpers/test-app.ts';
import { createAnimation } from '../../../src/core/animation/factory.ts';
import { webPage } from '../../../src/core/animation/html.ts';

const SONG: ProbeInfo = {
  kind: 'audio',
  container: 'mp3',
  duration: 120,
  sizeBytes: 1_920_000,
  audio: { codec: 'mp3', sampleRate: 44100, channels: 2, bitRate: 128_000 },
};
const SHORT: ProbeInfo = { ...SONG, duration: 4 };
const PNG_FRAME: ProbeInfo = {
  kind: 'image',
  container: 'png',
  sizeBytes: 9000,
  video: { codec: 'png', width: 600, height: 400 },
};
const PHOTO: ProbeInfo = {
  kind: 'image',
  container: 'png',
  sizeBytes: 1000,
  video: { codec: 'png', width: 800, height: 600 },
};

function setup() {
  const t = testApp({
    '/m/clip.mp4': VIDEO,
    '/m/song.mp3': SONG,
    '/m/short.mp3': SHORT,
    '/m/photo.png': PHOTO,
  });
  const learn = t.app.learn;
  return { ...t, learn, state: () => learn.store.get() };
}

describe('T1 inspecting a file', () => {
  it('asks for a file and shows what is inside it', async () => {
    const s = setup();
    s.dialogs.openMedia.mockResolvedValueOnce(['/m/song.mp3']);
    await s.learn.inspect();
    expect(s.state().inspected).toMatchObject({
      path: '/m/song.mp3',
      name: 'song.mp3',
      info: SONG,
    });
  });

  it('a dropped file is inspected straight away; cancelling the dialog keeps the last one', async () => {
    const s = setup();
    await s.learn.inspect('/m/clip.mp4');
    await s.learn.inspect();
    expect(s.state().inspected!.name).toBe('clip.mp4');
  });

  it('a file that cannot be read says why', async () => {
    const s = setup();
    await s.learn.inspect('/m/missing.mp4');
    expect(s.state().message?.kind).toBe('error');
    expect(s.state().inspected).toBeNull();
  });

  it('does not change the project', async () => {
    const s = setup();
    const before = s.app.store.get();
    await s.learn.inspect('/m/clip.mp4');
    await s.learn.compareVideo();
    expect(s.app.store.get()).toBe(before);
  });
});

describe('T3 compression comparison', () => {
  it('audio: the first 10 s as WAV, FLAC and MP3 192 / 128 / 64 kbps, with real sizes and savings', async () => {
    const s = setup();
    const encode = vi.spyOn(s.engine, 'encodeAudio');
    await s.learn.inspect('/m/song.mp3');
    await s.learn.compareAudio();
    const c = s.state().comparison!;
    expect(c).toMatchObject({ kind: 'audio', seconds: 10 });
    expect(c.items.map((i) => i.label)).toEqual([
      'WAV · lossless',
      'FLAC · lossless',
      'MP3 192 kbps',
      'MP3 128 kbps',
      'MP3 64 kbps',
    ]);
    expect(encode.mock.calls[0]![0].channels[0]!.length).toBe(441_000);
    expect(c.items[0]!.path).toBe('/cache/learn/compare-1.wav');
    const wav = c.items[0]!.bytes;
    expect(wav).toBeGreaterThan(1_700_000);
    expect(c.items[0]!.saving).toBe(0);
    expect(c.items[3]!.saving).toBeCloseTo(1 - c.items[3]!.bytes / wav, 9);
    expect(c.items[3]!.saving).toBeGreaterThan(0.85);
    const sizes = c.items.map((i) => i.bytes);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });

  it('audio shorter than 10 s is compared whole', async () => {
    const s = setup();
    await s.learn.inspect('/m/short.mp3');
    await s.learn.compareAudio();
    expect(s.state().comparison!.seconds).toBe(4);
  });

  it('video: the first 5 s lossless, as a high-quality MP4, and smaller MP4s', async () => {
    const s = setup();
    await s.learn.inspect('/m/clip.mp4');
    await s.learn.compareVideo();
    const c = s.state().comparison!;
    expect(c).toMatchObject({ kind: 'video', seconds: 5 });
    expect(c.items.map((i) => i.label)).toEqual([
      'Lossless · 1920 × 1080',
      'MP4 high · 1920 × 1080',
      'MP4 · 640 × 360',
      'MP4 · 426 × 240',
    ]);
    expect(c.items.map((i) => i.path)).toEqual([
      '/cache/learn/compare-1.avi',
      '/cache/learn/compare-2.mp4',
      '/cache/learn/compare-3.mp4',
      '/cache/learn/compare-4.mp4',
    ]);
    const sizes = c.items.map((i) => i.bytes);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
    expect(s.state().busy).toBeNull();
    // Players cannot show the lossless AVI: one exact frame of it is shown instead.
    expect(c.items[0]!.still).toBe('/cache/learn/compare-1.png');
    expect((await s.engine.probe('/cache/learn/compare-1.png')).container).toBe('png');
    expect(c.items.slice(1).map((i) => i.still)).toEqual([undefined, undefined, undefined]);
  });

  it('needs a file with sound (audio) or a picture that moves (video)', async () => {
    const s = setup();
    await s.learn.compareAudio();
    expect(s.state().message?.text).toMatch(/Inspect a file first/);
    await s.learn.inspect('/m/photo.png');
    await s.learn.compareAudio();
    expect(s.state().message?.text).toMatch(/no sound/);
    await s.learn.compareVideo();
    expect(s.state().message?.text).toMatch(/not a video/);
    expect(s.state().comparison).toBeNull();
  });

  it('inspecting another file clears the comparison', async () => {
    const s = setup();
    await s.learn.inspect('/m/song.mp3');
    await s.learn.compareAudio();
    await s.learn.inspect('/m/clip.mp4');
    expect(s.state().comparison).toBeNull();
  });
});

describe('T6 task checker', () => {
  const spec: TaskSpec = { name: 'Task 11b', container: 'mp4', width: 1920, height: 1080 };

  it('the teacher saves the task as a file', async () => {
    const s = setup();
    s.learn.setTask(spec);
    s.dialogs.saveTaskCheck.mockResolvedValueOnce('/t/Task 11b.mvetask');
    await s.learn.saveTask();
    expect(s.dialogs.saveTaskCheck).toHaveBeenCalledWith('Task 11b');
    expect(s.state().message).toEqual({ kind: 'info', text: 'Saved Task 11b.mvetask' });
  });

  it('a student opens it and checks their export: pass or fail for each row', async () => {
    const s = setup();
    s.learn.setTask(spec);
    s.dialogs.saveTaskCheck.mockResolvedValueOnce('/t/a.mvetask');
    await s.learn.saveTask();
    s.learn.setTask({ name: 'something else', channels: 1 });
    s.dialogs.openTaskCheck.mockResolvedValueOnce('/t/a.mvetask');
    await s.learn.openTask();
    expect(s.state().task.spec).toEqual(spec);
    s.dialogs.openExport.mockResolvedValueOnce(['/m/clip.mp4']);
    await s.learn.checkExport();
    expect(s.state().task.checked).toMatchObject({ name: 'clip.mp4', pass: true });
    s.learn.setTask({ ...spec, width: 1280, height: 720 });
    expect(s.state().task.checked).toBeNull(); // a changed task needs a new check
  });

  it('AN17 an exported web page is checked from the animation it carries: size, fps, length, looping', async () => {
    const s = setup();
    const doc = createAnimation({ name: 'Task 4' });
    const html = webPage(
      { ...doc, stage: { ...doc.stage, width: 600, height: 400, fps: 24, length: 72 } },
      { player: '', pictures: {}, fonts: [] },
    );
    s.disk.set('/e/Task4.html', html);
    s.learn.setTask({
      name: 'Task 4',
      container: 'html',
      width: 600,
      height: 400,
      fps: 24,
      duration: 3,
      loop: true,
    });
    s.dialogs.openExport.mockResolvedValueOnce(['/e/Task4.html']);
    await s.learn.checkExport();
    expect(s.state().task.checked).toMatchObject({ name: 'Task4.html', pass: true });
    s.disk.set('/e/other.html', '<html>not ours</html>');
    s.dialogs.openExport.mockResolvedValueOnce(['/e/other.html']);
    await s.learn.checkExport();
    expect(s.state().message?.text).toMatch(/not a web animation exported by EasyMedia/);
  });

  it('AN17 every picture of a PNG sequence chosen together is checked as one sequence', async () => {
    const frames = Array.from(
      { length: 72 },
      (_, i) => `/e/Task_${String(i + 1).padStart(4, '0')}.png`,
    );
    const t = testApp(Object.fromEntries(frames.map((f) => [f, PNG_FRAME])));
    const s = { ...t, learn: t.app.learn, state: () => t.app.learn.store.get() };
    s.learn.setTask({
      name: 'Frames',
      container: 'png',
      width: 600,
      height: 400,
      fps: 24,
      duration: 3,
    });
    s.dialogs.openExport.mockResolvedValueOnce(frames);
    await s.learn.checkExport();
    expect(s.state().task.checked).toMatchObject({
      name: 'Task_0001.png … (72 pictures)',
      pass: true,
    });
    s.dialogs.openExport.mockResolvedValueOnce(frames.slice(0, 48));
    await s.learn.checkExport();
    expect(s.state().task.checked?.pass).toBe(false);
    // Two videos are not a sequence.
    const v = setup();
    v.dialogs.openExport.mockResolvedValueOnce(['/m/clip.mp4', '/m/clip.mp4']);
    await v.learn.checkExport();
    expect(v.state().message?.text).toMatch(/every picture of a PNG sequence/);
  });

  it('a file that is not a task check is refused, and the task stays', async () => {
    const s = setup();
    s.learn.setTask(spec);
    s.dialogs.saveProject.mockResolvedValueOnce('/t/p.mve');
    await s.app.saveAs();
    s.dialogs.openTaskCheck.mockResolvedValueOnce('/t/p.mve');
    await s.learn.openTask();
    expect(s.state().message?.text).toMatch(/not an EasyMedia task check/);
    expect(s.state().task.spec).toEqual(spec);
    expect(serializeTaskSpec(spec)).toContain('easymedia-task-check');
  });
});

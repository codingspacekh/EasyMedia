import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, isDirty, projectTitle, type AppState } from '../../../src/app/app.ts';
import {
  addMainItem,
  addTextItem,
  setClipSpeed,
  setTextEffects,
  trimClip,
} from '../../../src/app/commands.ts';
import { canUndo } from '../../../src/app/history.ts';
import { proxyPathFor } from '../../../src/app/proxy-path.ts';
import { createMockMediaEngine } from '../../../src/adapters/mock/media-engine.ts';
import {
  createProject,
  createTextItem,
  createTitleSlide,
} from '../../../src/core/model/factory.ts';
import type { Dialogs, JobEvent, ProbeInfo, TextRenderer } from '../../../src/core/ports.ts';
import { defaultExport, estimateSize } from '../../../src/core/render/formats.ts';

const video = (sizeBytes = 7_000_000): ProbeInfo => ({
  kind: 'video',
  container: 'mp4',
  duration: 10,
  sizeBytes,
  video: { codec: 'h264', width: 1920, height: 1080, fps: 30 },
  audio: { codec: 'aac', sampleRate: 44100, channels: 2 },
});
const image: ProbeInfo = {
  kind: 'image',
  container: 'jpg',
  sizeBytes: 1,
  video: { codec: 'mjpeg', width: 100, height: 100 },
};
const sound: ProbeInfo = {
  kind: 'audio',
  container: 'mp3',
  duration: 30,
  sizeBytes: 1,
  audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
};

function setup(
  media: Record<string, ProbeInfo> = {
    '/m/clip.mp4': video(),
    '/m/photo.jpg': image,
    '/m/music.mp3': sound,
  },
) {
  const engine = createMockMediaEngine(media);
  const events: JobEvent[] = [];
  engine.onJobEvent((e) => events.push(e));
  const disk = new Map<string, string>();
  const dialogs = {
    openMedia: vi.fn<Dialogs['openMedia']>(async () => []),
    openProject: vi.fn<Dialogs['openProject']>(async () => null),
    saveProject: vi.fn<Dialogs['saveProject']>(async () => null),
    exportVideo: vi.fn<Dialogs['exportVideo']>(async () => null),
    exportAudio: vi.fn<Dialogs['exportAudio']>(async () => null),
    confirm: vi.fn<Dialogs['confirm']>(async () => true),
    chooseFolder: vi.fn<Dialogs['chooseFolder']>(async () => null),
  };
  const copies: string[] = [];
  const files = {
    read: async (path: string) => {
      const text = disk.get(path);
      if (text === undefined) throw new Error('ENOENT');
      return text;
    },
    write: async (path: string, text: string) => void disk.set(path, text),
    remove: async (path: string) => void disk.delete(path),
    copy: async (from: string, to: string) => void copies.push(`${from} → ${to}`),
    saveImage: vi.fn(async (name: string) => `/cache/text/${name}.png`),
  };
  // Every text picture is 10 bytes; credits blocks are 300 px tall.
  const text = {
    draw: vi.fn<TextRenderer['draw']>(async (_t, _s, frame, mode) => ({
      png: new Uint8Array(10),
      width: frame.width,
      height: mode === 'block' ? 300 : frame.height,
    })),
  };
  const app = createApp({
    engine,
    dialogs,
    files,
    text,
    paths: { proxies: '/cache', recovery: '/cache/recovery.mve', snapshots: '/cache/snapshots' },
  });
  const state = () => app.store.get();
  const project = () => state().history.present;
  async function importFiles(...paths: string[]) {
    dialogs.openMedia.mockResolvedValueOnce(paths);
    await app.importMedia();
  }
  return { app, engine, events, disk, dialogs, copies, files, text, state, project, importFiles };
}

const idOf = (s: AppState, path: string) =>
  s.history.present.media.find((m) => m.path === path)!.id;

describe('M4 app use cases', () => {
  afterEach(() => vi.useRealTimers());

  describe('import (A1, preview proxies)', () => {
    it('imports a video: "preparing" with progress until its proxy is ready', async () => {
      const { app, state, project, importFiles } = setup();
      const progress: number[] = [];
      app.store.subscribe((s) => {
        const a = Object.values(s.assets)[0];
        if (a?.state === 'preparing') progress.push(a.progress);
      });
      await importFiles('/m/clip.mp4');
      expect(project().media).toMatchObject([
        { kind: 'video', path: '/m/clip.mp4', duration: 10, hasAudio: true },
      ]);
      const id = idOf(state(), '/m/clip.mp4');
      expect(state().assets[id]!.state).toBe('preparing');
      await vi.waitFor(() =>
        expect(state().assets[id]).toMatchObject({
          state: 'ready',
          proxyPath: expect.stringMatching(/^\/cache\/clip-/),
        }),
      );
      expect(progress).toContain(0.5);
    });

    it('a still image or sound file is ready at once, with no proxy', async () => {
      const { state, events, importFiles } = setup();
      await importFiles('/m/photo.jpg', '/m/music.mp3');
      expect(Object.values(state().assets).map((a) => a.state)).toEqual(['ready', 'ready']);
      expect(events.filter((e) => e.type === 'queued')).toHaveLength(0);
    });

    it('V13: a sound file gets its loudness peaks (10 per second) for drawing its waveform', async () => {
      const { state, importFiles } = setup();
      await importFiles('/m/music.mp3');
      await vi.waitFor(() => expect(Object.values(state().assets)[0]!.peaks).toHaveLength(300));
    });

    it('reuses a proxy made earlier for the same file', async () => {
      const { engine, events, state, importFiles } = setup();
      const existing = proxyPathFor('/cache', '/m/clip.mp4', 7_000_000);
      (engine as unknown as { addFile(p: string, i: ProbeInfo): void }).addFile(existing, video(1));
      await importFiles('/m/clip.mp4');
      await vi.waitFor(() =>
        expect(Object.values(state().assets)[0]).toMatchObject({
          state: 'ready',
          proxyPath: existing,
        }),
      );
      expect(
        events.filter((e) => e.type === 'queued' && e.label === 'Preparing preview'),
      ).toHaveLength(0);
    });

    it('explains a file that cannot be read and imports the others', async () => {
      const { state, project, importFiles } = setup();
      await importFiles('/m/gone.mp4', '/m/photo.jpg');
      expect(project().media).toHaveLength(1);
      expect(state().message).toMatchObject({
        kind: 'error',
        text: expect.stringMatching(/could not be found/i),
      });
    });

    it('explains a file that is already imported', async () => {
      const { state, project, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      await importFiles('/m/photo.jpg');
      expect(project().media).toHaveLength(1);
      expect(state().message?.text).toMatch(/already imported/i);
    });

    it('does nothing when the dialog is cancelled', async () => {
      const { app, project } = setup();
      await app.importMedia();
      expect(project().media).toEqual([]);
    });
  });

  describe('editing the main track (V3, A18)', () => {
    it('adds videos and stills to the timeline', async () => {
      const { app, state, project, importFiles } = setup();
      await importFiles('/m/clip.mp4', '/m/photo.jpg');
      app.addToTimeline(idOf(state(), '/m/clip.mp4'));
      app.addToTimeline(idOf(state(), '/m/photo.jpg'));
      expect(project().timeline.main.map((m) => m.type)).toEqual(['video', 'image']);
    });

    it('V13: a sound file goes on the music track at the playhead, and is selected', async () => {
      const { app, state, project, importFiles } = setup();
      await importFiles('/m/music.mp3');
      app.setPlayhead(5);
      app.addToTimeline(idOf(state(), '/m/music.mp3'));
      expect(project().timeline.main).toEqual([]);
      const [music] = project().timeline.audio[0];
      expect(music).toMatchObject({ start: 5, in: 0, out: 30 });
      expect(state().selection).toBe(music!.id);
    });

    it('V13: if the music track is busy there, the sound goes on the voiceover track; if both are, it says so', async () => {
      const { app, state, project, importFiles } = setup();
      await importFiles('/m/music.mp3');
      const id = idOf(state(), '/m/music.mp3');
      app.addToTimeline(id);
      app.addToTimeline(id);
      expect(project().timeline.audio.map((t) => t.length)).toEqual([1, 1]);
      app.addToTimeline(id);
      expect(state().message?.text).toMatch(/no free space/i);
    });

    it('V13 "Add music at the current point": imports the chosen sound and places it at the playhead', async () => {
      const { app, state, project, dialogs } = setup();
      app.setPlayhead(5);
      dialogs.openMedia.mockResolvedValueOnce(['/m/music.mp3']);
      await app.addMusic();
      expect(project().media.map((m) => m.path)).toEqual(['/m/music.mp3']);
      expect(project().timeline.audio[0]).toMatchObject([{ start: 5 }]);
      // A file already in the media bin is not imported twice.
      app.setPlayhead(40);
      dialogs.openMedia.mockResolvedValueOnce(['/m/music.mp3']);
      await app.addMusic();
      expect(project().media).toHaveLength(1);
      expect(project().timeline.audio[0].map((a) => a.start)).toEqual([5, 40]);
      expect(state().message).toBeNull();
    });

    it('"Add music" refuses a file that is not a sound', async () => {
      const { app, state, project, dialogs } = setup();
      dialogs.openMedia.mockResolvedValueOnce(['/m/photo.jpg']);
      await app.addMusic();
      expect(project().timeline.audio[0]).toEqual([]);
      expect(state().message?.text).toMatch(/choose a sound file/i);
    });

    it('selects, deletes, and undoes / redoes', async () => {
      const { app, state, project, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      app.addToTimeline(idOf(state(), '/m/photo.jpg'));
      const clipId = project().timeline.main[0]!.id;
      app.select(clipId);
      app.removeSelected();
      expect([project().timeline.main.length, state().selection]).toEqual([0, null]);
      app.undo();
      expect(project().timeline.main).toHaveLength(1);
      app.redo();
      expect(project().timeline.main).toHaveLength(0);
    });

    it('deleting with nothing selected changes nothing', async () => {
      const { app, state } = setup();
      const before = state().history;
      app.removeSelected();
      expect(state().history).toBe(before);
    });
  });

  describe('M5 edit: inspector changes report errors inline, not in the status bar', () => {
    async function withClip() {
      const t = setup();
      await t.importFiles('/m/clip.mp4');
      t.app.addToTimeline(idOf(t.state(), '/m/clip.mp4'));
      return { ...t, clipId: t.project().timeline.main[0]!.id };
    }

    it('applies a valid edit and returns no error', async () => {
      const { app, project, clipId } = await withClip();
      expect(app.edit(trimClip(clipId, { in: 2, out: 6 }))).toBeNull();
      expect(project().timeline.main[0]).toMatchObject({ in: 2, out: 6 });
    });

    it('returns the reason for an invalid edit, changes nothing, shows no banner', async () => {
      const { app, state, project, clipId } = await withClip();
      const before = project();
      expect(app.edit(trimClip(clipId, { in: 0, out: 25 }))).toMatch(/end of the clip/i);
      expect(app.edit(setClipSpeed(clipId, 9))).toMatch(/between 0\.25× and 4×/);
      expect(project()).toBe(before);
      expect(state().message).toBeNull();
    });
  });

  describe('resize & crop a still (V11)', () => {
    it('makes a thumbnail for a video from its preview copy, and remembers its size and frame rate', async () => {
      const { state, engine, importFiles } = setup();
      const thumbs = vi.spyOn(engine, 'makeThumbnails');
      await importFiles('/m/clip.mp4');
      await vi.waitFor(() =>
        expect(state().assets[idOf(state(), '/m/clip.mp4')]!.thumbPath).toBeDefined(),
      );
      const status = state().assets[idOf(state(), '/m/clip.mp4')]!;
      expect(status.thumbPath).toBe(status.proxyPath!.replace(/\.mp4$/, '-thumb.jpg'));
      expect(thumbs).toHaveBeenCalledWith(status.proxyPath, status.thumbPath, {
        count: 1,
        height: 180,
        duration: 10,
      });
      expect(status).toMatchObject({ size: { width: 1920, height: 1080 }, fps: 30 });
    });

    it('remembers the size of an imported picture', async () => {
      const { state, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      expect(state().assets[idOf(state(), '/m/photo.jpg')]!.size).toEqual({
        width: 100,
        height: 100,
      });
    });

    it('saves a new picture the size of the project beside the original, and imports it', async () => {
      const { app, state, project, engine, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      const id = await app.resizeCropImage(idOf(state(), '/m/photo.jpg'), 'bottom');
      expect(id).not.toBeNull();
      const made = project().media.find((m) => m.id === id)!;
      expect(made.path).toBe('/m/photo1.jpg');
      expect((await engine.probe('/m/photo1.jpg')).video).toMatchObject({
        width: 1920,
        height: 1080,
      });
      expect(project().media.map((m) => m.path)).toEqual(['/m/photo.jpg', '/m/photo1.jpg']);
      expect(state().message).toEqual({ kind: 'info', text: 'Saved photo1.jpg (1920 × 1080).' });
    });

    it('explains when the picture size is not known yet', async () => {
      const { app, state } = setup();
      expect(await app.resizeCropImage('nope', 'centre')).toBeNull();
      expect(state().message?.kind).toBe('error');
    });
  });

  describe('snapshot (V10)', () => {
    async function withTwo() {
      const s = setup();
      await s.importFiles('/m/clip.mp4', '/m/photo.jpg');
      s.app.addToTimeline(idOf(s.state(), '/m/clip.mp4')); // 0–10 s
      s.app.addToTimeline(idOf(s.state(), '/m/photo.jpg')); // 10–15 s
      return s;
    }

    it('adds the frame straight to the media — no save dialog — and puts it after that clip', async () => {
      const { app, engine, project, state } = await withTwo();
      const render = vi.spyOn(engine, 'renderFrame');
      const id = await app.snapshot({
        time: 9.97,
        hideText: true,
        addToTimeline: true,
        duration: 10,
        format: 'tiff',
      });
      // An unsaved project keeps its snapshots in the app's own snapshots folder.
      expect(render.mock.calls[0]![1]).toBe(9.97);
      expect(render.mock.calls[0]![2]).toBe('/cache/snapshots/Snapshot_9.97s.tiff');
      const made = project().media.find((m) => m.id === id)!;
      expect(made.path).toBe('/cache/snapshots/Snapshot_9.97s.tiff');
      expect((await engine.probe(made.path)).kind).toBe('image');
      const main = project().timeline.main;
      expect(main.map((m) => m.type)).toEqual(['video', 'image', 'image']);
      expect(main[1]).toMatchObject({ assetId: id, duration: 10 });
      expect(state().message).toEqual({
        kind: 'info',
        text: 'Added Snapshot_9.97s.tiff to the media.',
      });
    });

    it('a saved project keeps its snapshots in a Snapshots folder next to it', async () => {
      const { app, dialogs, project } = await withTwo();
      dialogs.saveProject.mockResolvedValueOnce('/m/Task_11d.mve');
      await app.save();
      const id = await app.snapshot({ time: 2, hideText: true, addToTimeline: false, duration: 5 });
      expect(project().media.find((m) => m.id === id)!.path).toBe(
        '/m/Snapshots/Snapshot_2.00s.png',
      );
    });

    it('a second snapshot of the same moment never overwrites the first', async () => {
      const { app, project } = await withTwo();
      const options = { time: 2, hideText: true, addToTimeline: false, duration: 5 };
      const first = await app.snapshot(options);
      const second = await app.snapshot(options);
      const path = (id: string | null) => project().media.find((m) => m.id === id)!.path;
      expect([path(first), path(second)]).toEqual([
        '/cache/snapshots/Snapshot_2.00s.png',
        '/cache/snapshots/Snapshot_2.00s2.png',
      ]);
    });

    it('with text hidden, the frame is made without captions or title words (Book A 11.11)', async () => {
      const { app, engine } = await withTwo();
      app.edit(addTextItem(createTextItem('caption', 'Bees', 0, { id: 'cap' })));
      const render = vi.spyOn(engine, 'renderFrame');
      await app.snapshot({ time: 2, hideText: true, addToTimeline: false, duration: 5 });
      expect(render.mock.calls[0]![0].timeline.text).toEqual([]);
      await app.snapshot({ time: 2, hideText: false, addToTimeline: false, duration: 5 });
      expect(render.mock.calls[1]![0].timeline.text).toHaveLength(1);
      expect(render.mock.calls[1]![3].textImages).toHaveProperty('cap');
    });
  });

  describe('adding text (V4, V5)', () => {
    it('adds a title slide after the selected clip and selects it, undoably', async () => {
      const { app, state, project, importFiles } = setup();
      await importFiles('/m/clip.mp4', '/m/photo.jpg');
      app.addToTimeline(idOf(state(), '/m/clip.mp4'));
      app.addToTimeline(idOf(state(), '/m/photo.jpg'));
      app.select(project().timeline.main[0]!.id);
      app.addTitle();
      const main = project().timeline.main;
      expect(main.map((m) => m.type)).toEqual(['video', 'title', 'image']);
      expect(main[1]).toMatchObject({ type: 'title', text: 'Your title' });
      expect(state().selection).toBe(main[1]!.id);
      app.undo();
      expect(project().timeline.main).toHaveLength(2);
    });

    it('adds a title at the end when nothing is selected', () => {
      const { app, project } = setup();
      app.addTitle();
      expect(project().timeline.main.map((m) => m.type)).toEqual(['title']);
    });

    it('adds captions, subtitles and credits at the playhead and selects them', () => {
      const { app, state, project } = setup();
      app.setPlayhead(2.5);
      app.addText('caption');
      app.addText('subtitle');
      app.addText('credits');
      const text = project().timeline.text;
      expect(text.map((t) => [t.kind, t.start, t.text])).toEqual([
        ['caption', 2.5, 'Caption'],
        ['subtitle', 2.5, 'Subtitle'],
        ['credits', 2.5, 'Made by\nYour name'],
      ]);
      expect(state().selection).toBe(text[2]!.id);
    });
  });

  describe('export (V16)', () => {
    async function withClip() {
      const s = setup();
      await s.importFiles('/m/clip.mp4');
      s.app.addToTimeline(idOf(s.state(), '/m/clip.mp4'));
      return s;
    }

    it('explains that a clip is needed, without asking where to save', async () => {
      const { app, state, dialogs } = setup();
      await app.exportVideo();
      expect(dialogs.exportVideo).not.toHaveBeenCalled();
      expect(state().message?.text).toMatch(/add a clip/i);
    });

    it('does nothing when the save dialog is cancelled', async () => {
      const { app, state, events } = await withClip();
      const before = events.length;
      await app.exportVideo();
      expect(state().exporting.state).toBe('idle');
      expect(events.slice(before).filter((e) => e.label === 'Export')).toEqual([]);
    });

    it('shows progress, then where the video was saved', async () => {
      const { app, state, engine, dialogs } = await withClip();
      dialogs.exportVideo.mockResolvedValueOnce('/out/Untitled.mp4');
      const states: string[] = [];
      app.store.subscribe((s) => states.push(s.exporting.state));
      await app.exportVideo();
      expect(states).toContain('running');
      expect(state().exporting).toEqual({ state: 'done', output: '/out/Untitled.mp4' });
      expect((await engine.probe('/out/Untitled.mp4')).duration).toBe(10);
    });

    it('V16: asks for a file name with the extension of the chosen format, and exports in it', async () => {
      const { app, state, engine, dialogs } = await withClip();
      dialogs.exportVideo.mockResolvedValueOnce('/out/Task_11e.wmv');
      const format = {
        ...defaultExport(state().history.present.settings),
        container: 'wmv' as const,
      };
      await app.exportVideo({ format });
      expect(dialogs.exportVideo).toHaveBeenCalledWith('Untitled', 'wmv');
      expect(await engine.probe('/out/Task_11e.wmv')).toMatchObject({
        container: 'wmv',
        video: { codec: 'wmv2' },
      });
    });

    it('can also save the project, so it can be edited later', async () => {
      const { app, state, dialogs } = await withClip();
      dialogs.exportVideo.mockResolvedValueOnce('/out/x.mp4');
      dialogs.saveProject.mockResolvedValueOnce('/work/x.mve');
      await app.exportVideo({ alsoSaveProject: true });
      expect(state().projectPath).toBe('/work/x.mve');
      expect(state().exporting).toEqual({ state: 'done', output: '/out/x.mp4' });
    });

    it('V17: the export summary gives the length, whether there is sound, and the estimated size', async () => {
      const { app, state } = await withClip();
      const format = defaultExport(state().history.present.settings);
      expect(app.exportSummary(format)).toEqual({
        duration: 10,
        hasAudio: true,
        ...estimateSize(format, 10, true),
      });
    });

    it('can be cancelled', async () => {
      const { app, state, dialogs } = await withClip();
      dialogs.exportVideo.mockResolvedValueOnce('/out/x.mp4');
      // Press Cancel as soon as the export is shown as running.
      const stop = app.store.subscribe(
        (s) => s.exporting.state === 'running' && app.cancelExport(),
      );
      await app.exportVideo();
      stop();
      expect(state().exporting.state).toBe('idle');
      expect(state().message).toBeNull();
    });

    describe('text (ARCHITECTURE §7.3)', () => {
      it('draws every title and caption as a picture and gives the pictures to the export', async () => {
        const s = await withClip();
        const render = vi.spyOn(s.engine, 'renderVideo');
        s.app.edit(addMainItem(createTitleSlide('Welcome', { id: 'title' }), 0));
        s.app.edit(addTextItem(createTextItem('caption', 'The lake', 6, { id: 'cap' })));
        s.dialogs.exportVideo.mockResolvedValueOnce('/out/x.mp4');
        await s.app.exportVideo();

        const frame = { width: 1920, height: 1080 };
        expect(s.text.draw.mock.calls.map((c) => [c[0], c[2], c[3]])).toEqual([
          ['Welcome', frame, 'frame'],
          ['The lake', frame, 'frame'],
        ]);
        expect(s.files.saveImage.mock.calls.map((c) => c[0])).toEqual(['text-title', 'text-cap']);
        expect(render.mock.calls[0]![2].textImages).toEqual({
          title: { path: '/cache/text/text-title.png', ...frame },
          cap: { path: '/cache/text/text-cap.png', ...frame },
        });
        expect(s.state().exporting.state).toBe('done');
      });

      it('draws scrolling credits as a block of rows, and still credits as a full frame', async () => {
        const s = await withClip();
        s.app.edit(addTextItem(createTextItem('credits', 'Made by', 0, { id: 'c1' })));
        s.app.edit(addTextItem(createTextItem('credits', 'Thanks', 5, { id: 'c2' })));
        s.app.edit(setTextEffects('c2', { scroll: false }));
        s.dialogs.exportVideo.mockResolvedValueOnce('/out/x.mp4');
        await s.app.exportVideo();
        expect(s.text.draw.mock.calls.map((c) => c[3])).toEqual(['block', 'frame']);
      });

      it('does not draw a title slide that has no words', async () => {
        const s = await withClip();
        s.app.edit(addMainItem(createTitleSlide('  ', { id: 'blank' }), 0));
        s.dialogs.exportVideo.mockResolvedValueOnce('/out/x.mp4');
        await s.app.exportVideo();
        expect(s.text.draw).not.toHaveBeenCalled();
        expect(s.state().exporting.state).toBe('done');
      });

      it('explains when the text pictures cannot be made', async () => {
        const s = await withClip();
        s.app.edit(addTextItem(createTextItem('caption', 'Hi', 0)));
        s.text.draw.mockRejectedValueOnce(new Error('canvas broke'));
        s.dialogs.exportVideo.mockResolvedValueOnce('/out/x.mp4');
        await s.app.exportVideo();
        expect(s.state().exporting.state).toBe('failed');
        expect(s.state().message?.kind).toBe('error');
      });
    });
  });

  describe('save, open, new (P1, X1)', () => {
    it('Save asks where the first time, stores relative paths, and is then clean', async () => {
      const { app, state, disk, dialogs, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      dialogs.saveProject.mockResolvedValueOnce('/m/Task_11b.mve');
      await app.save();
      expect(dialogs.saveProject).toHaveBeenCalledWith('Untitled');
      expect(JSON.parse(disk.get('/m/Task_11b.mve')!).media[0].path).toBe('photo.jpg');
      expect([state().projectPath, isDirty(state()), projectTitle(state())]).toEqual([
        '/m/Task_11b.mve',
        false,
        'Task_11b.mve — EasyMedia',
      ]);
    });

    it('Save again overwrites without asking; Save As always asks', async () => {
      const { app, dialogs, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      dialogs.saveProject.mockResolvedValue('/m/a.mve');
      await app.save();
      await app.save();
      expect(dialogs.saveProject).toHaveBeenCalledTimes(1);
      await app.saveAs();
      expect(dialogs.saveProject).toHaveBeenCalledTimes(2);
    });

    it('a cancelled save keeps the work marked as unsaved', async () => {
      const { app, state, disk, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      await app.save();
      expect([isDirty(state()), disk.size, projectTitle(state())]).toEqual([
        true,
        0,
        'Untitled • — EasyMedia',
      ]);
    });

    it('Open reads a project, restores absolute paths, prepares proxies, and starts a fresh undo history', async () => {
      const { app, state, project, disk, dialogs } = setup({ '/p/media/clip.mp4': video() });
      const saved = {
        ...createProject({ name: 'Task' }),
        media: [{ id: 'c', kind: 'video', path: 'media/clip.mp4', duration: 10, hasAudio: true }],
      };
      disk.set('/p/task.mve', JSON.stringify(saved));
      dialogs.openProject.mockResolvedValueOnce('/p/task.mve');
      await app.open();
      expect(project().media[0]!.path).toBe('/p/media/clip.mp4');
      expect([canUndo(state().history), isDirty(state()), state().projectPath]).toEqual([
        false,
        false,
        '/p/task.mve',
      ]);
      await vi.waitFor(() => expect(state().assets.c!.state).toBe('ready'));
    });

    it('P6 a file that moved is marked missing; Locate points it to the new place', async () => {
      const { app, state, project, disk, dialogs } = setup({ '/new/clip.mp4': video() });
      const saved = {
        ...createProject({ name: 'Task' }),
        media: [{ id: 'c', kind: 'video', path: 'media/clip.mp4', duration: 10, hasAudio: true }],
      };
      disk.set('/p/task.mve', JSON.stringify(saved));
      dialogs.openProject.mockResolvedValueOnce('/p/task.mve');
      await app.open();
      await vi.waitFor(() =>
        expect(state().assets.c).toMatchObject({
          state: 'failed',
          message: expect.stringMatching(/could not be found/i),
        }),
      );

      dialogs.openMedia.mockResolvedValueOnce(['/new/clip.mp4']);
      await app.locate('c');
      expect(project().media[0]!.path).toBe('/new/clip.mp4');
      await vi.waitFor(() => expect(state().assets.c!.state).toBe('ready'));
    });

    it('Open asks before throwing away unsaved work', async () => {
      const { app, dialogs, project, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      dialogs.confirm.mockResolvedValueOnce(false);
      await app.open();
      expect(dialogs.confirm).toHaveBeenCalledWith(expect.stringMatching(/unsaved changes/i));
      expect(dialogs.openProject).not.toHaveBeenCalled();
      expect(project().media).toHaveLength(1);
    });

    it('explains a file that is not a project', async () => {
      const { app, state, disk, dialogs } = setup();
      disk.set('/p/bad.mve', 'not json');
      dialogs.openProject.mockResolvedValueOnce('/p/bad.mve');
      await app.open();
      expect(state().message?.text).toMatch(/not an EasyMedia project/i);
    });

    it('New starts an empty project (after asking, if there is unsaved work)', async () => {
      const { app, project, dialogs, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      await app.newProject();
      expect(dialogs.confirm).toHaveBeenCalled();
      expect(project().media).toEqual([]);
    });
  });

  describe('P2 package project: project and media together in one folder', () => {
    it('copies every media file into media/ and writes the project next to it', async () => {
      const { app, disk, dialogs, copies, state, importFiles } = setup({
        '/a/clip.mp4': video(),
        '/b/clip.mp4': video(),
        '/m/photo.jpg': image,
      });
      await importFiles('/a/clip.mp4', '/b/clip.mp4', '/m/photo.jpg');
      dialogs.chooseFolder.mockResolvedValueOnce('/usb/Task11d');
      await app.packageProject();
      expect(copies).toEqual([
        '/a/clip.mp4 → /usb/Task11d/media/clip.mp4',
        '/b/clip.mp4 → /usb/Task11d/media/clip-2.mp4',
        '/m/photo.jpg → /usb/Task11d/media/photo.jpg',
      ]);
      expect(
        JSON.parse(disk.get('/usb/Task11d/Untitled.mve')!).media.map(
          (m: { path: string }) => m.path,
        ),
      ).toEqual(['media/clip.mp4', 'media/clip-2.mp4', 'media/photo.jpg']);
      expect(state().message).toMatchObject({
        kind: 'info',
        text: expect.stringMatching(/packaged/i),
      });
    });

    it('asks for missing files to be located first', async () => {
      const { app, dialogs, copies, state, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      const id = idOf(state(), '/m/photo.jpg');
      app.store.update((s) => ({
        ...s,
        assets: { ...s.assets, [id]: { state: 'failed', progress: 0 } },
      }));
      await app.packageProject();
      expect(dialogs.chooseFolder).not.toHaveBeenCalled();
      expect(copies).toEqual([]);
      expect(state().message?.text).toMatch(/locate/i);
    });
  });

  describe('P3 autosave and recovery', () => {
    it('autosaves a saved project to its file every minute when there are changes', async () => {
      vi.useFakeTimers();
      const { app, disk, dialogs, state, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      dialogs.saveProject.mockResolvedValueOnce('/m/a.mve');
      await app.save();
      app.addToTimeline(idOf(state(), '/m/photo.jpg'));
      expect(JSON.parse(disk.get('/m/a.mve')!).timeline.main).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(JSON.parse(disk.get('/m/a.mve')!).timeline.main).toHaveLength(1);
      expect(isDirty(state())).toBe(false);
      app.dispose();
    });

    it('autosaves unsaved work to the recovery file, which a save then removes', async () => {
      vi.useFakeTimers();
      const { app, disk, dialogs, importFiles } = setup();
      await importFiles('/m/photo.jpg');
      await vi.advanceTimersByTimeAsync(60_000);
      expect(disk.has('/cache/recovery.mve')).toBe(true);
      dialogs.saveProject.mockResolvedValueOnce('/m/a.mve');
      await app.save();
      expect(disk.has('/cache/recovery.mve')).toBe(false);
      app.dispose();
    });

    it('does not autosave when nothing changed', async () => {
      vi.useFakeTimers();
      const { app, disk } = setup();
      await vi.advanceTimersByTimeAsync(180_000);
      expect(disk.size).toBe(0);
      app.dispose();
    });

    it('offers to restore unsaved work after a crash', async () => {
      const { app, disk, dialogs, project, state } = setup({ '/m/photo.jpg': image });
      const lost = {
        ...createProject({ name: 'Lost' }),
        media: [{ id: 'p', kind: 'image', path: '/m/photo.jpg', hasAudio: false }],
      };
      disk.set('/cache/recovery.mve', JSON.stringify(lost));
      await app.start();
      expect(dialogs.confirm).toHaveBeenCalledWith(expect.stringMatching(/restore/i));
      expect(project().media).toHaveLength(1);
      expect([isDirty(state()), state().projectPath]).toEqual([true, null]);
    });

    it('discards the recovery file if the student says no', async () => {
      const { app, disk, dialogs, project } = setup();
      disk.set('/cache/recovery.mve', JSON.stringify(createProject({ name: 'Lost' })));
      dialogs.confirm.mockResolvedValueOnce(false);
      await app.start();
      expect([disk.has('/cache/recovery.mve'), project().media]).toEqual([false, []]);
    });
  });
});

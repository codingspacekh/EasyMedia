import { describe, expect, it, vi } from 'vitest';
import { createMockMediaEngine } from '../../../../src/adapters/mock/media-engine.ts';
import { CHANNELS } from '../../../../src/preload/api.ts';
import { inProcessBridge } from '../../../helpers/ipc-bridge.ts';

const clip = {
  kind: 'video' as const,
  container: 'mp4',
  duration: 10,
  sizeBytes: 1,
  video: { codec: 'h264', width: 1920, height: 1080 },
};

describe('P2 main-process IPC handlers', () => {
  it('handles exactly the channels the preload exposes', () => {
    const { handlers } = inProcessBridge(createMockMediaEngine());
    expect([...handlers.keys()].sort()).toEqual([...CHANNELS].sort());
  });

  it('replies with data, and with a plain-English error instead of throwing', async () => {
    const { api } = inProcessBridge(createMockMediaEngine({ '/m/a.mp4': clip }));
    expect(await api.invoke('media:probe', '/m/a.mp4')).toMatchObject({
      ok: true,
      value: { kind: 'video' },
    });
    expect(await api.invoke('media:probe', '/m/gone.mp4')).toEqual({
      ok: false,
      error: { name: 'MediaError', message: expect.stringMatching(/could not be found/i) },
    });
  });

  it('lets the page play a file only after the app has opened it, and a proxy only once it is made', async () => {
    const { api, allow } = inProcessBridge(createMockMediaEngine({ '/m/a.mp4': clip }));
    expect(allow.has('/m/a.mp4')).toBe(false);
    await api.invoke('media:probe', '/m/a.mp4');
    expect(allow.has('/m/a.mp4')).toBe(true);

    const finished = new Promise((resolve) =>
      api.on('job:event', (e) => e.type === 'done' && resolve(e)),
    );
    await api.invoke('media:proxy', 'k1', '/m/a.mp4', '/cache/proxies/a.mp4', 10);
    expect(allow.has('/cache/proxies/a.mp4')).toBe(false);
    await finished;
    expect(allow.has('/cache/proxies/a.mp4')).toBe(true);
  });

  it('reports job events with the page’s own job key', async () => {
    const { api } = inProcessBridge(createMockMediaEngine({ '/m/a.mp4': clip }));
    const seen: string[] = [];
    const finished = new Promise<void>((resolve) =>
      api.on('job:event', (e) => {
        seen.push(`${e.type}:${e.jobId}`);
        if (e.type === 'done') resolve();
      }),
    );
    await api.invoke('media:proxy', 'page-7', '/m/a.mp4', '/cache/p.mp4', 10);
    await finished;
    expect(seen).toContain('done:page-7');
    expect(seen.every((s) => s.endsWith(':page-7'))).toBe(true);
  });

  it('X4 asks the system for microphone permission (macOS) and passes the answer to the page', async () => {
    const microphoneAccess = vi.fn(async () => false);
    const { api } = inProcessBridge(createMockMediaEngine(), { microphoneAccess });
    expect(await api.invoke('media:microphoneAccess')).toEqual({ ok: true, value: false });
    expect(microphoneAccess).toHaveBeenCalledTimes(1);
  });

  it('reads and writes project files, and passes dialog answers through', async () => {
    const { api } = inProcessBridge(createMockMediaEngine(), {
      dialogs: {
        openMedia: async () => ['/m/a.mp4'],
        openProject: async () => '/p/task.mve',
        saveProject: async (name) => `/p/${name}.mve`,
        exportVideo: async (name, container) => `/p/${name}.${container}`,
        exportAudio: async (name, format) => `/p/${name}.${format}`,
        confirm: async () => true,
        chooseFolder: async () => '/usb',
        unsavedChanges: async () => 'discard',
        openTaskCheck: async () => '/t/Task 11b.mvetask',
        saveTaskCheck: async (name) => `/t/${name}.mvetask`,
        openAnimation: async () => null,
        openPicture: async () => null,
        openSound: async () => '/m/alarm.mp3',
        openFrames: async () => ['/shots/1.jpg', '/shots/2.jpg'],
        openExport: async () => ['/e/Task4.html'],
        saveAnimation: async () => null,
        exportAnimation: async () => null,
      },
    });
    expect(await api.invoke('dialog:openExport')).toEqual({ ok: true, value: ['/e/Task4.html'] });
    expect(await api.invoke('dialog:openSound')).toEqual({ ok: true, value: '/m/alarm.mp3' });
    expect(await api.invoke('dialog:openFrames')).toEqual({
      ok: true,
      value: ['/shots/1.jpg', '/shots/2.jpg'],
    });
    expect(await api.invoke('dialog:saveTaskCheck', 'Task 11b')).toEqual({
      ok: true,
      value: '/t/Task 11b.mvetask',
    });
    expect(await api.invoke('dialog:openTaskCheck')).toEqual({
      ok: true,
      value: '/t/Task 11b.mvetask',
    });
    expect(await api.invoke('dialog:saveProject', 'Task_11b')).toEqual({
      ok: true,
      value: '/p/Task_11b.mve',
    });
    expect(await api.invoke('project:write', '/p/t.mve', '{}')).toEqual({ ok: true, value: null });
    expect(await api.invoke('project:read', '/p/t.mve')).toEqual({ ok: true, value: '{}' });
    expect(await api.invoke('dialog:confirm', 'Discard?')).toEqual({ ok: true, value: true });
    expect(await api.invoke('dialog:exportAudio', 'Task_11j', 'mp3')).toEqual({
      ok: true,
      value: '/p/Task_11j.mp3',
    });
    expect(await api.invoke('project:remove', '/p/t.mve')).toEqual({ ok: true, value: null });
    expect(await api.invoke('project:read', '/p/t.mve')).toMatchObject({
      ok: false,
      error: { name: 'Error' },
    });
    expect(await api.invoke('app:paths')).toEqual({
      ok: true,
      value: {
        proxies: '/cache/proxies',
        recovery: '/cache/recovery.mve',
        snapshots: '/cache/snapshots',
        learn: '/cache/learn',
        animationFrames: '/cache/frames',
      },
    });
  });

  it('P2 copies only files the app has opened (never arbitrary files)', async () => {
    const copied: string[] = [];
    const { api } = inProcessBridge(createMockMediaEngine({ '/m/a.mp4': clip }), {
      files: {
        read: async () => '',
        write: async () => {},
        remove: async () => {},
        copy: async (from, to) => void copied.push(`${from}→${to}`),
        saveImage: async () => '',
        saveSound: async (name: string) => `/cache/sounds/${name}.wav`,
        writeBytes: async () => {},
      },
    });
    expect(await api.invoke('project:copy', '/etc/passwd', '/usb/x')).toMatchObject({ ok: false });
    await api.invoke('media:probe', '/m/a.mp4');
    expect(await api.invoke('project:copy', '/m/a.mp4', '/usb/media/a.mp4')).toEqual({
      ok: true,
      value: null,
    });
    expect(copied).toEqual(['/m/a.mp4→/usb/media/a.mp4']);
  });

  it('saves text pictures only by a plain name, into the app folder, and lets the preview show them', async () => {
    const saved: string[] = [];
    const { api } = inProcessBridge(createMockMediaEngine(), {
      files: {
        read: async () => '',
        write: async () => {},
        remove: async () => {},
        copy: async () => {},
        saveImage: async (name, png) => {
          saved.push(`${name}:${png.length}`);
          return `/cache/text/${name}.png`;
        },
        saveSound: async (name: string) => `/cache/sounds/${name}.wav`,
        writeBytes: async (path, bytes) => {
          saved.push(`${path}:${bytes.length}`);
        },
      },
    });
    for (const bad of ['../evil', '/etc/x', 'a b', 'C:\\x', '']) {
      expect(await api.invoke('project:saveImage', bad, new Uint8Array(3))).toMatchObject({
        ok: false,
      });
    }
    expect(await api.invoke('project:saveImage', 'text-ab_1', new Uint8Array(3))).toEqual({
      ok: true,
      value: '/cache/text/text-ab_1.png',
    });
    expect(saved).toEqual(['text-ab_1:3']);
    const allow = (await import('../../../helpers/ipc-bridge.ts')).lastAllowList();
    expect(allow.has('/cache/text/text-ab_1.png')).toBe(true);
  });

  it('X8 saves a sound effect only by a plain name, into the app folder, and lets it be played', async () => {
    const saved: string[] = [];
    const { api } = inProcessBridge(createMockMediaEngine(), {
      files: {
        read: async () => '',
        write: async () => {},
        remove: async () => {},
        copy: async () => {},
        saveImage: async () => '',
        saveSound: async (name, wav) => {
          saved.push(`${name}:${wav.length}`);
          return `/cache/sounds/${name}.wav`;
        },
        writeBytes: async () => {},
      },
    });
    for (const bad of ['../evil', '/etc/x', 'a b', 'C:\\x', '', 'Pop', 'x'.repeat(60)]) {
      expect(await api.invoke('project:saveSound', bad, new Uint8Array(3))).toMatchObject({
        ok: false,
      });
    }
    expect(await api.invoke('project:saveSound', 'tick-tock', new Uint8Array(4))).toEqual({
      ok: true,
      value: '/cache/sounds/tick-tock.wav',
    });
    expect(saved).toEqual(['tick-tock:4']);
    const allow = (await import('../../../helpers/ipc-bridge.ts')).lastAllowList();
    expect(allow.has('/cache/sounds/tick-tock.wav')).toBe(true);
  });

  it('V11 crops only pictures the app has opened, and lets the preview show the new one', async () => {
    const photo = {
      kind: 'image' as const,
      container: 'jpg',
      sizeBytes: 1,
      video: { codec: 'mjpeg', width: 400, height: 300 },
    };
    const { api } = inProcessBridge(
      createMockMediaEngine({ '/m/p.jpg': photo, '/etc/x.jpg': photo }),
    );
    const plan = {
      resize: { width: 160, height: 120 },
      crop: { x: 0, y: 30, width: 160, height: 90 },
    };
    expect(await api.invoke('media:resizeCrop', '/etc/x.jpg', plan)).toMatchObject({
      ok: false,
    });
    await api.invoke('media:probe', '/m/p.jpg');
    expect(await api.invoke('media:resizeCrop', '/m/p.jpg', plan)).toEqual({
      ok: true,
      value: '/m/p1.jpg',
    });
    const allow = (await import('../../../helpers/ipc-bridge.ts')).lastAllowList();
    expect(allow.has('/m/p1.jpg')).toBe(true);
  });

  it('M17a updates: the page asks through updates:* and is told the state (off from the source)', async () => {
    const { api } = inProcessBridge(createMockMediaEngine({}));
    expect(await api.invoke('updates:get')).toMatchObject({
      ok: true,
      value: { mode: 'off', current: '1.5.0', status: 'idle' },
    });
    expect(await api.invoke('updates:check')).toMatchObject({
      ok: true,
      value: { status: 'idle' },
    });
    expect(await api.invoke('updates:auto', true)).toMatchObject({
      ok: true,
      value: { autoDownload: true },
    });
  });

  it('N1 the performance report: off unless asked for; on, it is sent each play of the stage', async () => {
    const off = inProcessBridge(createMockMediaEngine({})).api;
    expect(await off.invoke('perf:enabled')).toEqual({ ok: true, value: false });
    const sample = { seconds: 3, fps: 29.7, targetFps: 30, longestGapMs: 18 };
    expect(await off.invoke('perf:playback', sample)).toEqual({ ok: true, value: null });

    const playback = vi.fn();
    const { api } = inProcessBridge(createMockMediaEngine({}), { perf: { playback } });
    expect(await api.invoke('perf:enabled')).toEqual({ ok: true, value: true });
    expect(await api.invoke('perf:playback', sample)).toEqual({ ok: true, value: null });
    expect(playback).toHaveBeenCalledWith(sample);
    // What the page sends is checked.
    const bad = { ...sample, fps: 'fast' } as unknown as typeof sample;
    expect(await api.invoke('perf:playback', bad)).toMatchObject({ ok: false });
    expect(playback).toHaveBeenCalledTimes(1);
  });

  it('Report a Problem: the page’s unexpected errors and failed requests go to the problem log', async () => {
    const record = vi.fn();
    const { api } = inProcessBridge(createMockMediaEngine({}), { problems: { record } });
    expect(await api.invoke('log:page', 'TypeError: frame is undefined')).toEqual({
      ok: true,
      value: null,
    });
    expect(record).toHaveBeenCalledWith('error', 'page', 'TypeError: frame is undefined');
    await api.invoke('media:probe', '/m/gone.mp4');
    expect(record).toHaveBeenLastCalledWith(
      'error',
      'request',
      expect.stringMatching(/^media:probe: MediaError: .*could not be found/),
    );
    // A job that fails (the file is gone) is noted with its label.
    const failed = new Promise((resolve) =>
      api.on('job:event', (e) => e.type === 'failed' && resolve(e)),
    );
    await api.invoke('media:proxy', 'k1', '/m/gone.mp4', '/cache/p.mp4', 10);
    await failed;
    expect(record).toHaveBeenLastCalledWith(
      'error',
      'job',
      expect.stringMatching(/: MediaError: /),
    );
    // Only text is taken from the page.
    expect(await api.invoke('log:page', { evil: true } as unknown as string)).toMatchObject({
      ok: false,
    });
    // Without a log (tests, development) nothing breaks.
    const plain = inProcessBridge(createMockMediaEngine({})).api;
    expect(await plain.invoke('log:page', 'x')).toEqual({ ok: true, value: null });
  });

  it('V18 combines only pictures the app opened, and allows the picture it makes', async () => {
    const photo = {
      kind: 'image' as const,
      container: 'png',
      sizeBytes: 1,
      video: { codec: 'png', width: 400, height: 300 },
    };
    const { api } = inProcessBridge(
      createMockMediaEngine({ '/m/credits.png': photo, '/m/grid.png': photo, '/etc/x.png': photo }),
    );
    const plan = { top: { width: 100, height: 75 }, x: 0, y: 225 };
    await api.invoke('media:probe', '/m/credits.png');
    expect(await api.invoke('media:combine', '/m/credits.png', '/etc/x.png', plan)).toMatchObject({
      ok: false,
    });
    await api.invoke('media:probe', '/m/grid.png');
    expect(await api.invoke('media:combine', '/m/credits.png', '/m/grid.png', plan)).toEqual({
      ok: true,
      value: '/m/credits1.png',
    });
    const allow = (await import('../../../helpers/ipc-bridge.ts')).lastAllowList();
    expect(allow.has('/m/credits1.png')).toBe(true);
  });

  it('A1 decoded sound reaches the page through a temporary file, never through the main process memory', async () => {
    const backend = createMockMediaEngine({
      '/m/song.mp3': {
        kind: 'audio',
        container: 'mp3',
        duration: 1,
        sizeBytes: 1,
        audio: { codec: 'mp3', sampleRate: 100, channels: 2 },
      },
    });
    const { api, allow } = inProcessBridge(backend);
    const reply = await api.invoke('media:decodeAudio', '/m/song.mp3');
    if (!reply.ok) throw new Error(reply.error.message);
    expect(reply.value).toMatchObject({ sampleRate: 100, count: 2 });
    expect(allow.has(reply.value.raw)).toBe(true); // the page may read it once
    expect(backend.readRaw(reply.value.raw).byteLength).toBe(100 * 2 * 4);
    await api.invoke('media:release', reply.value.raw);
    expect(allow.has(reply.value.raw)).toBe(false);
    expect(() => backend.readRaw(reply.value.raw)).toThrow();
  });

  it('AN15 makes a video only from frames in the app’s own frames folder', async () => {
    const { api, allow } = inProcessBridge(createMockMediaEngine());
    const options = { format: 'mp4' as const, fps: 24, frames: 72, width: 600, height: 400 };
    for (const folder of [
      '/home/student',
      '/cache/frames',
      '/cache/frames/../proxies',
      '/cache/framesX/a',
    ])
      expect(await api.invoke('media:encodeFrames', 'k1', folder, '/out/a.mp4', options)).toEqual({
        ok: false,
        error: expect.objectContaining({
          message: 'Only frames drawn by OneEditor can be exported.',
        }),
      });
    const finished = new Promise((resolve) =>
      api.on('job:event', (e) => e.type === 'done' && resolve(e)),
    );
    expect(
      await api.invoke('media:encodeFrames', 'k2', '/cache/frames/export-1', '/out/a.mp4', options),
    ).toEqual({ ok: true, value: null });
    await finished;
    expect(allow.has('/out/a.mp4')).toBe(true);
  });

  it('AN28 puts only sounds the app opened (or made) into a video', async () => {
    const { api } = inProcessBridge(
      createMockMediaEngine({
        '/m/alarm.mp3': {
          kind: 'audio',
          container: 'mp3',
          duration: 2,
          sizeBytes: 32_000,
          audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
        },
      }),
    );
    const piece = {
      path: '/m/alarm.mp3',
      offset: 0,
      heard: 2,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      cut: 0,
      duration: 2,
      at: 0,
    };
    const options = {
      format: 'mp4' as const,
      fps: 24,
      frames: 72,
      width: 600,
      height: 400,
      sounds: [piece],
    };
    const folder = '/cache/frames/export-2';
    expect(await api.invoke('media:encodeFrames', 'k3', folder, '/out/b.mp4', options)).toEqual({
      ok: false,
      error: expect.objectContaining({ message: 'Only sounds opened in OneEditor can be used.' }),
    });
    await api.invoke('media:probe', '/m/alarm.mp3');
    expect(await api.invoke('media:encodeFrames', 'k4', folder, '/out/b.mp4', options)).toEqual({
      ok: true,
      value: null,
    });
  });

  it('only releases files it made for decoding', async () => {
    const backend = createMockMediaEngine({ '/m/a.mp4': clip });
    const release = vi.spyOn(backend, 'releaseDecoded');
    const { api } = inProcessBridge(backend);
    await api.invoke('media:release', '/m/a.mp4');
    expect(release).not.toHaveBeenCalled();
  });
});

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
      },
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

  it('only releases files it made for decoding', async () => {
    const backend = createMockMediaEngine({ '/m/a.mp4': clip });
    const release = vi.spyOn(backend, 'releaseDecoded');
    const { api } = inProcessBridge(backend);
    await api.invoke('media:release', '/m/a.mp4');
    expect(release).not.toHaveBeenCalled();
  });
});

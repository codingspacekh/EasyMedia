import { describe, expect, it } from 'vitest';
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

  it('reads and writes project files, and passes dialog answers through', async () => {
    const { api } = inProcessBridge(createMockMediaEngine(), {
      dialogs: {
        openMedia: async () => ['/m/a.mp4'],
        openProject: async () => '/p/task.mve',
        saveProject: async (name) => `/p/${name}.mve`,
        exportVideo: async (name) => `/p/${name}.mp4`,
      },
    });
    expect(await api.invoke('dialog:saveProject', 'Task_11b')).toEqual({
      ok: true,
      value: '/p/Task_11b.mve',
    });
    expect(await api.invoke('project:write', '/p/t.mve', '{}')).toEqual({ ok: true, value: null });
    expect(await api.invoke('project:read', '/p/t.mve')).toEqual({ ok: true, value: '{}' });
    expect(await api.invoke('app:paths')).toEqual({
      ok: true,
      value: { proxies: '/cache/proxies' },
    });
  });
});

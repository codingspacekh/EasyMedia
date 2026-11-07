// X7: a Welcome on the first launch (once), Help ▸ Welcome again; Help ▸ Licences (README §17);
// Help ▸ About OneEditor.
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/app/app.ts';
import { createMockMediaEngine } from '../../../src/adapters/mock/media-engine.ts';
import type { Dialogs } from '../../../src/core/ports.ts';

function setup(
  disk = new Map<string, string>(),
  website: () => Promise<void> = vi.fn(async () => {}),
) {
  const dialogs = {
    confirm: vi.fn<Dialogs['confirm']>(async () => false),
  } as unknown as Dialogs;
  const app = createApp({
    engine: createMockMediaEngine({}),
    dialogs,
    files: {
      read: async (p) => disk.get(p) ?? Promise.reject(new Error('ENOENT')),
      write: async (p, t) => void disk.set(p, t),
      remove: async (p) => void disk.delete(p),
      copy: async () => {},
      saveImage: async (name) => `/cache/${name}.png`,
      saveSound: async (name: string) => `/cache/sounds/${name}.wav`,
      writeBytes: async () => {},
    },
    text: { draw: async (_t, _s, frame) => ({ png: new Uint8Array(1), ...frame }) },
    paths: {
      proxies: '/cache',
      recovery: '/cache/recovery.mve',
      snapshots: '/cache/snapshots',
      learn: '/cache/learn',
      preferences: '/user/preferences.json',
      licences: '/app/THIRD_PARTY_LICENSES.txt',
    },
    website,
  });
  return { app, disk, state: () => app.store.get() };
}

describe('X7 Welcome', () => {
  it('shows on the first launch; closing it remembers, so it does not show again', async () => {
    const first = setup();
    await first.app.start();
    expect(first.state().welcome).toBe(true);
    await first.app.closeWelcome();
    expect(first.state().welcome).toBe(false);
    expect(JSON.parse(first.disk.get('/user/preferences.json')!)).toEqual({ welcomeSeen: true });

    const again = setup(first.disk);
    await again.app.start();
    expect(again.state().welcome).toBe(false);
  });

  it('Help ▸ Welcome shows it again at any time', async () => {
    const s = setup(new Map([['/user/preferences.json', '{"welcomeSeen":true}']]));
    await s.app.start();
    s.app.showWelcome();
    expect(s.state().welcome).toBe(true);
  });

  it('damaged preferences are treated as a first launch', async () => {
    const s = setup(new Map([['/user/preferences.json', 'not json']]));
    await s.app.start();
    expect(s.state().welcome).toBe(true);
  });
});

describe('Help ▸ Licences', () => {
  it('shows THIRD_PARTY_LICENSES inside the app (offline)', async () => {
    const s = setup(new Map([['/app/THIRD_PARTY_LICENSES.txt', 'FFmpeg 9.0.2 — GPL v3']]));
    await s.app.showLicences();
    expect(s.state().licences).toBe('FFmpeg 9.0.2 — GPL v3');
    s.app.closeLicences();
    expect(s.state().licences).toBeNull();
  });

  it('explains when the file is missing (a build made without it)', async () => {
    const s = setup();
    await s.app.showLicences();
    expect(s.state().licences).toBeNull();
    expect(s.state().message).toEqual({
      kind: 'error',
      text: expect.stringMatching(/licences could not be found/i),
    });
  });
});

describe('Help ▸ About OneEditor', () => {
  it('shows who makes OneEditor, its licence and the website for contributors', async () => {
    const s = setup();
    expect(s.state().about).toBe(false);
    s.app.showAbout();
    expect(s.state().about).toBe(true);
    s.app.closeAbout();
    expect(s.state().about).toBe(false);
  });

  it('opens the website in the browser, and says where it is if that fails', async () => {
    const website = vi.fn(async () => {});
    await setup(new Map(), website).app.openWebsite();
    expect(website).toHaveBeenCalledTimes(1);
    const broken = setup(
      new Map(),
      vi.fn(async () => Promise.reject(new Error('no browser'))),
    );
    await broken.app.openWebsite();
    expect(broken.state().message).toEqual({
      kind: 'error',
      text: expect.stringMatching(/could not be opened.*codingspacekh\.dev/),
    });
  });
});

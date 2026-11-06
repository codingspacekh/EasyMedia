// AN15: the HTML web animation's files, read by the main process for the page (it cannot read
// files itself): the player's script, a picture the app has opened and a bundled font, each as a
// data: URL. Only pictures the app opened, and only the app's own font files, can be read.
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createMockMediaEngine } from '../../../../src/adapters/mock/media-engine.ts';
import { createElectronPageAssets } from '../../../../src/adapters/electron/page-assets.ts';
import { inProcessBridge } from '../../../helpers/ipc-bridge.ts';

const bytes = (text: string) => new TextEncoder().encode(text);
const base64 = (text: string) => Buffer.from(text).toString('base64');

function setup(show = vi.fn(async () => {})) {
  const disk = new Map<string, Uint8Array>([
    ['/app/out/player.js', bytes('/* player */')],
    // As the main process makes it: with \ on Windows.
    [join('/app/dist/assets', 'Inter-B2xq_9aZ.ttf'), bytes('font')],
    ['/work/Paris1.jpg', bytes('jpeg')],
    ['/work/star.svg', bytes('<svg/>')],
    ['/work/secret.txt', bytes('secret')],
    ['/work/alarm.mp3', bytes('mp3')],
    ['/cache/sounds/ding.wav', bytes('wav')],
  ]);
  const bridge = inProcessBridge(createMockMediaEngine(), {
    pageFiles: {
      player: '/app/out/player.js',
      assets: '/app/dist/assets',
      read: async (path) => disk.get(path) ?? Promise.reject(new Error(`ENOENT ${path}`)),
      show,
    },
  });
  const assets = createElectronPageAssets(bridge.api, {
    'Inter.ttf': './assets/Inter-B2xq_9aZ.ttf',
    'Tiny.ttf': 'data:font/ttf;base64,AAAA',
  });
  return { ...bridge, assets };
}

describe('the web page’s files (AN15)', () => {
  it('the player’s script, as text', async () => {
    expect(await setup().assets.playerScript()).toBe('/* player */');
  });

  it('a picture the app opened, as a data: URL of its type', async () => {
    const s = setup();
    s.allow.add('/work/Paris1.jpg');
    s.allow.add('/work/star.svg');
    expect(await s.assets.pictureDataUrl('/work/Paris1.jpg')).toBe(
      `data:image/jpeg;base64,${base64('jpeg')}`,
    );
    expect(await s.assets.pictureDataUrl('/work/star.svg')).toBe(
      `data:image/svg+xml;base64,${base64('<svg/>')}`,
    );
  });

  it('refuses a file the app did not open, or one that is not a picture', async () => {
    const s = setup();
    await expect(s.assets.pictureDataUrl('/work/Paris1.jpg')).rejects.toThrow(
      /opened in OneEditor/,
    );
    s.allow.add('/work/secret.txt');
    await expect(s.assets.pictureDataUrl('/work/secret.txt')).rejects.toThrow(/picture/);
  });

  it('AN28 a sound the app opened (or a sound effect it made), as a data: URL of its type', async () => {
    const s = setup();
    await expect(s.assets.soundDataUrl('/work/alarm.mp3')).rejects.toThrow(/opened in OneEditor/);
    s.allow.add('/work/alarm.mp3');
    s.allow.add('/cache/sounds/ding.wav');
    expect(await s.assets.soundDataUrl('/work/alarm.mp3')).toBe(
      `data:audio/mpeg;base64,${base64('mp3')}`,
    );
    expect(await s.assets.soundDataUrl('/cache/sounds/ding.wav')).toBe(
      `data:audio/wav;base64,${base64('wav')}`,
    );
    s.allow.add('/work/secret.txt');
    await expect(s.assets.soundDataUrl('/work/secret.txt')).rejects.toThrow(/sound/);
  });

  it('a bundled font from the app’s own pages, as a data: URL', async () => {
    const s = setup();
    expect(await s.assets.fontDataUrl('Inter.ttf')).toBe(`data:font/ttf;base64,${base64('font')}`);
    // A font small enough for the page to hold already.
    expect(await s.assets.fontDataUrl('Tiny.ttf')).toBe('data:font/ttf;base64,AAAA');
  });

  it('refuses a font that is not bundled, and any other file of the app', async () => {
    const s = setup();
    await expect(s.assets.fontDataUrl('Comic.ttf')).rejects.toThrow(/not one of the fonts/);
    const font = (name: string) => s.api.invoke('page:font', name);
    expect(await font('../out/main.cjs')).toMatchObject({ ok: false });
    expect(await font('..\\secret.ttf')).toMatchObject({ ok: false });
    expect(await font('index.html')).toMatchObject({ ok: false });
  });

  it('AN18 Test: the page is shown in a window of its own, the stage’s size', async () => {
    const show = vi.fn(async () => {});
    const s = setup(show);
    await s.assets.openTest('<!DOCTYPE html>', 'Chapter07_Task4', 1024, 768);
    expect(show).toHaveBeenCalledWith('<!DOCTYPE html>', 'Chapter07_Task4', 1024, 768);
    expect(await s.api.invoke('page:test', '<p>', 'x', 0, 10)).toMatchObject({ ok: false });
  });
});

// M17a U1–U5: how the installed app sets its updates up — the address the build wrote, the
// settings file, a Mac's .dmg download — with temporary folders and a fake network.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchToFile, readUpdateConfig, setUpUpdates } from '../../../src/main/update-setup.ts';
import type { Updater } from '../../../src/main/updates.ts';

let dir: string;
beforeEach(() => void (dir = mkdtempSync(join(tmpdir(), 'mve-update-setup-'))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const url = 'https://github.com/codingspacekh/OneEditor/releases/latest/download';

describe('the update address the build wrote (resources/updates.json)', () => {
  it('is read; missing, unreadable or empty means updates are off', () => {
    const file = join(dir, 'updates.json');
    expect(readUpdateConfig(file)).toEqual({ url: null, macSigned: false });
    writeFileSync(file, 'not json');
    expect(readUpdateConfig(file)).toEqual({ url: null, macSigned: false });
    writeFileSync(file, JSON.stringify({ url: '', macSigned: 'yes' }));
    expect(readUpdateConfig(file)).toEqual({ url: null, macSigned: false });
    writeFileSync(file, JSON.stringify({ url, macSigned: true }));
    expect(readUpdateConfig(file)).toEqual({ url, macSigned: true });
  });
});

describe("a Mac's .dmg download", () => {
  it('is saved through a .download file, saying how far it has got', async () => {
    const bytes = new Uint8Array(1000).fill(7);
    const fetch = vi.fn(
      async () =>
        new Response(bytes, { status: 200, headers: { 'content-length': String(bytes.length) } }),
    );
    const seen: number[] = [];
    const file = join(dir, 'Downloads', 'OneEditor-1.5.1-mac-arm64.dmg');
    await fetchToFile(fetch, `${url}/x.dmg`, file, (p) => seen.push(p));
    expect(readFileSync(file)).toHaveLength(1000);
    expect(seen.at(-1)).toBe(100);
    expect(existsSync(`${file}.download`)).toBe(false);
    // Downloaded again: the old copy is replaced.
    await fetchToFile(fetch, `${url}/x.dmg`, file, () => {});
    expect(readFileSync(file)).toHaveLength(1000);
  });

  it('a failed download leaves nothing behind and says why', async () => {
    const file = join(dir, 'OneEditor.dmg');
    const missing = async () => new Response(null, { status: 404 });
    await expect(fetchToFile(missing, `${url}/x.dmg`, file, () => {})).rejects.toThrow(/404/);
    expect(existsSync(file) || existsSync(`${file}.download`)).toBe(false);
  });
});

describe('setting updates up', () => {
  const base = () => ({
    platform: 'win32',
    arch: 'x64',
    version: '1.5.1',
    configFile: join(dir, 'resources-updates.json'),
    userData: dir,
    downloads: join(dir, 'Downloads'),
    send: vi.fn(),
    fetch: vi.fn(),
    showItem: vi.fn(),
    openPath: vi.fn(async () => ''),
    quit: vi.fn(),
  });

  it('run from the source: off, and electron-updater is never loaded', async () => {
    const loadUpdater = vi.fn();
    const updates = await setUpUpdates({ ...base(), packaged: false, loadUpdater });
    expect(updates.get().mode).toBe('off');
    expect(loadUpdater).not.toHaveBeenCalled();
  });

  it('installed with an address: on; the settings file says an update was put in (1.5.0 → 1.5.1)', async () => {
    writeFileSync(join(dir, 'resources-updates.json'), JSON.stringify({ url, macSigned: false }));
    writeFileSync(join(dir, 'updates.json'), JSON.stringify({ lastVersion: '1.5.0' }));
    const updater = { on: vi.fn(), setFeedURL: vi.fn() } as unknown as Updater;
    const updates = await setUpUpdates({
      ...base(),
      packaged: true,
      loadUpdater: async () => updater,
    });
    expect(updates.get()).toMatchObject({ mode: 'auto', current: '1.5.1', updatedTo: '1.5.1' });
    expect(JSON.parse(readFileSync(join(dir, 'updates.json'), 'utf8'))).toMatchObject({
      lastVersion: '1.5.1',
      updatedTo: '1.5.1',
      autoDownload: false,
    });
  });

  it('a settings folder that cannot be written only means it asks again', async () => {
    writeFileSync(join(dir, 'resources-updates.json'), JSON.stringify({ url, macSigned: false }));
    const updates = await setUpUpdates({
      ...base(),
      userData: join(dir, 'no', 'such', 'folder'),
      packaged: true,
      loadUpdater: async () => ({ on: vi.fn(), setFeedURL: vi.fn() }) as unknown as Updater,
    });
    expect(updates.setAuto(true).autoDownload).toBe(true);
  });
});

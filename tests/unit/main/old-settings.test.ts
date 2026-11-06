// The app was called EasyMedia until v1.4: its settings folder (preferences, recent projects,
// snapshots, proxies) is named after the app, so the first start as OneEditor moves it across.
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moveOldSettings } from '../../../src/main/old-settings.ts';

let appData: string;
beforeEach(async () => (appData = await mkdtemp(join(tmpdir(), 'mve-old-settings-'))));
afterEach(() => rm(appData, { recursive: true, force: true }));

describe('the settings folder from before the rename', () => {
  it('is moved to the new name on the first start, with everything in it', async () => {
    await mkdir(join(appData, 'EasyMedia', 'snapshots'), { recursive: true });
    await writeFile(join(appData, 'EasyMedia', 'preferences.json'), '{"recent":["a.mve"]}');
    expect(moveOldSettings(appData)).toBe(true);
    expect(await readFile(join(appData, 'OneEditor', 'preferences.json'), 'utf8')).toContain(
      'a.mve',
    );
    expect(existsSync(join(appData, 'OneEditor', 'snapshots'))).toBe(true);
    expect(existsSync(join(appData, 'EasyMedia'))).toBe(false);
  });

  it('is left alone once OneEditor has its own folder', async () => {
    await mkdir(join(appData, 'EasyMedia'));
    await mkdir(join(appData, 'OneEditor'));
    await writeFile(join(appData, 'OneEditor', 'preferences.json'), '{}');
    expect(moveOldSettings(appData)).toBe(false);
    expect(existsSync(join(appData, 'EasyMedia'))).toBe(true);
    expect(await readFile(join(appData, 'OneEditor', 'preferences.json'), 'utf8')).toBe('{}');
  });

  it('does nothing when there was no EasyMedia, and never stops the app starting', async () => {
    expect(moveOldSettings(appData)).toBe(false);
    expect(moveOldSettings(join(appData, 'missing', 'folder'))).toBe(false);
  });
});

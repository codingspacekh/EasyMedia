// AN14: Import frames reads the pictures in the chosen folder, and nothing else.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { picturesIn } from '../../../../src/main/media/pictures.ts';

let folder = '';
afterEach(() => rm(folder, { recursive: true, force: true }));

describe('the pictures in a folder (AN14)', () => {
  it('lists the picture files, whatever the case of their extension, and nothing else', async () => {
    folder = await mkdtemp(join(tmpdir(), 'frames-'));
    for (const name of ['frame1.JPG', 'frame2.png', 'notes.txt', '.hidden.png', 'clip.mp4'])
      await writeFile(join(folder, name), '');
    await mkdir(join(folder, 'more.png'));
    const found = (await picturesIn(folder)).sort();
    expect(found).toEqual([join(folder, 'frame1.JPG'), join(folder, 'frame2.png')]);
  });
});

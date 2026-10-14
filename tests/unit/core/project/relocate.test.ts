import { describe, expect, it } from 'vitest';
import { createMediaAsset, createProject } from '../../../../src/core/model/factory.ts';
import {
  dirOf,
  fileNameOf,
  projectFromDisk,
  projectToDisk,
} from '../../../../src/core/project/relocate.ts';

const withMedia = (...paths: string[]) => ({
  ...createProject({ name: 'p' }),
  media: paths.map((path, i) =>
    createMediaAsset({ id: `m${i}`, kind: 'video', path, duration: 1 }),
  ),
});

describe('X1 media paths: absolute in memory, relative to the project file on disk', () => {
  it('saving stores paths relative to the project folder', () => {
    const p = withMedia('/Users/s/IT/Task11d/media/Lake.mp4', '/Users/s/Shared/music.mp3');
    expect(projectToDisk(p, '/Users/s/IT/Task11d').media.map((m) => m.path)).toEqual([
      'media/Lake.mp4',
      '../../Shared/music.mp3',
    ]);
  });

  it('opening turns them back into absolute paths for this computer', () => {
    const p = withMedia('media/Lake.mp4', 'D:/clips/a.mp4');
    expect(projectFromDisk(p, 'C:\\Users\\t\\Marking\\Task11d').media.map((m) => m.path)).toEqual([
      'C:/Users/t/Marking/Task11d/media/Lake.mp4',
      'D:/clips/a.mp4',
    ]);
  });

  it('does not change the project it was given', () => {
    const p = withMedia('/a/b.mp4');
    projectToDisk(p, '/a');
    expect(p.media[0]!.path).toBe('/a/b.mp4');
  });

  it.each([
    ['/Users/s/IT/task.mve', '/Users/s/IT', 'task.mve'],
    ['C:\\Users\\s\\task.mve', 'C:\\Users\\s', 'task.mve'],
    ['task.mve', '.', 'task.mve'],
  ])('%s is in %s and called %s', (path, dir, name) => {
    expect([dirOf(path), fileNameOf(path)]).toEqual([dir, name]);
  });
});

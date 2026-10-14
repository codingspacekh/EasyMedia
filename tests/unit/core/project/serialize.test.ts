import { describe, expect, it } from 'vitest';
import {
  createAudioItem,
  createImageClip,
  createMediaAsset,
  createProject,
  createTextItem,
  createTitleSlide,
  createVideoClip,
} from '../../../../src/core/model/factory.ts';
import { ProjectFileError } from '../../../../src/core/model/errors.ts';
import type { Project } from '../../../../src/core/model/types.ts';
import { CURRENT_SCHEMA, migrate } from '../../../../src/core/project/migrate.ts';
import { deserializeProject, serializeProject } from '../../../../src/core/project/serialize.ts';

function fullProject(): Project {
  const lake = createMediaAsset({
    id: 'lake',
    kind: 'video',
    path: 'media/Lake_Naivasha.mp4',
    duration: 20,
  });
  const photo = createMediaAsset({ id: 'photo', kind: 'image', path: 'media/Fish_Eagle1.jpg' });
  const music = createMediaAsset({
    id: 'music',
    kind: 'audio',
    path: '../shared/music.mp3',
    duration: 52,
  });
  const p = createProject({ name: 'Lake Naivasha' });
  return {
    ...p,
    media: [lake, photo, music],
    timeline: {
      main: [
        createTitleSlide('Lake Naivasha, Kenya', { id: 't' }),
        createVideoClip(lake, { id: 'v' }),
        createImageClip(photo, { id: 'i' }),
      ],
      text: [
        createTextItem('credits', 'Filmed by: GBRvideo\n\nEdited by: Student', 30, { id: 'c' }),
      ],
      audio: [[createAudioItem(music, 5, { id: 'a' })], []],
    },
  };
}

describe('P1 / P11 project files (.mve)', () => {
  it('round-trips: loading a saved project gives the same project', () => {
    const p = fullProject();
    expect(deserializeProject(serializeProject(p))).toEqual(p);
  });

  it('is readable JSON with the schema version first', () => {
    expect(serializeProject(fullProject())).toMatch(
      /^\{\n {2}"schemaVersion": 1,\n {2}"name": "Lake Naivasha"/,
    );
  });

  it('keeps relative media paths exactly as stored (X1)', () => {
    const loaded = deserializeProject(serializeProject(fullProject()));
    expect(loaded.media.map((m) => m.path)).toEqual([
      'media/Lake_Naivasha.mp4',
      'media/Fish_Eagle1.jpg',
      '../shared/music.mp3',
    ]);
  });

  it.each([
    ['not JSON', 'hello'],
    ['a different JSON file', '{"foo": 1}'],
    ['a project without a timeline', JSON.stringify({ ...fullProject(), timeline: undefined })],
    [
      'an unknown clip type',
      JSON.stringify({
        ...fullProject(),
        timeline: { ...fullProject().timeline, main: [{ type: 'hologram', id: 'h' }] },
      }),
    ],
  ])('rejects %s with a friendly message', (_name, text) => {
    expect(() => deserializeProject(text)).toThrow(ProjectFileError);
    expect(() => deserializeProject(text)).toThrow(/not an EasyMedia project, or it is damaged/i);
  });

  it('still opens an M1 project saved before "fit" and "hasAudio" existed', () => {
    const old = fullProject();
    const settings: Partial<typeof old.settings> = { ...old.settings };
    delete settings.fit;
    const media = old.media.map((m) => {
      const copy: Partial<typeof m> = { ...m };
      delete copy.hasAudio;
      return copy;
    });
    expect(() => deserializeProject(JSON.stringify({ ...old, settings, media }))).not.toThrow();
  });

  it('rejects a "hasAudio" that is not true or false', () => {
    const p = fullProject();
    const bad = JSON.stringify({ ...p, media: [{ ...p.media[0], hasAudio: 'yes' }] });
    expect(() => deserializeProject(bad)).toThrow(/not an EasyMedia project/i);
  });

  it('explains when a project comes from a newer version of the app', () => {
    const future = JSON.stringify({ ...fullProject(), schemaVersion: CURRENT_SCHEMA + 1 });
    expect(() => deserializeProject(future)).toThrow(/newer version of EasyMedia/i);
  });
});

describe('P11 migrations upgrade old project files step by step', () => {
  const migrations = {
    1: (old: Record<string, unknown>) => ({ ...old, schemaVersion: 2, tracks: 'renamed' }),
    2: (old: Record<string, unknown>) => ({ ...old, schemaVersion: 3, volume: 1 }),
  };

  it('runs every migration from the file version up to the current version', () => {
    expect(migrate({ schemaVersion: 1, name: 'old' }, migrations, 3)).toEqual({
      schemaVersion: 3,
      name: 'old',
      tracks: 'renamed',
      volume: 1,
    });
  });

  it('leaves a current file unchanged', () => {
    const current = { schemaVersion: 3, name: 'new' };
    expect(migrate(current, migrations, 3)).toBe(current);
  });

  it('fails clearly if a migration step is missing', () => {
    expect(() => migrate({ schemaVersion: 1 }, { 1: migrations[1] }, 3)).toThrow(/version 2/);
  });
});

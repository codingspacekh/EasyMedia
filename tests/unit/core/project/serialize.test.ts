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
      /^\{\n {2}"schemaVersion": 2,\n {2}"name": "Lake Naivasha"/,
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

  it('V13: keeps "lower under voiceover" on music and rejects one that is not true or false', () => {
    const p = fullProject();
    const ducked = {
      ...p,
      timeline: { ...p.timeline, audio: [[{ ...p.timeline.audio[0][0]!, duck: true }], []] },
    } as Project;
    expect(deserializeProject(serializeProject(ducked))).toEqual(ducked);
    const bad = JSON.stringify({
      ...p,
      timeline: { ...p.timeline, audio: [[{ ...p.timeline.audio[0][0]!, duck: 'yes' }], []] },
    });
    expect(() => deserializeProject(bad)).toThrow(/not an EasyMedia project/i);
  });

  it('V13: keeps the speed of a sound and rejects one that is not a number', () => {
    const p = fullProject();
    const fast = {
      ...p,
      timeline: { ...p.timeline, audio: [[{ ...p.timeline.audio[0][0]!, speed: 1.5 }], []] },
    } as Project;
    expect(deserializeProject(serializeProject(fast))).toEqual(fast);
    const bad = JSON.stringify({
      ...p,
      timeline: { ...p.timeline, audio: [[{ ...p.timeline.audio[0][0]!, speed: 'fast' }], []] },
    });
    expect(() => deserializeProject(bad)).toThrow(/not an EasyMedia project/i);
  });

  it('explains when a project comes from a newer version of the app', () => {
    const future = JSON.stringify({ ...fullProject(), schemaVersion: CURRENT_SCHEMA + 1 });
    expect(() => deserializeProject(future)).toThrow(/newer version of EasyMedia/i);
  });
});

describe('P1 for Audio mode: its tracks and clips are saved in the project, their sound in WAV files', () => {
  const withAudio = (): Project => ({
    ...fullProject(),
    audioMode: {
      rate: 44100,
      tracks: [
        {
          id: 'a1',
          name: 'Task_11p_audio',
          channels: 2,
          clips: [
            { id: 'c1', file: 'Task_11p audio/clip-c1.wav', offset: 0, in: 0, out: 44100 },
            { id: 'c2', file: 'Task_11p audio/clip-c1.wav', offset: 3, in: 44100, out: 88200 },
          ],
          gain: 0,
          pan: 0,
          bits: 16,
        },
        {
          id: 'a2',
          name: 'Recording 1',
          channels: 1,
          clips: [{ id: 'c3', file: 'Task_11p audio/clip-c3.wav', offset: 11, in: 0, out: 9 }],
          gain: -3,
          pan: 0.5,
        },
      ],
    },
  });

  it('round-trips the Audio mode tracks and clips', () => {
    const p = withAudio();
    expect(deserializeProject(serializeProject(p))).toEqual(p);
  });

  it('a project without Audio mode work has no audioMode', () => {
    expect(serializeProject(fullProject())).not.toMatch(/audioMode/);
  });

  it('opens projects of version 1 (one sound file per track) as tracks with one clip', () => {
    const v1 = JSON.stringify({
      ...fullProject(),
      schemaVersion: 1,
      audioMode: {
        rate: 44100,
        tracks: [
          {
            id: 'a1',
            name: 'Task_11p_audio',
            file: 'Task_11p audio/track-1.wav',
            offset: 2,
            gain: 0,
            pan: 0,
            bits: 16,
          },
        ],
      },
    });
    const p = deserializeProject(v1);
    expect(p.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(p.audioMode!.tracks).toEqual([
      {
        id: 'a1',
        name: 'Task_11p_audio',
        clips: [{ id: 'a1.c', file: 'Task_11p audio/track-1.wav', offset: 2 }],
        gain: 0,
        pan: 0,
        bits: 16,
      },
    ]);
  });

  it.each([
    ['a rate that is not a number', { rate: 'fast', tracks: [] }],
    ['a track without clips', { rate: 44100, tracks: [{ id: 'a', name: 'x', gain: 0, pan: 0 }] }],
    [
      'a clip without its file',
      {
        rate: 44100,
        tracks: [{ id: 'a', name: 'x', clips: [{ id: 'c', offset: 0 }], gain: 0, pan: 0 }],
      },
    ],
    [
      'a pan that is not a number',
      { rate: 44100, tracks: [{ id: 'a', name: 'x', clips: [], gain: 0, pan: 'left' }] },
    ],
  ])('refuses Audio mode work with %s', (_, audioMode) => {
    const text = serializeProject({ ...fullProject(), audioMode } as unknown as Project);
    expect(() => deserializeProject(text)).toThrow(ProjectFileError);
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

describe('M7 clip looks in project files', () => {
  const looked = (): Project => {
    const p = fullProject();
    const [first, ...rest] = p.timeline.main;
    return {
      ...p,
      timeline: {
        ...p.timeline,
        main: [
          {
            ...first!,
            fade: { in: 1, out: 0.5, colour: 'white' },
            effects: [{ effectId: 'video.blur', params: { radius: 8 } }],
            panZoom: {
              from: { zoom: 1, x: 0.5, y: 0.5 },
              to: { zoom: 2, x: 0.3, y: 0.4 },
              start: 1,
            },
          },
          ...rest.map((item) => ({
            ...item,
            transitionIn: { effectId: 'transition.dissolve', duration: 1 },
          })),
        ],
      },
    };
  };

  it('keeps fades, filters, pan & zoom and transitions', () => {
    const p = looked();
    expect(deserializeProject(serializeProject(p))).toEqual(p);
  });

  it.each([
    ['a fade colour that is not black or white', { fade: { in: 1, out: 0, colour: 'red' } }],
    ['a filter without settings', { effects: [{ effectId: 'video.blur' }] }],
    ['a transition without a duration', { transitionIn: { effectId: 'transition.dissolve' } }],
    [
      'a pan & zoom frame without a zoom',
      { panZoom: { from: { x: 0.5, y: 0.5 }, to: { zoom: 1, x: 0, y: 0 } } },
    ],
  ])('refuses a damaged file: %s', (_, look) => {
    const doc = JSON.parse(serializeProject(fullProject()));
    Object.assign(doc.timeline.main[0], look);
    expect(() => deserializeProject(JSON.stringify(doc))).toThrow(ProjectFileError);
  });
});

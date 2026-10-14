import { describe, expect, it } from 'vitest';
import {
  addAudioItem,
  addMainItem,
  addTextItem,
  importMedia,
  joinWithNext,
  moveMainItem,
  moveTimedItem,
  relinkMedia,
  removeItem,
  setClipMuted,
  setClipSpeed,
  setDuration,
  setProjectSettings,
  splitAtTime,
  trimClip,
} from '../../../src/app/commands.ts';
import { createHistory, execute, undo, type Command } from '../../../src/app/history.ts';
import {
  createAudioItem,
  createImageClip,
  createMediaAsset,
  createProject,
  createTextItem,
  createTitleSlide,
  createVideoClip,
} from '../../../src/core/model/factory.ts';
import { itemDuration, setItemDuration } from '../../../src/core/model/timeline.ts';
import type { Project } from '../../../src/core/model/types.ts';
import { deepFreeze } from '../../helpers/freeze.ts';

const lake = createMediaAsset({
  id: 'lake',
  kind: 'video',
  path: 'Lake_Naivasha.mp4',
  duration: 20,
});
const photo = createMediaAsset({ id: 'photo', kind: 'image', path: 'Fish_Eagle1.jpg' });
const music = createMediaAsset({ id: 'music', kind: 'audio', path: 'music.mp3', duration: 30 });
const voice = createMediaAsset({ id: 'voice', kind: 'audio', path: 'voice.mp3', duration: 4 });

/** Title (0–8 s) then the whole Lake clip (8–28 s); one caption; music on track 0. */
function sample(): Project {
  const p = createProject({ name: 'Sample' });
  return {
    ...p,
    media: [lake, photo, music, voice],
    timeline: {
      main: [
        setItemDuration(createTitleSlide('Title', { id: 't' }), 8),
        createVideoClip(lake, { id: 'v' }),
      ],
      text: [createTextItem('caption', 'Hello', 2, { id: 'x' })],
      audio: [[createAudioItem(music, 0, { id: 'a' })], []],
    },
  };
}
const run = (p: Project, c: Command) => execute(createHistory(p), c).present;

describe('P4 every command leaves the original untouched and can be undone exactly', () => {
  const commands: [string, Command][] = [
    ['importMedia', importMedia(createMediaAsset({ id: 'new', kind: 'image', path: 'b.png' }))],
    ['addMainItem', addMainItem(createImageClip(photo, { id: 'i' }))],
    ['removeItem', removeItem('v')],
    ['trimClip', trimClip('v', { in: 8, out: 12.5 })],
    ['setClipSpeed', setClipSpeed('v', 1.5)],
    ['setClipMuted', setClipMuted('v', true)],
    ['relinkMedia', relinkMedia('lake', { ...lake, path: 'moved/Lake_Naivasha.mp4' })],
    ['setDuration', setDuration('t', 3)],
    ['splitAtTime', splitAtTime(10, ['v1', 'v2'])],
    ['joinWithNext', joinWithNext('v1')],
    ['moveMainItem', moveMainItem('v', 0)],
    ['moveTimedItem', moveTimedItem('x', 4)],
    ['addTextItem', addTextItem(createTextItem('subtitle', 'Hi', 1, { id: 's' }))],
    ['addAudioItem', addAudioItem(createAudioItem(voice, 2, { id: 'vo' }), 1)],
    ['setProjectSettings', setProjectSettings({ aspect: '4:3', width: 960, height: 720 })],
  ];

  it.each(commands)('%s', (name, command) => {
    let base = sample();
    if (name === 'joinWithNext') base = run(base, splitAtTime(10, ['v1', 'v2']));
    const pristine = structuredClone(base);
    deepFreeze(base); // any change to the original now throws

    const h = execute(createHistory(base), command);
    expect(h.present).not.toEqual(pristine);
    expect(undo(h).present).toBe(base);
    expect(base).toEqual(pristine);
  });
});

describe('commands', () => {
  it('importMedia refuses the same file twice', () => {
    expect(() => run(sample(), importMedia(lake))).toThrow(/already imported/i);
  });

  it('addMainItem appends by default or inserts at a position', () => {
    const image = createImageClip(photo, { id: 'i' });
    expect(run(sample(), addMainItem(image)).timeline.main.map((m) => m.id)).toEqual([
      't',
      'v',
      'i',
    ]);
    expect(run(sample(), addMainItem(image, 1)).timeline.main.map((m) => m.id)).toEqual([
      't',
      'i',
      'v',
    ]);
  });

  it('addMainItem needs the media to be imported first', () => {
    const stranger = createMediaAsset({ kind: 'image', path: 'x.png' });
    expect(() => run(sample(), addMainItem(createImageClip(stranger)))).toThrow(/import/i);
  });

  it('removeItem works on any track and reports unknown items', () => {
    const p = [removeItem('t'), removeItem('x'), removeItem('a')].reduce(run, sample());
    expect([p.timeline.main.length, p.timeline.text.length, p.timeline.audio[0].length]).toEqual([
      1, 0, 0,
    ]);
    expect(() => run(sample(), removeItem('nope'))).toThrow(/could not be found/i);
  });

  it('trimClip only applies to video clips', () => {
    expect(run(sample(), trimClip('v', { in: 8, out: 12.5 })).timeline.main[1]).toMatchObject({
      in: 8,
      out: 12.5,
    });
    expect(() => run(sample(), trimClip('t', { in: 0, out: 1 }))).toThrow(/only video clips/i);
  });

  it('setClipSpeed recalculates the clip length on the timeline', () => {
    const p = run(sample(), setClipSpeed('v', 2));
    expect(itemDuration(p.timeline.main[1]!)).toBe(10);
  });

  it('P6 relinkMedia points a missing file to its new place; clips keep their edits', () => {
    const trimmed = run(sample(), trimClip('v', { in: 8, out: 12.5 }));
    const moved = run(trimmed, relinkMedia('lake', { ...lake, path: '/new/Lake.mp4' }));
    expect(moved.media.find((m) => m.id === 'lake')!.path).toBe('/new/Lake.mp4');
    expect(moved.timeline.main[1]).toMatchObject({ assetId: 'lake', in: 8, out: 12.5 });
    expect(relinkMedia('lake', lake).label).toBe('Locate file');
  });

  it('P6 relinkMedia refuses a different kind of file, or one too short for the clips', () => {
    expect(() => run(sample(), relinkMedia('lake', { ...photo, id: 'lake' }))).toThrow(/a video/i);
    const trimmed = run(sample(), trimClip('v', { in: 8, out: 12.5 }));
    expect(() => run(trimmed, relinkMedia('lake', { ...lake, duration: 10 }))).toThrow(
      /shorter than the part used/i,
    );
  });

  it('V13 setClipMuted removes and restores the sound of a video clip', () => {
    const muted = run(sample(), setClipMuted('v', true));
    expect(muted.timeline.main[1]).toMatchObject({ muted: true });
    expect(run(muted, setClipMuted('v', false)).timeline.main[1]).toMatchObject({ muted: false });
    expect(setClipMuted('v', true).label).toBe('Remove sound');
    expect(() => run(sample(), setClipMuted('t', true))).toThrow(/only video clips have sound/i);
  });

  it('setDuration works for stills, titles and text but not video', () => {
    expect(run(sample(), setDuration('t', 3)).timeline.main[0]).toMatchObject({ duration: 3 });
    expect(run(sample(), setDuration('x', 7)).timeline.text[0]).toMatchObject({ duration: 7 });
    expect(() => run(sample(), setDuration('v', 3))).toThrow(/trim/i);
  });

  it('splitAtTime splits the item under the playhead', () => {
    const p = run(sample(), splitAtTime(10, ['v1', 'v2']));
    expect(p.timeline.main.map((m) => m.id)).toEqual(['t', 'v1', 'v2']);
    expect(p.timeline.main[1]).toMatchObject({ in: 0, out: 2 });
    expect(() => run(sample(), splitAtTime(40))).toThrow(/move the playhead over a clip/i);
  });

  it('joinWithNext joins a split clip back; the last item has nothing to join', () => {
    const split = run(sample(), splitAtTime(10, ['v1', 'v2']));
    expect(run(split, joinWithNext('v1')).timeline.main.map((m) => m.id)).toEqual(['t', 'v1']);
    expect(() => run(sample(), joinWithNext('v'))).toThrow(/no clip after/i);
  });

  it('moveMainItem reorders the main track', () => {
    expect(run(sample(), moveMainItem('t', 1)).timeline.main.map((m) => m.id)).toEqual(['v', 't']);
    expect(() => run(sample(), moveMainItem('t', 5))).toThrow(/position/i);
  });

  it('moveTimedItem moves text and audio, never before 0 s or onto other audio', () => {
    expect(run(sample(), moveTimedItem('x', 4)).timeline.text[0]!.start).toBe(4);
    expect(() => run(sample(), moveTimedItem('x', -1))).toThrow(/before 0\.00 s/i);
    const twoClips = run(sample(), addAudioItem(createAudioItem(voice, 40, { id: 'vo' }), 0));
    expect(() => run(twoClips, moveTimedItem('vo', 10))).toThrow(/overlaps/i);
  });

  it('addAudioItem puts audio on the chosen track if it fits', () => {
    expect(
      run(sample(), addAudioItem(createAudioItem(voice, 2, { id: 'vo' }), 1)).timeline.audio[1],
    ).toHaveLength(1);
    expect(() => run(sample(), addAudioItem(createAudioItem(voice, 2), 0))).toThrow(/overlaps/i);
  });

  it('setProjectSettings validates the new settings', () => {
    expect(
      run(sample(), setProjectSettings({ aspect: '4:3', width: 960, height: 720 })).settings,
    ).toMatchObject({
      aspect: '4:3',
      width: 960,
    });
    expect(() => run(sample(), setProjectSettings({ aspect: '4:3' }))).toThrow(/is not 4:3/);
  });

  describe('rules for the wrong kind of item, or an item that does not exist', () => {
    it('importMedia also refuses the same file under a new id', () => {
      expect(() => run(sample(), importMedia({ ...lake, id: 'copy' }))).toThrow(
        /already imported/i,
      );
    });

    it('a title with an image background needs that image imported', () => {
      const stranger = createMediaAsset({ id: 'stranger', kind: 'image', path: 'x.png' });
      const onImage = (assetId: string) => ({
        ...createTitleSlide('Over a picture', { id: 'ti' }),
        background: { kind: 'image' as const, assetId },
      });
      expect(() => run(sample(), addMainItem(onImage(stranger.id)))).toThrow(/import/i);
      expect(run(sample(), addMainItem(onImage(photo.id))).timeline.main).toHaveLength(3);
    });

    it('only video clips have a speed', () => {
      expect(() => run(sample(), setClipSpeed('t', 2))).toThrow(/only video clips have a speed/i);
    });

    it('editing an item that does not exist says so', () => {
      for (const command of [
        trimClip('nope', { in: 0, out: 1 }),
        setDuration('nope', 2),
        moveTimedItem('nope', 1),
      ]) {
        expect(() => run(sample(), command)).toThrow(/could not be found/i);
      }
    });

    it('moveMainItem refuses a position that is not a whole number', () => {
      expect(() => run(sample(), moveMainItem('t', 0.5))).toThrow(/position/i);
    });

    it('moveTimedItem moves audio when it fits', () => {
      expect(run(sample(), moveTimedItem('a', 5)).timeline.audio[0][0]!.start).toBe(5);
    });

    it('text cannot be added before 0 s', () => {
      expect(() => run(sample(), addTextItem(createTextItem('caption', 'Early', -2)))).toThrow(
        /before 0\.00 s/i,
      );
    });

    it('labels describe the edit for the Undo menu', () => {
      expect(addAudioItem(createAudioItem(music, 0), 0).label).toBe('Add music');
      expect(addAudioItem(createAudioItem(voice, 0), 1).label).toBe('Add voiceover');
      expect(addMainItem(createTitleSlide('T')).label).toBe('Add title');
      expect(importMedia(lake).label).toBe('Import Lake_Naivasha.mp4');
    });
  });
});

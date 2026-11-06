// V20: editing pictures and videos over the video. Every change is one undo step (P4).
import { describe, expect, it } from 'vitest';
import { relinkMedia, removeItem } from '../../../src/app/commands.ts';
import { createHistory, execute, undo, type Command } from '../../../src/app/history.ts';
import {
  addOverlayItem,
  moveOverlayItem,
  setOverlayDuration,
  setOverlayFades,
  setOverlayOpacity,
  setOverlayPlacement,
  setOverlaySound,
  showOverlayForWholeVideo,
  trimOverlay,
} from '../../../src/app/overlay-commands.ts';
import { EditError } from '../../../src/core/model/errors.ts';
import {
  createImageClip,
  createMediaAsset,
  createProject,
  createVideoClip,
} from '../../../src/core/model/factory.ts';
import { createOverlayItem } from '../../../src/core/model/overlay.ts';
import { setItemDuration } from '../../../src/core/model/timeline.ts';
import type { OverlayItem, Project } from '../../../src/core/model/types.ts';
import { deepFreeze } from '../../helpers/freeze.ts';

const lake = createMediaAsset({ id: 'lake', kind: 'video', path: 'Lake.mp4', duration: 20 });
const logo = createMediaAsset({ id: 'logo', kind: 'image', path: 'Logo.png' });
const clip2 = createMediaAsset({ id: 'clip2', kind: 'video', path: 'Clip2.mp4', duration: 8 });
const photo = createMediaAsset({ id: 'photo', kind: 'image', path: 'photo.jpg' });

function project(): Project {
  const p = createProject({ name: 'Overlay' });
  return deepFreeze({
    ...p,
    media: [lake, logo, clip2, photo],
    timeline: {
      ...p.timeline,
      main: [createVideoClip(lake, { id: 'v' }), setItemDuration(createImageClip(photo), 10)],
    },
  });
}

const picture = createOverlayItem(logo, 2, { id: 'o', duration: 5 });
const video = createOverlayItem(clip2, 10, { id: 'p' });
const run = (...commands: Command[]) =>
  commands.reduce((h, c) => execute(h, c), createHistory(project()));
const overlay = (p: Project) => p.timeline.overlay ?? [];
const item = (p: Project, id = 'o') => overlay(p).find((o) => o.id === id)!;

describe('V20 editing pictures and videos over the video', () => {
  it('V20: adds a picture over the video; undo takes it away and leaves no overlay track', () => {
    const h = run(addOverlayItem(picture));
    expect(overlay(h.present)).toEqual([picture]);
    expect(h.past.at(-1)!.label).toBe('Add over the video');
    expect(undo(h).present.timeline).not.toHaveProperty('overlay');
  });

  it('V20: refuses one that overlaps another on the overlay track, with a clear message', () => {
    const h = run(addOverlayItem(picture));
    const late = createOverlayItem(clip2, 6, { id: 'late' });
    expect(() => execute(h, addOverlayItem(late))).toThrow(/overlaps another picture or video/i);
    // Several may follow one another.
    expect(overlay(execute(h, addOverlayItem({ ...late, start: 7 })).present)).toHaveLength(2);
  });

  it('V20: refuses a file that is not in the media bin, or a sound', () => {
    const music = createMediaAsset({ id: 'm', kind: 'audio', path: 'm.mp3', duration: 9 });
    expect(() => run(addOverlayItem({ ...picture, assetId: 'gone' }))).toThrow(EditError);
    expect(() => run(addOverlayItem({ ...picture, assetId: music.id }))).toThrow(EditError);
  });

  it('V20: moves it to a start typed to 0.01 s (N8), still not overlapping', () => {
    const h = run(addOverlayItem(picture), addOverlayItem(video));
    expect(item(execute(h, moveOverlayItem('o', 1.23)).present).start).toBe(1.23);
    expect(() => execute(h, moveOverlayItem('o', 6))).toThrow(/overlaps/);
    expect(() => execute(h, moveOverlayItem('o', -1))).toThrow(/before 0\.00 s/);
  });

  it('V20: a picture’s duration; a video is trimmed instead', () => {
    const h = run(addOverlayItem(picture), addOverlayItem(video));
    expect(item(execute(h, setOverlayDuration('o', 7.5)).present)).toMatchObject({
      duration: 7.5,
    });
    expect(() => execute(h, setOverlayDuration('p', 3))).toThrow(/trim/i);
    const trimmed = item(execute(h, trimOverlay('p', { in: 1, out: 4.5 })).present, 'p');
    expect(trimmed).toMatchObject({ in: 1, out: 4.5 });
    expect(() => execute(h, trimOverlay('o', { in: 0, out: 1 }))).toThrow(/duration/i);
  });

  it('V20: size, place and margin (the nine places, as for text)', () => {
    const h = run(addOverlayItem(picture));
    const next = execute(
      h,
      setOverlayPlacement('o', { position: 'bottom-left', widthPercent: 40, margin: 0 }),
    );
    expect(item(next.present)).toMatchObject({
      position: 'bottom-left',
      widthPercent: 40,
      margin: 0,
    });
    expect(() => execute(h, setOverlayPlacement('o', { widthPercent: 0 }))).toThrow(/1 and 100/);
  });

  it('V20: opacity and fades; no fade is saved as none', () => {
    const h = run(addOverlayItem(picture));
    expect(item(execute(h, setOverlayOpacity('o', 0.6)).present).opacity).toBe(0.6);
    const faded = execute(h, setOverlayFades('o', { in: 1, out: 0.5 }));
    expect(item(faded.present)).toMatchObject({ fadeIn: 1, fadeOut: 0.5 });
    const none = item(execute(faded, setOverlayFades('o', { in: 0, out: 0 })).present);
    expect(none).not.toHaveProperty('fadeIn');
    expect(none).not.toHaveProperty('fadeOut');
    expect(() => execute(h, setOverlayFades('o', { in: 3, out: 3 }))).toThrow(/longer/);
  });

  it('V20: a video’s own sound is off until turned on; then its volume', () => {
    const h = run(addOverlayItem(video));
    const on = execute(h, setOverlaySound('p', { muted: false }));
    expect(item(on.present, 'p')).toMatchObject({ muted: false, volume: 1 });
    expect(on.past.at(-1)!.label).toBe('Turn sound on');
    expect(item(execute(on, setOverlaySound('p', { volume: 0.4 })).present, 'p')).toMatchObject({
      volume: 0.4,
    });
    expect(() => execute(on, setOverlaySound('p', { volume: 3 }))).toThrow(/200 %/);
    const withPicture = execute(h, addOverlayItem(picture));
    expect(() => execute(withPicture, setOverlaySound('o', { muted: false }))).toThrow(
      /only a video/i,
    );
  });

  it('V20: "Show for the whole video": a logo from the start to the end of the video', () => {
    const h = run(addOverlayItem(picture));
    expect(item(execute(h, showOverlayForWholeVideo('o')).present)).toMatchObject({
      start: 0,
      duration: 30,
    });
  });

  it('V20: Delete takes it away; the last one leaves no overlay track in the file', () => {
    const h = run(addOverlayItem(picture), addOverlayItem(video));
    const one = execute(h, removeItem('o'));
    expect(overlay(one.present).map((o: OverlayItem) => o.id)).toEqual(['p']);
    expect(execute(one, removeItem('p')).present.timeline).not.toHaveProperty('overlay');
    // The other tracks are kept.
    expect(one.present.timeline.main).toHaveLength(2);
  });

  it('P6: a moved video over the video can only be located as a file long enough for its trim', () => {
    const h = run(addOverlayItem(video));
    const short = { ...clip2, path: 'Short.mp4', duration: 5 };
    expect(() => execute(h, relinkMedia('clip2', short))).toThrow(/shorter/);
  });
});

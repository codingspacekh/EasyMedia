// V9: the transitions students choose from, in groups, and how the preview shows each one.
import { describe, expect, it } from 'vitest';
import {
  TRANSITION_GROUPS,
  TRANSITION_LIST,
  transitionLook,
} from '../../../../src/core/effects/transitions/transitions.ts';

/** Every xfade transition of the bundled FFmpeg 9 (ffmpeg -h filter=xfade). */
const XFADE = `fade wipeleft wiperight wipeup wipedown slideleft slideright slideup slidedown
  circlecrop rectcrop distance fadeblack fadewhite radial smoothleft smoothright smoothup
  smoothdown circleopen circleclose vertopen vertclose horzopen horzclose dissolve pixelize
  diagtl diagtr diagbl diagbr hlslice hrslice vuslice vdslice hblur fadegrays wipetl wipetr
  wipebl wipebr squeezeh squeezev zoomin fadefast fadeslow hlwind hrwind vuwind vdwind
  coverleft coverright coverup coverdown revealleft revealright revealup revealdown`.split(/\s+/);

describe('V9 transitions to choose from', () => {
  it('there are at least 30, in groups, each with an FFmpeg xfade transition', () => {
    expect(TRANSITION_LIST.length).toBeGreaterThanOrEqual(30);
    for (const t of TRANSITION_LIST) {
      expect(XFADE).toContain(t.xfade);
      expect(TRANSITION_GROUPS).toContain(t.group);
    }
    expect(new Set(TRANSITION_LIST.map((t) => t.xfade)).size).toBe(TRANSITION_LIST.length);
    for (const group of TRANSITION_GROUPS)
      expect(TRANSITION_LIST.filter((t) => t.group === group).length).toBeGreaterThanOrEqual(4);
  });

  it('the transitions of earlier versions keep their ids and look (saved projects)', () => {
    const xfadeOf = (id: string) => TRANSITION_LIST.find((t) => t.id === id)?.xfade;
    expect(
      [
        'dissolve',
        'fadeblack',
        'fadewhite',
        'wipeleft',
        'wipeup',
        'slide',
        'push',
        'circle',
        'zoom',
      ].map((id) => xfadeOf(`transition.${id}`)),
    ).toEqual([
      'fade',
      'fadeblack',
      'fadewhite',
      'wipeleft',
      'wipeup',
      'slideleft',
      'smoothleft',
      'circleopen',
      'zoomin',
    ]);
  });

  it('every transition says why it is used, in its own words', () => {
    const whys = TRANSITION_LIST.map((t) => t.why);
    for (const why of whys) expect(why.length).toBeGreaterThan(40);
    expect(new Set(TRANSITION_LIST.map((t) => t.label)).size).toBe(TRANSITION_LIST.length);
  });
});

describe('how the preview shows a transition (approximately, with CSS)', () => {
  it('a dissolve blends the next clip in', () => {
    expect(transitionLook('fade', 0.25)).toEqual({ from: {}, to: { opacity: 0.25 } });
  });

  it('a wipe left uncovers the next clip from the right edge (as FFmpeg)', () => {
    expect(transitionLook('wipeleft', 0.25).to).toEqual({ clipPath: 'inset(0 0 0 75%)' });
    expect(transitionLook('wiperight', 0.25).to).toEqual({ clipPath: 'inset(0 75% 0 0)' });
    expect(transitionLook('wipeup', 0.25).to).toEqual({ clipPath: 'inset(75% 0 0 0)' });
    expect(transitionLook('wipedown', 0.25).to).toEqual({ clipPath: 'inset(0 0 75% 0)' });
  });

  it('a push moves both clips; a cover moves only the next; a reveal only the old', () => {
    expect(transitionLook('slideleft', 0.25)).toEqual({
      from: { transform: 'translate(-25%, 0)' },
      to: { transform: 'translate(75%, 0)' },
    });
    expect(transitionLook('coverleft', 0.25)).toEqual({
      from: {},
      to: { transform: 'translate(75%, 0)' },
    });
    expect(transitionLook('revealleft', 0.25)).toEqual({
      from: { transform: 'translate(-25%, 0)' },
      to: {},
      above: 'from',
    });
  });

  it('fading through black or white: the old clip goes, then the next one comes', () => {
    expect(transitionLook('fadeblack', 0.25)).toEqual({
      from: { opacity: 0.5 },
      to: { opacity: 0 },
      behind: '#000000',
    });
    expect(transitionLook('fadewhite', 0.75)).toEqual({
      from: { opacity: 0 },
      to: { opacity: 0.5 },
      behind: '#ffffff',
    });
  });

  it('a circle opens from the middle', () => {
    expect(transitionLook('circleopen', 0.5).to.clipPath).toBe('circle(35.36% at 50% 50%)');
  });

  it('every transition in the list has a look that starts on the old clip and ends on the next', () => {
    for (const t of TRANSITION_LIST) {
      const start = transitionLook(t.xfade, 0);
      const end = transitionLook(t.xfade, 1);
      expect(start.to.opacity ?? 1, t.id).toBeGreaterThanOrEqual(0);
      expect(end.to.opacity ?? 1, t.id).toBe(1);
      expect(end.to.clipPath ?? 'none', t.id).not.toMatch(/inset\(0 0 0 100%\)/);
    }
  });
});

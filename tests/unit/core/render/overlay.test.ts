// V20: a picture or video over the video. Where it goes (the preview) is where FFmpeg puts it (the
// export): the filter's own expressions are worked out here by FFmpeg's rules and compared.
import { describe, expect, it } from 'vitest';
import {
  createMediaAsset,
  createProject,
  createTextItem,
} from '../../../../src/core/model/factory.ts';
import { createImageClip, createVideoClip } from '../../../../src/core/model/factory.ts';
import { createOverlayItem } from '../../../../src/core/model/overlay.ts';
import { setItemDuration } from '../../../../src/core/model/timeline.ts';
import type {
  MediaAsset,
  OverlayItem,
  OverlayPlacement,
  Project,
  TextPosition,
} from '../../../../src/core/model/types.ts';
import { compileProject, projectHasSound } from '../../../../src/core/render/compile.ts';
import { overlayBox, overlayPosition, overlayScale } from '../../../../src/core/render/overlay.ts';

type Size = { width: number; height: number };

/** FFmpeg's expression functions, as av_expr_eval has them. */
function evaluate(expr: string, vars: Record<string, number>): number {
  const js = expr.replace(/[a-z_]+/g, (name) => (name in vars ? String(vars[name]) : `f.${name}`));
  const f = {
    min: Math.min,
    max: Math.max,
    trunc: Math.trunc,
    // C round(): halves away from zero.
    round: (n: number) => Math.sign(n) * Math.round(Math.abs(n)),
  };
  return (new Function('f', `return (${js});`) as (fs: typeof f) => number)(f);
}

/** The value of `key='expr'` (or key=number) in a filter's arguments. */
const arg = (filter: string, key: string) =>
  (new RegExp(`${key}='([^']*)'`).exec(filter) ?? new RegExp(`${key}=([^:,]*)`).exec(filter))![1]!;

/** Where FFmpeg's scale and overlay put the picture, by their rules (scale: w then h with ow). */
function throughFfmpeg(frame: Size, source: Size, placement: OverlayPlacement) {
  const scale = overlayScale(frame, placement);
  const position = overlayPosition(placement);
  const iw = source.width;
  const ih = source.height;
  const width = Math.trunc(evaluate(arg(scale, 'w'), { iw, ih }));
  const height = Math.trunc(evaluate(arg(scale, 'h'), { iw, ih, ow: width }));
  const vars = { main_w: frame.width, main_h: frame.height, overlay_w: width, overlay_h: height };
  // vf_overlay: x and y are cut to whole pixels, even ones on a yuv420 picture.
  const even = (n: number) => Math.trunc(n) & ~1;
  return {
    x: even(evaluate(arg(position, 'x'), vars)),
    y: even(evaluate(arg(position, 'y'), vars)),
    width,
    height,
  };
}

const POSITIONS: TextPosition[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'centre',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];
const HD = { width: 1920, height: 1080 };

describe('V20 where a picture over the video goes', () => {
  it('V20: a logo 25 % wide in the top-right corner, 20 px from the edges', () => {
    const box = overlayBox(
      HD,
      { width: 400, height: 200 },
      {
        position: 'top-right',
        widthPercent: 25,
        margin: 20,
      },
    );
    expect(box).toEqual({ x: 1920 - 480 - 20, y: 20, width: 480, height: 240 });
  });

  it('V20: keeps its shape; a tall picture is never taller than the frame', () => {
    const box = overlayBox(
      HD,
      { width: 500, height: 1000 },
      {
        position: 'centre',
        widthPercent: 100,
        margin: 0,
      },
    );
    expect(box.height).toBe(1080);
    expect(box.width).toBe(540);
    expect(box.x).toBe(690);
  });

  it('V20: a margin bigger than the room left keeps it inside the frame', () => {
    const box = overlayBox(
      HD,
      { width: 400, height: 200 },
      {
        position: 'bottom-right',
        widthPercent: 90,
        margin: 500,
      },
    );
    expect(box.x).toBe(0);
    expect(box.y + box.height).toBeLessThanOrEqual(1080);
  });

  const cases: [Size, Size, OverlayPlacement][] = [];
  for (const position of POSITIONS)
    for (const [frame, source, widthPercent, margin] of [
      [HD, { width: 400, height: 200 }, 25, 20],
      [HD, { width: 333, height: 777 }, 33, 15],
      [{ width: 854, height: 480 }, { width: 1920, height: 1080 }, 30, 11],
      [{ width: 640, height: 480 }, { width: 101, height: 57 }, 7, 0],
      [{ width: 720, height: 576 }, { width: 3764, height: 3092 }, 100, 3],
    ] as [Size, Size, number, number][])
      cases.push([frame, source, { position, widthPercent, margin }]);

  it.each(cases.map((c) => [`${c[2].position} ${c[1].width}×${c[1].height} on ${c[0].width}`, c]))(
    'V20: the preview puts %s where the export does',
    (_, [frame, source, placement]) => {
      expect(overlayBox(frame, source, placement)).toEqual(throughFfmpeg(frame, source, placement));
    },
  );
});

// ---- the export ----

const lake = createMediaAsset({
  id: 'lake',
  kind: 'video',
  path: 'Lake.mp4',
  duration: 20,
  hasAudio: false,
});
const logo = createMediaAsset({ id: 'logo', kind: 'image', path: 'Logo.png' });
const clip2 = createMediaAsset({
  id: 'clip2',
  kind: 'video',
  path: 'Clip2.mp4',
  duration: 8,
  hasAudio: true,
});
const photo = createMediaAsset({ id: 'photo', kind: 'image', path: 'photo.jpg' });
const options = {
  mediaPath: (a: MediaAsset) => `/media/${a.path}`,
  textImages: { c: { path: '/tmp/c.png', width: 1920, height: 1080 } },
};
const graph = (args: string[]) => args[args.indexOf('-filter_complex') + 1]!;

function project(overlay: OverlayItem[], extra: Partial<Project['timeline']> = {}): Project {
  const p = createProject({ name: 'Overlay' });
  return {
    ...p,
    media: [lake, logo, clip2, photo],
    timeline: {
      ...p.timeline,
      main: [createVideoClip(lake, { id: 'v' }), setItemDuration(createImageClip(photo), 10)],
      overlay,
      ...extra,
    },
  };
}

describe('V20 a picture or video over the video in the export', () => {
  it('V20: a project without overlays is exported as before', () => {
    const p = project([]);
    delete p.timeline.overlay;
    expect(graph(compileProject(p, options).args)).not.toContain('overlay');
  });

  it('V20: a logo is scaled, placed and shown only between its start and end', () => {
    const item = createOverlayItem(logo, 2, { id: 'o', duration: 5 });
    const { args } = compileProject(project([item]), options);
    expect(args.join(' ')).toContain('-loop 1 -framerate 30 -t 5 -i /media/Logo.png');
    const g = graph(args);
    expect(g).toContain(`setpts=PTS-STARTPTS+2/TB,${overlayScale(HD, item)}[ov0]`);
    expect(g).toContain(
      `[vjoin][ov0]overlay=${overlayPosition(item)}:eof_action=pass:enable='between(t,2,7)'[vout]`,
    );
  });

  it('V20: shown "for the whole video": never fed past the end of the video', () => {
    const item = createOverlayItem(logo, 25, { id: 'o', duration: 60 });
    expect(compileProject(project([item]), options).args.join(' ')).toContain(
      '-t 5 -i /media/Logo.png',
    );
    // One that starts after the video has ended is left out.
    const late = createOverlayItem(logo, 31, { id: 'late', duration: 5 });
    expect(compileProject(project([late]), options).args).not.toContain('/media/Logo.png');
  });

  it('V20: text stays on top: captions are laid over after the pictures over the video', () => {
    const item = createOverlayItem(logo, 0, { id: 'o', duration: 5 });
    const caption = createTextItem('caption', 'Hi', 1, { id: 'c' });
    const g = graph(compileProject(project([item], { text: [caption] }), options).args);
    expect(g).toContain('[vjoin][ov0]overlay=');
    expect(g).toMatch(/\[ov0\]overlay=[^;]*\[vbase\]/);
    expect(g).toContain('[vbase][t0]overlay=');
  });

  it('V20: half see-through, fading in and out (the picture’s transparency)', () => {
    const item = {
      ...createOverlayItem(logo, 2, { id: 'o', duration: 5 }),
      opacity: 0.5,
      fadeIn: 1,
      fadeOut: 0.5,
    };
    const g = graph(compileProject(project([item]), options).args);
    expect(g).toContain(
      `${overlayScale(HD, item)},format=rgba,colorchannelmixer=aa=0.5,fade=t=in:st=2:d=1:alpha=1,fade=t=out:st=6.5:d=0.5:alpha=1[ov0]`,
    );
  });

  it('V20: a video over the video plays its trimmed part from its start, without sound', () => {
    const item = { ...createOverlayItem(clip2, 3, { id: 'p' }), in: 1, out: 4 } as OverlayItem;
    const { args, hasAudio } = compileProject(project([item]), options);
    expect(args.join(' ')).toContain('-ss 1 -t 3 -i /media/Clip2.mp4');
    expect(graph(args)).toContain("enable='between(t,3,6)'");
    expect(hasAudio).toBe(false);
    expect(projectHasSound(project([item]))).toBe(false);
  });

  it('V20: a video over the video with its sound on is mixed in at its start', () => {
    const item = {
      ...createOverlayItem(clip2, 3, { id: 'p' }),
      muted: false,
      volume: 0.5,
    } as OverlayItem;
    const { args, hasAudio } = compileProject(project([item]), options);
    expect(hasAudio).toBe(true);
    const g = graph(args);
    expect(g).toMatch(
      /\[\d+:a\]asetpts=PTS-STARTPTS,[^;]*volume=0\.5[^;]*adelay=144000S:all=1\[os0\]/,
    );
    expect(g).toContain('[amain][os0]amix=inputs=2:duration=first:normalize=0[aout]');
  });

  it('V20: several follow one another, each laid over the last', () => {
    const a = createOverlayItem(logo, 0, { id: 'a', duration: 5 });
    const b = createOverlayItem(clip2, 6, { id: 'b' });
    const g = graph(compileProject(project([a, b]), options).args);
    expect(g).toContain('[vjoin][ov0]overlay=');
    expect(g).toContain('[ol0][ov1]overlay=');
    expect(g).toMatch(/\[ov1\]overlay=[^;]*\[vout\]/);
  });

  it('V10: a snapshot shows the picture over the video too', () => {
    const item = createOverlayItem(logo, 0, { id: 'o', duration: 5 });
    const { args } = compileProject(project([item]), { ...options, frameAt: 1 });
    expect(graph(args)).toContain('[vjoin][ov0]overlay=');
  });
});

import { describe, expect, it } from 'vitest';
import {
  createMediaAsset,
  createProject,
  createTextItem,
  createTitleSlide,
  createVideoClip,
} from '../../../../src/core/model/factory.ts';
import { EditError } from '../../../../src/core/model/errors.ts';
import { setItemDuration, trimVideo } from '../../../../src/core/model/timeline.ts';
import type { MainItem, MediaAsset, Project, TextItem } from '../../../../src/core/model/types.ts';
import { compileProject, type RenderOptions } from '../../../../src/core/render/compile.ts';

const lake = createMediaAsset({
  id: 'lake',
  kind: 'video',
  path: 'Lake.mp4',
  duration: 20,
  hasAudio: true,
});
const photo = createMediaAsset({
  id: 'photo',
  kind: 'image',
  path: 'Fish_Eagle1.jpg',
  hasAudio: false,
});
const options = (textImages: RenderOptions['textImages'] = {}): RenderOptions => ({
  mediaPath: (a: MediaAsset) => `/media/${a.path}`,
  textImages,
});
const project = (main: MainItem[], text: TextItem[] = []): Project => {
  const p = createProject({ name: 'Text' });
  return { ...p, media: [lake, photo], timeline: { ...p.timeline, main, text } };
};
const graph = (args: string[]) => args[args.indexOf('-filter_complex') + 1]!;
const full = (path: string) => ({ path, width: 1920, height: 1080 });

describe('M6 text in the export (V4–V7)', () => {
  const clip = trimVideo(
    createVideoClip(lake, { id: 'v' }),
    { in: 0, out: 30 },
    { ...lake, duration: 40 },
  );

  it('a caption is laid over the video only between its start and end', () => {
    const caption = createTextItem('caption', 'Over 400 species', 16.7, { id: 'c1' });
    const { args } = compileProject(
      project([{ ...clip, out: 20 }], [caption]),
      options({ c1: full('/tmp/c1.png') }),
    );
    // Fed until the video ends at 20 s (the caption itself is set to end at 21.7 s).
    expect(args.join(' ')).toContain('-loop 1 -framerate 30 -t 20 -i /tmp/c1.png');
    expect(graph(args)).toContain("[vbase][t0]overlay=x=0:y=0:enable='between(t,16.7,21.7)'[vout]");
  });

  it('regression (Activity 11d): text running past the end of the video does not make it longer', () => {
    // Transitions shortened the video to 20 s; the credits still say 15–25 s.
    const credits = setItemDuration(createTextItem('credits', 'Made by', 15, { id: 'cr' }), 10);
    const late = createTextItem('caption', 'After the end', 22, { id: 'late' });
    const { args, duration } = compileProject(
      project([{ ...clip, out: 20 }], [credits, late]),
      options({ cr: { path: '/tmp/cr.png', width: 1920, height: 400 }, late: full('/tmp/l.png') }),
    );
    expect(duration).toBe(20);
    // The picture of the credits is only fed until the video ends…
    expect(args.join(' ')).toContain('-loop 1 -framerate 30 -t 20 -i /tmp/cr.png');
    // …and text that starts after the end is left out.
    expect(args).not.toContain('/tmp/l.png');
  });

  it('text fades in and out by fading its transparency', () => {
    const caption = {
      ...createTextItem('caption', 'Hi', 16.7, { id: 'c1' }),
      fadeIn: 0.2,
      fadeOut: 0.2,
    };
    const g = graph(
      compileProject(
        project([{ ...clip, out: 20 }], [caption]),
        options({ c1: full('/tmp/c1.png') }),
      ).args,
    );
    expect(g).toContain('fade=t=in:st=16.7:d=0.2:alpha=1');
    expect(g).toContain('fade=t=out:st=21.5:d=0.2:alpha=1');
  });

  it('several text items are layered one after another', () => {
    const a = createTextItem('caption', 'A', 1, { id: 'a' });
    const b = createTextItem('subtitle', 'B', 2, { id: 'b' });
    const g = graph(
      compileProject(
        project([{ ...clip, out: 10 }], [a, b]),
        options({ a: full('/a.png'), b: full('/b.png') }),
      ).args,
    );
    expect(g).toContain('[vbase][t0]overlay');
    expect(g).toContain('[o0][t1]overlay');
    expect(g).toMatch(/\[t1\]overlay=[^;]*\[vout\]$/);
  });

  it('V5 scrolling credits move from below the frame to above it', () => {
    const credits = setItemDuration(
      createTextItem('credits', 'Filmed by: GBRvideo', 34.7, { id: 'cr' }),
      6,
    );
    const { args } = compileProject(
      project([{ ...clip, out: 40.7 }], [credits]),
      options({ cr: { path: '/cr.png', width: 1920, height: 400 } }),
    );
    expect(graph(args)).toContain(
      "overlay=x=(main_w-overlay_w)/2:y='main_h-(t-34.7)/6*(main_h+overlay_h)':enable='between(t,34.7,40.7)'",
    );
  });

  it('credits that do not scroll are shown in place', () => {
    const credits = {
      ...setItemDuration(createTextItem('credits', 'Thanks', 1, { id: 'cr' }), 3),
      scroll: false,
    };
    expect(
      graph(
        compileProject(project([{ ...clip, out: 5 }], [credits]), options({ cr: full('/cr.png') }))
          .args,
      ),
    ).toContain("overlay=x=0:y=0:enable='between(t,1,4)'");
  });

  it('an entrance flies the text in from the left over 1 s', () => {
    const caption = {
      ...createTextItem('caption', 'Hi', 2, { id: 'c1' }),
      entrance: 'fly-left' as const,
    };
    expect(
      graph(
        compileProject(project([{ ...clip, out: 10 }], [caption]), options({ c1: full('/c1.png') }))
          .args,
      ),
    ).toContain("overlay=x='if(lt(t-2,1),-1920+(t-2)*1920,0)':y=0");
  });

  it('Book B Task 11a: title text over a still picture for 8 s, flying in', () => {
    const title = {
      ...setItemDuration(createTitleSlide('Lake Naivasha, Kenya', { id: 't' }), 8),
      background: { kind: 'image' as const, assetId: 'photo' },
      entrance: 'fly-left' as const,
    };
    const { args, duration } = compileProject(project([title]), options({ t: full('/t.png') }));
    expect(args.join(' ')).toContain('-loop 1 -framerate 30 -t 8 -i /media/Fish_Eagle1.jpg');
    expect(args.join(' ')).toContain('-loop 1 -framerate 30 -t 8 -i /t.png');
    expect(graph(args)).toContain("[bg0][t0x]overlay=x='if(lt(t-0,1),-1920+(t-0)*1920,0)':y=0[v0]");
    expect(duration).toBe(8);
  });

  it('a title over a video background uses the video picture without its sound', () => {
    const title = {
      ...setItemDuration(createTitleSlide('Bees', { id: 't' }), 3),
      background: { kind: 'video' as const, assetId: 'lake' },
    };
    const { args, hasAudio } = compileProject(project([title]), options({ t: full('/t.png') }));
    expect(args.join(' ')).toContain('-ss 0 -t 3 -i /media/Lake.mp4');
    expect(graph(args)).not.toContain(':a]');
    expect(hasAudio).toBe(false);
  });

  it('a title slide with words but no prepared image is refused', () => {
    expect(() =>
      compileProject(project([createTitleSlide('Hello', { id: 't' })]), options()),
    ).toThrow(EditError);
    expect(() =>
      compileProject(project([createTitleSlide('Hello', { id: 't' })]), options()),
    ).toThrow(/text was not prepared/i);
  });
});

import { describe, expect, it } from 'vitest';
import {
  createImageClip,
  createMediaAsset,
  createProject,
  createVideoClip,
} from '../../../../src/core/model/factory.ts';
import { EditError } from '../../../../src/core/model/errors.ts';
import { setItemDuration, trimVideo } from '../../../../src/core/model/timeline.ts';
import type { MainItem, MediaAsset, Project } from '../../../../src/core/model/types.ts';
import { compileProject } from '../../../../src/core/render/compile.ts';

const lake = createMediaAsset({
  id: 'lake',
  kind: 'video',
  path: 'Lake.mp4',
  duration: 20,
  hasAudio: true,
});
const photo = createMediaAsset({ id: 'photo', kind: 'image', path: 'Eagle.jpg', hasAudio: false });
const options = { mediaPath: (a: MediaAsset) => `/media/${a.path}` };
const project = (main: MainItem[]): Project => {
  const p = createProject({ name: 'Look' });
  return { ...p, media: [lake, photo], timeline: { ...p.timeline, main } };
};
const graph = (p: Project) => {
  const { args } = compileProject(p, options);
  return args[args.indexOf('-filter_complex') + 1]!;
};
const clip = (id: string, from: number, to: number) =>
  trimVideo(createVideoClip(lake, { id }), { in: from, out: to }, lake);
const still = (id: string, seconds: number) =>
  setItemDuration(createImageClip(photo, { id }), seconds);

describe('V7 fades in the export', () => {
  it('fades the picture from black and to white, and the sound with it', () => {
    const g = graph(project([{ ...clip('v', 0, 10), fade: { in: 1, out: 2, colour: 'white' } }]));
    expect(g).toContain('trim=duration=10[p0];');
    expect(g).toContain('[p0]fade=t=in:st=0:d=1:color=white,fade=t=out:st=8:d=2:color=white[v0]');
    expect(g).toContain('atrim=duration=10,afade=t=in:st=0:d=1,afade=t=out:st=8:d=2[a0]');
  });

  it('a clip without a look compiles exactly as before', () => {
    expect(graph(project([clip('v', 0, 10)]))).toContain('trim=duration=10[v0]');
  });
});

describe('V15 filters in the export', () => {
  it('applies the clip’s filters in order after fitting it to the frame', () => {
    const g = graph(
      project([
        {
          ...still('s', 5),
          effects: [
            { effectId: 'video.blackwhite', params: {} },
            { effectId: 'video.blur', params: { radius: 8 } },
          ],
        },
      ]),
    );
    expect(g).toContain('trim=duration=5[p0];[p0]hue=s=0,boxblur=8:1[v0]');
  });

  it('explains an effect this version does not have', () => {
    expect(() =>
      graph(project([{ ...still('s', 5), effects: [{ effectId: 'video.nope', params: {} }] }])),
    ).toThrow(EditError);
  });
});

describe('V8 pan and zoom in the export', () => {
  it('zooms from 100 % to 150 % at the centre between 5 s and the end of an 8 s clip', () => {
    const g = graph(
      project([
        {
          ...clip('v', 0, 8),
          panZoom: {
            from: { zoom: 1, x: 0.5, y: 0.5 },
            to: { zoom: 1.5, x: 0.5, y: 0.5 },
            start: 5,
          },
        },
      ]),
    );
    const p = 'min(max((on/30-5)/3,0),1)';
    expect(g).toContain(
      `[p0]zoompan=z='1+0.5*${p}':x='max(0,min(iw-iw/zoom,(0.5+0*${p})*iw-iw/zoom/2))':y='max(0,min(ih-ih/zoom,(0.5+0*${p})*ih-ih/zoom/2))':d=1:s=1920x1080:fps=30[v0]`,
    );
  });
});

describe('V9 transitions in the export', () => {
  it('Book B Task 11g: a 2 s dissolve joins two clips with xfade and acrossfade; 6.7 s in all', () => {
    const p = project([
      clip('n1', 0, 4.2),
      { ...clip('n2', 8, 12.5), transitionIn: { effectId: 'transition.dissolve', duration: 2 } },
    ]);
    const g = graph(p);
    expect(g).toContain('[v0][v1]xfade=transition=fade:duration=2:offset=2.2[vout]');
    expect(g).toContain('[a0][a1]acrossfade=d=2[aout]');
    expect(g).not.toContain('concat');
    expect(compileProject(p, options).duration).toBeCloseTo(6.7, 10);
  });

  it('mixes plain cuts and transitions in one chain', () => {
    const g = graph(
      project([
        still('a', 3),
        still('b', 3),
        { ...still('c', 3), transitionIn: { effectId: 'transition.fadeblack', duration: 1 } },
      ]),
    );
    expect(g).toContain('[v0][v1]concat=n=2:v=1:a=0[x1]');
    expect(g).toContain('[x1][v2]xfade=transition=fadeblack:duration=1:offset=5[vout]');
  });
});

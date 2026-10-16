import { describe, expect, it } from 'vitest';
import {
  createImageClip,
  createMediaAsset,
  createProject,
  createTitleSlide,
  createVideoClip,
} from '../../../../src/core/model/factory.ts';
import { EditError } from '../../../../src/core/model/errors.ts';
import { setItemDuration, setVideoSpeed, trimVideo } from '../../../../src/core/model/timeline.ts';
import type { MainItem, MediaAsset, Project } from '../../../../src/core/model/types.ts';
import { compileProject, type RenderOptions } from '../../../../src/core/render/compile.ts';

const lake = createMediaAsset({
  id: 'lake',
  kind: 'video',
  path: 'Lake_Naivasha.mp4',
  duration: 20,
  hasAudio: true,
});
const silentClip = createMediaAsset({
  id: 'silent',
  kind: 'video',
  path: 'silent.mp4',
  duration: 10,
  hasAudio: false,
});
const photo = createMediaAsset({
  id: 'photo',
  kind: 'image',
  path: 'Fish_Eagle1.jpg',
  hasAudio: false,
});
const music = createMediaAsset({
  id: 'music',
  kind: 'audio',
  path: 'music.mp3',
  duration: 30,
  hasAudio: true,
});
const media = [lake, silentClip, photo, music];

const options: RenderOptions = { mediaPath: (a: MediaAsset) => `/media/${a.path}` };
const project = (main: MainItem[], extra: Partial<Project['timeline']> = {}): Project => {
  const p = createProject({ name: 'Test' });
  return { ...p, media, timeline: { ...p.timeline, main, ...extra } };
};
const clip = (id = 'c') => createVideoClip(lake, { id });
const muted = <T extends MainItem>(item: T): T => ({ ...item, muted: true });
const graph = (args: string[]) => args[args.indexOf('-filter_complex') + 1]!;

describe('V1–V3, V12–V14, V16 render compiler', () => {
  describe('slice 1: one clip, project resolution and fit (V1)', () => {
    it('matches the stored command', () => {
      expect(compileProject(project([clip()]), options).args).toMatchSnapshot();
    });

    it('reads the clip from its start for its whole length and fits it to 1920 × 1080', () => {
      const { args, duration, hasAudio } = compileProject(project([clip()]), options);
      expect(args.slice(0, 6)).toEqual(['-ss', '0', '-t', '20', '-i', '/media/Lake_Naivasha.mp4']);
      expect(graph(args)).toContain('pad=1920:1080');
      expect([duration, hasAudio]).toEqual([20, true]);
    });

    it('uses the project fit mode', () => {
      const p = project([clip()]);
      const crop = compileProject({ ...p, settings: { ...p.settings, fit: 'crop' } }, options);
      expect(graph(crop.args)).toContain('crop=1920:1080');
    });
  });

  describe('slice 2: trim (V2)', () => {
    it('Book B Task 11b: seeks to 8 s and reads 4.5 s', () => {
      const { args, duration } = compileProject(
        project([trimVideo(clip(), { in: 8, out: 12.5 }, lake)]),
        options,
      );
      expect(args.slice(0, 4)).toEqual(['-ss', '8', '-t', '4.5']);
      expect(duration).toBe(4.5);
    });
  });

  describe('slice 3: several clips one after another (V3)', () => {
    it('matches the stored command', () => {
      const p = project([
        trimVideo(clip('a'), { in: 0, out: 3 }, lake),
        trimVideo(clip('b'), { in: 10, out: 12 }, lake),
      ]);
      expect(compileProject(p, options).args).toMatchSnapshot();
    });

    it('joins every clip with concat, video and sound together', () => {
      const p = project([clip('a'), clip('b'), clip('c')]);
      expect(graph(compileProject(p, options).args)).toContain(
        '[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[vout][aout]',
      );
    });
  });

  describe('slice 4: still images (V12)', () => {
    it('loops the picture for its duration and adds silence when other clips have sound', () => {
      const p = project([setItemDuration(createImageClip(photo, { id: 'i' }), 5), clip()]);
      const { args, duration } = compileProject(p, options);
      expect(args.slice(0, 8)).toEqual([
        '-loop',
        '1',
        '-framerate',
        '30',
        '-t',
        '5',
        '-i',
        '/media/Fish_Eagle1.jpg',
      ]);
      expect(graph(args)).toContain('anullsrc=r=48000:cl=stereo,atrim=duration=5[a0]');
      expect(duration).toBe(25);
    });

    it('a colour title slide without text becomes a plain coloured frame', () => {
      const p = project([setItemDuration(createTitleSlide('', { id: 't' }), 6)]);
      expect(graph(compileProject(p, options).args)).toContain(
        'color=c=#000000:s=1920x1080:r=30:d=6',
      );
    });
  });

  describe('slice 5: speed (V14)', () => {
    it('Book B Task 11c: 0–6.3 s at 1.5× lasts 4.2 s, picture and sound sped up', () => {
      const fast = setVideoSpeed(trimVideo(clip(), { in: 0, out: 6.3 }, lake), 1.5);
      const { args, duration } = compileProject(project([fast]), options);
      expect(graph(args)).toContain('setpts=(PTS-STARTPTS)/1.5');
      expect(graph(args)).toContain('atempo=1.5');
      expect(duration).toBeCloseTo(4.2, 9);
    });

    it('quarter speed chains atempo (0.5 × 0.5)', () => {
      expect(graph(compileProject(project([setVideoSpeed(clip(), 0.25)]), options).args)).toContain(
        'atempo=0.5,atempo=0.5',
      );
    });
  });

  describe('slice 6: removing sound (V13)', () => {
    it('if no clip has sound, the file has no audio stream at all', () => {
      const { args, hasAudio } = compileProject(project([muted(clip())]), options);
      expect(hasAudio).toBe(false);
      expect(args).toContain('-an');
      expect(graph(args)).toContain('concat=n=1:v=1:a=0[vout]');
      expect(args).not.toContain('[aout]');
    });

    it('a muted clip between clips with sound becomes silence', () => {
      const { args } = compileProject(project([clip('a'), muted(clip('b'))]), options);
      expect(graph(args)).toContain('anullsrc=r=48000:cl=stereo,atrim=duration=20[a1]');
      expect(graph(args)).not.toContain('[1:a]');
    });

    it('a video file that has no sound track is treated like a muted clip', () => {
      const p = project([createVideoClip(silentClip, { id: 's' }), clip()]);
      expect(graph(compileProject(p, options).args)).not.toContain('[0:a]');
    });

    it('a clip volume other than 100 % is applied', () => {
      expect(graph(compileProject(project([{ ...clip(), volume: 0.5 }]), options).args)).toContain(
        'volume=0.5',
      );
    });
  });

  describe('slice 7: MP4 output and quality (V16)', () => {
    it.each([
      ['high', '18', '192k'],
      ['medium', '23', '160k'],
      ['low', '28', '128k'],
    ] as const)('%s quality: H.264 crf %s, AAC %s, ready for the web', (quality, crf, audio) => {
      const { args } = compileProject(project([clip()]), { ...options, quality });
      const tail = args.slice(args.indexOf('-c:v'));
      expect(tail).toEqual([
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        crf,
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        audio,
        '-movflags',
        '+faststart',
      ]);
    });

    it('a hardware encoder gets a bit rate instead of crf', () => {
      const { args } = compileProject(project([clip()]), {
        ...options,
        videoEncoder: 'h264_videotoolbox',
      });
      expect(args.slice(args.indexOf('-c:v'), args.indexOf('-c:v') + 4)).toEqual([
        '-c:v',
        'h264_videotoolbox',
        '-b:v',
        '6221k',
      ]);
    });
  });

  describe('things that cannot be exported (yet) are refused, never silently dropped', () => {
    it.each([
      ['an empty project', project([]), /add a clip/i],
      [
        'a clip whose file is not in the project',
        project([createVideoClip({ ...lake, id: 'gone' })]),
        /could not be found/i,
      ],
    ])('%s', (_name, p, message) => {
      expect(() => compileProject(p, options)).toThrow(EditError);
      expect(() => compileProject(p, options)).toThrow(message);
    });
  });
});

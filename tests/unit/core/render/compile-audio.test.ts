import { describe, expect, it } from 'vitest';
import {
  createAudioItem,
  createMediaAsset,
  createProject,
  createVideoClip,
} from '../../../../src/core/model/factory.ts';
import type { AudioItem, MainItem, MediaAsset, Project } from '../../../../src/core/model/types.ts';
import { compileProject, type RenderOptions } from '../../../../src/core/render/compile.ts';

const lake = createMediaAsset({
  id: 'lake',
  kind: 'video',
  path: 'Lake.mp4',
  duration: 20,
  hasAudio: true,
});
const music = createMediaAsset({
  id: 'music',
  kind: 'audio',
  path: 'Task_11e_audio.mp3',
  duration: 45,
  hasAudio: true,
});
const voice = createMediaAsset({
  id: 'voice',
  kind: 'audio',
  path: 'voice.wav',
  duration: 4,
  hasAudio: true,
});
const options: RenderOptions = { mediaPath: (a: MediaAsset) => `/media/${a.path}` };
const project = (main: MainItem[], audio: [AudioItem[], AudioItem[]]): Project => {
  const p = createProject({ name: 'Test' });
  return { ...p, media: [lake, music, voice], timeline: { ...p.timeline, main, audio } };
};
const clip = (change: Partial<Extract<MainItem, { type: 'video' }>> = {}) => ({
  ...createVideoClip(lake, { id: 'c' }),
  ...change,
});
const graph = (args: string[]) => args[args.indexOf('-filter_complex') + 1]!;
/** The filter chain that finishes with `label`, e.g. '[m0]'. */
const chain = (args: string[], label: string) =>
  graph(args)
    .split(';')
    .find((f) => f.endsWith(label))!;

describe('V13 music and voiceover tracks in the export', () => {
  it('Book B Task 11e: music starting at 5.00 s is delayed by exactly 5 s (in samples) and mixed in', () => {
    const p = project([clip()], [[createAudioItem(music, 5, { id: 'm' })], []]);
    const { args, hasAudio, duration } = compileProject(p, options);
    expect([hasAudio, duration]).toEqual([true, 20]);
    // The music file is an input, read from its start for as long as it is heard (20 − 5 s).
    const at = args.indexOf('/media/Task_11e_audio.mp3');
    expect(args.slice(at - 5, at + 1)).toEqual([
      '-ss',
      '0',
      '-t',
      '15',
      '-i',
      '/media/Task_11e_audio.mp3',
    ]);
    expect(chain(args, '[m0]')).toContain('adelay=240000S:all=1');
    // The clips' own sound comes first, so the mix ends with the video; volumes are kept as set.
    expect(graph(args)).toContain('[amain][m0]amix=inputs=2:duration=first:normalize=0[aout]');
    expect(args).toContain('[aout]');
  });

  it('music is heard even when no clip has sound: the clips give silence underneath', () => {
    const p = project([clip({ muted: true })], [[createAudioItem(music, 0, { id: 'm' })], []]);
    const { args, hasAudio } = compileProject(p, options);
    expect(hasAudio).toBe(true);
    expect(graph(args)).toContain('anullsrc=r=48000:cl=stereo,atrim=duration=20[a0]');
    expect(args).not.toContain('-an');
  });

  it('trim: reads the music from its start point', () => {
    const item = { ...createAudioItem(music, 0, { id: 'm' }), in: 2.5, out: 10 };
    const { args } = compileProject(project([clip()], [[item], []]), options);
    const at = args.indexOf('/media/Task_11e_audio.mp3');
    expect(args.slice(at - 5, at - 1)).toEqual(['-ss', '2.5', '-t', '7.5']);
  });

  it('volume and fades: the fade out ends where the music is last heard (here, with the video)', () => {
    const item = { ...createAudioItem(music, 5, { id: 'm' }), volume: 0.8, fadeIn: 1, fadeOut: 3 };
    const { args } = compileProject(project([clip()], [[item], []]), options);
    const m = chain(args, '[m0]');
    expect(m).toContain('volume=0.8');
    expect(m).toContain('afade=t=in:st=0:d=1');
    expect(m).toContain('afade=t=out:st=12:d=3'); // heard for 15 s
    // Fades are measured in the music's own time, before it is moved to 5 s.
    expect(m.indexOf('afade')).toBeLessThan(m.indexOf('adelay'));
  });

  it('music and voiceover are mixed together with the clip sound', () => {
    const p = project(
      [clip()],
      [[createAudioItem(music, 0, { id: 'm' })], [createAudioItem(voice, 6, { id: 'v' })]],
    );
    const { args } = compileProject(p, options);
    expect(graph(args)).toContain('[amain][m0][m1]amix=inputs=3:duration=first:normalize=0[aout]');
    expect(chain(args, '[m1]')).toContain('adelay=288000S:all=1');
  });

  it('lower under voiceover: the music is 6 dB quieter exactly while the voiceover plays', () => {
    const p = project(
      [clip()],
      [
        [{ ...createAudioItem(music, 0, { id: 'm' }), duck: true }],
        [createAudioItem(voice, 6, { id: 'v1' }), createAudioItem(voice, 12, { id: 'v2' })],
      ],
    );
    const m = chain(compileProject(p, options).args, '[m0]');
    expect(m).toContain("volume=-6dB:enable='between(t,6,10)+between(t,12,16)'");
    expect(m.indexOf('adelay')).toBeLessThan(m.indexOf('volume=-6dB')); // in timeline time
  });

  it('speed: music at 2× from 5 s reads 30 s of the file for the 15 s it is heard, pitch kept', () => {
    const item = { ...createAudioItem(music, 5, { id: 'm' }), speed: 2, fadeOut: 3 };
    const { args } = compileProject(project([clip()], [[item], []]), options);
    const at = args.indexOf('/media/Task_11e_audio.mp3');
    expect(args.slice(at - 5, at - 1)).toEqual(['-ss', '0', '-t', '30']);
    const m = chain(args, '[m0]');
    expect(m).toContain('atempo=2');
    // Fades are timed on the timeline, so they come after the speed change.
    expect(m).toContain('afade=t=out:st=12:d=3');
    expect(m.indexOf('atempo')).toBeLessThan(m.indexOf('afade'));
  });

  it('music that starts after the video has ended is left out', () => {
    const p = project([clip()], [[createAudioItem(music, 25, { id: 'm' })], []]);
    const { args } = compileProject(p, options);
    expect(args).not.toContain('/media/Task_11e_audio.mp3');
    expect(graph(args)).not.toContain('amix');
  });

  it('a snapshot has no sound, so the audio tracks are not read', () => {
    const p = project([clip()], [[createAudioItem(music, 0, { id: 'm' })], []]);
    const { args } = compileProject(p, { ...options, frameAt: 1 });
    expect(args).not.toContain('/media/Task_11e_audio.mp3');
  });
});

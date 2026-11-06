import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  animationArgs,
  computePeaks,
  frameArgs,
  proxyArgs,
  tempPathFor,
  thumbnailArgs,
  waveformArgs,
} from '../../../../src/main/media/jobs.ts';

describe('job commands', () => {
  it('a proxy is 360 px tall, keeps the shape, and is quick to decode and seek', () => {
    const args = proxyArgs('/in/a.mov');
    expect(args.slice(0, 2)).toEqual(['-i', '/in/a.mov']);
    expect(args).toEqual(
      expect.arrayContaining(['-vf', 'scale=-2:360', '-c:v', 'libx264', '-preset', 'veryfast']),
    );
    expect(args.join(' ')).toContain('-g 30');
  });

  it('thumbnails are one strip: count frames spread over the clip, tiled side by side', () => {
    const args = thumbnailArgs('/in/a.mp4', 10, { count: 5, height: 64 });
    expect(args).toContain('fps=0.5,scale=-2:64,tile=5x1');
    expect(args).toEqual(expect.arrayContaining(['-frames:v', '1']));
  });

  it('waveforms decode the sound to mono raw samples at a low rate', () => {
    expect(waveformArgs('/in/a.mp3')).toEqual([
      '-i',
      '/in/a.mp3',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '8000',
      '-f',
      'f32le',
    ]);
  });

  it('a frame is taken at the exact time, as one image', () => {
    const args = frameArgs('/in/a.mp4', 16.66);
    expect(args.slice(0, 4)).toEqual(['-ss', '16.66', '-i', '/in/a.mp4']);
    expect(args).toEqual(expect.arrayContaining(['-frames:v', '1', '-update', '1']));
  });

  it('temporary output keeps the extension, so ffmpeg still knows the format', () => {
    expect(tempPathFor(join('/out', 'proxy.mp4'), 'j7')).toBe(join('/out', 'proxy.partial-j7.mp4'));
  });
});

describe('computePeaks', () => {
  it('takes the loudest sample in each slice', () => {
    const samples = Float32Array.from([0.1, -0.5, 0.2, 0.3, -0.9, 0.4]);
    expect(computePeaks(samples, 3).map((p) => Number(p.toFixed(2)))).toEqual([0.5, 0.3, 0.9]);
  });

  it('never returns values outside 0–1', () => {
    expect(computePeaks(Float32Array.from([1.7, -2]), 2)).toEqual([1, 1]);
  });

  it('returns silence for an empty or very short sound', () => {
    expect(computePeaks(new Float32Array(0), 4)).toEqual([0, 0, 0, 0]);
    expect(computePeaks(Float32Array.from([0.5]), 2)).toHaveLength(2);
  });

  describe('AN15 animation exports', () => {
    const options = { fps: 24, frames: 72, width: 600, height: 450 };
    const alarm = {
      path: '/m/alarm.mp3',
      offset: 0.5,
      heard: 1.5,
      volume: 0.8,
      fadeIn: 0.25,
      fadeOut: 0,
      cut: 0,
      duration: 1.5,
      at: 1,
    };

    it('AN15 an MP4 without sound: the frames, padded to even, H.264', () => {
      const args = animationArgs('/f', { ...options, format: 'mp4' });
      expect(args.slice(0, 4)).toEqual(['-framerate', '24', '-i', join('/f', 'frame-%05d.png')]);
      expect(args).toEqual(expect.arrayContaining(['-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2']));
      expect(args).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-pix_fmt', 'yuv420p']));
      expect(args).not.toContain('-c:a');
    });

    it('AN15 AVI is MPEG-4 Part 2 (+ MP3 sound), MOV is H.264 (+ AAC), as Video mode makes them', () => {
      const avi = animationArgs('/f', { ...options, format: 'avi', sounds: [alarm] });
      expect(avi).toEqual(expect.arrayContaining(['-c:v', 'mpeg4', '-vtag', 'xvid']));
      expect(avi).toEqual(expect.arrayContaining(['-c:a', 'libmp3lame', '-b:a', '192k']));
      const mov = animationArgs('/f', { ...options, format: 'mov', sounds: [alarm] });
      expect(mov).toEqual(
        expect.arrayContaining(['-c:v', 'libx264', '-c:a', 'aac', '-b:a', '160k']),
      );
    });

    it('AN28 an MP4 with two sounds: each read, trimmed, faded, placed at its time and mixed', () => {
      const ding = { ...alarm, path: '/cache/sounds/ding.wav', offset: 0, heard: 1, volume: 1 };
      const both = [
        alarm,
        { ...ding, fadeIn: 0, fadeOut: 0.5, cut: 0.25, duration: 0.75, at: 2.25 },
      ];
      const args = animationArgs('/f', { ...options, format: 'mp4', sounds: both });
      // Each sound file is read from its trim start for the seconds heard.
      expect(args.slice(4, 16)).toEqual([
        ...['-ss', '0.5', '-t', '1.5', '-i', '/m/alarm.mp3'],
        ...['-ss', '0', '-t', '1', '-i', '/cache/sounds/ding.wav'],
      ]);
      const graph = args[args.indexOf('-filter_complex') + 1]!;
      expect(graph).toContain('[0:v]pad=ceil(iw/2)*2:ceil(ih/2)*2[v]');
      expect(graph).toContain(
        '[1:a]asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=0.8,afade=t=in:st=0:d=0.25,atrim=start=0:duration=1.5,asetpts=PTS-STARTPTS,adelay=48000S:all=1[s0]',
      );
      expect(graph).toContain(
        '[2:a]asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=out:st=0.5:d=0.5,atrim=start=0.25:duration=0.75,asetpts=PTS-STARTPTS,adelay=108000S:all=1[s1]',
      );
      // Mixed without making either quieter, then exactly as long as the video (3 s).
      expect(graph).toContain(
        '[s0][s1]amix=inputs=2:duration=longest:normalize=0,apad,atrim=duration=3[a]',
      );
      expect(args).toEqual(expect.arrayContaining(['-map', '[v]', '-map', '[a]', '-c:a', 'aac']));
    });

    it('AN28 a GIF has no sound: the sounds are not read', () => {
      const args = animationArgs('/f', { ...options, format: 'gif', sounds: [alarm] });
      expect(args).not.toContain('/m/alarm.mp3');
      expect(args.join(' ')).toContain('palettegen');
    });
  });
});

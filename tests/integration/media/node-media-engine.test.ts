import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
import { FIXTURES, generateFixtures, selectFixtures } from '../../../scripts/lib/fixtures.ts';
import { createNodeMediaEngine } from '../../../src/main/media/engine.ts';
import { mediaEngineContract } from '../../contract/media-engine.contract.ts';
import { bundledFfmpeg } from '../helpers/ffmpeg.ts';
import { planFreeCrop } from '../../../src/core/image/crop.ts';

let media: string;
let out: string;
const engine = createNodeMediaEngine(bundledFfmpeg());

beforeAll(async () => {
  media = await mkdtemp(join(tmpdir(), 'mve-media-'));
  out = await mkdtemp(join(tmpdir(), 'mve-out-'));
  await generateFixtures(bundledFfmpeg().ffmpeg, media, selectFixtures(FIXTURES, 'test'));
});
afterAll(async () => {
  await rm(media, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

mediaEngineContract('Node + FFmpeg', () => ({
  engine,
  video: join(media, 'clip_1080p30_10s.mp4'),
  image: join(media, 'photo_3764x3092.jpg'),
  audio: join(media, 'music_stereo_45s.mp3'),
  missing: join(media, 'missing.mp4'),
  out: (name) => join(out, name),
  // AN15: FFmpeg's test pattern saved as PNG frames, as the app's drawing would save them.
  frames: async (width, height, count) => {
    const folder = await mkdtemp(join(out, 'frames-'));
    await execFileAsync(bundledFfmpeg().ffmpeg, [
      ...['-v', 'error', '-f', 'lavfi', '-i', `testsrc=size=${width}x${height}:rate=24`],
      ...['-frames:v', String(count), '-start_number', '0', join(folder, 'frame-%05d.png')],
    ]);
    return folder;
  },
}));

describe('Node + FFmpeg engine, real-file details', () => {
  it.each([
    ['clip_1080p30_10s.mp4', 'video', 'mp4'],
    ['clip_4x3_640x480.mov', 'video', 'mov'],
    ['clip_4x3_640x480.avi', 'video', 'avi'],
    ['clip_4x3_640x480.wmv', 'video', 'wmv'],
    ['photo_3764x3092.jpg', 'image', 'jpg'],
    ['music_stereo_45s.mp3', 'audio', 'mp3'],
    ['music_with_cover.mp3', 'audio', 'mp3'],
    ['tone_dc_offset.wav', 'audio', 'wav'],
  ])('probes %s as %s / %s', async (file, kind, container) => {
    expect(await engine.probe(join(media, file))).toMatchObject({ kind, container });
  });

  it('AN5 an SVG picture (FFmpeg reads no size) gets its size from the file; a GIF is a gif', async () => {
    const svg = join(out, 'star.svg');
    await writeFile(
      svg,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 135 120"><path d="M0 0h1"/></svg>',
    );
    expect(await engine.probe(svg)).toMatchObject({
      kind: 'image',
      container: 'svg',
      video: { width: 135, height: 120 },
    });
    const gif = join(out, 'still.gif');
    await execFileAsync(bundledFfmpeg().ffmpeg, [
      ...['-v', 'error', '-f', 'lavfi', '-i', 'color=red:s=40x30', '-frames:v', '1', gif],
    ]);
    expect(await engine.probe(gif)).toMatchObject({
      container: 'gif',
      video: { width: 40, height: 30 },
    });
    // A GIF FFmpeg was not told to loop plays once: no NETSCAPE2.0 block.
    const once = join(out, 'once.gif');
    await execFileAsync(bundledFfmpeg().ffmpeg, [
      ...['-v', 'error', '-f', 'lavfi', '-i', 'color=red:s=40x30:r=5', '-frames:v', '3'],
      ...['-loop', '-1', once],
    ]);
    expect((await engine.probe(once)).loop).toBe(false);
  });

  it('AN15 a GIF has one picture per frame (72), loops, and the frames folder is removed after', async () => {
    const folder = await mkdtemp(join(out, 'gif-frames-'));
    await execFileAsync(bundledFfmpeg().ffmpeg, [
      ...['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=600x400:rate=24'],
      ...['-frames:v', '72', '-start_number', '0', join(folder, 'frame-%05d.png')],
    ]);
    await engine.encodeFrames(folder, join(out, 'count.gif'), {
      format: 'gif',
      fps: 24,
      frames: 72,
      width: 600,
      height: 400,
    }).done;
    const { stdout } = await execFileAsync(bundledFfmpeg().ffprobe, [
      ...['-v', 'error', '-count_frames', '-select_streams', 'v:0'],
      ...['-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', join(out, 'count.gif')],
    ]);
    expect(Number(stdout.trim())).toBe(72);
    // AN17: the task checker sees that it loops (the NETSCAPE2.0 block of -loop 0).
    expect(await engine.probe(join(out, 'count.gif'))).toMatchObject({
      container: 'gif',
      loop: true,
    });
    await expect(readdir(folder)).rejects.toThrow();
  });

  it('AN28 an MP4 with a sound: silent until the sound’s time (1 s), then heard, as long as the video', async () => {
    const folder = await mkdtemp(join(out, 'sound-frames-'));
    await execFileAsync(bundledFfmpeg().ffmpeg, [
      ...['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24'],
      ...['-frames:v', '48', '-start_number', '0', join(folder, 'frame-%05d.png')],
    ]);
    const output = join(out, 'alarm-at-1s.mp4');
    await engine.encodeFrames(folder, output, {
      format: 'mp4',
      fps: 24,
      frames: 48,
      width: 320,
      height: 240,
      sounds: [
        {
          path: join(media, 'music_stereo_45s.mp3'),
          offset: 5,
          heard: 2,
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
          cut: 0,
          duration: 2,
          at: 1,
        },
      ],
    }).done;
    const info = await engine.probe(output);
    expect(info.audio).toMatchObject({ codec: 'aac' });
    expect(info.duration).toBeCloseTo(2, 1);
    const { sampleRate, channels } = await engine.decodeAudio(output, 8000);
    const peak = (from: number, to: number) =>
      channels[0]!
        .slice(Math.round(from * sampleRate), Math.round(to * sampleRate))
        .reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak(0, 0.9)).toBeLessThan(0.01);
    expect(peak(1.1, 1.9)).toBeGreaterThan(0.2);
  });

  it('AN15 a range of 24 frames is a 1 s video of 24 pictures; an AVI and a MOV with sound play', async () => {
    const make = async (name: string, format: 'avi' | 'mov') => {
      const folder = await mkdtemp(join(out, `${format}-frames-`));
      await execFileAsync(bundledFfmpeg().ffmpeg, [
        ...['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=600x450:rate=24'],
        ...['-frames:v', '24', '-start_number', '0', join(folder, 'frame-%05d.png')],
      ]);
      await engine.encodeFrames(folder, join(out, name), {
        format,
        fps: 24,
        frames: 24,
        width: 600,
        height: 450,
        sounds: [
          {
            path: join(media, 'music_stereo_45s.mp3'),
            offset: 0,
            heard: 1,
            volume: 0.5,
            fadeIn: 0.2,
            fadeOut: 0.2,
            cut: 0,
            duration: 1,
            at: 0,
          },
        ],
      }).done;
      const { stdout } = await execFileAsync(bundledFfmpeg().ffprobe, [
        ...['-v', 'error', '-count_frames', '-select_streams', 'v:0'],
        ...['-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', join(out, name)],
      ]);
      return { frames: Number(stdout.trim()), info: await engine.probe(join(out, name)) };
    };
    const avi = await make('part.avi', 'avi');
    expect(avi.frames).toBe(24);
    expect(avi.info).toMatchObject({
      container: 'avi',
      video: { codec: 'mpeg4', width: 600, height: 450 },
      audio: { codec: 'mp3' },
    });
    expect(avi.info.duration).toBeCloseTo(1, 1);
    const mov = await make('part.mov', 'mov');
    expect(mov.frames).toBe(24);
    expect(mov.info).toMatchObject({
      container: 'mov',
      video: { codec: 'h264', width: 600, height: 450 },
      audio: { codec: 'aac' },
    });
    // Both can be read back (a player opens them): a picture from the middle of each.
    await engine.extractFrame(join(out, 'part.avi'), 0.5, join(out, 'part-avi.png'));
    await engine.extractFrame(join(out, 'part.mov'), 0.5, join(out, 'part-mov.png'));
    expect((await engine.probe(join(out, 'part-mov.png'))).video).toMatchObject({ width: 600 });
  });

  it('AN28 a sound file that has gone is named', async () => {
    const folder = await mkdtemp(join(out, 'gone-frames-'));
    await execFileAsync(bundledFfmpeg().ffmpeg, [
      ...['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24'],
      ...['-frames:v', '2', '-start_number', '0', join(folder, 'frame-%05d.png')],
    ]);
    const gone = {
      path: join(media, 'no-such-alarm.mp3'),
      offset: 0,
      heard: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      cut: 0,
      duration: 1,
      at: 0,
    };
    await expect(
      engine.encodeFrames(folder, join(out, 'gone.mp4'), {
        format: 'mp4',
        fps: 24,
        frames: 2,
        width: 320,
        height: 240,
        sounds: [gone],
      }).done,
    ).rejects.toThrow(/The sound no-such-alarm\.mp3 could not be found/);
  });

  it('AN15 frames that are missing give a plain message', async () => {
    await expect(
      engine.encodeFrames(join(out, 'no-such-frames'), join(out, 'none.mp4'), {
        format: 'mp4',
        fps: 24,
        frames: 1,
        width: 600,
        height: 400,
      }).done,
    ).rejects.toThrow(/frames could not be found/);
  });

  it('a 4:3 clip keeps its shape in the proxy (480 × 360)', async () => {
    await engine.makeProxy(join(media, 'clip_4x3_640x480.mov'), join(out, 'proxy43.mp4'), 5).done;
    expect((await engine.probe(join(out, 'proxy43.mp4'))).video).toMatchObject({
      width: 480,
      height: 360,
    });
  });

  it('quitting (cancelAll) also stops a file check (ffprobe) that is still running', async () => {
    const own = createNodeMediaEngine(bundledFfmpeg());
    const checking = own.probe(join(media, 'clip_1080p30_10s.mp4'));
    own.cancelAll();
    await expect(checking).rejects.toThrow();
  });

  it('explains a damaged file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(media, 'damaged.mp4'), 'this is not a video');
    await expect(engine.probe(join(media, 'damaged.mp4'))).rejects.toThrow(/damaged/i);
  });

  it('leaves no temporary files behind after cancelled or failed jobs', async () => {
    const job = engine.makeProxy(join(media, 'clip_1080p30_10s.mp4'), join(out, 'gone.mp4'), 10);
    setTimeout(() => job.cancel(), 50);
    await job.done.catch(() => {});
    await engine
      .makeProxy(join(media, 'missing.mp4'), join(out, 'gone2.mp4'), 10)
      .done.catch(() => {});
    expect((await readdir(out)).filter((f) => f.includes('.partial-'))).toEqual([]);
  });

  it('peaks of a 0.4-amplitude tone are about 0.4', async () => {
    const peaks = await engine.waveformPeaks(join(media, 'music_stereo_45s.mp3'), 20);
    for (const p of peaks) expect(p).toBeGreaterThan(0.3);
  });

  it('AN5 a colour made see-through is clear in the PNG, the rest solid; a crop of it stays clear', async () => {
    // A red pearl on a white photo.
    const photo = join(out, 'pearl-on-white.jpg');
    await execFileAsync(bundledFfmpeg().ffmpeg, [
      ...['-v', 'error', '-f', 'lavfi', '-i', 'color=white:s=40x30'],
      ...['-vf', 'drawbox=x=10:y=10:w=20:h=10:color=red:t=fill', '-frames:v', '1', photo],
    ]);
    const alpha = async (file: string, width: number) => {
      const { stdout } = await execFileAsync(
        bundledFfmpeg().ffmpeg,
        ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
        { encoding: 'buffer' },
      );
      return (x: number, y: number) => stdout[(y * width + x) * 4 + 3];
    };
    const made = await engine.colourKeyImage(photo, {
      colour: '#ffffff',
      tolerance: 15,
      soft: false,
    });
    expect(made).toBe(join(out, 'pearl-on-white1.png'));
    const keyed = await alpha(made, 40);
    expect(keyed(0, 0)).toBe(0);
    expect(keyed(39, 29)).toBe(0);
    expect(keyed(20, 15)).toBe(255);
    // Crop… keeps it see-through (the part at its own size, a PNG still).
    const cut = await engine.resizeCropImage(
      made,
      planFreeCrop({ width: 40, height: 30 }, { x: 5, y: 5, width: 30, height: 20 }),
    );
    const part = await alpha(cut, 30);
    expect(part(0, 0)).toBe(0);
    expect(part(15, 10)).toBe(255);
  });
});

// Shared behaviour every MediaEngine must have (MILESTONES M2: contract tests).
// Run against the real FFmpeg engine (integration) and the mock (unit), so the mock
// cannot drift from reality.
import { describe, expect, it } from 'vitest';
import { EditError, JobCancelledError, MediaError } from '../../src/core/model/errors.ts';
import { assetFromProbe, createProject, createVideoClip } from '../../src/core/model/factory.ts';
import { trimVideo } from '../../src/core/model/timeline.ts';
import { planResizeCrop } from '../../src/core/image/crop.ts';
import type { MediaAsset, Project, VideoClip } from '../../src/core/model/types.ts';
import type { JobEvent, MediaEngine } from '../../src/core/ports.ts';
import { defaultExport } from '../../src/core/render/formats.ts';
import {
  estimateAudioSize,
  type AudioExportSettings,
} from '../../src/core/render/audio-formats.ts';

export interface ContractSetup {
  engine: MediaEngine;
  /** 1920×1080, 10 s, with sound. */
  video: string;
  /** Still image. */
  image: string;
  /** Sound only. */
  audio: string;
  missing: string;
  /** A writable path for an output file. */
  out(name: string): string;
}

export function mediaEngineContract(name: string, setup: () => ContractSetup): void {
  describe(`MediaEngine contract: ${name}`, () => {
    it('probe reads a video', async () => {
      const { engine, video } = setup();
      const info = await engine.probe(video);
      expect(info.kind).toBe('video');
      expect(info.duration).toBeCloseTo(10, 1);
      expect(info.video).toMatchObject({ width: 1920, height: 1080 });
    });

    it('probe reads a still image (no duration) and a sound file', async () => {
      const { engine, image, audio } = setup();
      const still = await engine.probe(image);
      expect([still.kind, still.duration]).toEqual(['image', undefined]);
      expect((await engine.probe(audio)).kind).toBe('audio');
    });

    it('probe explains a missing file', async () => {
      const { engine, missing } = setup();
      await expect(engine.probe(missing)).rejects.toThrow(MediaError);
      await expect(engine.probe(missing)).rejects.toThrow(/could not be found/i);
    });

    it('makeProxy reports rising progress, ends at 100 %, and writes a 360 px copy', async () => {
      const { engine, video, out } = setup();
      const events: JobEvent[] = [];
      const stop = engine.onJobEvent((e) => events.push(e));
      const job = engine.makeProxy(video, out('proxy.mp4'), 10);
      await job.done;
      stop();
      const mine = events.filter((e) => e.jobId === job.id);
      const ratios = mine.flatMap((e) => (e.type === 'progress' ? [e.ratio] : []));
      expect(ratios.length).toBeGreaterThan(0);
      expect(ratios).toEqual([...ratios].sort((a, b) => a - b));
      expect(ratios.at(-1)).toBe(1);
      expect(mine.at(-1)!.type).toBe('done');
      const proxy = await engine.probe(out('proxy.mp4'));
      expect(proxy.video).toMatchObject({ width: 640, height: 360 });
      expect(proxy.duration).toBeCloseTo(10, 0);
    });

    it('a cancelled proxy leaves no file', async () => {
      const { engine, video, out } = setup();
      const job = engine.makeProxy(video, out('cancelled.mp4'), 10);
      job.cancel();
      await expect(job.done).rejects.toThrow(JobCancelledError);
      await expect(engine.probe(out('cancelled.mp4'))).rejects.toThrow(/could not be found/i);
    });

    it('a proxy of a missing file fails with an explanation', async () => {
      const { engine, missing, out } = setup();
      await expect(engine.makeProxy(missing, out('none.mp4'), 10).done).rejects.toThrow(
        /could not be found/i,
      );
    });

    it('resizeCropImage makes a new picture of the crop size and never overwrites (V11)', async () => {
      const { engine, image } = setup();
      const info = await engine.probe(image);
      const plan = planResizeCrop(info.video!, { width: 320, height: 180 }, 'bottom');
      const first = await engine.resizeCropImage(image, plan);
      expect(first).toBe(image.replace(/\.jpg$/, '1.jpg'));
      expect(await engine.probe(first)).toMatchObject({
        kind: 'image',
        video: { width: 320, height: 180 },
      });
      // That name is taken now, so the next copy is numbered on; the original is kept.
      expect(await engine.resizeCropImage(image, plan)).toBe(image.replace(/\.jpg$/, '2.jpg'));
      expect((await engine.probe(image)).video).toMatchObject(info.video!);
    });

    it('resizeCropImage refuses a crop outside the resized picture', async () => {
      const { engine, image } = setup();
      const bad = {
        resize: { width: 100, height: 100 },
        crop: { x: 50, y: 0, width: 100, height: 100 },
      };
      await expect(engine.resizeCropImage(image, bad)).rejects.toThrow(EditError);
    });

    it('extractFrame saves one full-size frame as an image (V10)', async () => {
      const { engine, video, out } = setup();
      await engine.extractFrame(video, 2.5, out('frame.png'));
      const frame = await engine.probe(out('frame.png'));
      expect(frame).toMatchObject({
        kind: 'image',
        container: 'png',
        video: { width: 1920, height: 1080 },
      });
    });

    it('makeThumbnails writes one strip of thumbnails side by side', async () => {
      const { engine, video, out } = setup();
      await engine.makeThumbnails(video, out('thumbs.jpg'), { count: 5, height: 64, duration: 10 })
        .done;
      const strip = await engine.probe(out('thumbs.jpg'));
      expect(strip).toMatchObject({ kind: 'image', video: { height: 64 } });
      expect(strip.video!.width % 5).toBe(0);
      expect(strip.video!.width).toBeGreaterThan(5 * 100);
    });

    it('waveformPeaks returns the requested number of 0–1 peaks', async () => {
      const { engine, audio } = setup();
      const peaks = await engine.waveformPeaks(audio, 50);
      expect(peaks).toHaveLength(50);
      expect(peaks.every((p) => p >= 0 && p <= 1)).toBe(true);
      expect(Math.max(...peaks)).toBeGreaterThan(0.1);
    });

    it('waveformPeaks explains a missing file', async () => {
      const { engine, missing } = setup();
      await expect(engine.waveformPeaks(missing, 10)).rejects.toThrow(/could not be found/i);
    });

    describe('decodeAudio (A1) and encodeAudio (A16, A17)', () => {
      const tone = (seconds: number, rate = 44100, channels = 2) =>
        Array.from({ length: channels }, (_, ch) =>
          Float32Array.from(
            { length: seconds * rate },
            (_, i) => 0.5 * Math.sin((2 * Math.PI * (440 + 110 * ch) * i) / rate),
          ),
        );
      const settings = (change: Partial<AudioExportSettings>): AudioExportSettings => ({
        format: 'mp3',
        sampleRate: 44100,
        channels: 2,
        bitRate: 128,
        mode: 'cbr',
        bitDepth: 16,
        tags: {},
        ...change,
      });

      it('decodes a sound file into one array of samples per channel, at its own rate', async () => {
        const { engine, audio } = setup();
        const decoded = await engine.decodeAudio(audio);
        expect(decoded.sampleRate).toBe(44100);
        expect(decoded.channels).toHaveLength(2);
        expect(decoded.channels[0]!.length / 44100).toBeCloseTo(45, 0);
        expect(decoded.channels[1]!.length).toBe(decoded.channels[0]!.length);
        const loudest = decoded.channels[0]!.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        expect(loudest).toBeGreaterThan(0.1);
        expect(loudest).toBeLessThanOrEqual(1);
      });

      it('decodes at the project rate when asked, and the sound of a video file', async () => {
        const { engine, audio, video } = setup();
        const slow = await engine.decodeAudio(audio, 22050);
        expect(slow.sampleRate).toBe(22050);
        expect(slow.channels[0]!.length / 22050).toBeCloseTo(45, 0);
        const fromVideo = await engine.decodeAudio(video);
        expect(fromVideo.channels[0]!.length / fromVideo.sampleRate).toBeCloseTo(10, 0);
      });

      it('explains a file with no sound and a missing file', async () => {
        const { engine, image, missing } = setup();
        await expect(engine.decodeAudio(image)).rejects.toThrow(MediaError);
        await expect(engine.decodeAudio(image)).rejects.toThrow(/no sound/i);
        await expect(engine.decodeAudio(missing)).rejects.toThrow(/could not be found/i);
      });

      it('A16 exports a WAV at 48 kHz / 24-bit that probes with those values', async () => {
        const { engine, out } = setup();
        const job = engine.encodeAudio(
          { sampleRate: 44100, channels: tone(2) },
          out('export.wav'),
          settings({ format: 'wav', sampleRate: 48000, bitDepth: 24 }),
        );
        await job.done;
        const info = await engine.probe(out('export.wav'));
        expect(info).toMatchObject({
          kind: 'audio',
          container: 'wav',
          audio: { sampleRate: 48000, bitDepth: 24, channels: 2 },
        });
        expect(info.duration).toBeCloseTo(2, 1);
      });

      it('A17 exports a mono MP3 near its estimated size', async () => {
        const { engine, out } = setup();
        const chosen = settings({ channels: 1 });
        await engine.encodeAudio(
          { sampleRate: 44100, channels: tone(4, 44100, 1) },
          out('mono.mp3'),
          chosen,
        ).done;
        const info = await engine.probe(out('mono.mp3'));
        expect(info.audio).toMatchObject({ codec: 'mp3', channels: 1, sampleRate: 44100 });
        const ratio = info.sizeBytes / estimateAudioSize(chosen, 4).bytes;
        expect(ratio).toBeGreaterThan(0.75);
        expect(ratio).toBeLessThan(1.25);
      });

      it.each([
        ['mp3', 'mp3', 'mp3'],
        ['m4a', 'm4a', 'aac'],
        ['aac', 'aac', 'aac'],
        ['wav', 'wav', 'pcm_s16le'],
        ['flac', 'flac', 'flac'],
      ] as const)('A17 exports %s (container %s, codec %s)', async (format, container, codec) => {
        const { engine, out } = setup();
        await engine.encodeAudio(
          { sampleRate: 44100, channels: tone(1) },
          out(`each.${format}`),
          settings({ format }),
        ).done;
        expect(await engine.probe(out(`each.${format}`))).toMatchObject({
          kind: 'audio',
          container,
          audio: { codec },
        });
      });

      it('P1 for Audio mode: a 32-bit WAV gives back exactly the samples it was given', async () => {
        const { engine, out } = setup();
        const channels = [
          Float32Array.from({ length: 4410 }, (_, i) => Math.sin(i / 7) * 0.3712345),
          Float32Array.from({ length: 4410 }, (_, i) => Math.cos(i / 3) * 0.9876543),
        ];
        const file = out('exact.wav');
        await engine.encodeAudio(
          { sampleRate: 44100, channels },
          file,
          settings({ format: 'wav', bitDepth: 32, channels: 2 }),
        ).done;
        const back = await engine.decodeAudio(file);
        expect(back.sampleRate).toBe(44100);
        expect(back.channels).toEqual(channels);
      });

      it('P1 for Audio mode: writes into a folder that does not exist yet', async () => {
        const { engine, out } = setup();
        const file = out('Task 11p audio/track-1.wav');
        await engine.encodeAudio(
          { sampleRate: 44100, channels: tone(1, 44100, 1) },
          file,
          settings({ format: 'wav', bitDepth: 32, channels: 1 }),
        ).done;
        expect((await engine.probe(file)).audio).toMatchObject({ codec: 'pcm_f32le' });
      });

      it('refuses settings a format cannot have', async () => {
        const { engine, out } = setup();
        const job = engine.encodeAudio(
          { sampleRate: 44100, channels: tone(1) },
          out('bad.mp3'),
          settings({ sampleRate: 96000 }),
        );
        await expect(job.done).rejects.toThrow(EditError);
      });

      it('a cancelled audio export leaves no file', async () => {
        const { engine, out } = setup();
        const job = engine.encodeAudio(
          { sampleRate: 44100, channels: tone(2) },
          out('cancelled.flac'),
          settings({ format: 'flac' }),
        );
        job.cancel();
        await expect(job.done).rejects.toThrow(JobCancelledError);
        await expect(engine.probe(out('cancelled.flac'))).rejects.toThrow(/could not be found/i);
      });
    });

    describe('renderVideo (V16)', () => {
      const projectWith = (asset: MediaAsset, clips: VideoClip[]): Project => {
        const p = createProject({ name: 'Contract' });
        return {
          ...p,
          settings: { ...p.settings, width: 1280, height: 720 },
          media: [asset],
          timeline: { ...p.timeline, main: clips },
        };
      };
      const twoTrimmedClips = async (engine: MediaEngine, video: string) => {
        const asset = assetFromProbe(video, await engine.probe(video), { id: 'v' });
        return projectWith(asset, [
          trimVideo(createVideoClip(asset, { id: 'a' }), { in: 0, out: 2 }, asset),
          trimVideo(createVideoClip(asset, { id: 'b' }), { in: 5, out: 7.5 }, asset),
        ]);
      };

      it('exports the timeline at the project size and length, with sound', async () => {
        const { engine, video, out } = setup();
        await engine.renderVideo(await twoTrimmedClips(engine, video), out('render.mp4'), {
          projectDir: '/',
        }).done;
        const info = await engine.probe(out('render.mp4'));
        expect(info).toMatchObject({
          kind: 'video',
          container: 'mp4',
          video: { width: 1280, height: 720 },
        });
        expect(info.duration).toBeCloseTo(4.5, 1);
        expect(info.audio).toBeDefined();
      });

      it.each([
        [{ container: 'wmv', compression: 'lossy' }, 'wmv', 'wmv2', 'wmav2'],
        [{ container: 'avi', compression: 'lossless' }, 'avi', 'ffv1', 'pcm_s16le'],
        [
          { container: 'mpg', compression: 'lossy', width: 720, height: 576, fps: 25 },
          'mpg',
          'mpeg2video',
          'ac3',
        ],
      ] as const)(
        'exports in the chosen format: %o → %s with %s and %s (V16, V17)',
        async (change, container, videoCodec, audioCodec) => {
          const { engine, video, out } = setup();
          const p = await twoTrimmedClips(engine, video);
          const format = { ...defaultExport(p.settings), width: 640, height: 360, ...change };
          const file = out(`format.${container}`);
          await engine.renderVideo(p, file, { projectDir: '/', format }).done;
          const info = await engine.probe(file);
          expect(info).toMatchObject({
            kind: 'video',
            container,
            video: { codec: videoCodec, width: format.width, height: format.height },
            audio: { codec: audioCodec },
          });
          expect(info.duration).toBeCloseTo(4.5, 0);
        },
      );

      it('has no audio stream when every clip is muted', async () => {
        const { engine, video, out } = setup();
        const p = await twoTrimmedClips(engine, video);
        const muted = {
          ...p,
          timeline: { ...p.timeline, main: p.timeline.main.map((c) => ({ ...c, muted: true })) },
        };
        await engine.renderVideo(muted, out('silent.mp4'), { projectDir: '/' }).done;
        expect((await engine.probe(out('silent.mp4'))).audio).toBeUndefined();
      });

      it('renderFrame saves one frame of the project as a picture at the project size (V10)', async () => {
        const { engine, video, out } = setup();
        const p = await twoTrimmedClips(engine, video);
        expect(await engine.renderFrame(p, 3, out('snap.tiff'), { projectDir: '/' })).toBe(
          out('snap.tiff'),
        );
        // The name is taken now: the next snapshot gets a numbered name, the first is kept.
        expect(await engine.renderFrame(p, 4, out('snap.tiff'), { projectDir: '/' })).toBe(
          out('snap2.tiff'),
        );
        expect(await engine.probe(out('snap.tiff'))).toMatchObject({
          kind: 'image',
          video: { width: 1280, height: 720 },
        });
      });

      it('renderFrame explains a time outside the video', async () => {
        const { engine, video, out } = setup();
        const p = await twoTrimmedClips(engine, video);
        await expect(
          engine.renderFrame(p, 60, out('late.png'), { projectDir: '/' }),
        ).rejects.toThrow(EditError);
      });

      it('refuses an empty project with an explanation', async () => {
        const { engine, out } = setup();
        const job = engine.renderVideo(createProject({ name: 'Empty' }), out('empty.mp4'), {
          projectDir: '/',
        });
        await expect(job.done).rejects.toThrow(EditError);
        await expect(job.done).rejects.toThrow(/add a clip/i);
      });

      it('explains a missing media file', async () => {
        const { engine, video, missing, out } = setup();
        const p = await twoTrimmedClips(engine, video);
        const gone = { ...p, media: p.media.map((m) => ({ ...m, path: missing })) };
        await expect(
          engine.renderVideo(gone, out('gone.mp4'), { projectDir: '/' }).done,
        ).rejects.toThrow(/could not be found/i);
      });
    });
  });
}

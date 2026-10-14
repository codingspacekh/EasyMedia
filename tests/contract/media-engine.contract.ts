// Shared behaviour every MediaEngine must have (MILESTONES M2: contract tests).
// Run against the real FFmpeg engine (integration) and the mock (unit), so the mock
// cannot drift from reality.
import { describe, expect, it } from 'vitest';
import { JobCancelledError, MediaError } from '../../src/core/model/errors.ts';
import type { JobEvent, MediaEngine } from '../../src/core/ports.ts';

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
  });
}

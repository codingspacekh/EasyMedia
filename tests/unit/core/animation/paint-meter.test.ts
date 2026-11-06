// M17 step 2, N1 on a real laptop: the frames the stage really showed while it played, counted at
// each screen refresh as the end-to-end check does, so the teacher's report has a number.
import { describe, expect, it } from 'vitest';
import {
  createPaintMeter,
  isPlaybackSample,
  summarisePlayback,
} from '../../../../src/core/animation/paint-meter.ts';

/** Feeds a meter screen refreshes every `refreshMs` for `ms`, the stage showing `frameAt(t)`. */
function play(fps: number, ms: number, refreshMs: number, frameAt: (t: number) => number) {
  const meter = createPaintMeter(fps);
  for (let t = 0; t <= ms; t += refreshMs) meter.refresh(1000 + t, frameAt(t));
  return meter.finish();
}

describe('N1 the paint meter', () => {
  it('a stage showing every frame of a 30 fps animation on a 60 Hz screen plays at 30 fps', () => {
    const sample = play(30, 3200, 1000 / 60, (t) => Math.floor((t * 30) / 1000));
    expect(sample).toMatchObject({ targetFps: 30, seconds: 3 });
    expect(sample!.fps).toBeCloseTo(30, 0);
    expect(sample!.longestGapMs).toBe(17);
  });

  it('a stage that redraws every 50 ms shows 20 of 30 fps, and its longest gap is 50 ms', () => {
    const sample = play(30, 3200, 50, (t) => Math.floor((t * 30) / 1000));
    expect(sample!.fps).toBeCloseTo(20, 0);
    expect(sample!.longestGapMs).toBe(50);
  });

  it('skips the first 200 ms (the player starts on its next tick) and counts a stall', () => {
    const meter = createPaintMeter(24);
    meter.refresh(0, 0);
    meter.refresh(150, 0); // not counted: the first 200 ms
    meter.refresh(300, 7);
    meter.refresh(1000, 24); // a 700 ms stall
    meter.refresh(1400, 33);
    expect(meter.finish()).toEqual({ seconds: 1.2, fps: 2.5, targetFps: 24, longestGapMs: 700 });
  });

  it('counts the frames shown, not the different ones: a looping animation counts every lap', () => {
    // 3 frames looping at 30 fps for 2 s: 60 frames shown, only 3 different ones.
    const sample = play(30, 2200, 1000 / 60, (t) => Math.floor((t * 30) / 1000) % 3);
    expect(sample!.fps).toBeCloseTo(30, 0);
  });

  it('a play under a second is not a measurement', () => {
    expect(play(30, 900, 1000 / 60, (t) => Math.floor((t * 30) / 1000))).toBeNull();
    expect(createPaintMeter(30).finish()).toBeNull();
  });
});

describe('N1 the report of every play', () => {
  const sample = (fps: number, longestGapMs: number, seconds = 10) => ({
    seconds,
    fps,
    targetFps: 30,
    longestGapMs,
  });

  it('nothing played: nothing to report', () => {
    expect(summarisePlayback([])).toBeNull();
  });

  it('reports the slowest play, the longest gap of all, and whether every play met 95 %', () => {
    expect(summarisePlayback([sample(30, 18), sample(29.1, 40, 5), sample(29.8, 120)])).toEqual({
      plays: 3,
      seconds: 25,
      fps: 29.1,
      targetFps: 30,
      longestGapMs: 120,
      meetsBudget: true,
    });
    expect(summarisePlayback([sample(30, 18), sample(28.4, 40)])).toMatchObject({
      fps: 28.4,
      meetsBudget: false,
    });
  });

  it('only takes a sample from the page that is all finite numbers, with a frame rate', () => {
    expect(isPlaybackSample(sample(30, 18))).toBe(true);
    expect(isPlaybackSample({ ...sample(30, 18), fps: Number.NaN })).toBe(false);
    expect(isPlaybackSample({ ...sample(30, 18), targetFps: 0 })).toBe(false);
    expect(isPlaybackSample({ seconds: 1 })).toBe(false);
    expect(isPlaybackSample(null)).toBe(false);
  });
});

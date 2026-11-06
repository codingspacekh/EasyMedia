// M17 step 2, N1 on a real laptop: while the stage plays, the frame on it is read at each screen
// refresh; each play's measurement goes to the performance report when it stops.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaybackSample } from '../../../src/core/animation/paint-meter.ts';
import { watchPlayback } from '../../../src/app/animation/paint-watch.ts';
import { testApp } from '../../helpers/test-app.ts';

const REFRESH_MS = 1000 / 60;

function setup() {
  const anim = testApp().app.animation;
  const samples: PlaybackSample[] = [];
  let queued: ((now: number) => void)[] = [];
  const stop = watchPlayback(
    anim.store,
    (s) => samples.push(s),
    (cb) => queued.push(cb),
  );
  /** The screen refreshes for `ms` while the player's clock runs. */
  const refreshFor = (ms: number) => {
    for (let t = 0; t < ms; t += REFRESH_MS) {
      vi.advanceTimersByTime(REFRESH_MS);
      const now = Date.now();
      const run = queued;
      queued = [];
      run.forEach((cb) => cb(now));
    }
  };
  return { anim, samples, stop, refreshFor, queued: () => queued.length };
}

describe('N1 measuring the stage while it plays', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a 24 fps animation played for 3 s and paused: one measurement, every frame shown', () => {
    const s = setup();
    s.anim.play();
    s.refreshFor(3000);
    s.anim.pause();
    expect(s.samples).toHaveLength(1);
    expect(s.samples[0]).toMatchObject({ targetFps: 24, longestGapMs: 17 });
    expect(s.samples[0]!.fps).toBeCloseTo(24, 0);
    expect(s.samples[0]!.seconds).toBeCloseTo(2.8, 1);
  });

  it('a play that reaches the end is measured too; each play is its own measurement', () => {
    const s = setup();
    s.anim.play();
    s.refreshFor(5500); // 5 s: the player stops at the end by itself
    expect(s.anim.store.get().playing).toBe(false);
    s.anim.play();
    s.refreshFor(2000);
    s.anim.pause();
    expect(s.samples).toHaveLength(2);
  });

  it('no refresh is asked for when not playing; a play under a second is not reported', () => {
    const s = setup();
    expect(s.queued()).toBe(0);
    s.anim.play();
    s.refreshFor(500);
    s.anim.pause();
    s.refreshFor(100);
    expect(s.queued()).toBe(0);
    expect(s.samples).toEqual([]);
  });

  it('stops watching when asked, during a play too', () => {
    const s = setup();
    s.anim.play();
    s.refreshFor(500);
    s.stop();
    s.refreshFor(100);
    expect(s.queued()).toBe(0);
    s.anim.pause();
    s.anim.play();
    s.refreshFor(2000);
    s.anim.pause();
    expect(s.samples).toEqual([]);
  });
});

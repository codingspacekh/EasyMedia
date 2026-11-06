// M17 step 2, N1 on a real laptop: how many of the animation's frames the stage really showed
// while it played. The frame on the stage is read at each screen refresh, as the end-to-end check
// does, so a redraw slower than a frame shows up as frames never seen. Only the performance report
// (ONEEDITOR_PERF_REPORT) uses it.

/** One play, from Play to Pause or the end. */
export interface PlaybackSample {
  /** How long was measured, after the first SETTLE_MS. */
  seconds: number;
  /** The frames the stage showed per second. */
  fps: number;
  /** The animation's own frame rate. */
  targetFps: number;
  /** The longest time between two screen refreshes, a stall if well over a frame. */
  longestGapMs: number;
}

/** Every play the report saw. */
export interface PlaybackSummary {
  plays: number;
  seconds: number;
  /** The slowest play's frame rate. */
  fps: number;
  targetFps: number;
  longestGapMs: number;
  /** N1: every play showed at least 95 % of its frames (a frame lost to the timer's edges). */
  meetsBudget: boolean;
}

/** The player starts on its next tick: the first refreshes are not counted. */
const SETTLE_MS = 200;
/** A shorter play is not a measurement. */
const MIN_MS = 1000;
const BUDGET = 0.95;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function createPaintMeter(targetFps: number) {
  let start: number | null = null;
  let last = 0;
  let lastFrame: number | null = null;
  let shown = 0;
  let longest = 0;
  return {
    /** A screen refresh at `now` (ms) with `frame` on the stage. */
    refresh(now: number, frame: number): void {
      if (start === null) start = now;
      else if (now - start > SETTLE_MS) {
        longest = Math.max(longest, now - last);
        if (frame !== lastFrame) shown++;
      }
      last = now;
      lastFrame = frame;
    },
    /** The play's measurement, or null when it was too short to tell. */
    finish(): PlaybackSample | null {
      const ms = start === null ? 0 : last - start - SETTLE_MS;
      if (ms < MIN_MS) return null;
      return {
        seconds: round1(ms / 1000),
        fps: round1((shown * 1000) / ms),
        targetFps,
        longestGapMs: Math.round(longest),
      };
    },
  };
}

export function summarisePlayback(samples: readonly PlaybackSample[]): PlaybackSummary | null {
  if (samples.length === 0) return null;
  const slowest = samples.reduce((a, b) => (b.fps / b.targetFps < a.fps / a.targetFps ? b : a));
  return {
    plays: samples.length,
    seconds: round1(samples.reduce((sum, s) => sum + s.seconds, 0)),
    fps: slowest.fps,
    targetFps: slowest.targetFps,
    longestGapMs: Math.max(...samples.map((s) => s.longestGapMs)),
    meetsBudget: samples.every((s) => s.fps >= BUDGET * s.targetFps),
  };
}

/** What the page sends is checked: only finite numbers, with a frame rate to compare with. */
export function isPlaybackSample(value: unknown): value is PlaybackSample {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  const finite = (k: string) => typeof s[k] === 'number' && Number.isFinite(s[k]);
  return (
    ['seconds', 'fps', 'targetFps', 'longestGapMs'].every(finite) && (s.targetFps as number) > 0
  );
}

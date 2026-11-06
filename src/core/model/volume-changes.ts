// V13 volume changes inside one sound in Video mode, e.g. "lower the music to 30 % between 10 s
// and 15 s". The times are timeline times, as a task gives them, so they stay where they were
// typed when the sound is moved or split. The preview (volumeAt) and the export
// (volumeExpression) follow the same points, so they sound the same.
import { EditError } from './errors.ts';
import type { Seconds } from './time.ts';
import type { VolumeChange } from './types.ts';

/** How long a change takes to glide to its volume and back when no time is typed: no click. */
export const VOLUME_RAMP = 0.25;
export const MAX_RAMP = 5;

/** A corner of the volume line: the volume (0.3 = 30 %) at timeline time `t`. */
export interface VolumePoint {
  t: Seconds;
  level: number;
}

const rampOf = (c: VolumeChange): Seconds => c.ramp ?? VOLUME_RAMP;
const byStart = (changes: readonly VolumeChange[]) =>
  [...changes].sort((a, b) => a.from - b.from || a.to - b.to);

/**
 * The volume line, as corners joined by straight lines; `base` (the sound's own volume) before
 * the first and after the last. Each change glides from `base` over its ramp before `from` and
 * back over its ramp after `to`. Two changes closer than their two ramps glide straight from one
 * volume to the other; when they are closer than their average ramp (or touch), that glide is
 * as long as the average ramp, centred between them, so it never clicks.
 */
export function volumePoints(base: number, changes: readonly VolumeChange[]): VolumePoint[] {
  const spans = byStart(changes);
  const points: VolumePoint[] = [];
  spans.forEach((c, i) => {
    const before = spans[i - 1];
    const after = spans[i + 1];
    const r = rampOf(c);
    let from = c.from;
    let to = c.to;
    if (!before || c.from - before.to >= rampOf(before) + r)
      points.push({ t: c.from - r, level: base });
    else {
      const width = (rampOf(before) + r) / 2;
      const gap = c.from - before.to;
      if (gap < width) from = (before.to + c.from) / 2 + width / 2;
    }
    if (after && after.from - c.to < r + rampOf(after)) {
      const width = (r + rampOf(after)) / 2;
      const gap = after.from - c.to;
      if (gap < width) to = (c.to + after.from) / 2 - width / 2;
    }
    points.push({ t: from, level: c.volume }, { t: to, level: c.volume });
    if (!after || after.from - c.to >= r + rampOf(after)) points.push({ t: c.to + r, level: base });
  });
  // Very short changes next to each other: the corners never go back in time.
  for (let i = 1; i < points.length; i++)
    points[i] = { ...points[i]!, t: Math.max(points[i]!.t, points[i - 1]!.t) };
  return points;
}

/** The volume at timeline time `t` (0.3 = 30 %), as the export plays it. */
export function volumeAt(base: number, changes: readonly VolumeChange[], t: Seconds): number {
  const points = volumePoints(base, changes);
  let i = -1;
  while (i + 1 < points.length && points[i + 1]!.t <= t) i++;
  if (i < 0) return base;
  const a = points[i]!;
  const b = points[i + 1];
  if (!b) return a.level;
  return a.level + ((b.level - a.level) * (t - a.t)) / (b.t - a.t);
}

/** A number for an FFmpeg expression (no "1e-7"; the tiny errors of sums dropped). */
const num = (n: number): string => String(Number(n.toFixed(12)));

/**
 * The same line as an FFmpeg expression of the timeline time `t`, for
 * `volume=eval=frame:volume='…'` after the sound has been moved to its start.
 */
export function volumeExpression(base: number, changes: readonly VolumeChange[]): string {
  const points = volumePoints(base, changes);
  if (!points.length) return num(base);
  let expression = num(points.at(-1)!.level);
  for (let i = points.length - 2; i >= 0; i--) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (b.t <= a.t) continue; // a sudden change (no glide): nothing in between
    const line = `${num(a.level)}+(${num(b.level - a.level)})*(t-${num(a.t)})/${num(b.t - a.t)}`;
    expression = `if(lt(t,${num(b.t)}),${line},${expression})`;
  }
  return `if(lt(t,${num(points[0]!.t)}),${num(base)},${expression})`;
}

/** Throws an EditError a student understands when the changes cannot be used. */
export function validateVolumeChanges(changes: readonly VolumeChange[]): void {
  for (const c of changes) {
    if (![c.from, c.to, c.volume, rampOf(c)].every(Number.isFinite))
      throw new EditError('Type a number for each time and volume.');
    if (c.from < 0) throw new EditError('A volume change cannot start before 0 s.');
    if (!(c.to > c.from))
      throw new EditError('A volume change ends after it starts: make "To" later than "From".');
    if (!(c.volume >= 0 && c.volume <= 2))
      throw new EditError('Volume must be between 0 % and 200 %.');
    if (!(rampOf(c) >= 0 && rampOf(c) <= MAX_RAMP))
      throw new EditError(`The glide time must be between 0 and ${MAX_RAMP} s.`);
  }
  const spans = byStart(changes);
  for (let i = 1; i < spans.length; i++) {
    const [a, b] = [spans[i - 1]!, spans[i]!];
    if (b.from < a.to - 1e-9)
      throw new EditError(
        `The volume changes ${a.from.toFixed(2)} – ${a.to.toFixed(2)} s and ${b.from.toFixed(2)} – ${b.to.toFixed(2)} s overlap. Change the times of one of them.`,
      );
  }
}

/** The changes heard between `start` and `end` (with their glides), e.g. on each part of a split. */
export function volumeChangesWithin(
  changes: readonly VolumeChange[],
  start: Seconds,
  end: Seconds,
): VolumeChange[] {
  return changes.filter((c) => c.from - rampOf(c) < end && c.to + rampOf(c) > start);
}

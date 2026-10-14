// FFmpeg filter building blocks for export (V1, V14). Pure strings, no I/O.
import type { ProjectSettings } from '../model/types.ts';

/** Number for an FFmpeg argument: at most 6 decimals, no trailing zeros. */
export function num(n: number): string {
  return String(Number(n.toFixed(6)));
}

/** Scales a clip into the project frame using the project's fit mode, then fixes fps and pixel format. */
export function fitFilter(s: ProjectSettings): string {
  const { width: w, height: h } = s;
  const fit = {
    letterbox: `scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${s.background}`,
    crop: `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`,
    stretch: `scale=${w}:${h}`,
  }[s.fit ?? 'letterbox'];
  return `${fit},setsar=1,fps=${s.fps},format=yuv420p`;
}

/** atempo only accepts 0.5–2 per step, so larger changes are chained (4× = 2 × 2). */
export function atempoChain(speed: number): number[] {
  const steps: number[] = [];
  let rest = speed;
  while (rest > 2 + 1e-9) {
    steps.push(2);
    rest /= 2;
  }
  while (rest < 0.5 - 1e-9) {
    steps.push(0.5);
    rest /= 0.5;
  }
  if (Math.abs(rest - 1) > 1e-9) steps.push(rest);
  return steps;
}

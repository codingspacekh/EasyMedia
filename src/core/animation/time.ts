// AN8: frames and seconds. The timeline counts frames (the syllabus's word); the workbook's
// tasks give times in seconds, so both are shown and either can be typed.
import { EditError } from '../model/errors.ts';
import { MAX_FPS, MIN_FPS } from './rules.ts';
import type { AnimObject, AnimationDoc } from './types.ts';

/** The nearest whole frame to a time. */
export const framesFor = (seconds: number, fps: number): number => Math.round(seconds * fps);

export const secondsFor = (frames: number, fps: number): number => frames / fps;

/** `0:03.00 · frame 72`: minutes, seconds and hundredths, then the frame. */
export function timeLabel(frame: number, fps: number): string {
  const total = secondsFor(frame, fps);
  const minutes = Math.floor(total / 60);
  const seconds = (total - minutes * 60).toFixed(2).padStart(5, '0');
  return `${minutes}:${seconds} · frame ${frame}`;
}

/** A typed frame ("72"), time in seconds ("3 s", "1.5s") or clock time ("0:03.00"); null if not one. */
export function parseFrame(text: string, fps: number): number | null {
  const t = text.trim().toLowerCase();
  let m = /^(\d+)$/.exec(t);
  if (m) return Number(m[1]);
  m = /^(\d+(?:\.\d+)?)\s*s$/.exec(t);
  if (m) return framesFor(Number(m[1]), fps);
  m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (m) return framesFor(Number(m[1]) * 60 + Number(m[2]), fps);
  return null;
}

const retimed = (o: AnimObject, scale: number): AnimObject => ({
  ...o,
  ...(o.tracks
    ? {
        tracks: o.tracks.map((t) => ({
          ...t,
          keyframes: t.keyframes.map((k) => ({ ...k, frame: Math.round(k.frame * scale) })),
        })),
      }
    : {}),
  ...(o.kind === 'group' ? { children: o.children.map((c) => retimed(c, scale)) } : {}),
});

/**
 * Changes the frame rate. `'times'` keeps every keyframe (and the length) at the same time in
 * seconds, rounded to whole frames; `'frames'` keeps the frame numbers, so the motion speeds up
 * or slows down.
 */
export function changeFps(doc: AnimationDoc, fps: number, keep: 'times' | 'frames'): AnimationDoc {
  if (!Number.isInteger(fps) || fps < MIN_FPS || fps > MAX_FPS)
    throw new EditError(`The frame rate must be between ${MIN_FPS} and ${MAX_FPS} fps.`);
  if (keep === 'frames') return { ...doc, stage: { ...doc.stage, fps } };
  const scale = fps / doc.stage.fps;
  return {
    ...doc,
    stage: { ...doc.stage, fps, length: Math.max(1, Math.round(doc.stage.length * scale)) },
    layers: doc.layers.map((l) => ({ ...l, objects: l.objects.map((o) => retimed(o, scale)) })),
  };
}

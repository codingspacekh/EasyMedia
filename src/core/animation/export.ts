// AN15: exporting an animation. Every frame is drawn by draw.ts (the same drawing as the preview)
// and made into the file the student chose: MP4 and animated GIF through FFmpeg, a PNG sequence
// (one picture per frame) or the frame at the playhead as one PNG. The pros and cons of each
// format and the estimated size are shown before exporting (T7).
import type { AnimationDoc } from './types.ts';

export type AnimationFormat = 'mp4' | 'gif' | 'png-sequence' | 'png';

export interface AnimationFormatInfo {
  id: AnimationFormat;
  label: string;
  /** What the file is for, in a few words. */
  use: string;
  pros: string[];
  cons: string[];
}

export const ANIMATION_FORMATS: readonly AnimationFormatInfo[] = [
  {
    id: 'mp4',
    label: 'MP4 video',
    use: 'Computers, phones, web video, Video mode',
    pros: [
      'Small files, even for long animations (lossy compression, H.264)',
      'Plays almost everywhere and can be edited in Video mode',
    ],
    cons: ['Lossy: fine lines and sharp edges can blur a little', 'Does not loop by itself'],
  },
  {
    id: 'gif',
    label: 'Animated GIF',
    use: 'Web pages, emails, messages',
    pros: ['Loops by itself and plays in any web browser or email', 'Sharp edges stay sharp'],
    cons: [
      'At most 256 colours: gradients become bands',
      'Much bigger than MP4 for the same animation; no sound',
    ],
  },
  {
    id: 'png-sequence',
    label: 'PNG sequence',
    use: 'Other animation or video software',
    pros: ['Lossless: every frame exactly as drawn', 'Any frame can be opened as a picture'],
    cons: ['One file per frame: many files and much space', 'Needs other software to play it'],
  },
  {
    id: 'png',
    label: 'PNG picture of this frame',
    use: 'A still: a poster, a thumbnail, a printout',
    pros: ['Lossless picture of the frame at the playhead'],
    cons: ['A single frame: nothing moves'],
  },
];

/** The frames exported: 0 to length − 1, so a 3 s animation at 24 fps is 72 frames, 3.00 s. */
export function exportedFrames(doc: AnimationDoc): {
  count: number;
  first: number;
  last: number;
  seconds: number;
} {
  const count = doc.stage.length;
  return { count, first: 0, last: count - 1, seconds: count / doc.stage.fps };
}

/** H.264 in yuv420p needs even sizes: an odd side is padded by one pixel. */
export function evenSize(width: number, height: number) {
  const w = width + (width % 2);
  const h = height + (height % 2);
  return { width: w, height: h, padded: w !== width || h !== height };
}

/** Rough bytes per pixel of each frame for flat-coloured vector drawings (measured, rounded up). */
const PNG_BYTES_PER_PIXEL = 0.15;
const GIF_BYTES_PER_PIXEL = 0.12;
const MP4_BITS_PER_PIXEL = 0.05;

/** T7: the estimated file size in bytes (all frames for a sequence). */
export function estimateAnimationSize(doc: AnimationDoc, format: AnimationFormat): number {
  const pixels = doc.stage.width * doc.stage.height;
  const { count } = exportedFrames(doc);
  switch (format) {
    case 'png':
      return pixels * PNG_BYTES_PER_PIXEL;
    case 'png-sequence':
      return pixels * PNG_BYTES_PER_PIXEL * count;
    case 'gif':
      return pixels * GIF_BYTES_PER_PIXEL * count;
    case 'mp4':
      return (pixels * MP4_BITS_PER_PIXEL * count) / 8;
  }
}

/** The PNG sequence's files: `Task1.png` → `Task1_0001.png`, `Task1_0002.png`… */
export function sequenceName(output: string, index: number): string {
  return `${output.replace(/\.png$/i, '')}_${String(index + 1).padStart(4, '0')}.png`;
}

/** The temporary frames FFmpeg reads: frame-00000.png onwards, in a folder of their own. */
export const FRAME_PATTERN = 'frame-%05d.png';
export const frameFile = (index: number): string => `frame-${String(index).padStart(5, '0')}.png`;

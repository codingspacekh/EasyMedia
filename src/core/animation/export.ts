// AN15: exporting an animation. Every frame is drawn by draw.ts (the same drawing as the preview)
// and made into the file the student chose: MP4, AVI, MOV and animated GIF through FFmpeg, a PNG
// sequence (one picture per frame) or the frame at the playhead as one PNG or as an SVG of vector
// shapes (svg-export.ts); or the drawing itself goes into a web page that plays it (html.ts). A
// part of it (a range of frames) or another width can be exported; the videos and the web page
// carry its sounds (AN28, sound.ts). The pros and cons of each format and the estimated size are
// shown before exporting (T7).
import { EditError } from '../model/errors.ts';
import { soundFileBytes, soundsHeard } from './sound.ts';
import type { AnimationDoc, Stage } from './types.ts';

export type AnimationFormat =
  'mp4' | 'avi' | 'mov' | 'gif' | 'html' | 'png-sequence' | 'png' | 'svg';

/** AN15: a part of the animation, at another size. Absent: all of it, at the stage's size. */
export interface AnimationExportOptions {
  /** The width in px; the height keeps the stage's proportions. */
  width?: number;
  /** The first and last frames exported (both are). */
  from?: number;
  to?: number;
}

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
    id: 'avi',
    label: 'AVI video',
    use: 'Older Windows computers and software that asks for an AVI',
    pros: [
      'Plays on old Windows computers and in older video software (MPEG-4 Part 2 video, MP3 sound)',
      'Quick to make and to open',
    ],
    cons: [
      'About twice as big as MP4 for the same picture (an older codec)',
      'Does not loop by itself; phones and web pages may not play it',
    ],
  },
  {
    id: 'mov',
    label: 'MOV video',
    use: 'Apple computers, iMovie, Final Cut, QuickTime',
    pros: [
      'The same H.264 picture and AAC sound as MP4, as small',
      'Apple’s own QuickTime type: opens in iMovie and Final Cut',
    ],
    cons: [
      'Lossy: fine lines and sharp edges can blur a little',
      'Some Windows players need a codec',
    ],
  },
  {
    id: 'gif',
    label: 'Animated GIF',
    use: 'Web pages, emails, messages',
    pros: [
      'Loops by itself (or plays once and stops) in any web browser or email',
      'Sharp edges stay sharp',
    ],
    cons: [
      'At most 256 colours: gradients become bands',
      'Much bigger than MP4 for the same animation; no sound',
    ],
  },
  {
    id: 'html',
    label: 'HTML web animation',
    use: 'A web page, a school website, a presentation',
    pros: [
      'One file that plays in any web browser, without the internet, looping or once',
      'Sharp at any size: the shapes are drawn, not stored as pictures',
      'Can have Pause and Continue buttons',
    ],
    cons: [
      'Needs a web browser: it cannot be put in a video',
      'A browser plays sound only after a click: the page asks for one',
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
  {
    id: 'svg',
    label: 'SVG picture of this frame',
    use: 'A vector picture: a logo, an icon, a printout, other drawing software',
    pros: [
      'Vector: sharp at any size, as the shapes are stored, not pixels',
      'Each shape can be edited in other drawing software; small for flat shapes',
    ],
    cons: [
      'A single frame: nothing moves',
      'Pictures and the fonts of its words are put inside: that makes it bigger',
    ],
  },
];

/** AN15: the video formats (FFmpeg): even sides, sound (AN28), no transparency. */
export const isVideoFormat = (f: AnimationFormat): boolean =>
  f === 'mp4' || f === 'avi' || f === 'mov';

/** AN15: every format but the SVG (vector: it has no pixels) can be exported at another width. */
export const hasSize = (f: AnimationFormat): boolean => f !== 'svg';

/** AN15: the formats of moving pictures can be a part (a range of frames). */
export const hasRange = (f: AnimationFormat): boolean => f !== 'png' && f !== 'svg';

/** AN28: the formats that carry sound: the videos and the web page. */
export const carriesSound = (f: AnimationFormat): boolean => isVideoFormat(f) || f === 'html';

/**
 * The frames exported: 0 to length − 1 (a 3 s animation at 24 fps is 72 frames, 3.00 s), or the
 * range from–to, both exported.
 */
export function exportedFrames(
  doc: AnimationDoc,
  { from, to }: Pick<AnimationExportOptions, 'from' | 'to'> = {},
): { count: number; first: number; last: number; seconds: number } {
  const end = doc.stage.length - 1;
  const first = from ?? 0;
  const last = to ?? end;
  if (![first, last].every(Number.isInteger) || first < 0 || last > end)
    throw new EditError(`Type frames from 0 to ${end}.`);
  if (first > last) throw new EditError('The first frame must come before the last one.');
  const count = last - first + 1;
  return { count, first, last, seconds: count / doc.stage.fps };
}

/** H.264 in yuv420p needs even sizes: an odd side is padded by one pixel. */
export function evenSize(width: number, height: number) {
  const w = width + (width % 2);
  const h = height + (height % 2);
  return { width: w, height: h, padded: w !== width || h !== height };
}

export const MIN_EXPORT_WIDTH = 16;
export const MAX_EXPORT_WIDTH = 3840;

/**
 * AN15: the size of the file made: the stage's, or `width` with the height in proportion
 * (1024 × 768 at 600 px wide is 600 × 450). A video needs even sides: an odd width gets one
 * pixel more and the height is rounded to even (`padded` when a pixel was added).
 */
export function exportSize(
  stage: Pick<Stage, 'width' | 'height'>,
  format: AnimationFormat,
  width?: number,
): { width: number; height: number; padded: boolean } {
  if (width === undefined || width === stage.width) {
    const plain = { width: stage.width, height: stage.height, padded: false };
    return isVideoFormat(format) ? evenSize(stage.width, stage.height) : plain;
  }
  if (!Number.isInteger(width) || width < MIN_EXPORT_WIDTH || width > MAX_EXPORT_WIDTH)
    throw new EditError(`Type a width between ${MIN_EXPORT_WIDTH} and ${MAX_EXPORT_WIDTH} pixels.`);
  const proportion = stage.height / stage.width;
  if (!isVideoFormat(format))
    return { width, height: Math.max(1, Math.round(width * proportion)), padded: false };
  const w = width + (width % 2);
  return {
    width: w,
    height: Math.max(2, 2 * Math.round((w * proportion) / 2)),
    padded: w !== width,
  };
}

/** Rough bytes per pixel of each frame for flat-coloured vector drawings (measured, rounded up). */
const PNG_BYTES_PER_PIXEL = 0.15;
const GIF_BYTES_PER_PIXEL = 0.12;
const MP4_BITS_PER_PIXEL = 0.05;
/** MPEG-4 Part 2 needs about twice the bits of H.264 for the same picture (as Video mode, V17). */
const AVI_BITS_PER_PIXEL = 0.1;
/** AN28: the sound in a video: AAC at 160 kbit/s (MP4, MOV), MP3 at 192 kbit/s (AVI). */
const AAC_BYTES_PER_SECOND = 20_000;
const MP3_BYTES_PER_SECOND = 24_000;
/** An SVG: a little per shape, and each picture inside as text, as in the web page. */
const SVG_BYTES = 1_000;
const SVG_BYTES_PER_OBJECT = 250;
/** A web page: the player and the animation's data, then each picture (a JPG, inside as text). */
const HTML_PAGE_BYTES = 40_000;
const HTML_PICTURE_BYTES_PER_PIXEL = 0.5;
/** A file inside a web page is written as text (base64): a third bigger. */
const AS_TEXT = 4 / 3;

/** T7: the estimated file size in bytes (all frames for a sequence), with its sound (AN28). */
export function estimateAnimationSize(
  doc: AnimationDoc,
  format: AnimationFormat,
  options: AnimationExportOptions = {},
): number {
  const size = exportSize(doc.stage, format, options.width);
  const pixels = size.width * size.height;
  const { count, seconds } = exportedFrames(doc, options);
  const sound = soundsHeard(doc).length > 0;
  switch (format) {
    case 'png':
      return pixels * PNG_BYTES_PER_PIXEL;
    case 'png-sequence':
      return pixels * PNG_BYTES_PER_PIXEL * count;
    case 'gif':
      return pixels * GIF_BYTES_PER_PIXEL * count;
    case 'mp4':
    case 'mov':
      return (
        (pixels * MP4_BITS_PER_PIXEL * count) / 8 + (sound ? AAC_BYTES_PER_SECOND * seconds : 0)
      );
    case 'avi':
      return (
        (pixels * AVI_BITS_PER_PIXEL * count) / 8 + (sound ? MP3_BYTES_PER_SECOND * seconds : 0)
      );
    case 'html':
      return (
        HTML_PAGE_BYTES +
        doc.pictures.reduce(
          (sum, p) => sum + p.width * p.height * HTML_PICTURE_BYTES_PER_PIXEL,
          0,
        ) +
        soundFileBytes(doc) * AS_TEXT
      );
    case 'svg':
      return (
        SVG_BYTES +
        doc.layers.reduce((sum, l) => sum + l.objects.length * SVG_BYTES_PER_OBJECT, 0) +
        doc.pictures.reduce((sum, p) => sum + p.width * p.height * HTML_PICTURE_BYTES_PER_PIXEL, 0)
      );
  }
}

/** The PNG sequence's files: `Task1.png` → `Task1_0001.png`, `Task1_0002.png`… */
export function sequenceName(output: string, index: number): string {
  return `${output.replace(/\.png$/i, '')}_${String(index + 1).padStart(4, '0')}.png`;
}

/** The temporary frames FFmpeg reads: frame-00000.png onwards, in a folder of their own. */
export const FRAME_PATTERN = 'frame-%05d.png';
export const frameFile = (index: number): string => `frame-${String(index).padStart(5, '0')}.png`;

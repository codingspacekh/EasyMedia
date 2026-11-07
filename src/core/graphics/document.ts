// G1, G8 (M18): a Graphics mode image. It is an animation document with one frame and its
// `graphic` settings (ARCHITECTURE §7.10, D2): its layers hold the same vector objects, drawn and
// exported by the same drawing, so a graphic can go on to be animated (most papers animate the
// graphic they had made). The stage is the canvas.
import { EditError } from '../model/errors.ts';
import { createAnimation } from '../animation/factory.ts';
import { boundsOf, moved, type Bounds } from '../animation/geometry.ts';
import { MIN_STAGE, TRANSPARENT, validateStage } from '../animation/rules.ts';
import type { AnimationDoc, GraphicSettings, Stage, Unit } from '../animation/types.ts';
import { SCREEN_DPI, PRINT_DPI, isUnit, toPx, validateDpi } from './units.ts';

/** A canvas may be bigger than an animation's stage: an A4 page at 300 dpi is 2480 × 3508. */
export const MAX_CANVAS = 8192;

export interface ImageSize {
  /** In `units`. */
  width: number;
  height: number;
  units: Unit;
  dpi: number;
}

export interface ImagePreset extends ImageSize {
  name: string;
  /** What it is for, shown beside it. */
  use: string;
}

/** G1: the sizes the papers and the coursebook ask for, and common screen sizes. */
export const IMAGE_PRESETS: readonly ImagePreset[] = [
  {
    name: 'A4 portrait',
    width: 21,
    height: 29.7,
    units: 'cm',
    dpi: PRINT_DPI,
    use: 'Print: posters, leaflets (9626/04 M/J/18)',
  },
  { name: 'A4 landscape', width: 29.7, height: 21, units: 'cm', dpi: PRINT_DPI, use: 'Print' },
  {
    name: 'A5 portrait',
    width: 14.8,
    height: 21,
    units: 'cm',
    dpi: PRINT_DPI,
    use: 'Print: flyers, cards',
  },
  {
    name: '10 × 10 cm',
    width: 10,
    height: 10,
    units: 'cm',
    dpi: PRINT_DPI,
    use: 'A printed logo (9626/04 M/22)',
  },
  {
    name: 'Logo 200 × 200 px',
    width: 200,
    height: 200,
    units: 'px',
    dpi: SCREEN_DPI,
    use: 'A web logo (9626/04 J/17, O/N/17)',
  },
  {
    name: 'Logo 250 × 250 px',
    width: 250,
    height: 250,
    units: 'px',
    dpi: SCREEN_DPI,
    use: 'A web logo (coursebook exam-style 1)',
  },
  {
    name: 'Full HD 1920 × 1080 px',
    width: 1920,
    height: 1080,
    units: 'px',
    dpi: SCREEN_DPI,
    use: 'A screen or a video frame',
  },
  {
    name: 'HD 1280 × 720 px',
    width: 1280,
    height: 720,
    units: 'px',
    dpi: SCREEN_DPI,
    use: 'A screen, a web page',
  },
  {
    name: 'Web banner 728 × 90 px',
    width: 728,
    height: 90,
    units: 'px',
    dpi: SCREEN_DPI,
    use: 'The top of a web page',
  },
];

/** The canvas in pixels for a size in any unit (rounded to whole pixels). */
export function canvasPixels(size: ImageSize): { width: number; height: number } {
  validateDpi(size.dpi);
  if (!isUnit(size.units)) throw new EditError('Choose the units: px, cm, mm, in or pt.');
  const width = Math.round(toPx(size.width, size.units, size.dpi));
  const height = Math.round(toPx(size.height, size.units, size.dpi));
  for (const [what, n] of [
    ['width', width],
    ['height', height],
  ] as const)
    if (!Number.isFinite(n) || n < MIN_STAGE || n > MAX_CANVAS)
      throw new EditError(
        `The ${what} must come to between ${MIN_STAGE} and ${MAX_CANVAS} pixels (it is ${Number.isFinite(n) ? n : '?'} px at ${size.dpi} dpi).`,
      );
  return { width, height };
}

export interface NewImage {
  name: string;
  size: ImageSize;
  /** A hex colour, or 'none': transparent. */
  background: string;
}

/** G1: a new image: one empty layer, the rulers on, the grid and guides ready. */
export function createGraphic({ name, size, background }: NewImage): AnimationDoc {
  const { width, height } = canvasPixels(size);
  const base = createAnimation({ name });
  const stage: Stage = { width, height, background, fps: 24, length: 1 };
  validateGraphicStage(stage);
  return {
    ...base,
    stage,
    graphic: { dpi: size.dpi, units: size.units },
    view: { ...base.view, rulers: true },
  };
}

/** The default new image: 1280 × 720 px for a screen, white. */
export const defaultGraphic = (): AnimationDoc =>
  createGraphic({
    name: 'Untitled',
    size: { width: 1280, height: 720, units: 'px', dpi: SCREEN_DPI },
    background: '#ffffff',
  });

/** A canvas checked as a stage is, but allowed up to MAX_CANVAS (print sizes). */
export function validateGraphicStage(stage: Stage): void {
  validateStage({ ...stage, length: 1 }, MAX_CANVAS);
}

export const isGraphic = (doc: AnimationDoc): boolean => doc.graphic !== undefined;

/** The settings of an image (an animation opened here is treated as a screen picture). */
export const graphicOf = (doc: AnimationDoc): GraphicSettings =>
  doc.graphic ?? { dpi: SCREEN_DPI, units: 'px' };

/**
 * G1, G10: a new canvas size, resolution and background. The drawing stays where it is (its top
 * left at the canvas's top left): a bigger canvas adds room on the right and below.
 */
export function setImage(
  doc: AnimationDoc,
  change: { width?: number; height?: number; background?: string; dpi?: number; units?: Unit },
): AnimationDoc {
  const graphic = { ...graphicOf(doc) };
  if (change.dpi !== undefined) {
    validateDpi(change.dpi);
    graphic.dpi = change.dpi;
  }
  if (change.units !== undefined) {
    if (!isUnit(change.units)) throw new EditError('Choose the units: px, cm, mm, in or pt.');
    graphic.units = change.units;
  }
  const stage: Stage = {
    ...doc.stage,
    ...(change.width !== undefined ? { width: change.width } : {}),
    ...(change.height !== undefined ? { height: change.height } : {}),
    ...(change.background !== undefined ? { background: change.background } : {}),
  };
  validateGraphicStage(stage);
  return { ...doc, stage, graphic };
}

/** The box round the visible objects (null when there are none). */
export function drawingBounds(doc: AnimationDoc, ids?: ReadonlySet<string>): Bounds | null {
  const boxes = doc.layers
    .filter((l) => l.visible && !l.mask)
    .flatMap((l) => l.objects)
    .filter((o) => !ids || ids.has(o.id))
    .map(boundsOf);
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * G8: crops the canvas to a box (whole pixels, at least 16 × 16): everything moves so the box's
 * top left becomes the canvas's, guides too. "Crop to selection", "Fit canvas to drawing" (9626/04
 * O/N/19: "exclude as much white space as possible").
 */
export function cropCanvas(doc: AnimationDoc, box: Bounds): AnimationDoc {
  const cropped = canvasAround(doc, box, MIN_STAGE);
  validateGraphicStage(cropped.stage);
  return cropped;
}

/**
 * The drawing moved so `box` (to whole pixels, at least `min` px a side) is the canvas. An export
 * of a part may be smaller than a canvas can be (a needle 6 px wide).
 */
export function canvasAround(doc: AnimationDoc, box: Bounds, min = 1): AnimationDoc {
  const left = Math.floor(box.x);
  const top = Math.floor(box.y);
  const width = Math.max(min, Math.ceil(box.x + box.width) - left);
  const height = Math.max(min, Math.ceil(box.y + box.height) - top);
  const stage = { ...doc.stage, width, height };
  return {
    ...doc,
    stage,
    layers: doc.layers.map((l) => ({ ...l, objects: l.objects.map((o) => moved(o, -left, -top)) })),
    guides: {
      x: doc.guides.x.map((g) => g - left).filter((g) => g >= 0 && g <= width),
      y: doc.guides.y.map((g) => g - top).filter((g) => g >= 0 && g <= height),
    },
  };
}

/** For messages: "transparent" or the colour. */
export const backgroundName = (background: string): string =>
  background === TRANSPARENT ? 'transparent' : background;

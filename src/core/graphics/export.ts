// G11 (M18): exporting an image — SVG (vector), PNG and JPG (bitmaps) — at the canvas size or
// another one, and the whole image or only the objects chosen, each in a file of its own if
// asked (9626/04 J/19: "save the grouped objects separately as Casing, MetalInsert and Grid";
// J/20: each part "in both .svg and a transparent bitmap format"). BMP, GIF, TIFF and PDF come
// in M23.
import { EditError } from '../model/errors.ts';
import { TRANSPARENT } from '../animation/rules.ts';
import type { AnimationDoc, AnimObject, Id } from '../animation/types.ts';
import { canvasAround, drawingBounds, graphicOf } from './document.ts';
import { roundIn, toPx, type Unit } from './units.ts';

export type GraphicFormat = 'png' | 'jpg' | 'svg';

export const GRAPHIC_FORMATS: readonly GraphicFormat[] = ['png', 'jpg', 'svg'];

export interface FormatInfo {
  label: string;
  extension: string;
  kind: 'vector' | 'bitmap';
  compression: 'lossless' | 'lossy' | 'none';
  transparency: boolean;
  /** One line on what it is good for and what it cannot do (T7, syllabus 19.1 file formats). */
  about: string;
}

export const FORMAT_INFO: Readonly<Record<GraphicFormat, FormatInfo>> = {
  svg: {
    label: 'SVG (Scalable Vector Graphics)',
    extension: 'svg',
    kind: 'vector',
    compression: 'none',
    transparency: true,
    about:
      'Shapes, not pixels: any size without going blurry, small for logos and drawings, opens in browsers and vector programs. Not for photographs.',
  },
  png: {
    label: 'PNG (Portable Network Graphics)',
    extension: 'png',
    kind: 'bitmap',
    compression: 'lossless',
    transparency: true,
    about:
      'Pixels, compressed without losing any: sharp edges and text, keeps transparency. Larger than a JPG for photographs.',
  },
  jpg: {
    label: 'JPG / JPEG (Joint Photographic Experts Group)',
    extension: 'jpg',
    kind: 'bitmap',
    compression: 'lossy',
    transparency: false,
    about:
      'Pixels, compressed by losing detail you hardly see: small files for photographs. No transparency (see-through parts become the background colour); edges and text can blur.',
  },
};

/** What size the picture is made at. A vector file (SVG) is always the canvas, scaled if asked. */
export type ExportSize =
  | { by: 'canvas' }
  /** In px; the other side in proportion (9626/04 J/20: "a width of 600px"; M/21: "a height of 500 pixels"). */
  | { by: 'width'; px: number }
  | { by: 'height'; px: number }
  | { by: 'percent'; percent: number }
  /** A printed width in a unit at a resolution (the height in proportion): "10 cm at 300 dpi". */
  | { by: 'print'; width: number; unit: Unit; dpi: number };

/** What is exported: the whole canvas, or the selected objects cropped to them. */
export type ExportWhat = 'image' | 'selection' | 'each';

export interface GraphicExportOptions {
  format: GraphicFormat;
  size?: ExportSize;
  /** JPG quality, 1–100 (default 90). */
  quality?: number;
  /** JPG only: the colour see-through parts become (default white). */
  background?: string;
  what?: ExportWhat;
}

export const MIN_EXPORT_SIDE = 1;
export const MAX_EXPORT_SIDE = 16384;

export interface PixelSize {
  width: number;
  height: number;
  /** The resolution written into the file. */
  dpi: number;
}

/** G11: the pixel size (and dpi kept in the file) of an export of a canvas this big. */
export function exportPixels(
  canvas: { width: number; height: number },
  dpi: number,
  size: ExportSize = { by: 'canvas' },
): PixelSize {
  const ratio = canvas.height / canvas.width;
  let width: number;
  let height: number;
  let outDpi = dpi;
  switch (size.by) {
    case 'canvas':
      ({ width, height } = canvas);
      break;
    case 'width':
      width = Math.round(size.px);
      height = Math.round(width * ratio);
      break;
    case 'height':
      height = Math.round(size.px);
      width = Math.round(height / ratio);
      break;
    case 'percent':
      if (!(size.percent > 0)) throw new EditError('Type a size above 0 %.');
      width = Math.round((canvas.width * size.percent) / 100);
      height = Math.round((canvas.height * size.percent) / 100);
      // The same printed size: a picture made smaller keeps its size on paper only at a lower dpi.
      break;
    case 'print':
      if (!(size.width > 0)) throw new EditError('Type a printed width above 0.');
      width = Math.round(toPx(size.width, size.unit, size.dpi));
      height = Math.round(width * ratio);
      outDpi = size.dpi;
      break;
  }
  for (const n of [width, height])
    if (!Number.isFinite(n) || n < MIN_EXPORT_SIDE || n > MAX_EXPORT_SIDE)
      throw new EditError(
        `That makes a picture of ${Number.isFinite(width) ? width : '?'} × ${Number.isFinite(height) ? height : '?'} px: each side must be between ${MIN_EXPORT_SIDE} and ${MAX_EXPORT_SIDE} px.`,
      );
  return { width, height, dpi: outDpi };
}

/**
 * G11, G10: an SVG's width and height as written in the file: in px for a screen image, or in
 * the image's own units (cm, mm, in, pt), so a 10 cm logo opens as 10 cm (9626/04 M/22).
 */
export function svgDimensions(
  doc: AnimationDoc,
  size: ExportSize = { by: 'canvas' },
): {
  width: string;
  height: string;
} {
  const { dpi, units } = graphicOf(doc);
  if (size.by === 'print') {
    const h = (size.width * doc.stage.height) / doc.stage.width;
    return {
      width: `${roundIn(size.width, size.unit)}${size.unit}`,
      height: `${roundIn(h, size.unit)}${size.unit}`,
    };
  }
  const px = exportPixels(doc.stage, dpi, size);
  if (units === 'px' || size.by !== 'canvas')
    return { width: `${px.width}`, height: `${px.height}` };
  const inUnit = (n: number) =>
    roundIn((n / dpi) * { cm: 2.54, mm: 25.4, in: 1, pt: 72 }[units], units);
  return { width: `${inUnit(px.width)}${units}`, height: `${inUnit(px.height)}${units}` };
}

/** The objects on the canvas that `ids` names (top-level), in drawing order. */
function chosen(doc: AnimationDoc, ids: readonly Id[]): AnimObject[] {
  const want = new Set(ids);
  return doc.layers.flatMap((l) => l.objects).filter((o) => want.has(o.id));
}

/**
 * G11: an image of only these objects, its canvas cropped to them and see-through around them
 * (a transparent bitmap or an SVG of the part alone). Their layers stay (hidden ones are left
 * out, as on the canvas); the rest of the drawing is gone.
 */
export function imageOfObjects(doc: AnimationDoc, ids: readonly Id[]): AnimationDoc {
  const want = new Set(ids);
  const objects = chosen(doc, ids);
  if (objects.length === 0) throw new EditError('Choose the objects to export first.');
  const only: AnimationDoc = {
    ...doc,
    stage: { ...doc.stage, background: TRANSPARENT },
    // A mask layer still shapes the layer under it, as it does on the canvas.
    layers: doc.layers.map((l) =>
      l.mask ? l : { ...l, objects: l.objects.filter((o) => want.has(o.id)) },
    ),
    guides: { x: [], y: [] },
  };
  const box = drawingBounds(only, want);
  if (!box) throw new EditError('The objects chosen are on hidden layers: show them first.');
  return canvasAround(only, box);
}

/**
 * G11 "each": one image per chosen object, named after it ("Casing", "Needle"); names that are the
 * same, or not usable in a file name, are made different ("Star", "Star 2").
 */
export function imagesOfEach(
  doc: AnimationDoc,
  ids: readonly Id[],
): { name: string; doc: AnimationDoc }[] {
  const used = new Set<string>();
  return chosen(doc, ids).map((o) => {
    const plain = o.name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Object';
    let name = plain;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${plain} ${n}`;
    used.add(name.toLowerCase());
    return { name, doc: imageOfObjects(doc, [o.id]) };
  });
}

/** JPG quality, checked. */
export function jpegQuality(quality = 90): number {
  if (!Number.isInteger(quality) || quality < 1 || quality > 100)
    throw new EditError('The JPG quality must be a whole number from 1 to 100.');
  return quality;
}

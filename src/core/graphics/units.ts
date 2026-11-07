// G1, G6, G10 (M18): pixels and the units the papers give sizes in — A4 is 21 × 29.7 cm (9626/04
// M/J/18), a logo 10 cm × 10 cm (M/22), a jigsaw piece an 80 mm square (M/25), outlines 1 pt.
// A picture is pixels; its resolution (dots per inch) says how big it prints: at 300 dpi, 2480 px
// is 21 cm. A point is 1/72 inch, as in every graphics program.
import { EditError } from '../model/errors.ts';
import type { Unit } from '../animation/types.ts';

export type { Unit };

export const UNITS: readonly Unit[] = ['px', 'cm', 'mm', 'in', 'pt'];

export const UNIT_NAMES: Readonly<Record<Unit, string>> = {
  px: 'pixels',
  cm: 'centimetres',
  mm: 'millimetres',
  in: 'inches',
  pt: 'points',
};

/** How many of each unit make an inch. */
const PER_INCH: Readonly<Record<Exclude<Unit, 'px'>, number>> = {
  cm: 2.54,
  mm: 25.4,
  in: 1,
  pt: 72,
};

/** The screen's resolution (CSS pixels): what a new image for the web uses. */
export const SCREEN_DPI = 96;
/** What print shops ask for (G10). */
export const PRINT_DPI = 300;
export const MIN_DPI = 10;
export const MAX_DPI = 1200;

export const isUnit = (u: unknown): u is Unit => UNITS.includes(u as Unit);

/** A length in `unit` as pixels at `dpi` (not rounded: the caller rounds a canvas size). */
export function toPx(value: number, unit: Unit, dpi: number): number {
  return unit === 'px' ? value : (value / PER_INCH[unit]) * dpi;
}

/** Pixels as a length in `unit` at `dpi`. */
export function fromPx(px: number, unit: Unit, dpi: number): number {
  return unit === 'px' ? px : (px / dpi) * PER_INCH[unit];
}

/** How many decimals a length in `unit` is shown with: 0.01 cm is about a pixel at 300 dpi. */
export const DECIMALS: Readonly<Record<Unit, number>> = { px: 0, cm: 2, mm: 1, in: 2, pt: 1 };

/** Rounded as it is shown, without trailing zeros: 21, 29.7, 3.5. */
export function roundIn(value: number, unit: Unit): number {
  const f = 10 ** DECIMALS[unit];
  return Math.round(value * f) / f;
}

/** "21 cm", "250 px", "3.5 in". */
export function formatLength(px: number, unit: Unit, dpi: number): string {
  return `${roundIn(fromPx(px, unit, dpi), unit)} ${unit}`;
}

/** A resolution a student may give: a whole number of dots per inch, 10 to 1200. */
export function validateDpi(dpi: number): void {
  if (!Number.isFinite(dpi) || !Number.isInteger(dpi) || dpi < MIN_DPI || dpi > MAX_DPI)
    throw new EditError(
      `The resolution must be a whole number of dots per inch, ${MIN_DPI} to ${MAX_DPI}.`,
    );
}

/** dpi as pixels per metre, as PNG files keep it (pHYs). */
export const dpiToPpm = (dpi: number): number => Math.round(dpi / 0.0254);
export const ppmToDpi = (ppm: number): number => Math.round(ppm * 0.0254);

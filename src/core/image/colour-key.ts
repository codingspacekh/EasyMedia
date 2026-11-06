// AN5 Make a colour see-through (9626/04 O/N/19: the pearl cut out of its photo, on a transparent
// background, instead of a mask): the colour picked from the picture and the colours near it
// become see-through. FFmpeg's colorkey does it into a PNG; the dialog's preview works it out the
// same way from the picture's pixels. Pure maths plus the filter.
import { EditError } from '../model/errors.ts';

export interface ColourKey {
  /** The colour picked from the picture, hex ("#ffffff"). */
  colour: string;
  /** How near a colour must be to the picked one to go too, 1–100 % (100: every colour). */
  tolerance: number;
  /** Soft edges: colours just past the tolerance are partly see-through (smoother outlines). */
  soft: boolean;
}

/** The picture's pixels: RGBA, one byte each, row by row (StageRenderer.pixels). */
export interface KeyPixels {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

/** What the dialog starts with: near-white and near-plain backgrounds go, the subject stays. */
export const DEFAULT_TOLERANCE = 20;
/** How far past the tolerance soft edges reach (FFmpeg's colorkey "blend", 0–1). */
const SOFT_BLEND = 0.1;

const HEX = /^#[0-9a-f]{6}$/i;

function check(key: ColourKey): void {
  if (!HEX.test(key.colour))
    throw new EditError('Pick the colour to make see-through: click it in the picture.');
  if (!(key.tolerance >= 1 && key.tolerance <= 100))
    throw new EditError('The tolerance must be between 1 and 100 %.');
}

const blendOf = (key: ColourKey) => (key.soft ? SOFT_BLEND : 0);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** The FFmpeg filter: colorkey=0xRRGGBB:similarity:blend, kept see-through as RGBA for the PNG. */
export function colourKeyFilter(key: ColourKey): string {
  check(key);
  const rgb = key.colour.slice(1).toLowerCase();
  return `colorkey=0x${rgb}:${round3(key.tolerance / 100)}:${blendOf(key)},format=rgba`;
}

/**
 * How solid (0–255) a pixel of this colour stays, as FFmpeg's colorkey works it out: its distance
 * from the picked colour (0–1 across the RGB cube) against the tolerance.
 */
export function keyedAlpha(r: number, g: number, b: number, key: ColourKey): number {
  const kr = parseInt(key.colour.slice(1, 3), 16);
  const kg = parseInt(key.colour.slice(3, 5), 16);
  const kb = parseInt(key.colour.slice(5, 7), 16);
  const diff = Math.sqrt(((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2) / (255 * 255 * 3));
  const similarity = key.tolerance / 100;
  const blend = blendOf(key);
  if (blend > 0) return Math.round(Math.max(0, Math.min(1, (diff - similarity) / blend)) * 255);
  return diff > similarity ? 255 : 0;
}

/** The preview: the pixels with the keyed colours see-through (a pixel already clear stays so). */
export function seeThrough(pixels: KeyPixels, key: ColourKey): Uint8ClampedArray<ArrayBuffer> {
  const out = Uint8ClampedArray.from(pixels.data);
  for (let i = 0; i < out.length; i += 4)
    out[i + 3] = Math.min(out[i + 3]!, keyedAlpha(out[i]!, out[i + 1]!, out[i + 2]!, key));
  return out;
}

/** The colour of the pixel at (x, y) in the pixels, as hex (outside: the nearest edge's). */
export function colourAt(pixels: KeyPixels, x: number, y: number): string {
  const px = Math.min(pixels.width - 1, Math.max(0, Math.floor(x)));
  const py = Math.min(pixels.height - 1, Math.max(0, Math.floor(y)));
  const i = (py * pixels.width + px) * 4;
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(pixels.data[i]!)}${hex(pixels.data[i + 1]!)}${hex(pixels.data[i + 2]!)}`;
}

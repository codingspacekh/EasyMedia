// AN1, AN2, AN6: what a stage and an object may be, with plain messages for the student; the
// coursebook's common aspect ratios (Table 19.1) as presets.
import { EditError } from '../model/errors.ts';
import { FONTS } from '../text/fonts.ts';
import type { AnimObject, Paint, Stage } from './types.ts';

export const MIN_STAGE = 16;
export const MAX_STAGE = 4096;
export const MIN_FPS = 1;
export const MAX_FPS = 60;
export const MAX_FRAMES = 36_000;
export const FPS_CHOICES: readonly number[] = [10, 12, 15, 24, 25, 30, 60];

export interface StagePreset {
  ratio: string;
  /** Width : height as a number. */
  value: number;
  width: number;
  height: number;
  use: string;
}

/** Coursebook Table 19.1. */
export const STAGE_PRESETS: readonly StagePreset[] = [
  { ratio: '4:3', value: 4 / 3, width: 1024, height: 768, use: 'Standard: old televisions' },
  {
    ratio: '16:9',
    value: 16 / 9,
    width: 1280,
    height: 720,
    use: 'Widescreen: TV, monitors, laptops, web video',
  },
  { ratio: '16:10', value: 1.6, width: 1280, height: 800, use: 'Most modern mobile phones' },
  { ratio: '2.35:1', value: 2.35, width: 1880, height: 800, use: 'Widescreen films' },
];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** "16:9", "4:3", "3:2"… or a preset's name when the sizes match it (1880 × 800 is 2.35:1). */
export function aspectOf(width: number, height: number): string {
  const preset = STAGE_PRESETS.find((p) => Math.abs(width / height - p.value) < 0.002);
  if (preset) return preset.ratio;
  const d = gcd(Math.round(width), Math.round(height));
  return `${Math.round(width) / d}:${Math.round(height) / d}`;
}

const even = (n: number) => 2 * Math.round(n / 2);

/** The size of a preset given one side; the other is rounded to a whole even number of pixels. */
export function presetSize(
  ratio: string,
  side: { width: number } | { height: number },
): { width: number; height: number } {
  const preset = STAGE_PRESETS.find((p) => p.ratio === ratio);
  if (!preset) throw new EditError(`There is no ${ratio} preset.`);
  return 'width' in side
    ? { width: side.width, height: even(side.width / preset.value) }
    : { width: even(side.height * preset.value), height: side.height };
}

const HEX = /^#[0-9a-f]{6}$/i;
export const isColour = (c: unknown): c is string => typeof c === 'string' && HEX.test(c);
const colourMessage = (what: string) => `${what} must be a colour such as #F4C8EE.`;

const whole = (n: number, what: string) => {
  if (!Number.isInteger(n)) throw new EditError(`${what} must be a whole number.`);
};

export function validateStage(stage: Stage): void {
  for (const [what, n] of [
    ['The width', stage.width],
    ['The height', stage.height],
  ] as const) {
    whole(n, what);
    if (n < MIN_STAGE || n > MAX_STAGE)
      throw new EditError(`${what} must be between ${MIN_STAGE} and ${MAX_STAGE} pixels.`);
  }
  whole(stage.fps, 'The frame rate');
  if (stage.fps < MIN_FPS || stage.fps > MAX_FPS)
    throw new EditError(`The frame rate must be between ${MIN_FPS} and ${MAX_FPS} fps.`);
  whole(stage.length, 'The length');
  if (stage.length < 1) throw new EditError('The animation must be at least 1 frame long.');
  if (stage.length > MAX_FRAMES)
    throw new EditError('The animation must be at most 36 000 frames long.');
  if (!isColour(stage.background)) throw new EditError(colourMessage('The stage colour'));
}

function validatePaint(paint: Paint, what: string): void {
  if (paint.kind === 'none') return;
  if (paint.kind === 'solid') {
    if (!isColour(paint.colour)) throw new EditError(colourMessage(`The ${what} colour`));
    return;
  }
  if (!isColour(paint.from) || !isColour(paint.to))
    throw new EditError(colourMessage(`Each ${what} colour`));
  if (paint.kind === 'linear' && !Number.isFinite(paint.angle))
    throw new EditError('The gradient angle must be a number of degrees.');
}

const atLeastZero = (n: number, what: string) => {
  if (!Number.isFinite(n) || n < 0) throw new EditError(`${what} must be 0 or more.`);
};

export function validateObject(object: AnimObject): void {
  for (const n of [object.x, object.y, object.rotation])
    if (!Number.isFinite(n)) throw new EditError('Position and rotation must be numbers.');
  atLeastZero(object.width, 'The width');
  atLeastZero(object.height, 'The height');
  if (!Number.isFinite(object.opacity) || object.opacity < 0 || object.opacity > 100)
    throw new EditError('Opacity must be between 0 and 100 %.');
  validatePaint(object.fill, 'fill');
  if (object.stroke) {
    atLeastZero(object.stroke.width, 'The outline width');
    if (!isColour(object.stroke.colour)) throw new EditError(colourMessage('The outline colour'));
  }
  switch (object.kind) {
    case 'rect':
      atLeastZero(object.radius, 'The corner radius');
      break;
    case 'star':
      if (!Number.isInteger(object.points) || object.points < 3)
        throw new EditError('A star needs 3 or more points.');
      if (!(object.inner >= 0 && object.inner <= 1))
        throw new EditError('The inner radius must be between 0 and 1 of the outer one.');
      break;
    case 'polygon':
      if (!Number.isInteger(object.sides) || object.sides < 3)
        throw new EditError('A polygon needs 3 or more sides.');
      break;
    case 'text':
      if (!FONTS.some((f) => f.name === object.font))
        throw new EditError(`${object.font} is not a bundled font. Choose one from the list.`);
      if (!(object.size >= 1)) throw new EditError('The font size must be at least 1 px.');
      break;
    case 'path':
      if (object.points.length < 2) throw new EditError('A path needs at least two points.');
      break;
    case 'group':
      object.children.forEach(validateObject);
      break;
    default:
      break;
  }
}

// Bundled fonts (X2): the same on every computer. Files: resources/fonts (OFL licence).
import { EditError } from '../model/errors.ts';
import type { TextStyle } from '../model/types.ts';

export const FONTS = [
  { name: 'Inter', label: 'Inter (sans-serif)' },
  { name: 'Noto Serif', label: 'Noto Serif (serif)' },
  { name: 'Courier Prime', label: 'Courier Prime (like Courier)' },
] as const;

const POSITIONS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'centre',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];

export function validateTextStyle(style: TextStyle): void {
  if (!FONTS.some((f) => f.name === style.font)) {
    throw new EditError(`Choose one of the fonts: ${FONTS.map((f) => f.name).join(', ')}.`);
  }
  if (!(style.size >= 8 && style.size <= 300))
    throw new EditError('Text size must be between 8 and 300.');
  if (!/^#[0-9a-f]{6}$/i.test(style.colour)) throw new EditError('Choose a text colour.');
  if (!['left', 'centre', 'right'].includes(style.align) || !POSITIONS.includes(style.position)) {
    throw new EditError('Choose where the text goes.');
  }
}

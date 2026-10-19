// Bundled fonts (X2): the same on every computer. Files: resources/fonts (OFL licence).
import { EditError } from '../model/errors.ts';
import type { TextStyle } from '../model/types.ts';

export const FONT_GROUPS = [
  'Sans-serif',
  'Serif',
  'Display',
  'Handwriting',
  'Typewriter & retro',
] as const;
export type FontGroup = (typeof FONT_GROUPS)[number];

export interface Font {
  /** The CSS family name, kept in saved projects. */
  name: string;
  group: FontGroup;
  /** What it is good for, shown when choosing. */
  hint: string;
}

const f = (name: string, group: FontGroup, hint: string): Font => ({ name, group, hint });

export const FONTS: readonly Font[] = [
  f('Inter', 'Sans-serif', 'Clear and modern: captions and subtitles'),
  f('Montserrat', 'Sans-serif', 'Wide and bold: titles'),
  f('Poppins', 'Sans-serif', 'Round and friendly'),
  f('Oswald', 'Sans-serif', 'Tall and narrow: headlines'),
  f('Noto Serif', 'Serif', 'Like a book or newspaper'),
  f('Playfair Display', 'Serif', 'Elegant: weddings, history'),
  f('Arvo', 'Serif', 'Strong slab serif'),
  f('Cinzel', 'Serif', 'Carved capitals: films, credits'),
  f('Bebas Neue', 'Display', 'Big poster capitals'),
  f('Anton', 'Display', 'Heavy and loud: sport, adverts'),
  f('Abril Fatface', 'Display', 'Magazine headlines'),
  f('Righteous', 'Display', 'Rounded and retro'),
  f('Bangers', 'Display', 'Comic book'),
  f('Lobster', 'Handwriting', 'Bold joined-up script'),
  f('Pacifico', 'Handwriting', 'Relaxed brush script: holidays'),
  f('Dancing Script', 'Handwriting', 'Lively joined-up writing'),
  f('Caveat', 'Handwriting', 'Quick handwritten notes'),
  f('Indie Flower', 'Handwriting', 'Playful, like a school notebook'),
  f('Courier Prime', 'Typewriter & retro', 'Typewriter: old documents'),
  f('Press Start 2P', 'Typewriter & retro', 'Pixel video game'),
];

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
    throw new EditError('Choose one of the fonts in the list: they come with EasyMedia.');
  }
  if (!(style.size >= 8 && style.size <= 300))
    throw new EditError('Text size must be between 8 and 300.');
  if (!/^#[0-9a-f]{6}$/i.test(style.colour)) throw new EditError('Choose a text colour.');
  for (const c of [style.accent, style.outlineColour, style.boxColour])
    if (c !== undefined && !/^#[0-9a-f]{6}$/i.test(c))
      throw new EditError('Choose a colour from the colour box.');
  if (!['left', 'centre', 'right'].includes(style.align) || !POSITIONS.includes(style.position)) {
    throw new EditError('Choose where the text goes.');
  }
}

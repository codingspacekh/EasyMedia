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
  f('Bungee', 'Display', 'Bold street signs: urban, sport'),
  f('Black Ops One', 'Display', 'Army stencil: action and games'),
  f('Titan One', 'Display', 'Chunky and fun: children, cartoons'),
  f('Archivo Black', 'Display', 'Very heavy and plain: punchy captions'),
  f('Russo One', 'Display', 'Fast and techy: cars, science'),
  f('Bowlby One', 'Display', 'Fat headline letters: trailers, sales'),
  f('Lobster', 'Handwriting', 'Bold joined-up script'),
  f('Pacifico', 'Handwriting', 'Relaxed brush script: holidays'),
  f('Dancing Script', 'Handwriting', 'Lively joined-up writing'),
  f('Caveat', 'Handwriting', 'Quick handwritten notes'),
  f('Indie Flower', 'Handwriting', 'Playful, like a school notebook'),
  f('Courier Prime', 'Typewriter & retro', 'Typewriter: old documents'),
  f('Press Start 2P', 'Typewriter & retro', 'Pixel video game'),
];

/** One font file, as fonts.css declares it (a test keeps the two the same). */
export interface FontFile {
  family: string;
  style: 'normal' | 'italic';
  /** A CSS weight or range: "400", "100 900" (a variable font). */
  weight: string;
  /** Its name in resources/fonts. */
  file: string;
}

/** The CSS rule that brings a bundled font into a web page or an SVG, given its file as data. */
export const fontFaceRule = (face: FontFile, url: string): string =>
  `@font-face { font-family: '${face.family}'; font-style: ${face.style}; ` +
  `font-weight: ${face.weight}; src: url('${url}') format('truetype'); }`;

const GENERIC: Record<FontGroup, string> = {
  'Sans-serif': 'sans-serif',
  Serif: 'serif',
  Display: 'sans-serif',
  Handwriting: 'cursive',
  'Typewriter & retro': 'monospace',
};

/** The general family of the same kind (sans-serif, serif, cursive, monospace) for a font. */
export const genericFamily = (name: string): string => {
  const font = FONTS.find((f) => f.name === name);
  return font ? GENERIC[font.group] : 'sans-serif';
};

const face = (
  family: string,
  style: FontFile['style'],
  weight: string,
  file: string,
): FontFile => ({
  family,
  style,
  weight,
  file,
});

/** AN15: every bundled font file, so an HTML web animation can carry the ones its text uses. */
export const FONT_FACES: readonly FontFile[] = [
  face('Inter', 'normal', '100 900', 'Inter.ttf'),
  face('Inter', 'italic', '100 900', 'Inter-Italic.ttf'),
  face('Noto Serif', 'normal', '100 900', 'NotoSerif.ttf'),
  face('Noto Serif', 'italic', '100 900', 'NotoSerif-Italic.ttf'),
  face('Courier Prime', 'normal', '400', 'CourierPrime-Regular.ttf'),
  face('Courier Prime', 'normal', '700', 'CourierPrime-Bold.ttf'),
  face('Courier Prime', 'italic', '400', 'CourierPrime-Italic.ttf'),
  face('Courier Prime', 'italic', '700', 'CourierPrime-BoldItalic.ttf'),
  face('Montserrat', 'normal', '100 900', 'Montserrat.ttf'),
  face('Montserrat', 'italic', '100 900', 'Montserrat-Italic.ttf'),
  face('Poppins', 'normal', '400', 'Poppins-Regular.ttf'),
  face('Poppins', 'normal', '700', 'Poppins-Bold.ttf'),
  face('Poppins', 'italic', '400', 'Poppins-Italic.ttf'),
  face('Poppins', 'italic', '700', 'Poppins-BoldItalic.ttf'),
  face('Oswald', 'normal', '200 700', 'Oswald.ttf'),
  face('Playfair Display', 'normal', '400 900', 'PlayfairDisplay.ttf'),
  face('Playfair Display', 'italic', '400 900', 'PlayfairDisplay-Italic.ttf'),
  face('Arvo', 'normal', '400', 'Arvo-Regular.ttf'),
  face('Arvo', 'normal', '700', 'Arvo-Bold.ttf'),
  face('Arvo', 'italic', '400', 'Arvo-Italic.ttf'),
  face('Arvo', 'italic', '700', 'Arvo-BoldItalic.ttf'),
  face('Cinzel', 'normal', '400 900', 'Cinzel.ttf'),
  face('Bebas Neue', 'normal', '400', 'BebasNeue-Regular.ttf'),
  face('Anton', 'normal', '400', 'Anton-Regular.ttf'),
  face('Abril Fatface', 'normal', '400', 'AbrilFatface-Regular.ttf'),
  face('Righteous', 'normal', '400', 'Righteous-Regular.ttf'),
  face('Bangers', 'normal', '400', 'Bangers-Regular.ttf'),
  face('Bungee', 'normal', '400', 'Bungee-Regular.ttf'),
  face('Black Ops One', 'normal', '400', 'BlackOpsOne-Regular.ttf'),
  face('Titan One', 'normal', '400', 'TitanOne-Regular.ttf'),
  face('Archivo Black', 'normal', '400', 'ArchivoBlack-Regular.ttf'),
  face('Russo One', 'normal', '400', 'RussoOne-Regular.ttf'),
  face('Bowlby One', 'normal', '400', 'BowlbyOne-Regular.ttf'),
  face('Lobster', 'normal', '400', 'Lobster-Regular.ttf'),
  face('Pacifico', 'normal', '400', 'Pacifico-Regular.ttf'),
  face('Indie Flower', 'normal', '400', 'IndieFlower-Regular.ttf'),
  face('Press Start 2P', 'normal', '400', 'PressStart2P-Regular.ttf'),
  face('Dancing Script', 'normal', '400 700', 'DancingScript.ttf'),
  face('Caveat', 'normal', '400 700', 'Caveat.ttf'),
];

const covers = (weight: string, wanted: number): boolean => {
  const [low, high = low] = weight.split(' ').map(Number);
  return wanted >= low! && wanted <= high!;
};

/**
 * AN15: the one file a text in this font needs: the italic file for italic words, the bold one for
 * bold; a font with fewer files gets the nearest (the browser then makes it bold or italic, as in
 * the app). Null for a font that is not bundled.
 */
export function faceFor(family: string, bold: boolean, italic: boolean): FontFile | null {
  const own = FONT_FACES.filter((f) => f.family === family);
  const style = italic ? 'italic' : 'normal';
  const weight = bold ? 700 : 400;
  const sameStyle = own.filter((f) => f.style === style);
  const pool = sameStyle.length ? sameStyle : own.filter((f) => f.style === 'normal');
  return pool.find((f) => covers(f.weight, weight)) ?? pool[0] ?? null;
}

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
    throw new EditError('Choose one of the fonts in the list: they come with OneEditor.');
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

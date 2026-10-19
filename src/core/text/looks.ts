// One-click text looks (like Word Art): each sets the text's colours and effects, never its font,
// size, bold / italic or place, so a student can try them one after another.
import type { TextStyle } from '../model/types.ts';

type LookFields = Pick<
  TextStyle,
  | 'colour'
  | 'shadow'
  | 'outline'
  | 'box'
  | 'outlineColour'
  | 'boxColour'
  | 'glow'
  | 'gradient'
  | 'depth'
  | 'accent'
>;

export interface TextLook {
  id: string;
  label: string;
  /** What it suits, shown when choosing. */
  hint: string;
  style: LookFields;
}

const NONE: LookFields = {
  shadow: false,
  outline: false,
  box: false,
  glow: false,
  gradient: false,
  depth: false,
  colour: '#ffffff',
};

const look = (id: string, label: string, hint: string, style: Partial<LookFields>): TextLook => ({
  id,
  label,
  hint,
  style: { ...NONE, ...style },
});

export const TEXT_LOOKS: readonly TextLook[] = [
  look('plain', 'Plain', 'White words, nothing else', {}),
  look('shadow', 'Soft shadow', 'Readable on most pictures', { shadow: true }),
  look('subtitle', 'Subtitle box', 'Words on a dark box: always readable', { box: true }),
  look('outline', 'Black edge', 'A black edge: readable on busy pictures', { outline: true }),
  look('highlight', 'Highlighter', 'Black words on a yellow box', {
    colour: '#111111',
    box: true,
    boxColour: '#ffd400',
  }),
  look('neon', 'Neon', 'Glowing pink, like a sign at night', {
    colour: '#ffe6fb',
    glow: true,
    accent: '#ff2fd0',
  }),
  look('ice', 'Ice glow', 'Cool blue glow: science, winter', { glow: true, accent: '#38bdf8' }),
  look('gold', 'Gold', 'Shiny gold: awards, celebrations', {
    colour: '#fff3b0',
    gradient: true,
    accent: '#c8901a',
    outline: true,
    outlineColour: '#4a3000',
  }),
  look('fire', 'Fire', 'Yellow to red: action, sport', {
    colour: '#ffe14d',
    gradient: true,
    accent: '#ff3b1f',
    outline: true,
    outlineColour: '#4a0800',
  }),
  look('ocean', 'Ocean', 'Light to deep blue: nature, travel', {
    colour: '#c8f4ff',
    gradient: true,
    accent: '#1e6bd6',
    shadow: true,
  }),
  look('3d', 'Pop-out 3D', 'Words that stand out from the screen', {
    depth: true,
    accent: '#1f3b8f',
  }),
  look('comic', 'Comic', 'Yellow with a black edge, like a comic book', {
    colour: '#ffe600',
    outline: true,
    depth: true,
    accent: '#000000',
  }),
  look('retro', 'Retro', 'Warm colours from the 1980s', {
    colour: '#ff7a59',
    depth: true,
    accent: '#2a1a5e',
  }),
  look('sticker', 'Sticker', 'A coloured edge, like a sticker', {
    outline: true,
    outlineColour: '#7c3aed',
    shadow: true,
  }),
];

const FIELDS = [
  'colour',
  'shadow',
  'outline',
  'box',
  'outlineColour',
  'boxColour',
  'glow',
  'gradient',
  'depth',
  'accent',
] as const satisfies readonly (keyof LookFields)[];

/** The style with the look's colours and effects (anything the look does not set is cleared). */
export function applyLook(style: TextStyle, id: string): TextStyle {
  const chosen = TEXT_LOOKS.find((l) => l.id === id);
  if (!chosen) return style;
  const next: TextStyle = { ...style };
  for (const field of FIELDS) delete next[field];
  return { ...next, ...chosen.style };
}

/** The look the style has now, or null when it has been changed by hand. */
export function lookOf(style: TextStyle): string | null {
  const same = (l: TextLook) =>
    FIELDS.every((f) => (style[f] ?? NONE[f] ?? null) === (l.style[f] ?? null));
  return TEXT_LOOKS.find(same)?.id ?? null;
}

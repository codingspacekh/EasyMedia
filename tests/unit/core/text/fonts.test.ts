// X2: bundled fonts, the same on every computer, in groups students can browse.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONT_GROUPS, FONTS, validateTextStyle } from '../../../../src/core/text/fonts.ts';
import type { TextStyle } from '../../../../src/core/model/types.ts';

const root = join(import.meta.dirname, '../../../..');
const css = readFileSync(join(root, 'src/ui/fonts.css'), 'utf8');
/** Every @font-face: its family and file. */
const faces = [...css.matchAll(/font-family: '([^']+)';[\s\S]*?url\('([^']+)'\)/g)].map((m) => ({
  family: m[1]!,
  file: join(root, 'src/ui', m[2]!),
}));

const style = (font: string): TextStyle => ({
  font,
  size: 60,
  colour: '#ffffff',
  bold: false,
  italic: false,
  align: 'centre',
  position: 'centre',
});

describe('X2 bundled fonts', () => {
  it('there are at least 20, in groups', () => {
    expect(FONTS.length).toBeGreaterThanOrEqual(20);
    expect(FONT_GROUPS).toEqual([
      'Sans-serif',
      'Serif',
      'Display',
      'Handwriting',
      'Typewriter & retro',
    ]);
    for (const font of FONTS) expect(FONT_GROUPS).toContain(font.group);
    for (const group of FONT_GROUPS)
      expect(FONTS.filter((f) => f.group === group).length).toBeGreaterThanOrEqual(2);
  });

  it('the fonts of earlier versions are still there (saved projects)', () => {
    expect(FONTS.map((f) => f.name)).toEqual(
      expect.arrayContaining(['Inter', 'Noto Serif', 'Courier Prime']),
    );
  });

  it('each font is bundled: an @font-face for it, its file, and its open font licence', () => {
    for (const font of FONTS) {
      const own = faces.filter((f) => f.family === font.name);
      expect(own.length, font.name).toBeGreaterThan(0);
      for (const face of own) expect(existsSync(face.file), face.file).toBe(true);
      const licence = join(root, 'resources/fonts', `OFL-${font.name.replace(/ /g, '')}.txt`);
      expect(readFileSync(licence, 'utf8'), font.name).toMatch(/SIL OPEN FONT LICENSE/);
    }
  });

  it('every bundled font can be chosen; a font that is not bundled is refused', () => {
    for (const font of FONTS) expect(() => validateTextStyle(style(font.name))).not.toThrow();
    expect(() => validateTextStyle(style('Comic Sans MS'))).toThrow(/choose one of the fonts/i);
  });
});

// AN4: Split into letters. A text object becomes one text object per letter, each where it was
// drawn, so the letters can be animated one at a time (workbook Task 2: letters entering one by
// one; coursebook exam-style questions 1 and 3). Spaces make no object but keep their room.
import { EditError } from '../model/errors.ts';
import { newId } from '../model/factory.ts';
import { curvedText, curveOf } from './curve.ts';
import { LINE_HEIGHT, roughTextWidth } from './factory.ts';
import type { TextObject } from './types.ts';

/** The size of some words in the text's font (the screen measures; tests use a rough guess). */
export type MeasureText = (t: TextObject) => { width: number; height: number };

const roughMeasure: MeasureText = (t) => ({
  width: roughTextWidth(t.text, t.size),
  height: t.text.split('\n').length * t.size * LINE_HEIGHT,
});

export function splitIntoLetters(t: TextObject, measure: MeasureText = roughMeasure): TextObject[] {
  if (t.rotation !== 0) throw new EditError('Turn the text back to 0° before splitting it.');
  if ((t.tracks ?? []).some((k) => k.keyframes.length > 0))
    throw new EditError('Split the words into letters before animating them.');
  if (curveOf(t) !== 0) return curvedLetters(t, measure);
  const widthOf = (text: string) => (text === '' ? 0 : measure({ ...t, text }).width);
  const letters: TextObject[] = [];
  t.text.split('\n').forEach((line, row) => {
    const lineWidth = widthOf(line);
    const start =
      t.align === 'left'
        ? 0
        : t.align === 'centre'
          ? (t.width - lineWidth) / 2
          : t.width - lineWidth;
    [...line].forEach((ch, i) => {
      if (ch.trim() === '') return;
      const box = measure({ ...t, text: ch });
      const rest = { ...t };
      delete rest.tracks;
      letters.push({
        ...rest,
        id: newId(),
        name: ch,
        text: ch,
        align: 'left',
        x: t.x + start + widthOf([...line].slice(0, i).join('')),
        y: t.y + row * t.size * LINE_HEIGHT,
        width: box.width,
        height: box.height,
      });
    });
  });
  if (letters.length === 0) throw new EditError('This text has no letters to split.');
  return letters;
}

/**
 * AN26: curved words split into straight letters, each where it was drawn on the arc and turned
 * to follow it (what was done by hand before the curve: 9626/04 M/J/17 the HUNGRY logo).
 */
function curvedLetters(t: TextObject, measure: MeasureText): TextObject[] {
  const plain = { ...t };
  delete plain.curve;
  delete plain.tracks;
  const widthOf = (text: string) => (text === '' ? 0 : measure({ ...plain, text }).width);
  const bent = curvedText(t, widthOf);
  // The bent words sit in the middle of the box, as the stage draws them.
  const left = t.x + (t.width - bent.width) / 2;
  const top = t.y + (t.height - bent.height) / 2;
  const letters = bent.letters
    .filter((l) => l.char.trim() !== '')
    .map((l): TextObject => {
      const box = measure({ ...plain, text: l.char });
      return {
        ...plain,
        id: newId(),
        name: l.char,
        text: l.char,
        align: 'left',
        x: left + l.x - box.width / 2,
        y: top + l.y - box.height / 2,
        width: box.width,
        height: box.height,
        rotation: ((l.angle % 360) + 360) % 360,
      };
    });
  if (letters.length === 0) throw new EditError('This text has no letters to split.');
  return letters;
}

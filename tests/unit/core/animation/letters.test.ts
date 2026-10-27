// M14 / AN4: Split into letters — one text object per letter, where the letter was, so letters
// can enter one at a time (workbook Task 2; coursebook exam-style question 3).
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createText,
  roughTextWidth,
} from '../../../../src/core/animation/factory.ts';
import { addObject, splitText } from '../../../../src/core/animation/layers.ts';
import { splitIntoLetters } from '../../../../src/core/animation/letters.ts';
import { setPropertyAt } from '../../../../src/core/animation/tween.ts';
import type { TextObject } from '../../../../src/core/animation/types.ts';

/** 10 px a letter: easy to check by hand. */
const measure = (t: TextObject) => ({
  width: t.text.split('\n').reduce((w, l) => Math.max(w, l.length * 10), 0),
  height: t.text.split('\n').length * t.size * 1.2,
});

describe('Split into letters (AN4)', () => {
  it('makes one object per letter, each where it was; spaces only move the next letter on', () => {
    const words = { ...createText('Hi you', { x: 100, y: 50, size: 20 }), width: 60 };
    const letters = splitIntoLetters(words, measure);
    expect(letters.map((l) => [l.text, l.x, l.y, l.width])).toEqual([
      ['H', 100, 50, 10],
      ['i', 110, 50, 10],
      ['y', 130, 50, 10],
      ['o', 140, 50, 10],
      ['u', 150, 50, 10],
    ]);
    expect(letters.map((l) => l.name)).toEqual(['H', 'i', 'y', 'o', 'u']);
    expect(new Set(letters.map((l) => l.id)).size).toBe(5);
  });

  it('keeps the font, size, style, colours and opacity; lines go under each other', () => {
    const words: TextObject = {
      ...createText('ab\ncd', { x: 0, y: 0, size: 30, font: 'Lobster' }),
      bold: true,
      italic: true,
      opacity: 80,
      fill: { kind: 'solid', colour: '#ff1cc8' },
      stroke: { colour: '#000000', width: 2, dash: 'solid' },
    };
    const letters = splitIntoLetters(words, measure);
    expect(letters.map((l) => [l.text, l.x, l.y])).toEqual([
      ['a', 0, 0],
      ['b', 10, 0],
      ['c', 0, 36],
      ['d', 10, 36],
    ]);
    for (const l of letters)
      expect(l).toMatchObject({
        font: 'Lobster',
        size: 30,
        bold: true,
        italic: true,
        opacity: 80,
        fill: { kind: 'solid', colour: '#ff1cc8' },
        stroke: { colour: '#000000', width: 2 },
        align: 'left',
      });
  });

  it('centred and right-aligned lines start where they were drawn', () => {
    const centred = {
      ...createText('ab\nwxyz', { x: 0, y: 0, size: 10 }),
      align: 'centre' as const,
      width: 40,
    };
    expect(splitIntoLetters(centred, measure).map((l) => l.x)).toEqual([10, 20, 0, 10, 20, 30]);
    const right = { ...centred, align: 'right' as const };
    expect(
      splitIntoLetters(right, measure)
        .slice(0, 2)
        .map((l) => l.x),
    ).toEqual([20, 30]);
  });

  it('refuses text that is turned, already moves, or has no letters', () => {
    const t = createText('Hi', { x: 0, y: 0 });
    expect(() => splitIntoLetters({ ...t, rotation: 30 }, measure)).toThrow(/Turn the text back/);
    expect(() => splitIntoLetters(setPropertyAt(t, 'x', 24, 50), measure)).toThrow(
      /before animating/,
    );
    expect(() => splitIntoLetters({ ...t, text: '  ' }, measure)).toThrow(/no letters/);
  });

  it('uses the rough measure when none is given', () => {
    const t = createText('ab', { x: 0, y: 0, size: 20 });
    expect(splitIntoLetters(t)[1]!.x).toBeCloseTo(roughTextWidth('a', 20), 6);
  });

  it('in the document: the text is replaced by its letters in its place, with names of their own', () => {
    let doc = createAnimation({ name: 'Task 2' });
    const layer = doc.layers[0]!.id;
    doc = addObject(doc, layer, createText('p', { x: 0, y: 0 }));
    const words = createText('pop', { x: 0, y: 100 });
    doc = addObject(doc, layer, words);
    const { doc: split, ids } = splitText(doc, words.id, measure);
    expect(split.layers[0]!.objects.map((o) => o.name)).toEqual(['p', 'p 2', 'o', 'p 3']);
    expect(ids).toEqual(split.layers[0]!.objects.slice(1).map((o) => o.id));
    expect(() => splitText(split, ids[0]!, measure)).not.toThrow();
  });
});

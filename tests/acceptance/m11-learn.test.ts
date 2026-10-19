// M11 exit gate: Book A's exam-style questions 1–6 can be answered from Learn mode's glossary.
// Each test is a question; the glossary entry must hold the points a mark scheme looks for.
import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../../src/core/teaching/glossary.ts';

const meaning = (term: string) => GLOSSARY.find((e) => e.term === term)!.meaning;
/** How many of the points the text makes. */
const points = (text: string, ...patterns: RegExp[]) => patterns.filter((p) => p.test(text)).length;

describe('Book A exam-style questions answered from Learn mode', () => {
  it('1 Define what is meant by the aspect ratio of a video. [1]', () => {
    expect(meaning('Aspect ratio')).toMatch(/ratio of the width .*to (its|the) height/i);
  });

  it('2 State why a trimming tool would be used on a video clip. [1]', () => {
    expect(meaning('Trimming')).toMatch(/remove unwanted (footage|material|parts)/i);
  });

  it('3 Explain two advantages of using captions on a video clip. [2]', () => {
    const text = meaning('Caption');
    expect(
      points(
        text,
        /deaf|hard of hearing/i,
        /sound (is )?off|without (the )?sound|noisy/i,
        /name|place|information|explain/i,
        /language/i,
      ),
    ).toBeGreaterThanOrEqual(2);
  });

  it('4 Explain two advantages of using a lossy compression method on a video file. [2]', () => {
    const text = meaning('Lossy compression');
    expect(text).toMatch(/smaller file/i);
    expect(
      points(
        text,
        /less (storage|space)/i,
        /(upload|download|send)/i,
        /stream/i,
        /bandwidth|data allowance/i,
      ),
    ).toBeGreaterThanOrEqual(2);
  });

  it('5 Explain one disadvantage of using a lossless compression method on a sound file. [1]', () => {
    const text = meaning('Lossless compression');
    expect(text).toMatch(/(larger|bigger) (file|than)/i);
    expect(text).toMatch(/storage|download|stream/i);
  });

  it('6 Explain what is meant by the sample rate of a sound file and how it affects the file size. [2]', () => {
    const text = meaning('Sample rate');
    expect(text).toMatch(/number of (times|samples).* (each|per|a) second/i);
    expect(text).toMatch(/higher .*(bigger|larger) file|more samples .*(bigger|larger)/i);
  });
});

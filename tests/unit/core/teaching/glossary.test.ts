import { describe, expect, it } from 'vitest';
import { GLOSSARY, searchGlossary } from '../../../../src/core/teaching/glossary.ts';

describe('Learn mode glossary', () => {
  it('is in alphabetical order, each word once, each with a meaning', () => {
    const terms = GLOSSARY.map((e) => e.term);
    expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b, 'en')));
    expect(new Set(terms.map((t) => t.toLowerCase())).size).toBe(terms.length);
    for (const e of GLOSSARY) expect(e.meaning.length, e.term).toBeGreaterThan(30);
  });

  it('has the key words of both coursebooks', () => {
    const terms = GLOSSARY.map((e) => e.term.toLowerCase());
    for (const word of [
      'aspect ratio',
      'bit rate',
      'caption',
      'codec',
      'container',
      'credits',
      'dc offset',
      'lossless compression',
      'lossy compression',
      'mono',
      'normalise',
      'overdubbing',
      'sample rate',
      'sample resolution',
      'stereo',
      'subtitles',
      'trimming',
    ])
      expect(terms, word).toContain(word);
  });

  it('finds words by their name or meaning, ignoring capitals', () => {
    expect(searchGlossary('')).toEqual(GLOSSARY);
    expect(searchGlossary('ASPECT').map((e) => e.term)).toContain('Aspect ratio');
    expect(searchGlossary('hearing').map((e) => e.term)).toContain('Caption');
    expect(searchGlossary('zzzz')).toEqual([]);
  });
});

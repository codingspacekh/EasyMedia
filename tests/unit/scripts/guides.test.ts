// M12: the student user guide and the teacher notes, shipped with the app as web pages.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guidePage, teacherNotes } from '../../../scripts/lib/guides.ts';
import { SYLLABUS } from '../../../src/core/teaching/syllabus.ts';

const root = join(import.meta.dirname, '../../..');

describe('teacher notes', () => {
  it('list every syllabus point with where it is done and the tools for it', () => {
    const notes = teacherNotes(SYLLABUS);
    for (const p of SYLLABUS) expect(notes).toContain(p.point);
    expect(notes).toMatch(
      /\| fading in and fading out \| Audio ▸ Effect ▸ Fade in \/ Fade out \| Fade in, Fade out \|/,
    );
    expect(notes).toMatch(/## 11\.1 Video editing[\s\S]*## 11\.2 Audio editing/);
  });

  it('docs/guide/teacher-notes.md is up to date (npm run guides)', () => {
    expect(readFileSync(join(root, 'docs/guide/teacher-notes.md'), 'utf8')).toBe(
      teacherNotes(SYLLABUS),
    );
  });
});

describe('guide pages', () => {
  it('are whole web pages that work offline and print well', () => {
    const html = guidePage('User guide', '# EasyMedia\n\nHello <world> & *you*.');
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<title>EasyMedia — User guide</title>');
    expect(html).toContain('<h1 id="easymedia">EasyMedia</h1>');
    expect(html).toContain('<em>you</em>');
    expect(html).not.toMatch(/<script|https?:\/\/(?!github\.com)/); // nothing loaded from the internet
    expect(html).toContain('@media print');
  });

  it('headings have ids, so the contents links jump to them', () => {
    const html = guidePage(
      'Guide',
      '[Go](#saving-and-moving-your-work)\n\n## Saving and moving your work',
    );
    expect(html).toContain('<h2 id="saving-and-moving-your-work">');
    expect(html).toContain('href="#saving-and-moving-your-work"');
  });
});

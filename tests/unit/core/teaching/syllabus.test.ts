// Teacher notes (M12): every point of the 9626 syllabus, Chapter 11, with where it is done in
// EasyMedia; every tool and effect sits under a real syllabus point.
import { describe, expect, it } from 'vitest';
import { AUDIO_EFFECTS, EFFECTS, TRANSITIONS } from '../../../../src/core/effects/registry.ts';
import { TOOLS } from '../../../../src/core/effects/help.ts';
import { SYLLABUS, toolsFor } from '../../../../src/core/teaching/syllabus.ts';

const all = [...EFFECTS, ...AUDIO_EFFECTS, ...TRANSITIONS, ...TOOLS];

describe('the syllabus and EasyMedia', () => {
  it('lists the syllabus points of 11.1 and 11.2 in the syllabus’s words, each with where to do it', () => {
    expect(SYLLABUS.filter((p) => p.section === '11.1').length).toBeGreaterThanOrEqual(30);
    expect(SYLLABUS.filter((p) => p.section === '11.2').length).toBeGreaterThanOrEqual(30);
    for (const p of SYLLABUS) expect(p.where.length, p.point).toBeGreaterThan(10);
    expect(SYLLABUS.map((p) => p.point)).toEqual(
      expect.arrayContaining([
        'setting an aspect ratio',
        'using scrolling credits with appropriate blank lines',
        'normalising an audio clip, including removing any DC offset',
        'saving in files v containers',
      ]),
    );
  });

  it('every tool and effect of the app is placed under a syllabus point', () => {
    for (const e of all)
      expect(toolsFor(SYLLABUS).has(e.syllabus), `${e.label}: ${e.syllabus}`).toBe(true);
  });

  it('each point knows its tools (for the teacher notes)', () => {
    const fades = SYLLABUS.find(
      (p) => p.point === 'fading in and fading out' && p.section === '11.2',
    )!;
    expect(fades.tools).toContain('11.2 fading in and out');
  });
});

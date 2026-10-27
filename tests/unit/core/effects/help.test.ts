import { describe, expect, it } from 'vitest';
import { TOOLS, WHY, toolById } from '../../../../src/core/effects/help.ts';

// T5 for the tools that are not registry effects (the effects are covered by registry.test.ts).
describe('"Why use this?" for every editing tool that is not an effect (T5)', () => {
  it.each(TOOLS.map((t) => [t.label, t] as const))(
    '%s has a syllabus point and a "why"',
    (_, t) => {
      expect(t.syllabus).toMatch(/^(11\.[12]|20\.1) /);
      expect(WHY[t.id].length).toBeGreaterThan(40);
    },
  );

  it('every "why" text belongs to a tool, once', () => {
    expect(TOOLS.map((t) => t.id).sort()).toEqual(Object.keys(WHY).sort());
  });

  it.each([
    'trim',
    'split',
    'remove',
    'duration',
    'speed',
    'clipSound',
    'separateSound',
    'title',
    'caption',
    'subtitle',
    'credits',
    'resizeCrop',
    'aspectRatio',
    'cutCopyPaste',
    'trimAudio',
    'addTrack',
    'moveTrack',
    'align',
    'mix',
    'mono',
    'removeTrack',
    'recording',
  ] as const)('has the tool %s', (id) => {
    expect(toolById(id).why).toBe(WHY[id]);
  });
});

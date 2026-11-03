// M16b / N17: "Why use this?" is shown as a short answer first, then its reasons as points, so it
// can be read at a glance. The words are the registry's (the exam's wording), only arranged.
import { describe, expect, it } from 'vitest';
import { WHY, explain } from '../../../../src/core/effects/help.ts';
import { AUDIO_EFFECTS, EFFECTS, TRANSITIONS } from '../../../../src/core/effects/registry.ts';

const ALL: [string, string][] = [
  ...Object.entries(WHY),
  ...[...EFFECTS, ...AUDIO_EFFECTS, ...TRANSITIONS].map((e) => [e.id, e.why] as [string, string]),
];
const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w !== 'so');

describe('explain (N17)', () => {
  it('splits sentences: the first is the answer, the rest are reasons', () => {
    expect(explain('Trimming removes footage. It makes the video shorter. It saves time.')).toEqual(
      {
        answer: 'Trimming removes footage.',
        reasons: ['It makes the video shorter.', 'It saves time.'],
      },
    );
  });

  it('a list after a colon becomes the reasons', () => {
    expect(
      explain('Sound gets a response: music sets the mood, and a voiceover explains what happens.'),
    ).toEqual({
      answer: 'Sound gets a response.',
      reasons: ['Music sets the mood, and a voiceover explains what happens.'],
    });
  });

  it('"…, so …" and "— for example …" become reasons of their own', () => {
    expect(explain('Trimming removes footage, so the video is shorter.')).toEqual({
      answer: 'Trimming removes footage.',
      reasons: ['So the video is shorter.'],
    });
    expect(explain('Removing a track takes away a sound — for example the old tracks.')).toEqual({
      answer: 'Removing a track takes away a sound.',
      reasons: ['For example the old tracks.'],
    });
  });

  it('every real text: a short answer, nothing lost, nothing added', () => {
    for (const [id, text] of ALL) {
      const { answer, reasons } = explain(text);
      expect(answer.length, id).toBeLessThanOrEqual(150);
      expect(answer, id).toMatch(/[.!?]$/);
      expect(words([answer, ...reasons].join(' ')), id).toEqual(words(text));
    }
    // Nearly every text has reasons to list.
    expect(ALL.filter(([, t]) => explain(t).reasons.length > 0).length).toBeGreaterThanOrEqual(
      ALL.length - 3,
    );
  });
});

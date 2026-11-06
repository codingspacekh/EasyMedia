// The 9626 papers name every file <name>_<centre number>_<candidate number>, e.g. Gas_ZZ999_9999
// (M/J/26 Task 3), TTTVideo_ZZ999_9999 (F/M/25). With the candidate's details set once, every
// Save and Export dialog suggests that name.
import { describe, expect, it } from 'vitest';
import { checkCandidate, examName, type Candidate } from '../../../src/core/exam-name.ts';

const me: Candidate = { centre: 'KH012', number: '0042', name: 'Sok Dara' };

describe('exam file names', () => {
  it('adds _centre_candidate to the name', () => {
    expect(examName('Gas', me)).toBe('Gas_KH012_0042');
    expect(examName('TTTVideo', me)).toBe('TTTVideo_KH012_0042');
  });

  it('leaves a name alone without details, or when it already ends with them', () => {
    expect(examName('Gas', null)).toBe('Gas');
    expect(examName('Gas_KH012_0042', me)).toBe('Gas_KH012_0042');
  });

  it('the papers’ example numbers (or another candidate’s) are replaced, not added to', () => {
    expect(examName('Gas_ZZ999_9999', me)).toBe('Gas_KH012_0042');
    expect(examName('Orbit_ab123_4567', me)).toBe('Orbit_KH012_0042');
  });

  it('accepts a centre number of two letters and three digits and a 4-digit candidate number', () => {
    expect(checkCandidate({ centre: ' kh012 ', number: '42', name: '  Sok Dara ' })).toEqual({
      candidate: { centre: 'KH012', number: '0042', name: 'Sok Dara' },
    });
    expect(checkCandidate({ centre: 'ZZ999', number: '9999', name: '' })).toEqual({
      candidate: { centre: 'ZZ999', number: '9999', name: '' },
    });
  });

  it('refuses other numbers, saying what they look like', () => {
    expect(checkCandidate({ centre: 'K012', number: '0042', name: '' })).toEqual({
      field: 'centre',
      error: 'A centre number is two letters and three digits, for example ZZ999.',
    });
    expect(checkCandidate({ centre: 'KH012', number: '12345', name: '' })).toEqual({
      field: 'number',
      error: 'A candidate number has four digits, for example 9999.',
    });
    expect(checkCandidate({ centre: 'KH012', number: '00a1', name: '' })).toMatchObject({
      field: 'number',
    });
    expect(checkCandidate({ centre: 'KH012', number: '1', name: 'x'.repeat(81) })).toEqual({
      field: 'name',
      error: 'Please keep the name to 80 letters or fewer.',
    });
  });
});

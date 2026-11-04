// The 9626 papers name every file <name>_<centre number>_<candidate number>, for example
// Gas_ZZ999_9999 (M/J/26), TTTVideo_ZZ999_9999 (F/M/25). With the candidate's details set once
// (File ▸ Candidate Details…), every Save and Export dialog suggests that name.

export interface Candidate {
  /** Two letters and three digits, upper case: KH012. */
  centre: string;
  /** Four digits: 0042. */
  number: string;
  /** For text such as "Video edited by: …" (F/M/25); may be empty. */
  name: string;
}

/** A name ending with any centre and candidate number (the papers' ZZ999_9999 too). */
const SUFFIX = /_[A-Za-z]{2}\d{3}_\d{4}$/;

export function examName(base: string, candidate: Candidate | null): string {
  if (!candidate) return base;
  return `${base.replace(SUFFIX, '')}_${candidate.centre}_${candidate.number}`;
}

const MAX_NAME = 80;

export function checkCandidate(input: {
  centre: string;
  number: string;
  name: string;
}): { candidate: Candidate } | { field: keyof Candidate; error: string } {
  const centre = input.centre.trim().toUpperCase();
  if (!/^[A-Z]{2}\d{3}$/.test(centre))
    return {
      field: 'centre',
      error: 'A centre number is two letters and three digits, for example ZZ999.',
    };
  const typed = input.number.trim();
  if (!/^\d{1,4}$/.test(typed))
    return { field: 'number', error: 'A candidate number has four digits, for example 9999.' };
  const name = input.name.trim();
  if (name.length > MAX_NAME)
    return { field: 'name', error: `Please keep the name to ${MAX_NAME} letters or fewer.` };
  return { candidate: { centre, number: typed.padStart(4, '0'), name } };
}

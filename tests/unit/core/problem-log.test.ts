// Help ▸ Report a Problem…: OneEditor notes errors, failed jobs and the menu commands used in a
// small log (one JSON line each, the last 300 kept), and turns it into a text file the student
// gives the teacher: the version, the computer and the last things that happened.
import { describe, expect, it } from 'vitest';
import {
  LOG_KEEP,
  logLine,
  parseLog,
  problemReport,
  trimLog,
  type LogEntry,
} from '../../../src/core/problem-log.ts';

const at = (s: number) => new Date(Date.UTC(2026, 10, 5, 7, 0, s)).toISOString();

describe('the problem log', () => {
  it('one JSON line per entry; long texts are cut; lines that are not entries are skipped', () => {
    const line = logLine({ at: at(1), kind: 'error', where: 'page', text: 'x'.repeat(5000) });
    expect(line.endsWith('\n')).toBe(true);
    const [entry] = parseLog(`${line}not json\n{"at":1}\n`);
    expect(entry).toMatchObject({ kind: 'error', where: 'page' });
    expect(entry!.text.length).toBeLessThanOrEqual(2000);
    expect(parseLog('')).toEqual([]);
  });

  it(`keeps the last ${LOG_KEEP} entries`, () => {
    const text = Array.from({ length: LOG_KEEP + 50 }, (_, i) =>
      logLine({ at: at(0), kind: 'action', where: 'menu', text: `step ${i}` }),
    ).join('');
    const kept = parseLog(trimLog(text));
    expect(kept).toHaveLength(LOG_KEEP);
    expect(kept[0]!.text).toBe('step 50');
  });
});

describe('the report', () => {
  const entries: LogEntry[] = [
    { at: at(1), kind: 'action', where: 'menu', text: 'export' },
    { at: at(9), kind: 'error', where: 'page', text: 'TypeError: frame is undefined' },
  ];
  const computer = {
    version: '1.5.0',
    installed: true,
    os: 'Windows_NT 10.0.22631',
    arch: 'x64',
    cpu: 'Intel(R) Core(TM) i3-1005G1',
    ramGB: 8,
  };

  it('has the version, the computer, a space to say what happened, then the entries, newest last', () => {
    const text = problemReport({ ...computer, entries, made: at(30), offset: 420 });
    expect(text).toMatch(/^OneEditor problem report\n/);
    expect(text).toContain('OneEditor 1.5.0 (installed)');
    expect(text).toContain('Windows_NT 10.0.22631, x64, Intel(R) Core(TM) i3-1005G1, 8 GB');
    expect(text).toContain('What were you doing when it went wrong?');
    // Times on the computer's clock (07:00 UTC is 14:00 in Cambodia).
    expect(text).toContain('Made 2026-11-05 14:00:30');
    expect(text).toContain('2026-11-05 14:00:01  menu    export');
    const menu = text.indexOf('menu    export');
    const error = text.indexOf('ERROR page    TypeError: frame is undefined');
    expect(menu).toBeGreaterThan(0);
    expect(error).toBeGreaterThan(menu);
  });

  it('says so when nothing was noted; from the source it says so too', () => {
    const text = problemReport({
      ...computer,
      installed: false,
      entries: [],
      made: at(0),
      offset: 0,
    });
    expect(text).toContain('OneEditor 1.5.0 (run from its source)');
    expect(text).toContain('Nothing was noted');
  });
});

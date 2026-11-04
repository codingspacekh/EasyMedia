// Help ▸ Report a Problem…: the log is a file in the app's data folder (so it outlives a crash),
// kept short; the report is saved where the student chooses (the Desktop by default) and shown.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LOG_KEEP, logLine, parseLog } from '../../../src/core/problem-log.ts';
import { createProblemLog, saveProblemReport } from '../../../src/main/problem-log.ts';

const COMPUTER = {
  version: '1.5.0',
  installed: true,
  os: 'Darwin 25.6.0',
  arch: 'x64',
  cpu: 'Intel i9',
  ramGB: 32,
};
const fixed = () => new Date(Date.UTC(2026, 10, 5, 7, 30, 0));

describe('the problem log file', () => {
  it('notes entries with the time; they are there after a restart', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'mve-log-')), 'problems.log');
    const log = createProblemLog(file, fixed);
    log.record('action', 'menu', 'export');
    log.record('error', 'page', 'TypeError: x');
    expect(createProblemLog(file, fixed).entries()).toEqual([
      { at: '2026-11-05T07:30:00.000Z', kind: 'action', where: 'menu', text: 'export' },
      { at: '2026-11-05T07:30:00.000Z', kind: 'error', where: 'page', text: 'TypeError: x' },
    ]);
  });

  it(`is cut back to the last ${LOG_KEEP} entries when it opens and when it grows`, () => {
    const file = join(mkdtempSync(join(tmpdir(), 'mve-log-')), 'problems.log');
    const line = (i: number) =>
      logLine({ at: fixed().toISOString(), kind: 'action', where: 'menu', text: `${i}` });
    writeFileSync(file, Array.from({ length: LOG_KEEP + 10 }, (_, i) => line(i)).join(''));
    const log = createProblemLog(file, fixed);
    expect(parseLog(readFileSync(file, 'utf8'))).toHaveLength(LOG_KEEP);
    for (let i = 0; i < LOG_KEEP + 1; i++) log.record('action', 'menu', 'more');
    expect(parseLog(readFileSync(file, 'utf8')).length).toBeLessThanOrEqual(2 * LOG_KEEP);
    expect(log.entries()).toHaveLength(LOG_KEEP);
  });

  it('a log that cannot be written or read never stops the app', () => {
    const log = createProblemLog('/no/such/folder/problems.log', fixed);
    expect(() => log.record('error', 'main', 'x')).not.toThrow();
    expect(log.entries()).toEqual([]);
  });
});

describe('saving the report', () => {
  it('asks where (a dated name), writes the report and shows it', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'mve-log-')), 'problems.log');
    const log = createProblemLog(file, fixed);
    log.record('error', 'request', 'media:render: Error: ffmpeg exited with code 1');
    const choose = vi.fn(async (name: string) => `/Desktop/${name}`);
    const write = vi.fn(async () => {});
    const show = vi.fn();
    expect(
      await saveProblemReport({
        log,
        computer: COMPUTER,
        now: fixed,
        offset: 0,
        choose,
        write,
        show,
      }),
    ).toBe('/Desktop/OneEditor problem report 2026-11-05.txt');
    expect(choose).toHaveBeenCalledWith('OneEditor problem report 2026-11-05.txt');
    const [path, text] = write.mock.calls[0] as unknown as [string, string];
    expect(path).toBe('/Desktop/OneEditor problem report 2026-11-05.txt');
    expect(text).toContain('OneEditor 1.5.0 (installed)');
    expect(text).toContain('ERROR request media:render: Error: ffmpeg exited with code 1');
    expect(show).toHaveBeenCalledWith('/Desktop/OneEditor problem report 2026-11-05.txt');
  });

  it('closed without a place: nothing is written', async () => {
    const write = vi.fn(async () => {});
    const log = createProblemLog('/no/such/problems.log', fixed);
    const saved = await saveProblemReport({
      log,
      computer: COMPUTER,
      now: fixed,
      offset: 0,
      choose: async () => null,
      write,
      show: () => {},
    });
    expect(saved).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
});

// Help ▸ Report a Problem…: OneEditor notes errors, failed jobs and the menu commands used in a
// small log (one JSON line each, in the app's data folder, so it outlives a crash; the last
// LOG_KEEP kept), and turns it into a text file the student gives the teacher.

export interface LogEntry {
  /** ISO time. */
  at: string;
  /** An error, or something the student did (a menu command). */
  kind: 'error' | 'action';
  /** Where: the page, the main process, a request from the page, a job (FFmpeg), the menu. */
  where: 'page' | 'main' | 'request' | 'job' | 'menu';
  text: string;
}

export const LOG_KEEP = 300;
const MAX_TEXT = 2000;

export function logLine(entry: LogEntry): string {
  return `${JSON.stringify({ ...entry, text: entry.text.slice(0, MAX_TEXT) })}\n`;
}

export function parseLog(text: string): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const line of text.split('\n')) {
    try {
      const e = JSON.parse(line) as Partial<LogEntry>;
      if (typeof e.at === 'string' && typeof e.text === 'string' && e.kind && e.where)
        entries.push(e as LogEntry);
    } catch {
      // Not an entry (a line cut short by a crash): skipped.
    }
  }
  return entries;
}

/** The log with only its last LOG_KEEP entries. */
export function trimLog(text: string): string {
  return parseLog(text).slice(-LOG_KEEP).map(logLine).join('');
}

/** The time on the computer's clock: `offset` minutes ahead of UTC (+420 in Cambodia). */
const time = (iso: string, offset: number) =>
  new Date(Date.parse(iso) + offset * 60_000).toISOString().replace('T', ' ').slice(0, 19);

export function problemReport(r: {
  version: string;
  installed: boolean;
  os: string;
  arch: string;
  cpu: string;
  ramGB: number;
  entries: readonly LogEntry[];
  made: string;
  /** Minutes the computer's clock is ahead of UTC. */
  offset: number;
}): string {
  const lines = r.entries.map(
    (e) =>
      `${time(e.at, r.offset)}  ${e.kind === 'error' ? 'ERROR ' : ''}${e.where.padEnd(7)} ${e.text}`,
  );
  return [
    'OneEditor problem report',
    `Made ${time(r.made, r.offset)} (the computer's time)`,
    '',
    `OneEditor ${r.version} (${r.installed ? 'installed' : 'run from its source'})`,
    `${r.os}, ${r.arch}, ${r.cpu}, ${r.ramGB} GB`,
    '',
    'What were you doing when it went wrong? Write it here:',
    '',
    '',
    '',
    'The last things OneEditor noted (oldest first; file names may appear):',
    ...(lines.length ? lines : ['Nothing was noted.']),
    '',
  ].join('\n');
}

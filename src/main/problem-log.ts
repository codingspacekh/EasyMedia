// Help ▸ Report a Problem…: the problem log is a file in the app's data folder (so it outlives a
// crash), cut back to its last entries when it opens and when it grows; the report
// (core/problem-log.ts) is saved where the student chooses and shown in Finder / Explorer.
// Writing or reading the log never stops the app.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import {
  LOG_KEEP,
  logLine,
  parseLog,
  problemReport,
  trimLog,
  type LogEntry,
} from '../core/problem-log.ts';

export type ProblemLog = ReturnType<typeof createProblemLog>;

export function createProblemLog(file: string, now: () => Date = () => new Date()) {
  const read = () => {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  };
  const trim = () => {
    try {
      writeFileSync(file, trimLog(read()));
    } catch {
      // A log that cannot be written is not worth a word to the student.
    }
  };
  let count = parseLog(read()).length;
  if (count > LOG_KEEP) {
    trim();
    count = LOG_KEEP;
  }
  return {
    record(kind: LogEntry['kind'], where: LogEntry['where'], text: string): void {
      try {
        appendFileSync(file, logLine({ at: now().toISOString(), kind, where, text }));
      } catch {
        return;
      }
      if (++count > 2 * LOG_KEEP) {
        trim();
        count = LOG_KEEP;
      }
    },
    entries: (): LogEntry[] => parseLog(read()).slice(-LOG_KEEP),
  };
}

export async function saveProblemReport(d: {
  log: Pick<ProblemLog, 'entries'>;
  computer: {
    version: string;
    installed: boolean;
    os: string;
    arch: string;
    cpu: string;
    ramGB: number;
  };
  now: () => Date;
  /** Minutes the computer's clock is ahead of UTC. */
  offset: number;
  /** The save box, with the suggested name; null when closed. */
  choose: (name: string) => Promise<string | null>;
  write: (path: string, text: string) => Promise<void>;
  /** Shows the file in Finder / Explorer. */
  show: (path: string) => void;
}): Promise<string | null> {
  const made = d.now().toISOString();
  const day = new Date(Date.parse(made) + d.offset * 60_000).toISOString().slice(0, 10);
  const path = await d.choose(`OneEditor problem report ${day}.txt`);
  if (!path) return null;
  await d.write(
    path,
    problemReport({ ...d.computer, entries: d.log.entries(), made, offset: d.offset }),
  );
  d.show(path);
  return path;
}

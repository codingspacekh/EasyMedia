// Help ▸ Report a Problem…: an error the student could not have caused (not a refused edit, a
// missing file or a damaged project, which are explained) is shown as "Something went wrong", and
// what really happened is passed to whoever listens: ui/main.ts sends it to the main process's
// problem log. One listener at a time; none in tests unless a test listens.

export const UNEXPECTED = 'Something went wrong. Please try again.';

/** How much of a stack is kept: enough to find the place, short enough to read. */
const STACK_LINES = 6;

let listener: ((text: string) => void) | null = null;
/** An error shown twice (a status and a message) is logged once. */
const logged = new WeakSet<object>();

export function onUnexpected(listen: (text: string) => void): () => void {
  listener = listen;
  return () => {
    if (listener === listen) listener = null;
  };
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const head = `${error.name}: ${error.message}`;
  const stack = (error.stack ?? '').split('\n').filter((l) => /^\s+at /.test(l));
  return [head, ...stack.slice(0, STACK_LINES).map((l) => `    ${l.trim()}`)].join('\n');
}

/** The message to show for an unexpected error; the error itself goes to the problem log. */
export function unexpected(error: unknown): string {
  try {
    if (typeof error === 'object' && error !== null) {
      if (logged.has(error)) return UNEXPECTED;
      logged.add(error);
    }
    listener?.(describe(error));
  } catch {
    // Logging must never hide the message.
  }
  return UNEXPECTED;
}

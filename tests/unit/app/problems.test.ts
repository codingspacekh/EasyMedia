// Help ▸ Report a Problem…: an error the student could not have caused is shown as "Something went
// wrong", and what really happened goes to the problem log (ui/main.ts sends it to the main
// process). A known problem (a missing file, a refused edit) is explained and not logged.
import { afterEach, describe, expect, it } from 'vitest';
import { onUnexpected, unexpected, UNEXPECTED } from '../../../src/app/problems.ts';
import { testApp } from '../../helpers/test-app.ts';

let stop = () => {};
afterEach(() => stop());

function listen() {
  const seen: string[] = [];
  stop = onUnexpected((text) => seen.push(text));
  return seen;
}

describe('unexpected errors', () => {
  it('give the plain message, and their name, message and first lines of stack to the log', () => {
    const seen = listen();
    const error = new TypeError('frame is undefined');
    expect(unexpected(error)).toBe(UNEXPECTED);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/^TypeError: frame is undefined\n {4}at /);
    expect(seen[0]!.split('\n').length).toBeLessThanOrEqual(7);
    expect(unexpected('a string thrown')).toBe(UNEXPECTED);
    expect(seen[1]).toBe('a string thrown');
  });

  it('with nobody listening, the message is still given', () => {
    expect(unexpected(new Error('x'))).toBe(UNEXPECTED);
  });

  it('an animation export that fails for no reason the student can fix is logged', async () => {
    const seen = listen();
    const t = testApp();
    t.dialogs.exportAnimation.mockResolvedValueOnce('/out/Gas.png');
    t.stageRenderer.renderPng.mockRejectedValueOnce(new Error('GPU process lost'));
    await t.app.animation.exportAnimation('png');
    expect(t.app.animation.store.get().message).toEqual({ kind: 'error', text: UNEXPECTED });
    expect(seen[0]).toMatch(/^Error: GPU process lost/);
  });

  it('a known problem is explained to the student and not logged', async () => {
    const seen = listen();
    const t = testApp();
    t.dialogs.openMedia.mockResolvedValueOnce(['/m/gone.mp4']);
    await t.app.importMedia();
    expect(seen).toEqual([]);
  });
});

// P7: the window does not close (nor the app quit) with unsaved work until the page agrees.
import { describe, expect, it, vi } from 'vitest';
import { createCloseGuard } from '../../../src/main/close-guard.ts';

function fakeWindow() {
  let onClose: ((e: { preventDefault(): void }) => void) | null = null;
  const win = {
    crashed: false,
    on: (_event: 'close', listener: (e: { preventDefault(): void }) => void) =>
      void (onClose = listener),
    close: vi.fn(() => tryClose()),
    isCrashed: () => win.crashed,
  };
  /** The student clicks the close button: true when the window really closes. */
  function tryClose(): boolean {
    let prevented = false;
    onClose!({ preventDefault: () => (prevented = true) });
    return !prevented;
  }
  return { win, tryClose };
}

describe('P7 close guard', () => {
  it('stops the close and asks the page; closes when the page says yes', () => {
    const { win, tryClose } = fakeWindow();
    const ask = vi.fn();
    const quit = vi.fn();
    const guard = createCloseGuard(win, { ask, quit });
    expect(tryClose()).toBe(false);
    expect(ask).toHaveBeenCalledTimes(1);
    guard.answer(true);
    expect(win.close).toHaveBeenCalled();
    expect(quit).not.toHaveBeenCalled();
  });

  it('asks only once while the question is showing; "no" keeps the window, and asks again next time', () => {
    const { win, tryClose } = fakeWindow();
    const ask = vi.fn();
    const guard = createCloseGuard(win, { ask, quit: vi.fn() });
    tryClose();
    tryClose();
    expect(ask).toHaveBeenCalledTimes(1);
    guard.answer(false);
    expect(win.close).not.toHaveBeenCalled();
    tryClose();
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('Quit (Cmd+Q, File ▸ Exit) quits once the page agrees; "no" cancels the quit', () => {
    const { win, tryClose } = fakeWindow();
    const quit = vi.fn();
    const guard = createCloseGuard(win, { ask: vi.fn(), quit });
    guard.quitting();
    tryClose();
    guard.answer(false);
    expect(quit).not.toHaveBeenCalled();
    guard.quitting();
    tryClose();
    guard.answer(true);
    expect(quit).toHaveBeenCalled();
  });

  it('a page that has crashed cannot answer: the window closes', () => {
    const { win, tryClose } = fakeWindow();
    win.crashed = true;
    const ask = vi.fn();
    createCloseGuard(win, { ask, quit: vi.fn() });
    expect(tryClose()).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });
});

// P7: closing the window or quitting with unsaved work. The window's close is stopped and the
// page is asked (it shows Save / Don't save / Cancel); only its "yes" closes the window, and
// quits the app if the close came from Quit. A page that has crashed cannot answer, so it closes.

export interface GuardedWindow {
  on(event: 'close', listener: (event: { preventDefault(): void }) => void): void;
  close(): void;
  isCrashed(): boolean;
}

export function createCloseGuard(
  win: GuardedWindow,
  { ask, quit }: { ask: () => void; quit: () => void },
) {
  let allowed = false;
  let asking = false;
  let quitRequested = false;

  win.on('close', (event) => {
    if (allowed || win.isCrashed()) return;
    event.preventDefault();
    if (asking) return;
    asking = true;
    ask();
  });

  return {
    /** Quit was chosen (before-quit): once the page agrees, the app quits, not just the window. */
    quitting(): void {
      quitRequested = true;
    },
    /** The page's answer: true = close (the work was saved or may be discarded). */
    answer(close: boolean): void {
      asking = false;
      if (!close) {
        quitRequested = false;
        return;
      }
      allowed = true;
      win.close();
      if (quitRequested) quit();
    },
  };
}

import { describe, expect, it, vi } from 'vitest';
import { sendToWindow } from '../../../src/main/send.ts';

const window = (destroyed: { window?: boolean; contents?: boolean } = {}) => {
  const send = vi.fn();
  return {
    send,
    win: {
      isDestroyed: () => destroyed.window ?? false,
      webContents: { isDestroyed: () => destroyed.contents ?? false, send },
    },
  };
};

describe('sending to the page from the main process', () => {
  it('sends to an open window', () => {
    const { win, send } = window();
    sendToWindow(win, 'job:event', { type: 'started', jobId: 'k', label: 'Export' });
    expect(send).toHaveBeenCalledWith('job:event', {
      type: 'started',
      jobId: 'k',
      label: 'Export',
    });
  });

  it('does nothing (and never throws) when the window is gone — a job finishing as the app quits', () => {
    for (const gone of [{ window: true }, { contents: true }]) {
      const { win, send } = window(gone);
      expect(() =>
        sendToWindow(win, 'job:event', { type: 'cancelled', jobId: 'k', label: 'x' }),
      ).not.toThrow();
      expect(send).not.toHaveBeenCalled();
    }
    expect(() =>
      sendToWindow(undefined, 'job:event', { type: 'cancelled', jobId: 'k', label: 'x' }),
    ).not.toThrow();
  });
});

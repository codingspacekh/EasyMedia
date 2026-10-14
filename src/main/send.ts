// Main → page events. A job can finish just as the window closes (the app is quitting); sending
// to a destroyed window throws, and an uncaught error in the main process shows an error dialog
// that stops the app from exiting. So a closed window simply gets nothing.
import type { Events } from '../preload/api.ts';

interface SendTarget {
  isDestroyed(): boolean;
  webContents: { isDestroyed(): boolean; send(channel: string, payload: unknown): void };
}

export function sendToWindow<E extends keyof Events>(
  win: SendTarget | undefined,
  event: E,
  payload: Events[E],
): void {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  win.webContents.send(event, payload);
}

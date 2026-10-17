// Preload (P2, ARCHITECTURE §2): the only bridge between the page and the main process.
// Runs sandboxed; the page sees exactly one object, window.mve, with a fixed set of channels.
import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type Events, type MveApi } from './api.ts';

const EVENTS: readonly (keyof Events)[] = ['job:event', 'menu:action', 'app:closeRequested'];

const api: MveApi = {
  platform: process.platform,
  invoke: (channel, ...args) =>
    CHANNELS.includes(channel)
      ? ipcRenderer.invoke(channel, ...args)
      : Promise.resolve({
          ok: false,
          error: { name: 'Error', message: `Unknown channel ${channel}` },
        }),
  on: (event, listener) => {
    if (!EVENTS.includes(event)) return () => {};
    const wrapped = (_e: unknown, payload: unknown) => listener(payload as never);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.removeListener(event, wrapped);
  },
};

contextBridge.exposeInMainWorld('mve', api);

// Connects the renderer-side adapter to the main-process IPC handlers in one process,
// so the whole chain can be tested without Electron.
import type { MediaEngine } from '../../src/core/ports.ts';
import { registerIpc, type MainServices } from '../../src/main/ipc.ts';
import { createAllowList } from '../../src/main/protocol/allowlist.ts';
import type { Events, MveApi } from '../../src/preload/api.ts';

export function inProcessBridge(engine: MediaEngine, overrides: Partial<MainServices> = {}) {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const allow = createAllowList();
  const files = new Map<string, string>();
  registerIpc({
    ipc: {
      handle: (channel, handler) =>
        void handlers.set(channel, (...args) => Promise.resolve(handler({}, ...args))),
    },
    send: (event, payload) => listeners.get(event)?.forEach((l) => l(payload)),
    engine,
    allow,
    paths: { proxies: '/cache/proxies', recovery: '/cache/recovery.mve' },
    dialogs: {
      openMedia: async () => [],
      openProject: async () => null,
      saveProject: async () => null,
      exportVideo: async () => null,
      confirm: async () => false,
      chooseFolder: async () => null,
    },
    files: {
      read: async (path) => {
        const text = files.get(path);
        if (text === undefined) throw new Error('ENOENT');
        return text;
      },
      write: async (path, text) => void files.set(path, text),
      remove: async (path) => void files.delete(path),
      copy: async () => {},
    },
    ...overrides,
  });
  const api: MveApi = {
    platform: 'test',
    invoke: (channel, ...args) => handlers.get(channel)!(...args) as never,
    on: (event, listener) => {
      const set = listeners.get(event) ?? new Set();
      listeners.set(event, set);
      set.add(listener as (p: unknown) => void);
      return () => set.delete(listener as (p: unknown) => void);
    },
  };
  return {
    api,
    handlers,
    allow,
    files,
    send: (event: keyof Events, payload: unknown) =>
      listeners.get(event)?.forEach((l) => l(payload)),
  };
}

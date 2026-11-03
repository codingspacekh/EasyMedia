// Connects the renderer-side adapter to the main-process IPC handlers in one process,
// so the whole chain can be tested without Electron.
import type { MediaEngine } from '../../src/core/ports.ts';
import { registerIpc, type MainServices } from '../../src/main/ipc.ts';
import { createAllowList } from '../../src/main/protocol/allowlist.ts';
import { createUpdates } from '../../src/main/updates.ts';
import { NO_UPDATE_PREFS } from '../../src/core/updates.ts';
import type { Events, MveApi } from '../../src/preload/api.ts';

let lastAllow = createAllowList();
/** The allow-list of the most recently made bridge. */
export const lastAllowList = () => lastAllow;

export function inProcessBridge(engine: MediaEngine, overrides: Partial<MainServices> = {}) {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const allow = createAllowList();
  lastAllow = allow;
  const files = new Map<string, string>();
  registerIpc({
    ipc: {
      handle: (channel, handler) =>
        void handlers.set(channel, (...args) => Promise.resolve(handler({}, ...args))),
    },
    send: (event, payload) => listeners.get(event)?.forEach((l) => l(payload)),
    engine,
    allow,
    paths: {
      proxies: '/cache/proxies',
      recovery: '/cache/recovery.mve',
      snapshots: '/cache/snapshots',
      learn: '/cache/learn',
      animationFrames: '/cache/frames',
    },
    dialogs: {
      openMedia: async () => [],
      openProject: async () => null,
      saveProject: async () => null,
      exportVideo: async () => null,
      exportAudio: async () => null,
      confirm: async () => false,
      chooseFolder: async () => null,
      unsavedChanges: async () => 'cancel',
      openTaskCheck: async () => null,
      saveTaskCheck: async () => null,
      openAnimation: async () => null,
      openPicture: async () => null,
      openFrames: async () => [],
      openExport: async () => [],
      saveAnimation: async () => null,
      exportAnimation: async () => null,
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
      saveImage: async (name) => `/cache/text/${name}.png`,
      writeBytes: async () => {},
    },
    microphoneAccess: async () => true,
    closeAnswer: () => {},
    pageFiles: {
      player: '/app/out/player.js',
      assets: '/app/dist/assets',
      read: async (path) => Promise.reject(new Error(`ENOENT ${path}`)),
      show: async () => {},
    },
    // M17a: as when run from the source: updates are off.
    updates: createUpdates({
      mode: 'off',
      current: '1.5.0',
      url: null,
      updater: () => {
        throw new Error('Updates are off.');
      },
      readPrefs: () => ({ ...NO_UPDATE_PREFS }),
      writePrefs: () => {},
      notesFor: () => [],
      send: (state) => listeners.get('updates:state')?.forEach((l) => l(state)),
      log: () => {},
      later: () => {},
      every: () => {},
      downloads: '/Downloads',
      arch: 'x64',
      fetchToFile: async () => {},
      showItem: () => {},
      openPath: async () => {},
      quit: () => {},
    }),
    ...overrides,
  });
  const api: MveApi = {
    platform: 'test',
    pathForFile: (file) => `/dropped/${file.name}`,
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

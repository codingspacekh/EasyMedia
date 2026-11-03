// M17a: a stand-in for the main process's updates (UpdatesPort), for app and UI tests.
import { vi } from 'vitest';
import type { UpdatesPort } from '../../src/core/ports.ts';
import type { UpdateState } from '../../src/core/updates.ts';

export const UPDATES_IDLE: UpdateState = {
  mode: 'auto',
  current: '1.5.0',
  status: 'idle',
  version: null,
  notes: [],
  percent: 0,
  checkedAt: null,
  error: null,
  autoDownload: false,
  updatedTo: null,
  updatedNotes: [],
  dmg: null,
};

export function fakeUpdates(initial: Partial<UpdateState> = {}) {
  let state: UpdateState = { ...UPDATES_IDLE, ...initial };
  const listeners = new Set<(s: UpdateState) => void>();
  /** What the main process would send when its state changes. */
  const push = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l(state));
  };
  const reply = async () => ({ ...state });
  const port = {
    get: vi.fn(reply),
    check: vi.fn(reply),
    download: vi.fn(reply),
    install: vi.fn(reply),
    setAuto: vi.fn(async (on: boolean) => {
      push({ autoDownload: on });
      return { ...state };
    }),
    seen: vi.fn(async () => {
      push({ updatedTo: null, updatedNotes: [] });
      return { ...state };
    }),
    showDmg: vi.fn(reply),
    openDmg: vi.fn(reply),
    onState: (listener: (s: UpdateState) => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  } satisfies UpdatesPort;
  return { port, push };
}

// M17a U1–U5: the page's side of updates. The main process looks, downloads and puts the update
// in (src/main/updates.ts); this keeps what it last said, for the note at the bottom of the window
// and Help ▸ Check for Updates…. With no port (tests, the browser) there are no updates.
import type { UpdatesPort } from '../core/ports.ts';
import type { UpdateState } from '../core/updates.ts';
import { createStore, type Store } from './store.ts';

export interface UpdatesView {
  /** What the main process last said; null until it has (or with no updates at all). */
  state: UpdateState | null;
  /** "Later" on a ready update: the note is hidden until something changes. */
  later: boolean;
  /** Help ▸ Check for Updates… is open. */
  dialog: boolean;
}

export function createAppUpdates(port?: UpdatesPort) {
  const store: Store<UpdatesView> = createStore<UpdatesView>({
    state: null,
    later: false,
    dialog: false,
  });
  const take = (state: UpdateState) =>
    store.update((v) => ({ ...v, state, later: v.later && v.state?.status === state.status }));
  if (port) {
    port.onState(take);
    void port.get().then(take);
  }
  const ask = async (request: (p: UpdatesPort) => Promise<UpdateState>) => {
    if (port) take(await request(port));
  };
  return {
    store,
    check: () => ask((p) => p.check()),
    download: () => ask((p) => p.download()),
    install: () => ask((p) => p.install()),
    setAuto: (on: boolean) => ask((p) => p.setAuto(on)),
    seen: () => ask((p) => p.seen()),
    showDmg: () => ask((p) => p.showDmg()),
    openDmg: () => ask((p) => p.openDmg()),
    /** Hides the "ready" note; the update still goes in when the app is next closed. */
    later: () => store.update((v) => ({ ...v, later: true })),
    openDialog: () => store.update((v) => ({ ...v, dialog: true })),
    closeDialog: () => store.update((v) => ({ ...v, dialog: false })),
  };
}

export type AppUpdates = ReturnType<typeof createAppUpdates>;

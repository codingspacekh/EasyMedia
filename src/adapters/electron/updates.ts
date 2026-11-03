// M17a U1–U5: the page's UpdatesPort over the preload bridge (window.mve).
import type { UpdatesPort } from '../../core/ports.ts';
import type { MveApi } from '../../preload/api.ts';
import { unwrap } from './media-engine.ts';

export function createElectronUpdates(api: MveApi): UpdatesPort {
  return {
    get: () => unwrap(api.invoke('updates:get')),
    check: () => unwrap(api.invoke('updates:check')),
    download: () => unwrap(api.invoke('updates:download')),
    install: () => unwrap(api.invoke('updates:install')),
    setAuto: (on) => unwrap(api.invoke('updates:auto', on)),
    seen: () => unwrap(api.invoke('updates:seen')),
    showDmg: () => unwrap(api.invoke('updates:showDmg')),
    openDmg: () => unwrap(api.invoke('updates:openDmg')),
    onState: (listener) => api.on('updates:state', listener),
  };
}

// M17a: the page's UpdatesPort reaches the main process's updates through the preload bridge.
import { describe, expect, it } from 'vitest';
import { createElectronUpdates } from '../../../src/adapters/electron/updates.ts';
import { createMockMediaEngine } from '../../../src/adapters/mock/media-engine.ts';
import type { UpdateState } from '../../../src/core/updates.ts';
import { inProcessBridge } from '../../helpers/ipc-bridge.ts';

describe('updates over the preload bridge', () => {
  it('every request answers with the state; a change is heard', async () => {
    const { api } = inProcessBridge(createMockMediaEngine({}));
    const updates = createElectronUpdates(api);
    const heard: UpdateState[] = [];
    const stop = updates.onState((s) => heard.push(s));
    for (const ask of [
      updates.get,
      updates.check,
      updates.download,
      updates.install,
      updates.seen,
      updates.showDmg,
      updates.openDmg,
    ])
      expect(await ask()).toMatchObject({ mode: 'off', current: '1.5.0' });
    expect(await updates.setAuto(true)).toMatchObject({ autoDownload: true });
    expect(heard.at(-1)).toMatchObject({ autoDownload: true });
    stop();
  });
});

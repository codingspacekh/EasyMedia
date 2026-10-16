// UndoStore with IndexedDB: Chromium keeps the samples of Audio mode's undo steps on disk
// (A18 + N4, as Audacity). The page writes them itself, so they never pass through the main
// process. Tested in the real app (tests/e2e/acceptance-m9.spec.ts).
import type { UndoStore } from '../../core/ports.ts';

const STEPS = 'steps';

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function createIndexedDbUndoStore(name = 'easymedia-undo'): UndoStore {
  let opened: Promise<IDBDatabase> | null = null;
  const db = () =>
    (opened ??= new Promise((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STEPS);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  const steps = async (mode: IDBTransactionMode) =>
    (await db()).transaction(STEPS, mode).objectStore(STEPS);
  let next = 0;

  return {
    async save(channels) {
      const key = `${Date.now().toString(36)}-${(next++).toString(36)}`;
      await request((await steps('readwrite')).put([...channels], key));
      return key;
    },
    async load(key) {
      const channels = (await request((await steps('readonly')).get(key))) as
        Float32Array[] | undefined;
      if (!channels) throw new Error(`Undo step ${key} is missing.`);
      return channels;
    },
    async keepOnly(keep) {
      const store = await steps('readwrite');
      const keys = (await request(store.getAllKeys())) as string[];
      await Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => request(store.delete(k))));
    },
  };
}

// Files the page may load through media://. Only paths the app imported or created are added.
import { resolve } from 'node:path';

export function createAllowList() {
  const allowed = new Set<string>();
  return {
    add: (path: string) => void allowed.add(resolve(path)),
    has: (path: string) => allowed.has(resolve(path)),
  };
}

export type AllowList = ReturnType<typeof createAllowList>;

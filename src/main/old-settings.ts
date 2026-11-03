// The app was called EasyMedia until v1.4. Electron names the settings folder after the app
// (preferences, recent projects, snapshots, proxies, the recovery file), so on the first start as
// OneEditor the old folder is moved to the new name. Run before anything opens that folder.
import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export const OLD_NAME = 'EasyMedia';
export const NAME = 'OneEditor';

/** True when the old folder was moved. Never throws: a failed move only means fresh settings. */
export function moveOldSettings(appData: string): boolean {
  const from = join(appData, OLD_NAME);
  const to = join(appData, NAME);
  try {
    if (!existsSync(from) || existsSync(to)) return false;
    renameSync(from, to);
    return true;
  } catch {
    return false;
  }
}

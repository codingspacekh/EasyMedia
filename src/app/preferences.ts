// The app's own settings, kept between sessions in preferences.json (the user's app-data folder):
// whether the Welcome was seen (X7) and the panel layout (N16). Each change is merged into what
// is saved, so one setting never wipes another; a missing or damaged file reads as empty.
import type { AppPaths, ProjectFiles } from '../core/ports.ts';

export type Preferences = Record<string, unknown>;

export function createPreferences(files: ProjectFiles, paths: AppPaths) {
  let cache: Preferences | null = null;

  async function read(): Promise<Preferences> {
    if (cache) return cache;
    if (!paths.preferences) return (cache = {});
    try {
      const parsed: unknown = JSON.parse(await files.read(paths.preferences));
      cache =
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? (parsed as Preferences)
          : {};
    } catch {
      cache = {};
    }
    return cache;
  }

  /** Merges the change into the saved preferences; failing to save is not an error. */
  async function update(change: Preferences): Promise<void> {
    const next = { ...(await read()), ...change };
    cache = next;
    if (!paths.preferences) return;
    await files.write(paths.preferences, `${JSON.stringify(next)}\n`).catch(() => {});
  }

  return { read, update };
}

export type PreferencesStore = ReturnType<typeof createPreferences>;

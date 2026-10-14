// P11: project files carry a schemaVersion. Older files are upgraded one version at a time.
import { ProjectFileError } from '../model/errors.ts';

export const CURRENT_SCHEMA = 1;

export type ProjectDocument = Record<string, unknown>;
/** Upgrades a document from version n (the key) to version n + 1. */
export type Migration = (old: ProjectDocument) => ProjectDocument;

/** Add an entry here whenever the project format changes, e.g. `1: (v1) => ({ ...v1, schemaVersion: 2 })`. */
export const MIGRATIONS: Record<number, Migration> = {};

export const DAMAGED = 'This file is not an EasyMedia project, or it is damaged.';

export function migrate(
  doc: ProjectDocument,
  migrations: Record<number, Migration> = MIGRATIONS,
  current: number = CURRENT_SCHEMA,
): ProjectDocument {
  const declared = doc.schemaVersion;
  if (typeof declared !== 'number' || !Number.isInteger(declared) || declared < 1) {
    throw new ProjectFileError(DAMAGED);
  }
  let version: number = declared;
  if (version > current) {
    throw new ProjectFileError(
      'This project was made with a newer version of EasyMedia. Please update the app to open it.',
    );
  }
  let upgraded = doc;
  while (version < current) {
    const step = migrations[version];
    if (!step)
      throw new ProjectFileError(
        `No upgrade step from project version ${version} to version ${version + 1}.`,
      );
    upgraded = step(upgraded);
    version = upgraded.schemaVersion as number;
  }
  return upgraded;
}

// Shared set-up for coursebook acceptance tests that render real files.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { createHistory, execute, type Command } from '../../src/app/history.ts';
import { assetFromProbe, createProject } from '../../src/core/model/factory.ts';
import type { MediaAsset, Project } from '../../src/core/model/types.ts';
import { createNodeMediaEngine } from '../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';

export const FRAME = 1 / 30;
export const engine = createNodeMediaEngine(bundledFfmpeg());

/** A temporary "project folder" holding the given fixture files under media/. */
export async function projectFolder(fixtureNames: string[]) {
  const dir = await mkdtemp(join(tmpdir(), 'mve-acceptance-'));
  const specs = selectFixtures(FIXTURES, 'test').filter((f) => fixtureNames.includes(f.name));
  await generateFixtures(bundledFfmpeg().ffmpeg, dir, specs);
  return {
    dir,
    file: (name: string) => join(dir, name),
    /** Imports a file the way the app will: probe it, store a project-relative path. */
    asset: async (name: string, id: string): Promise<MediaAsset> =>
      assetFromProbe(name, await engine.probe(join(dir, name)), { id }),
    cleanUp: () => rm(dir, { recursive: true, force: true }),
  };
}

/** Builds a project by running the same commands the app uses. */
export function build(name: string, steps: Command[]): Project {
  return steps.reduce(execute, createHistory(createProject({ name }))).present;
}

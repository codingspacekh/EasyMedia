// Generates synthetic test media into tests/fixtures/media/ (MILESTONES §3.2).
// Usage: npm run fixtures [-- --group spike] [-- --out some/dir]
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { binaryPaths, platformKey } from '../src/main/ffmpeg/paths.ts';
import { FIXTURES, generateFixtures, selectFixtures, type FixtureSpec } from './lib/fixtures.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const group = (option('--group') ?? 'test') as FixtureSpec['group'];
const outDir = option('--out') ?? join(root, 'tests', 'fixtures', 'media');

const { ffmpeg } = binaryPaths(
  join(root, 'resources'),
  platformKey(process.platform, process.arch),
);
const specs = selectFixtures(FIXTURES, group);
await mkdir(outDir, { recursive: true });
console.log(`Generating ${specs.length} "${group}" fixtures in ${outDir}`);
await generateFixtures(ffmpeg, outDir, specs);
console.log(specs.map((s) => `  ✓ ${s.name}`).join('\n'));

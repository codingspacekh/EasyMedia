// Renders a saved project to MP4 without the UI (M3).
// Usage: npm run render -- <project.mve> <output.mp4> [--quality high|medium|low] [--hardware]
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deserializeProject } from '../src/core/project/serialize.ts';
import type { Quality } from '../src/core/render/compile.ts';
import { detectHardwareEncoder, encoderTester, videoEncoder } from '../src/main/ffmpeg/hardware.ts';
import { binaryPaths, platformKey } from '../src/main/ffmpeg/paths.ts';
import { createNodeMediaEngine } from '../src/main/media/engine.ts';

const USAGE =
  'Usage: npm run render -- <project.mve> <output.mp4> [--quality high|medium|low] [--hardware]';
const root = fileURLToPath(new URL('..', import.meta.url));

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
let quality = 'high';
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--quality') quality = args[++i] ?? '';
  else if (!args[i]!.startsWith('--')) positional.push(args[i]!);
}
const [projectFile, output] = positional;
if (!projectFile || !output) fail(USAGE);
if (!['high', 'medium', 'low'].includes(quality)) fail('Quality must be high, medium or low.');

try {
  const project = deserializeProject(await readFile(projectFile, 'utf8'));
  const binaries = binaryPaths(
    join(root, 'resources'),
    platformKey(process.platform, process.arch),
  );
  const hardware = args.includes('--hardware')
    ? await detectHardwareEncoder(process.platform, encoderTester(binaries.ffmpeg))
    : null;
  const engine = createNodeMediaEngine(binaries, { videoEncoder: videoEncoder(hardware) });
  engine.onJobEvent((e) => {
    if (e.type === 'progress') process.stdout.write(`\rExporting… ${Math.round(e.ratio * 100)} %`);
  });
  const target = resolve(output);
  await engine.renderVideo(project, target, {
    projectDir: dirname(resolve(projectFile)),
    quality: quality as Quality,
  }).done;
  console.log(`\nExported ${target} (${videoEncoder(hardware)}, ${quality} quality)`);
} catch (error) {
  fail(`\n${(error as Error).message}`);
}

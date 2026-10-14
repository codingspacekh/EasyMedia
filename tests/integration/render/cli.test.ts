import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES, generateFixtures, selectFixtures } from '../../../scripts/lib/fixtures.ts';
import { assetFromProbe, createProject, createVideoClip } from '../../../src/core/model/factory.ts';
import { trimVideo } from '../../../src/core/model/timeline.ts';
import { serializeProject } from '../../../src/core/project/serialize.ts';
import { createNodeMediaEngine } from '../../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../helpers/ffmpeg.ts';
import { measure } from '../helpers/measure.ts';

const cli = fileURLToPath(new URL('../../../scripts/render.ts', import.meta.url));
let dir: string;

function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) =>
    execFile(process.execPath, [cli, ...args], (error, stdout, stderr) =>
      resolve({ code: error ? ((error as { code?: number }).code ?? 1) : 0, stdout, stderr }),
    ),
  );
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-cli-'));
  await mkdir(join(dir, 'media'));
  const spec = selectFixtures(FIXTURES, 'test').filter((f) => f.name === 'clip_1080p30_10s.mp4');
  await generateFixtures(bundledFfmpeg().ffmpeg, join(dir, 'media'), spec);
  const info = await createNodeMediaEngine(bundledFfmpeg()).probe(
    join(dir, 'media', 'clip_1080p30_10s.mp4'),
  );
  const asset = assetFromProbe('media/clip_1080p30_10s.mp4', info, { id: 'clip' }); // relative path (X1)
  const p = createProject({ name: 'CLI' });
  const project = {
    ...p,
    media: [asset],
    timeline: {
      ...p.timeline,
      main: [trimVideo(createVideoClip(asset), { in: 2, out: 4 }, asset)],
    },
  };
  await writeFile(join(dir, 'task.mve'), serializeProject(project));
  await writeFile(join(dir, 'empty.mve'), serializeProject(createProject({ name: 'Empty' })));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('mve-render command line (M3)', () => {
  it('renders a saved project, finding media relative to the project file', async () => {
    const { code, stdout } = await runCli([join(dir, 'task.mve'), join(dir, 'out.mp4')]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/Exported .*out\.mp4/);
    const m = await measure(join(dir, 'out.mp4'));
    expect([m.width, m.height]).toEqual([1920, 1080]);
    expect(m.videoDuration).toBeCloseTo(2, 1);
  });

  it('explains how to use it when arguments are missing', async () => {
    const { code, stderr } = await runCli([]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/usage: npm run render -- <project\.mve> <output\.mp4>/i);
  });

  it('shows the student-friendly reason when a project cannot be exported', async () => {
    const { code, stderr } = await runCli([join(dir, 'empty.mve'), join(dir, 'empty.mp4')]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/add a clip/i);
  });

  it('rejects an unknown quality', async () => {
    const { code, stderr } = await runCli([
      join(dir, 'task.mve'),
      join(dir, 'q.mp4'),
      '--quality',
      'ultra',
    ]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/high, medium or low/i);
  });
});

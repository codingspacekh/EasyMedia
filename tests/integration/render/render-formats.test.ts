// V16, V17 with the bundled FFmpeg: every container and compression exports, probes with the
// expected codecs, and lossy files come out close to their estimated size.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../../scripts/lib/fixtures.ts';
import { assetFromProbe, createProject, createVideoClip } from '../../../src/core/model/factory.ts';
import type { Project } from '../../../src/core/model/types.ts';
import {
  defaultExport,
  estimateSize,
  presetSettings,
  type ExportSettings,
} from '../../../src/core/render/formats.ts';
import { createNodeMediaEngine } from '../../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../helpers/ffmpeg.ts';
import { measure } from '../helpers/measure.ts';

const engine = createNodeMediaEngine(bundledFfmpeg());
const CLIP = 'clip_1080p30_10s.mp4'; // moving test pattern with a tone: like real footage, never still
let dir: string;
let project: Project;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-formats-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => f.name === CLIP),
  );
  const asset = assetFromProbe(CLIP, await engine.probe(join(dir, CLIP)), { id: 'c' });
  const p = createProject({ name: 'Formats' });
  project = { ...p, media: [asset], timeline: { ...p.timeline, main: [createVideoClip(asset)] } };
});
afterAll(() => rm(dir, { recursive: true, force: true }));

async function exportAs(format: ExportSettings, name: string) {
  const file = join(dir, `${name}.${format.container}`);
  await engine.renderVideo(project, file, { projectDir: dir, format }).done;
  return { file, info: await engine.probe(file) };
}

describe('V16 every container exports with the expected codecs', () => {
  it.each([
    ['mp4', 'lossy', 'h264', 'aac'],
    ['mov', 'lossy', 'h264', 'aac'],
    ['mov', 'lossless', 'png', 'pcm_s16le'],
    ['avi', 'lossy', 'mpeg4', 'mp3'],
    ['avi', 'lossless', 'ffv1', 'pcm_s16le'],
    ['wmv', 'lossy', 'wmv2', 'wmav2'],
    ['mpg', 'lossy', 'mpeg2video', 'ac3'],
  ] as const)('%s %s → %s + %s, full length', async (container, compression, video, audio) => {
    const format = {
      ...defaultExport(project.settings),
      container,
      compression,
      width: 640,
      height: 360,
    };
    const { file, info } = await exportAs(format, `${container}-${compression}`);
    expect(info).toMatchObject({
      container,
      video: { codec: video, width: 640, height: 360 },
      audio: { codec: audio },
    });
    expect(Math.abs((await measure(file)).videoDuration - 10)).toBeLessThan(0.1);
  });

  it('DVD (PAL): 720 × 576 at 25 fps, shown as 16:9', async () => {
    const { info } = await exportAs(presetSettings('dvd-pal', project.settings), 'dvd');
    expect(info.video).toMatchObject({ codec: 'mpeg2video', width: 720, height: 576, fps: 25 });
  });
});

describe('V17 estimated file size', () => {
  it.each([
    ['youtube', {}],
    ['mobile-medium', {}],
    ['mobile-small', {}],
    ['dvd-pal', {}],
    ['custom', { container: 'avi' }],
    ['custom', { container: 'wmv', quality: 'medium' }],
  ] as const)('%s %o: the real size is within ± 25 % of the estimate', async (preset, change) => {
    const format = { ...presetSettings(preset, project.settings), ...change };
    const { info } = await exportAs(format, `size-${preset}-${format.container}`);
    const estimate = estimateSize(format, 10, true);
    expect(estimate.upTo).toBe(false);
    expect(info.sizeBytes / estimate.bytes).toBeGreaterThan(0.75);
    expect(info.sizeBytes / estimate.bytes).toBeLessThan(1.25);
  });

  it('a lossless file stays under its "up to" estimate', async () => {
    const format: ExportSettings = {
      ...defaultExport(project.settings),
      container: 'avi',
      compression: 'lossless',
    };
    const { info } = await exportAs(format, 'size-lossless');
    expect(info.sizeBytes).toBeLessThan(estimateSize(format, 10, true).bytes);
  });
});

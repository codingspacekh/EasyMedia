// Book B (video_audio_editing.pdf) Tasks 11b and 11c, rendered to real files (M3 exit gate).
// Lake_Naivasha.mp4 is stood in for by a 20 s 1080p fixture whose brightness rises with time,
// so we can check which moment of the source each exported frame comes from.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addMainItem,
  importMedia,
  setClipMuted,
  setClipSpeed,
  trimClip,
} from '../../src/app/commands.ts';
import { createVideoClip } from '../../src/core/model/factory.ts';
import type { MediaAsset } from '../../src/core/model/types.ts';
import { brightness, measure } from '../integration/helpers/measure.ts';
import { build, engine, FRAME, projectFolder } from './helpers.ts';

let folder: Awaited<ReturnType<typeof projectFolder>>;
let lake: MediaAsset;
const SOURCE = 'lake_1080p30_20s.mp4';

beforeAll(async () => {
  folder = await projectFolder([SOURCE]);
  lake = await folder.asset(SOURCE, 'lake');
});
afterAll(() => folder.cleanUp());

describe('Book B Task 11b: trim to start after 8 s and last 4.5 s, remove all sound', () => {
  let out: string;
  beforeAll(async () => {
    const project = build('Naivasha2', [
      importMedia(lake),
      addMainItem(createVideoClip(lake, { id: 'clip' })),
      trimClip('clip', { in: 8, out: 12.5 }),
      setClipMuted('clip', true),
    ]);
    out = folder.file('Naivasha2.mp4');
    await engine.renderVideo(project, out, { projectDir: folder.dir }).done;
  });

  it('is 1920 × 1080 and 4.5 s long (± 1 frame)', async () => {
    const m = await measure(out);
    expect([m.width, m.height]).toEqual([1920, 1080]);
    expect(Math.abs(m.videoDuration - 4.5)).toBeLessThanOrEqual(FRAME + 0.001);
  });

  it('has no sound at all (no audio stream)', async () => {
    expect((await measure(out)).audioDuration).toBeUndefined();
  });

  it('starts at the 8 s point of the source and ends at 12.5 s', async () => {
    const src = folder.file(SOURCE);
    expect(Math.abs((await brightness(out, 0.1)) - (await brightness(src, 8.1)))).toBeLessThan(2);
    expect(Math.abs((await brightness(out, 4.4)) - (await brightness(src, 12.4)))).toBeLessThan(2);
  });
});

describe('Book B Task 11c: first 6.3 s only, no sound, 1.5× speed', () => {
  let out: string;
  beforeAll(async () => {
    const project = build('Naivasha1', [
      importMedia(lake),
      addMainItem(createVideoClip(lake, { id: 'clip' })),
      trimClip('clip', { in: 0, out: 6.3 }),
      setClipMuted('clip', true),
      setClipSpeed('clip', 1.5),
    ]);
    out = folder.file('Naivasha1.mp4');
    await engine.renderVideo(project, out, { projectDir: folder.dir }).done;
  });

  it('is 1920 × 1080 and 6.3 ÷ 1.5 = 4.2 s long (± 1 frame), with no sound', async () => {
    const m = await measure(out);
    expect([m.width, m.height]).toEqual([1920, 1080]);
    expect(Math.abs(m.videoDuration - 4.2)).toBeLessThanOrEqual(FRAME + 0.001);
    expect(m.audioDuration).toBeUndefined();
  });

  it('plays 1.5× faster: 2 s into the export shows the 3 s point of the source', async () => {
    const src = folder.file(SOURCE);
    expect(Math.abs((await brightness(out, 2)) - (await brightness(src, 3)))).toBeLessThan(2);
    expect(Math.abs((await brightness(out, 4)) - (await brightness(src, 6)))).toBeLessThan(2);
  });
});

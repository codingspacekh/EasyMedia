// Book A (sound_video_editing.pdf) Activities 11.04 and 11.08, rendered (M3 exit gate).
// BeeFly.mov is stood in for by a 10 s 1080p clip; BeeFlySlow.mov by a 5 s 640×480 (4:3) MOV.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMainItem, importMedia, setClipSpeed, trimClip } from '../../src/app/commands.ts';
import { createVideoClip } from '../../src/core/model/factory.ts';
import { measure, tinyFrame } from '../integration/helpers/measure.ts';
import { build, engine, FRAME, projectFolder } from './helpers.ts';

let folder: Awaited<ReturnType<typeof projectFolder>>;
beforeAll(async () => {
  folder = await projectFolder(['clip_1080p30_10s.mp4', 'clip_4x3_640x480.mov']);
});
afterAll(() => folder.cleanUp());

describe('Book A Activity 11.04: trim the end of BeeFly to make it 5 s long', () => {
  it('is 5 s long (± 1 frame), 1920 × 1080, and keeps its sound', async () => {
    const beeFly = await folder.asset('clip_1080p30_10s.mp4', 'beefly');
    const project = build('BeeProject', [
      importMedia(beeFly),
      addMainItem(createVideoClip(beeFly, { id: 'clip' })),
      trimClip('clip', { in: 0, out: 5 }),
    ]);
    const out = folder.file('11.04.mp4');
    await engine.renderVideo(project, out, { projectDir: folder.dir }).done;
    const m = await measure(out);
    expect([m.width, m.height]).toEqual([1920, 1080]);
    expect(Math.abs(m.videoDuration - 5)).toBeLessThanOrEqual(FRAME + 0.001);
    expect(m.audioDuration).toBeCloseTo(5, 1);
  });
});

describe('Book A Activity 11.08: trim BeeFlySlow to 5 s and alter its speed to 200 %', () => {
  it('lasts 2.5 s with sound, fitted into 1920 × 1080 with black bars (4:3 source)', async () => {
    const beeFlySlow = await folder.asset('clip_4x3_640x480.mov', 'beeflyslow');
    const project = build('BeeProject', [
      importMedia(beeFlySlow),
      addMainItem(createVideoClip(beeFlySlow, { id: 'clip' })),
      trimClip('clip', { in: 0, out: 5 }),
      setClipSpeed('clip', 2),
    ]);
    const out = folder.file('11.08.mp4');
    await engine.renderVideo(project, out, { projectDir: folder.dir }).done;
    const m = await measure(out);
    expect([m.width, m.height]).toEqual([1920, 1080]);
    expect(Math.abs(m.videoDuration - 2.5)).toBeLessThanOrEqual(FRAME + 0.001);
    expect(m.audioDuration).toBeCloseTo(2.5, 1);
    expect((await tinyFrame(out, 1)).columnBrightness(0)).toBeLessThan(40);
  });
});

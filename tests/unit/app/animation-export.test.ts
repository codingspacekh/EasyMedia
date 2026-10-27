// M14 / AN15: exporting the animation — every frame drawn by the same drawing as the preview,
// made into an MP4 or an animated GIF by FFmpeg, saved as a PNG sequence, or the frame at the
// playhead as one PNG; with progress and Cancel (N12), and the size shown first (T7).
import { describe, expect, it } from 'vitest';
import { MediaError } from '../../../src/core/model/errors.ts';
import { testApp } from '../../helpers/test-app.ts';

function setup(width = 600, height = 400) {
  const t = testApp();
  const anim = t.app.animation;
  const stage = anim.store.get().history.present.stage;
  anim.setStage({ ...stage, width, height, length: 72 });
  anim.addShape('ellipse', { x: 0, y: 0, width: 204, height: 204 });
  anim.setFrame(72);
  anim.setProperties({ x: 396 });
  anim.setFrame(0);
  return { ...t, anim, state: () => anim.store.get() };
}

const framesIn = (bytes: Map<string, Uint8Array>) =>
  [...bytes.keys()].filter((p) => /animation-frames\/export-[^/]+\/frame-\d{5}\.png$/.test(p));

describe('exporting the animation (AN15)', () => {
  it('MP4: frames 0–71 drawn, made into a 600 × 400, 24 fps, 3.00 s H.264 video', async () => {
    const s = setup();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Task1.mp4');
    const encoded: string[] = [];
    const stop = s.engine.onJobEvent((e) => e.type === 'started' && encoded.push(e.label));
    await s.anim.exportAnimation('mp4');
    stop();
    expect(s.dialogs.exportAnimation).toHaveBeenCalledWith('Untitled', 'mp4');
    expect(s.stageRenderer.renderPng.mock.calls.map((c) => c[1])).toEqual(
      Array.from({ length: 72 }, (_, i) => i),
    );
    expect(framesIn(s.bytes)).toHaveLength(72);
    expect(encoded).toEqual(['Export animation']);
    expect(await s.engine.probe('/work/Task1.mp4')).toMatchObject({
      container: 'mp4',
      duration: 3,
      video: { codec: 'h264', width: 600, height: 400, fps: 24 },
    });
    expect(s.state().message).toEqual({ kind: 'info', text: 'Saved Task1.mp4.' });
    expect(s.state().exporting).toBeNull();
  });

  it('GIF: the same frames made into an animated GIF', async () => {
    const s = setup();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Task1.gif');
    await s.anim.exportAnimation('gif');
    expect(await s.engine.probe('/work/Task1.gif')).toMatchObject({
      container: 'gif',
      video: { width: 600, height: 400 },
    });
  });

  it('an odd-sized stage is padded to even for MP4, and the student is told', async () => {
    const s = setup(601, 401);
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Odd.mp4');
    await s.anim.exportAnimation('mp4');
    expect((await s.engine.probe('/work/Odd.mp4')).video).toMatchObject({
      width: 602,
      height: 402,
    });
    expect(s.state().message?.text).toBe(
      'Saved Odd.mp4. MP4 needs even sizes, so it is 602 × 402 (one pixel added).',
    );
  });

  it('PNG sequence: one picture per frame, Task1_0001.png to Task1_0072.png, without FFmpeg', async () => {
    const s = setup();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Task1.png');
    const jobs: string[] = [];
    const stop = s.engine.onJobEvent((e) => jobs.push(e.type));
    await s.anim.exportAnimation('png-sequence');
    stop();
    const files = [...s.bytes.keys()].filter((p) => p.startsWith('/work/'));
    expect(files).toHaveLength(72);
    expect(files[0]).toBe('/work/Task1_0001.png');
    expect(files.at(-1)).toBe('/work/Task1_0072.png');
    expect(jobs).toEqual([]);
    expect(s.state().message?.text).toBe('Saved 72 pictures, Task1_0001.png to Task1_0072.png.');
  });

  it('PNG: the frame at the playhead', async () => {
    const s = setup();
    s.anim.setFrame(36);
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Half.png');
    await s.anim.exportAnimation('png');
    expect(s.stageRenderer.renderPng).toHaveBeenCalledTimes(1);
    expect(s.stageRenderer.renderPng.mock.calls[0]![1]).toBe(36);
    expect(s.bytes.has('/work/Half.png')).toBe(true);
  });

  it('nothing happens when the save box is closed', async () => {
    const s = setup();
    await s.anim.exportAnimation('mp4');
    expect(s.stageRenderer.renderPng).not.toHaveBeenCalled();
    expect(s.state().exporting).toBeNull();
  });

  it('shows the progress: drawing the frames, then making the file', async () => {
    const s = setup();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Task1.mp4');
    const seen: string[] = [];
    const stop = s.anim.store.subscribe((st) => {
      const e = st.exporting;
      if (e) seen.push(`${e.phase} ${Math.round(e.progress * 100)}`);
    });
    await s.anim.exportAnimation('mp4');
    stop();
    expect(seen).toContain('drawing 0');
    expect(seen).toContain('drawing 50');
    expect(seen).toContain('encoding 100');
    expect(seen.indexOf('drawing 50')).toBeLessThan(seen.indexOf('encoding 100'));
  });

  it('Cancel while drawing stops, removes the frames drawn and makes no file', async () => {
    const s = setup();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Task1.mp4');
    s.stageRenderer.renderPng.mockImplementation(async () => {
      if (s.stageRenderer.renderPng.mock.calls.length === 5) s.anim.cancelExport();
      return new Uint8Array([1]);
    });
    await s.anim.exportAnimation('mp4');
    expect(s.stageRenderer.renderPng).toHaveBeenCalledTimes(5);
    expect(framesIn(s.bytes)).toEqual([]);
    await expect(s.engine.probe('/work/Task1.mp4')).rejects.toThrow(MediaError);
    expect(s.state()).toMatchObject({ exporting: null, message: { text: 'Export cancelled.' } });
  });

  it('Cancel while FFmpeg works stops the job and makes no file', async () => {
    const s = setup();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Task1.mp4');
    const stop = s.anim.store.subscribe((st) => {
      if (st.exporting?.phase === 'encoding') s.anim.cancelExport();
    });
    await s.anim.exportAnimation('mp4');
    stop();
    await expect(s.engine.probe('/work/Task1.mp4')).rejects.toThrow(MediaError);
    expect(s.state()).toMatchObject({ exporting: null, message: { text: 'Export cancelled.' } });
  });

  it('T7: the summary before exporting — frames, seconds, estimated size, padding', () => {
    const s = setup(601, 401);
    expect(s.anim.exportSummary('mp4')).toMatchObject({
      frames: 72,
      seconds: 3,
      size: { width: 602, height: 402, padded: true },
    });
    expect(s.anim.exportSummary('gif').bytes).toBeGreaterThan(s.anim.exportSummary('mp4').bytes);
    expect(s.anim.exportSummary('png').frames).toBe(1);
  });

  it('the old Export (a picture of the stage) still works as the frame at the playhead', async () => {
    const s = setup();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Stage.png');
    await s.anim.exportPng();
    expect(s.dialogs.exportAnimation).toHaveBeenCalledWith('Untitled', 'png');
    expect(s.bytes.has('/work/Stage.png')).toBe(true);
  });
});

describe('Send to Video mode (M14)', () => {
  async function saved() {
    const s = setup();
    s.dialogs.saveAnimation.mockResolvedValueOnce('/work/Task1.mvea');
    await s.anim.save();
    return s;
  }
  const clips = (s: ReturnType<typeof setup>) =>
    s.app.store
      .get()
      .history.present.timeline.main.map((c) =>
        'assetId' in c
          ? s.app.store.get().history.present.media.find((m) => m.id === c.assetId)?.path
          : null,
      );

  it('exports an MP4 beside the animation file and puts it on the video timeline as a clip', async () => {
    const s = await saved();
    expect(await s.app.sendAnimationToVideo()).toBe(true);
    expect(s.dialogs.exportAnimation).not.toHaveBeenCalled();
    expect((await s.engine.probe('/work/Task1.mp4')).video).toMatchObject({ codec: 'h264' });
    expect(clips(s)).toEqual(['/work/Task1.mp4']);
    expect(s.app.store.get().message?.text).toBe('Added Task1.mp4 to the timeline.');
  });

  it('sending again updates the same file without a second clip', async () => {
    const s = await saved();
    await s.app.sendAnimationToVideo();
    await s.app.sendAnimationToVideo();
    expect(clips(s)).toEqual(['/work/Task1.mp4']);
    expect(s.app.store.get().message?.text).toBe('Updated Task1.mp4 in Video mode.');
  });

  it('an animation never saved is saved first; closing the save box sends nothing', async () => {
    const s = setup();
    expect(await s.app.sendAnimationToVideo()).toBe(false);
    expect(s.dialogs.saveAnimation).toHaveBeenCalledTimes(1);
    expect(clips(s)).toEqual([]);
    s.dialogs.saveAnimation.mockResolvedValueOnce('/work/Fresh.mvea');
    expect(await s.app.sendAnimationToVideo()).toBe(true);
    expect(clips(s)).toEqual(['/work/Fresh.mp4']);
  });

  it('a cancelled export sends nothing', async () => {
    const s = await saved();
    s.stageRenderer.renderPng.mockImplementation(async () => {
      s.anim.cancelExport();
      return new Uint8Array([1]);
    });
    expect(await s.app.sendAnimationToVideo()).toBe(false);
    expect(clips(s)).toEqual([]);
  });
});

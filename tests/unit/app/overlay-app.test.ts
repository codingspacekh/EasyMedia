// V20: putting a picture or video over the video from the media bin, what the preview shows, and
// that packaging (P2) and missing files (P6) cover it.
import { describe, expect, it } from 'vitest';
import type { AppState, AssetStatus } from '../../../src/app/app.ts';
import { createHistory } from '../../../src/app/history.ts';
import { overlaysAt } from '../../../src/app/preview.ts';
import { toMediaUrl } from '../../../src/core/media-url.ts';
import {
  createImageClip,
  createMediaAsset,
  createProject,
  createVideoClip,
} from '../../../src/core/model/factory.ts';
import { createOverlayItem } from '../../../src/core/model/overlay.ts';
import { setItemDuration } from '../../../src/core/model/timeline.ts';
import type { OverlayItem } from '../../../src/core/model/types.ts';
import { overlayBox } from '../../../src/core/render/overlay.ts';
import { IMAGE, testApp, VIDEO } from '../../helpers/test-app.ts';

const media = { '/m/clip.mp4': VIDEO, '/m/photo.jpg': IMAGE, '/m/Logo.png': IMAGE };
const idOf = (app: ReturnType<typeof testApp>['app'], path: string) =>
  app.store.get().history.present.media.find((m) => m.path === path)!.id;
const overlay = (app: ReturnType<typeof testApp>['app']) =>
  app.store.get().history.present.timeline.overlay ?? [];

describe('V20 over the video from the media bin', () => {
  it('V20: a logo goes over the video at the playhead until the video ends, and is selected', async () => {
    const { app, importFiles } = testApp(media);
    await importFiles('/m/clip.mp4', '/m/Logo.png');
    app.addToTimeline(idOf(app, '/m/clip.mp4'));
    app.setPlayhead(2.5);
    app.addOverTheVideo(idOf(app, '/m/Logo.png'));
    expect(overlay(app)).toMatchObject([
      { type: 'image', start: 2.5, duration: 7.5, position: 'top-right' },
    ]);
    expect(app.store.get().selection).toBe(overlay(app)[0]!.id);
    app.undo();
    expect(app.store.get().history.present.timeline).not.toHaveProperty('overlay');
  });

  it('V20: a picture added past the end of the video shows for 5 s; a video plays all of it', async () => {
    const { app, importFiles } = testApp(media);
    await importFiles('/m/clip.mp4', '/m/Logo.png');
    app.addOverTheVideo(idOf(app, '/m/Logo.png'));
    app.setPlayhead(5);
    app.addOverTheVideo(idOf(app, '/m/clip.mp4'));
    expect(overlay(app)).toMatchObject([
      { type: 'image', start: 0, duration: 5 },
      { type: 'video', start: 5, in: 0, out: 10, muted: true },
    ]);
  });

  it('V20: one that would overlap another is refused with a clear message', async () => {
    const { app, importFiles } = testApp(media);
    await importFiles('/m/Logo.png', '/m/photo.jpg');
    app.addOverTheVideo(idOf(app, '/m/Logo.png'));
    app.setPlayhead(1);
    app.addOverTheVideo(idOf(app, '/m/photo.jpg'));
    expect(overlay(app)).toHaveLength(1);
    expect(app.store.get().message?.text).toMatch(/overlaps another picture or video/i);
  });

  it('P2: Package project copies the files used over the video', async () => {
    const { app, importFiles, copies, dialogs } = testApp(media);
    await importFiles('/m/Logo.png');
    app.addOverTheVideo(idOf(app, '/m/Logo.png'));
    dialogs.chooseFolder.mockResolvedValueOnce('/usb/T');
    await app.packageProject();
    expect(copies).toContainEqual(['/m/Logo.png', '/usb/T/media/Logo.png']);
  });

  it('P6: a missing file used over the video must be located before packaging', async () => {
    const { app, importFiles, copies, dialogs } = testApp(media);
    await importFiles('/m/Logo.png');
    const id = idOf(app, '/m/Logo.png');
    app.addOverTheVideo(id);
    app.store.update((s) => ({
      ...s,
      assets: { ...s.assets, [id]: { state: 'failed', progress: 0 } },
    }));
    await app.packageProject();
    expect(dialogs.chooseFolder).not.toHaveBeenCalled();
    expect(copies).toEqual([]);
  });
});

// ---- the preview ----

const lake = createMediaAsset({ id: 'lake', kind: 'video', path: '/m/lake.mp4', duration: 20 });
const logo = createMediaAsset({ id: 'logo', kind: 'image', path: '/m/Logo.png' });
const clip2 = createMediaAsset({ id: 'clip2', kind: 'video', path: '/m/clip2.mp4', duration: 8 });
const ready: Record<string, AssetStatus> = {
  lake: { state: 'ready', progress: 1, proxyPath: '/cache/lake.mp4' },
  logo: { state: 'ready', progress: 1, size: { width: 400, height: 200 } },
  clip2: {
    state: 'ready',
    progress: 1,
    proxyPath: '/cache/clip2.mp4',
    size: { width: 1280, height: 720 },
  },
};

function state(overlay: OverlayItem[], assets = ready): AppState {
  const p = createProject({ name: 'p' });
  const project = {
    ...p,
    media: [lake, logo, clip2],
    timeline: {
      ...p.timeline,
      main: [createVideoClip(lake, { id: 'v' }), setItemDuration(createImageClip(logo), 5)],
      overlay,
    },
  };
  return {
    history: createHistory(project),
    projectPath: null,
    saved: project,
    audioDirty: false,
    assets,
    playhead: 0,
    selection: null,
    exporting: { state: 'idle' },
    message: null,
    welcome: false,
    licences: null,
    about: false,
  };
}

describe('V20 the preview shows pictures and videos over the video', () => {
  const picture = createOverlayItem(logo, 2, { id: 'o', duration: 5 });

  it('V20: a logo in its place and size (the export’s), only between its start and end', () => {
    const box = overlayBox({ width: 1920, height: 1080 }, { width: 400, height: 200 }, picture);
    const pc = (n: number, of: number) => `${Number(((n / of) * 100).toFixed(4))}%`;
    expect(overlaysAt(state([picture]), 3)).toEqual([
      {
        itemId: 'o',
        kind: 'image',
        src: toMediaUrl('/m/Logo.png'),
        left: pc(box.x, 1920),
        top: pc(box.y, 1080),
        width: pc(box.width, 1920),
        height: pc(box.height, 1080),
        opacity: 1,
      },
    ]);
    expect(overlaysAt(state([picture]), 1.99)).toEqual([]);
    expect(overlaysAt(state([picture]), 7)).toEqual([]);
  });

  it('V20: see-through and fading as in the export', () => {
    const faded = { ...picture, opacity: 0.5, fadeIn: 1, fadeOut: 2 };
    expect(overlaysAt(state([faded]), 2.5)[0]!.opacity).toBeCloseTo(0.25);
    expect(overlaysAt(state([faded]), 4)[0]!.opacity).toBeCloseTo(0.5);
    expect(overlaysAt(state([faded]), 6.5)[0]!.opacity).toBeCloseTo(0.125);
  });

  it('V20: a video plays its proxy from its trimmed start; silent unless its sound is on', () => {
    const pip = { ...createOverlayItem(clip2, 10, { id: 'p' }), in: 1, out: 6 } as OverlayItem;
    expect(overlaysAt(state([pip]), 12)).toMatchObject([
      { kind: 'video', src: toMediaUrl('/cache/clip2.mp4'), mediaTime: 3, volume: 0 },
    ]);
    const heard = { ...pip, muted: false, volume: 0.5 } as OverlayItem;
    expect(overlaysAt(state([heard]), 12)[0]).toMatchObject({ volume: 0.5 });
  });

  it('V20: nothing past the end of the video, or before its size is known', () => {
    const late = createOverlayItem(logo, 20, { id: 'late', duration: 30 });
    expect(overlaysAt(state([late]), 26)).toEqual([]);
    expect(
      overlaysAt(state([picture], { ...ready, logo: { state: 'ready', progress: 1 } }), 3),
    ).toEqual([]);
  });
});

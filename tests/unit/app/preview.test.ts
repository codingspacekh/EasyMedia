import { describe, expect, it } from 'vitest';
import type { AppState, AssetStatus } from '../../../src/app/app.ts';
import { createHistory } from '../../../src/app/history.ts';
import { previewAt } from '../../../src/app/preview.ts';
import { toMediaUrl } from '../../../src/core/media-url.ts';
import {
  createImageClip,
  createMediaAsset,
  createProject,
  createTitleSlide,
  createVideoClip,
} from '../../../src/core/model/factory.ts';
import { setItemDuration, setVideoSpeed, trimVideo } from '../../../src/core/model/timeline.ts';

const lake = createMediaAsset({
  id: 'lake',
  kind: 'video',
  path: '/m/lake.mp4',
  duration: 20,
  hasAudio: true,
});
const photo = createMediaAsset({ id: 'photo', kind: 'image', path: '/m/photo.jpg' });

function state(assets: Record<string, AssetStatus>): AppState {
  const p = createProject({ name: 'p' });
  const project = {
    ...p,
    media: [lake, photo],
    timeline: {
      ...p.timeline,
      main: [
        {
          ...setItemDuration(createTitleSlide('', { id: 't' }), 2),
          background: { kind: 'colour' as const, colour: '#ff0000' },
        },
        setVideoSpeed(trimVideo(createVideoClip(lake, { id: 'v' }), { in: 8, out: 12 }, lake), 2), // 2–4 s
        setItemDuration(createImageClip(photo, { id: 'i' }), 3), // 4–7 s
      ],
    },
  };
  return {
    history: createHistory(project),
    projectPath: null,
    saved: project,
    assets,
    playhead: 0,
    selection: null,
    exporting: { state: 'idle' },
    message: null,
  };
}
const ready: Record<string, AssetStatus> = {
  lake: { state: 'ready', progress: 1, proxyPath: '/cache/lake.mp4' },
  photo: { state: 'ready', progress: 1 },
};

describe('what the preview shows at the playhead (approximate preview, ARCHITECTURE §7.3)', () => {
  it('a colour title slide', () => {
    expect(previewAt(state(ready), 1)).toEqual({ kind: 'colour', colour: '#ff0000', itemId: 't' });
  });

  it('a video plays its proxy from the right moment at the clip speed', () => {
    // 1 s into a 2× clip trimmed from 8 s → source 10 s
    expect(previewAt(state(ready), 3)).toEqual({
      kind: 'video',
      src: toMediaUrl('/cache/lake.mp4'),
      mediaTime: 10,
      rate: 2,
      volume: 1,
      itemId: 'v',
    });
  });

  it('V13 a clip with its sound removed plays silently in the preview, as in the export', () => {
    const s = state(ready);
    const main = s.history.present.timeline.main.map((m) =>
      m.type === 'video' ? { ...m, muted: true } : m,
    );
    const muted = {
      ...s,
      history: {
        ...s.history,
        present: { ...s.history.present, timeline: { ...s.history.present.timeline, main } },
      },
    };
    expect(previewAt(muted, 3)).toMatchObject({ kind: 'video', volume: 0 });
  });

  it('a video whose proxy is not ready yet shows "preparing" with progress', () => {
    expect(previewAt(state({ ...ready, lake: { state: 'preparing', progress: 0.4 } }), 3)).toEqual({
      kind: 'waiting',
      progress: 0.4,
      itemId: 'v',
    });
  });

  it('a still shows the picture itself', () => {
    expect(previewAt(state(ready), 5)).toEqual({
      kind: 'image',
      src: toMediaUrl('/m/photo.jpg'),
      itemId: 'i',
    });
  });

  it('nothing after the end of the timeline', () => {
    expect(previewAt(state(ready), 7)).toEqual({ kind: 'empty' });
  });
});

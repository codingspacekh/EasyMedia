// Book B (video_audio_editing.pdf) Task 11d — the timeline only (M1 exit gate).
// Rendering this timeline to a video file is tested from M3 onwards.
//
// Task 11d: title frames (Task 11a, 8 s) → Naivasha1 (Task 11c: 0–6.3 s at 1.5×) →
// Naivasha2 (Task 11b: 8–12.5 s) → still of Naivasha2's last frame with two captions
// (10 s) → Fish_Eagle.mp4 → credits (6 s).
//
// ASSUMPTION: the coursebook does not state the length of Fish_Eagle.mp4. We use 8.00 s,
// which makes the whole video 40.70 s. Lake_Naivasha.mp4 is assumed to be 20 s long.
import { describe, expect, it } from 'vitest';
import {
  addMainItem,
  addTextItem,
  importMedia,
  setClipSpeed,
  setDuration,
  trimClip,
} from '../../src/app/commands.ts';
import {
  canUndo,
  createHistory,
  execute,
  undo,
  type Command,
  type History,
} from '../../src/app/history.ts';
import {
  createImageClip,
  createMediaAsset,
  createProject,
  createTextItem,
  createTitleSlide,
  createVideoClip,
} from '../../src/core/model/factory.ts';
import { formatTime } from '../../src/core/model/time.ts';
import { layoutMain, mainTrackDuration } from '../../src/core/model/timeline.ts';
import type { TitleSlide } from '../../src/core/model/types.ts';

const eagleJpg = createMediaAsset({
  id: 'eagle-jpg',
  kind: 'image',
  path: 'media/Fish_Eagle1.jpg',
});
const lake = createMediaAsset({
  id: 'lake',
  kind: 'video',
  path: 'media/Lake_Naivasha.mp4',
  duration: 20,
});
const snapshot = createMediaAsset({ id: 'snap', kind: 'image', path: 'media/Snapshot_n2end.png' });
const eagleMp4 = createMediaAsset({
  id: 'eagle-mp4',
  kind: 'video',
  path: 'media/Fish_Eagle.mp4',
  duration: 8,
});

const title: TitleSlide = {
  ...createTitleSlide('Lake Naivasha, Kenya', { id: 'title' }),
  background: { kind: 'image', assetId: eagleJpg.id },
};
const creditsBackground = createTitleSlide('', { id: 'credits-bg' });

const steps: Command[] = [
  ...[eagleJpg, lake, snapshot, eagleMp4].map(importMedia),
  addMainItem(title),
  setDuration('title', 8),
  addMainItem(createVideoClip(lake, { id: 'naivasha1' })),
  trimClip('naivasha1', { in: 0, out: 6.3 }),
  setClipSpeed('naivasha1', 1.5),
  addMainItem(createVideoClip(lake, { id: 'naivasha2' })),
  trimClip('naivasha2', { in: 8, out: 12.5 }),
  addMainItem(createImageClip(snapshot, { id: 'still' })),
  setDuration('still', 10),
  addMainItem(createVideoClip(eagleMp4, { id: 'fish-eagle' })),
  addMainItem(creditsBackground),
  setDuration('credits-bg', 6),
  addTextItem(
    createTextItem(
      'caption',
      'Lake Naivasha sits in the Great Rift Valley. It is home to over 400 species of birds.',
      16.7,
      { id: 'caption1' },
    ),
  ),
  addTextItem(
    createTextItem(
      'caption',
      'Lake Naivasha offers some of the best bird-watching in the world.',
      21.7,
      { id: 'caption2' },
    ),
  ),
  addTextItem(
    createTextItem(
      'credits',
      'Filmed by: GBRvideo\nLocation: Lake Naivasha, Kenya\nDate filmed: August 2019\nEdited by: A. Student',
      34.7,
      {
        id: 'credits',
      },
    ),
  ),
  setDuration('credits', 6),
];

function build(): History {
  return steps.reduce(execute, createHistory(createProject({ name: 'Task_11d' })));
}

describe('Book B Task 11d — timeline', () => {
  it('places every main-track item at the right time', () => {
    const layout = layoutMain(build().present.timeline.main);
    expect(layout.map((l) => [l.item.id, formatTime(l.start), formatTime(l.end)])).toEqual([
      ['title', '00:00.00', '00:08.00'],
      ['naivasha1', '00:08.00', '00:12.20'],
      ['naivasha2', '00:12.20', '00:16.70'],
      ['still', '00:16.70', '00:26.70'],
      ['fish-eagle', '00:26.70', '00:34.70'],
      ['credits-bg', '00:34.70', '00:40.70'],
    ]);
  });

  it('is 40.70 s long', () => {
    expect(formatTime(mainTrackDuration(build().present.timeline.main))).toBe('00:40.70');
  });

  it('shows the two captions one after the other over the 10 s still', () => {
    const p = build().present;
    const still = layoutMain(p.timeline.main).find((l) => l.item.id === 'still')!;
    const [c1, c2] = p.timeline.text;
    expect(c1!.start).toBeCloseTo(still.start, 6);
    expect(c2!.start).toBeCloseTo(c1!.start + c1!.duration, 6);
    expect(c2!.start + c2!.duration).toBeCloseTo(still.end, 6);
  });

  it('shows the credits for the last 6 s, ending with the video', () => {
    const p = build().present;
    const credits = p.timeline.text.find((t) => t.kind === 'credits')!;
    expect(formatTime(credits.start)).toBe('00:34.70');
    expect(credits.start + credits.duration).toBeCloseTo(mainTrackDuration(p.timeline.main), 6);
  });

  it('every step can be undone, back to an empty project', () => {
    let h = build();
    while (canUndo(h)) h = undo(h);
    expect(h.present).toEqual(createProject({ name: 'Task_11d' }));
  });
});

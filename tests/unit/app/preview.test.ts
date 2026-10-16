import { describe, expect, it } from 'vitest';
import type { AppState, AssetStatus } from '../../../src/app/app.ts';
import { createHistory } from '../../../src/app/history.ts';
import { previewAt, soundsAt, textLayersAt } from '../../../src/app/preview.ts';
import { toMediaUrl } from '../../../src/core/media-url.ts';
import {
  createAudioItem,
  createImageClip,
  createMediaAsset,
  createProject,
  createTextItem,
  createTitleSlide,
  createVideoClip,
} from '../../../src/core/model/factory.ts';
import { setItemDuration, setVideoSpeed, trimVideo } from '../../../src/core/model/timeline.ts';
import type { MainItem } from '../../../src/core/model/types.ts';

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

describe('text drawn over the preview (same pictures as the export)', () => {
  const measure = (t: string) => t.length * 10;
  function withText() {
    const s = state(ready);
    const project = s.history.present;
    const titled = {
      ...project,
      timeline: {
        ...project.timeline,
        main: [
          { ...project.timeline.main[0]!, text: 'Welcome', fadeIn: 1 },
          ...project.timeline.main.slice(1),
        ],
        text: [
          { ...createTextItem('caption', 'The lake', 2, { id: 'cap' }), duration: 3 },
          { ...createTextItem('credits', 'A\nB', 4, { id: 'cr' }), duration: 2 },
        ],
      },
    };
    return { ...s, history: createHistory(titled) };
  }

  it("shows a title slide's words, fading in from the slide's own start", () => {
    const layers = textLayersAt(withText(), 0.5, measure);
    expect(layers).toEqual([
      expect.objectContaining({
        id: 't',
        text: 'Welcome',
        mode: 'frame',
        opacity: 0.5,
        x: 0,
        y: 0,
      }),
    ]);
  });

  it('shows captions only during their time, in timeline order after the title', () => {
    expect(textLayersAt(withText(), 1.9, measure).map((l) => l.id)).toEqual(['t']);
    expect(textLayersAt(withText(), 3, measure).map((l) => l.id)).toEqual(['cap']);
    expect(textLayersAt(withText(), 5, measure).map((l) => l.id)).toEqual(['cr']);
    expect(textLayersAt(withText(), 6.5, measure).map((l) => l.id)).toEqual([]);
  });

  it('scrolls credits as a block, using its measured height', () => {
    // 2 lines × 36 × 1.2 = 86.4, plus 2 × 18 padding → 123 px; halfway: 1080 − ½ × 1203
    const [credits] = textLayersAt(withText(), 5, measure).filter((l) => l.id === 'cr');
    expect(credits).toMatchObject({ mode: 'block', x: 0 });
    expect(credits!.y).toBeCloseTo(1080 - 0.5 * (1080 + 123), 5);
  });

  it('a title with no words has no layer', () => {
    expect(textLayersAt(state(ready), 1, measure)).toEqual([]);
  });
});

describe('title slide backgrounds in the preview', () => {
  function titleOver(background: { kind: 'image' | 'video'; assetId: string }) {
    const s = state(ready);
    const project = s.history.present;
    const main = [{ ...project.timeline.main[0]!, background }, ...project.timeline.main.slice(1)];
    return {
      ...s,
      history: createHistory({ ...project, timeline: { ...project.timeline, main } }),
    };
  }

  it('shows the picture behind a title', () => {
    expect(previewAt(titleOver({ kind: 'image', assetId: 'photo' }), 1)).toEqual({
      kind: 'image',
      src: toMediaUrl('/m/photo.jpg'),
      itemId: 't',
    });
  });

  it('plays the video behind a title from its start, silently (as exported)', () => {
    expect(previewAt(titleOver({ kind: 'video', assetId: 'lake' }), 1.5)).toEqual({
      kind: 'video',
      src: toMediaUrl('/cache/lake.mp4'),
      mediaTime: 1.5,
      rate: 1,
      volume: 0,
      itemId: 't',
    });
  });
});

describe('looks in the preview (V7, V8, V9, V15 — approximate)', () => {
  function withMain(change: (main: MainItem[]) => MainItem[]) {
    const s = state(ready);
    const project = s.history.present;
    return {
      ...s,
      history: createHistory({
        ...project,
        timeline: { ...project.timeline, main: change(project.timeline.main) },
      }),
    };
  }

  it('shows filters, the fade and the pan & zoom view of the clip at the playhead', () => {
    const s = withMain(([title, video, image]) => [
      title!,
      video!,
      {
        ...image!,
        effects: [{ effectId: 'video.sepia', params: {} }],
        fade: { in: 2, out: 0, colour: 'white' },
        panZoom: { from: { zoom: 1, x: 0.5, y: 0.5 }, to: { zoom: 2, x: 0.5, y: 0.5 } },
      },
    ]);
    // the still runs 4–7 s: 1 s in, the fade is half way and the zoom a third of the way
    const frame = previewAt(s, 5);
    expect(frame).toMatchObject({
      kind: 'image',
      look: { filter: 'sepia(1)', fade: { colour: 'white', amount: 0.5 } },
    });
    expect(frame.kind === 'image' && frame.look?.view?.zoom).toBeCloseTo(4 / 3, 10);
  });

  it('a clip with no look has none', () => {
    expect(previewAt(state(ready), 5)).not.toHaveProperty('look');
  });

  it('during a transition the next clip comes in on top, with how far the transition has got', () => {
    const s = withMain(([title, video, image]) => [
      title!,
      video!,
      { ...image!, transitionIn: { effectId: 'transition.dissolve', duration: 1 } },
    ]);
    // the video runs 2–4 s, the still now starts at 3 s
    const frame = previewAt(s, 3.25);
    expect(frame).toMatchObject({ kind: 'video', itemId: 'v' });
    expect(frame.kind === 'video' && frame.incoming).toEqual({
      frame: { kind: 'image', src: toMediaUrl('/m/photo.jpg'), itemId: 'i' },
      progress: 0.25,
      transition: 'Dissolve',
    });
    expect(previewAt(s, 2.5)).not.toHaveProperty('incoming');
  });
});

describe('V13 music and voiceover heard in the preview', () => {
  const music = createMediaAsset({
    id: 'music',
    kind: 'audio',
    path: '/m/music.mp3',
    duration: 30,
  });
  const voice = createMediaAsset({ id: 'voice', kind: 'audio', path: '/m/voice.wav', duration: 2 });
  /** The 7 s timeline above, music from 1 s (read from 10 s, fading in 2 s, out 1 s), a voiceover at 5 s. */
  function withSound(duck = false): AppState {
    const s = state(ready);
    const p = s.history.present;
    const project = {
      ...p,
      media: [...p.media, music, voice],
      timeline: {
        ...p.timeline,
        audio: [
          [
            {
              ...createAudioItem(music, 1, { id: 'm' }),
              in: 10,
              volume: 0.8,
              fadeIn: 2,
              fadeOut: 1,
              duck,
            },
          ],
          [createAudioItem(voice, 5, { id: 'vo' })],
        ] as AppState['history']['present']['timeline']['audio'],
      },
    };
    return { ...s, history: createHistory(project) };
  }

  it('plays each sound from the right moment of its file, with its volume and fades', () => {
    expect(soundsAt(withSound(), 0.5)).toEqual([]); // the music starts at 1 s
    const [m] = soundsAt(withSound(), 2);
    expect(m).toEqual({
      itemId: 'm',
      src: toMediaUrl('/m/music.mp3'),
      mediaTime: 11,
      rate: 1,
      volume: 0.4,
    });
    expect(soundsAt(withSound(), 5.5).map((x) => x.itemId)).toEqual(['m', 'vo']);
    // The music is cut where the video ends (7 s), so its fade out happens 6–7 s.
    expect(soundsAt(withSound(), 6.5)[0]!.volume).toBeCloseTo(0.4, 5);
    expect(soundsAt(withSound(), 7.2)).toEqual([]);
  });

  it('a sound at 2× plays its file twice as fast, from the matching moment', () => {
    const s = withSound();
    const project = s.history.present;
    const fast = {
      ...project,
      timeline: {
        ...project.timeline,
        audio: [
          [{ ...project.timeline.audio[0][0]!, speed: 2, fadeIn: 0 }],
          project.timeline.audio[1],
        ] as typeof project.timeline.audio,
      },
    };
    const [m] = soundsAt({ ...s, history: createHistory(fast) }, 2); // 1 s in → 2 s into the file
    expect(m).toMatchObject({ mediaTime: 12, rate: 2 });
  });

  it('lowers the music by 6 dB while the voiceover plays', () => {
    expect(soundsAt(withSound(true), 4)[0]!.volume).toBeCloseTo(0.8, 5);
    expect(soundsAt(withSound(true), 5.5)[0]!.volume).toBeCloseTo(0.8 * 0.501, 3);
  });
});

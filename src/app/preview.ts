// What the preview shows at a given time (ARCHITECTURE §7.3, "approximate preview"):
// videos play their small proxy, stills show the picture, titles show their background. Text is
// drawn on top with the same drawing code as the export, so it sits on the same pixels.
import { toMediaUrl } from '../core/media-url.ts';
import type { Seconds } from '../core/model/time.ts';
import {
  audioDuration,
  findMainItemAt,
  itemDuration,
  layoutMain,
  mainTrackDuration,
  transitionOverlap,
} from '../core/model/timeline.ts';
import type { Id, MainItem, PanZoomFrame, TextStyle } from '../core/model/types.ts';
import { previewFilter, transitionById } from '../core/effects/registry.ts';
import { panZoomAt } from '../core/effects/panzoom.ts';
import { textImageSize, type TextImageMode } from '../core/text/draw.ts';
import { layoutText, type Measure } from '../core/text/layout.ts';
import { textMotion } from '../core/text/motion.ts';
import type { AppState } from './app.ts';

/** How the clip looks at this moment (approximate preview of the export, ARCHITECTURE §7.3). */
export interface PreviewLook {
  /** CSS filter for the clip's filters (V15). */
  filter: string;
  /** How far the picture has faded to black or white (V7), 0–1. */
  fade: { colour: 'black' | 'white'; amount: number } | null;
  /** Pan & zoom view (V8): zoom and the centre of the view, 0–1. */
  view: PanZoomFrame | null;
}

interface Extras {
  look?: PreviewLook;
  /** V9: the next clip coming in over this one during a transition. */
  incoming?: { frame: PreviewFrame; progress: number; transition: string; xfade: string };
}

export type PreviewFrame =
  | { kind: 'empty' }
  | ({
      kind: 'video';
      src: string;
      mediaTime: Seconds;
      rate: number;
      volume: number;
      itemId: Id;
    } & Extras)
  | ({ kind: 'waiting'; progress: number; itemId: Id } & Extras)
  | ({ kind: 'image'; src: string; itemId: Id } & Extras)
  | ({ kind: 'colour'; colour: string; itemId: Id } & Extras);

export function previewAt(state: AppState, time: Seconds): PreviewFrame {
  const main = state.history.present.timeline.main;
  const hit = findMainItemAt(main, time);
  if (!hit) return { kind: 'empty' };
  const frame = frameOf(state, hit.index, hit.offset);
  // During a transition, the next item is already starting.
  const next = layoutMain(main)[hit.index + 1];
  if (frame.kind === 'empty' || !next || time < next.start) return frame;
  const overlap = transitionOverlap(main, hit.index + 1);
  if (overlap <= 0) return frame;
  const kind = transitionById(next.item.transitionIn!.effectId);
  return {
    ...frame,
    incoming: {
      frame: frameOf(state, hit.index + 1, time - next.start),
      progress: (time - next.start) / overlap,
      transition: kind?.label ?? 'Transition',
      xfade: kind?.xfade ?? 'fade',
    },
  };
}

/** The look of an item `offset` seconds in, or undefined when it has none. */
function lookOf(item: MainItem, offset: Seconds): PreviewLook | undefined {
  if (!item.effects?.length && !item.fade && !item.panZoom) return undefined;
  const length = itemDuration(item);
  let fade: PreviewLook['fade'] = null;
  if (item.fade) {
    const { in: fadeIn, out, colour } = item.fade;
    const amount = Math.max(
      fadeIn > 0 ? 1 - offset / fadeIn : 0,
      out > 0 ? 1 - (length - offset) / out : 0,
      0,
    );
    fade = { colour, amount: Math.min(1, amount) };
  }
  return {
    filter: previewFilter(item.effects ?? []),
    fade,
    view: item.panZoom ? panZoomAt(item.panZoom, offset, length) : null,
  };
}

function frameOf(state: AppState, index: number, offset: Seconds): PreviewFrame {
  const item = state.history.present.timeline.main[index]!;
  const frame = baseFrame(state, item, offset);
  const look = lookOf(item, offset);
  return look && frame.kind !== 'empty' ? { ...frame, look } : frame;
}

function baseFrame(state: AppState, item: MainItem, offset: Seconds): PreviewFrame {
  const project = state.history.present;
  const hit = { offset };
  if (item.type === 'title') {
    const bg = item.background;
    if (bg.kind === 'colour') return { kind: 'colour', colour: bg.colour, itemId: item.id };
    const path = project.media.find((m) => m.id === bg.assetId)?.path ?? '';
    if (bg.kind === 'image') return { kind: 'image', src: toMediaUrl(path), itemId: item.id };
    // A video behind a title plays from its start, without sound (as exported).
    return videoFrame(state, bg.assetId, hit.offset, 1, 0, item.id);
  }
  const asset = project.media.find((m) => m.id === item.assetId);
  if (item.type === 'image')
    return { kind: 'image', src: toMediaUrl(asset?.path ?? ''), itemId: item.id };
  // Matches the export: removed sound is silent (V13).
  return videoFrame(
    state,
    item.assetId,
    item.in + hit.offset * item.speed,
    item.speed,
    item.muted ? 0 : item.volume,
    item.id,
  );
}

function videoFrame(
  state: AppState,
  assetId: Id,
  mediaTime: Seconds,
  rate: number,
  volume: number,
  itemId: Id,
): PreviewFrame {
  const status = state.assets[assetId];
  if (status?.state !== 'ready' || !status.proxyPath) {
    return { kind: 'waiting', progress: status?.progress ?? 0, itemId };
  }
  return { kind: 'video', src: toMediaUrl(status.proxyPath), mediaTime, rate, volume, itemId };
}

/** One picture of text to draw over the preview, in project pixels. */
export interface TextLayer {
  id: Id;
  text: string;
  style: TextStyle;
  mode: TextImageMode;
  opacity: number;
  x: number;
  y: number;
  /** Zoom entrances and exits: the size, around `anchor` (the middle of the words). */
  scale: number;
  anchor: { x: number; y: number };
  /**
   * Where the preview draws it: a title's words belong to its clip (`main`, or `incoming`
   * during a transition into the next title), so they take part in the transition as in the
   * export; captions, subtitles and credits go `over` the video.
   */
  slot: 'main' | 'incoming' | 'over';
}

/** The title's words, then captions, subtitles and credits showing at `time` (export order). */
export function textLayersAt(state: AppState, time: Seconds, measure: Measure): TextLayer[] {
  const project = state.history.present;
  const frame = { width: project.settings.width, height: project.settings.height };
  const layers: TextLayer[] = [];
  const hit = findMainItemAt(project.timeline.main, time);
  const middle = (text: string, style: TextStyle) => {
    const { box } = layoutText(text, style, frame, measure);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const title = (i: number, offset: Seconds, slot: 'main' | 'incoming') => {
    const it = project.timeline.main[i];
    if (it?.type !== 'title' || it.text.trim() === '') return;
    const motion = textMotion(it, offset, it.duration, frame);
    const anchor = middle(it.text, it.style);
    layers.push({
      id: it.id,
      text: it.text,
      style: it.style,
      mode: 'frame',
      anchor,
      slot,
      ...motion,
    });
  };
  if (hit) {
    title(hit.index, hit.offset, 'main');
    // During a transition the next item has already started.
    const next = layoutMain(project.timeline.main)[hit.index + 1];
    if (next && time >= next.start && transitionOverlap(project.timeline.main, hit.index + 1) > 0)
      title(hit.index + 1, time - next.start, 'incoming');
  }
  for (const t of project.timeline.text) {
    if (time < t.start || time >= t.start + t.duration) continue;
    const mode = t.kind === 'credits' && t.scroll !== false ? 'block' : 'frame';
    const credits =
      mode === 'block'
        ? { creditsHeight: textImageSize(t.text, t.style, frame, mode, measure).height }
        : undefined;
    const motion = textMotion(t, time - t.start, t.duration, frame, credits);
    const anchor = middle(t.text, t.style);
    layers.push({ id: t.id, text: t.text, style: t.style, mode, anchor, slot: 'over', ...motion });
  }
  return layers;
}

/** A music or voiceover clip heard at this moment (V13). */
export interface PreviewSound {
  itemId: Id;
  src: string;
  /** Where in the sound file we are. */
  mediaTime: Seconds;
  /** Playback speed (V13 like V14). */
  rate: number;
  /** Its volume with fades and lowering under the voiceover, as in the export. */
  volume: number;
}

/** -6 dB as a factor. */
const DUCK = 10 ** (-6 / 20);

/** The music and voiceover heard at `time`; like the export, they stop when the video ends. */
export function soundsAt(state: AppState, time: Seconds): PreviewSound[] {
  const project = state.history.present;
  const end = mainTrackDuration(project.timeline.main);
  const heard = (start: Seconds, length: Seconds) => Math.min(length, end - start);
  const playing = (start: Seconds, length: Seconds) =>
    time >= start && time < start + heard(start, length);
  const voiceover = project.timeline.audio[1].some((a) => playing(a.start, audioDuration(a)));
  return project.timeline.audio.flatMap((items, track) =>
    items.flatMap((item) => {
      const length = audioDuration(item);
      if (!playing(item.start, length)) return [];
      const asset = project.media.find((m) => m.id === item.assetId);
      if (!asset) return [];
      const offset = time - item.start;
      const until = heard(item.start, length);
      const gain = Math.min(
        item.fadeIn > 0 ? offset / item.fadeIn : 1,
        item.fadeOut > 0 ? (until - offset) / item.fadeOut : 1,
        1,
      );
      const ducked = track === 0 && item.duck && voiceover ? DUCK : 1;
      return [
        {
          itemId: item.id,
          src: toMediaUrl(asset.path),
          mediaTime: item.in + offset * (item.speed ?? 1),
          rate: item.speed ?? 1,
          volume: Math.max(0, item.volume * gain * ducked),
        },
      ];
    }),
  );
}

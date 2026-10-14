// What the preview shows at a given time (ARCHITECTURE §7.3, "approximate preview"):
// videos play their small proxy, stills show the picture, titles show their background. Text is
// drawn on top with the same drawing code as the export, so it sits on the same pixels.
import { toMediaUrl } from '../core/media-url.ts';
import type { Seconds } from '../core/model/time.ts';
import { findMainItemAt } from '../core/model/timeline.ts';
import type { Id, TextStyle } from '../core/model/types.ts';
import { textImageSize, type TextImageMode } from '../core/text/draw.ts';
import type { Measure } from '../core/text/layout.ts';
import { textMotion } from '../core/text/motion.ts';
import type { AppState } from './app.ts';

export type PreviewFrame =
  | { kind: 'empty' }
  | { kind: 'video'; src: string; mediaTime: Seconds; rate: number; volume: number; itemId: Id }
  | { kind: 'waiting'; progress: number; itemId: Id }
  | { kind: 'image'; src: string; itemId: Id }
  | { kind: 'colour'; colour: string; itemId: Id };

export function previewAt(state: AppState, time: Seconds): PreviewFrame {
  const project = state.history.present;
  const hit = findMainItemAt(project.timeline.main, time);
  if (!hit) return { kind: 'empty' };
  const item = project.timeline.main[hit.index]!;
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
}

/** The title's words, then captions, subtitles and credits showing at `time` (export order). */
export function textLayersAt(state: AppState, time: Seconds, measure: Measure): TextLayer[] {
  const project = state.history.present;
  const frame = { width: project.settings.width, height: project.settings.height };
  const layers: TextLayer[] = [];
  const hit = findMainItemAt(project.timeline.main, time);
  const item = hit && project.timeline.main[hit.index];
  if (hit && item?.type === 'title' && item.text.trim() !== '') {
    const motion = textMotion(item, hit.offset, item.duration, frame);
    layers.push({ id: item.id, text: item.text, style: item.style, mode: 'frame', ...motion });
  }
  for (const t of project.timeline.text) {
    if (time < t.start || time >= t.start + t.duration) continue;
    const mode = t.kind === 'credits' && t.scroll !== false ? 'block' : 'frame';
    const credits =
      mode === 'block'
        ? { creditsHeight: textImageSize(t.text, t.style, frame, mode, measure).height }
        : undefined;
    const motion = textMotion(t, time - t.start, t.duration, frame, credits);
    layers.push({ id: t.id, text: t.text, style: t.style, mode, ...motion });
  }
  return layers;
}

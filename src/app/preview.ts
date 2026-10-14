// What the preview shows at a given time (ARCHITECTURE §7.3, "approximate preview"):
// videos play their small proxy, stills show the picture, titles show their colour.
import { toMediaUrl } from '../core/media-url.ts';
import type { Seconds } from '../core/model/time.ts';
import { findMainItemAt } from '../core/model/timeline.ts';
import type { Id } from '../core/model/types.ts';
import type { AppState } from './app.ts';

export type PreviewFrame =
  | { kind: 'empty' }
  | { kind: 'video'; src: string; mediaTime: Seconds; rate: number; itemId: Id }
  | { kind: 'waiting'; progress: number; itemId: Id }
  | { kind: 'image'; src: string; itemId: Id }
  | { kind: 'colour'; colour: string; itemId: Id };

export function previewAt(state: AppState, time: Seconds): PreviewFrame {
  const project = state.history.present;
  const hit = findMainItemAt(project.timeline.main, time);
  if (!hit) return { kind: 'empty' };
  const item = project.timeline.main[hit.index]!;
  if (item.type === 'title') {
    return {
      kind: 'colour',
      colour: item.background.kind === 'colour' ? item.background.colour : '#000000',
      itemId: item.id,
    };
  }
  const asset = project.media.find((m) => m.id === item.assetId);
  if (item.type === 'image')
    return { kind: 'image', src: toMediaUrl(asset?.path ?? ''), itemId: item.id };
  const status = state.assets[item.assetId];
  if (status?.state !== 'ready' || !status.proxyPath) {
    return { kind: 'waiting', progress: status?.progress ?? 0, itemId: item.id };
  }
  return {
    kind: 'video',
    src: toMediaUrl(status.proxyPath),
    mediaTime: item.in + hit.offset * item.speed,
    rate: item.speed,
    itemId: item.id,
  };
}

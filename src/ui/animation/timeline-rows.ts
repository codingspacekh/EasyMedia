// The animation timeline's rows and labels (M14, AN8, AN9, AN11, AN14), used by Timeline.svelte:
// one row per layer (top first), its objects under it (front first; on a frame-by-frame layer,
// those of the drawing at the playhead), and an opened or selected object's motion paths and
// animated properties under that.
import { objectsShown } from '../../core/animation/frames.ts';
import { TWEEN_PROPERTIES } from '../../core/animation/tween.ts';
import type {
  AnimObject,
  AnimationDoc,
  Id,
  MotionPath,
  Track,
  TweenProperty,
} from '../../core/animation/types.ts';

export type TimelineRow =
  | {
      kind: 'layer';
      id: Id;
      name: string;
      frames: number[];
      open: boolean;
      /** AN14: a frame-by-frame layer's keyframes (each starts a drawing). */
      drawings?: number[];
    }
  | { kind: 'object'; id: Id; name: string; frames: number[]; open: boolean; animated: boolean }
  | { kind: 'property'; id: Id; track: Track }
  /** AN11: the frames an object follows its path. */
  | { kind: 'motion'; id: Id; motion: MotionPath; n: number };

/** Each property's name, as in the Properties panel. */
export const PROPERTY_LABEL = Object.fromEntries(
  TWEEN_PROPERTIES.map((p) => [p.id, p.label]),
) as Record<TweenProperty, string>;
const ORDER = TWEEN_PROPERTIES.map((p) => p.id);

/** The frames where any of the objects has a keyframe, each once. */
const framesOf = (objects: readonly AnimObject[]): number[] => [
  ...new Set(
    objects.flatMap((o) => (o.tracks ?? []).flatMap((t) => t.keyframes.map((k) => k.frame))),
  ),
];

export function timelineRows(
  doc: AnimationDoc,
  frame: number,
  {
    closedLayers,
    openObjects,
    selection,
  }: {
    /** Layers whose objects the student hid. */
    closedLayers: Readonly<Record<Id, boolean>>;
    /** Objects opened (true) or closed (false) by hand; otherwise a selected object is open. */
    openObjects: Readonly<Record<Id, boolean>>;
    selection: readonly Id[];
  },
): TimelineRow[] {
  const out: TimelineRow[] = [];
  for (const layer of [...doc.layers].reverse()) {
    const open = !closedLayers[layer.id];
    out.push({
      kind: 'layer',
      id: layer.id,
      name: layer.name,
      frames: framesOf(layer.objects),
      open,
      ...(layer.drawings ? { drawings: layer.drawings } : {}),
    });
    if (!open) continue;
    // AN14: on a frame-by-frame layer, the objects of the drawing at the playhead.
    for (const o of [...objectsShown(layer, frame)].reverse()) {
      const tracks = (o.tracks ?? []).filter((t) => t.keyframes.length > 0);
      const shown = openObjects[o.id] ?? selection.includes(o.id);
      out.push({
        kind: 'object',
        id: o.id,
        name: o.name,
        frames: framesOf([o]),
        open: shown,
        animated: tracks.length > 0 || (o.paths?.length ?? 0) > 0,
      });
      if (!shown) continue;
      (o.paths ?? []).forEach((motion, i) =>
        out.push({ kind: 'motion', id: o.id, motion, n: i + 1 }),
      );
      for (const track of [...tracks].sort(
        (a, b) => ORDER.indexOf(a.property) - ORDER.indexOf(b.property),
      ))
        out.push({ kind: 'property', id: o.id, track });
    }
  }
  return out;
}

/** Frame numbers every 5, or every 10, 20… when the frames (`px` wide) are narrow. */
export const labelStep = (px: number) =>
  5 * Math.max(1, 2 ** Math.ceil(Math.log2(Math.max(1, 28 / (5 * px)))));

export const frameLabels = (length: number, step: number) =>
  Array.from({ length: Math.floor(length / step) + 1 }, (_, i) => i * step);

/** The whole seconds within the length: 1, 2, 3… */
export const secondLabels = (length: number, fps: number) =>
  Array.from({ length: Math.floor(length / fps) }, (_, i) => i + 1);

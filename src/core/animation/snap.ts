// AN2: snapping. A moved or drawn box snaps its edges and centre to guides, other objects'
// edges and centres, the grid, and whole pixels — in that order of preference — within a
// threshold in stage pixels (the UI divides its screen threshold by the zoom).
import { toStage, type Bounds } from './geometry.ts';
import { drawOrder } from './layers.ts';
import type { AnimObject, AnimationDoc, Id } from './types.ts';

export interface Candidate {
  value: number;
  label: string;
}

export interface SnapOptions {
  /** In stage pixels. */
  threshold: number;
  /** Objects that must not attract (the ones being moved). */
  exclude: readonly Id[];
  /** Alt is held: no snapping at all. */
  off?: boolean;
}

export interface SnapResult {
  dx: number;
  dy: number;
  /** What it snapped to, for the status bar: "grid", "guide", "edge of Star"…; null for pixels. */
  to: string | null;
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** The nearest candidate within the threshold (the first wins a tie), or the value itself. */
export function snapValue(
  value: number,
  candidates: readonly Candidate[],
  threshold: number,
): { value: number; to: string | null } {
  let best: Candidate | null = null;
  let bestDistance = threshold + 1e-9;
  for (const c of candidates) {
    const d = Math.abs(c.value - value);
    if (d < bestDistance) {
      best = c;
      bestDistance = d;
    }
  }
  return best ? { value: best.value, to: best.label } : { value, to: null };
}

type Axis = 'x' | 'y';

/** The bounds of the object's box (the numbers in the Properties panel), turned if it is. */
function boxBounds(o: AnimObject): Bounds {
  const corners = [
    { x: 0, y: 0 },
    { x: o.width, y: 0 },
    { x: o.width, y: o.height },
    { x: 0, y: o.height },
  ].map((c) => toStage(o, c));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function objectCandidates(doc: AnimationDoc, axis: Axis, exclude: readonly Id[]): Candidate[] {
  return drawOrder(doc)
    .filter(({ object }) => !exclude.includes(object.id))
    .flatMap(({ object }) => {
      const b = boxBounds(object);
      const start = axis === 'x' ? b.x : b.y;
      const size = axis === 'x' ? b.width : b.height;
      return [
        { value: start, label: `edge of ${object.name}` },
        { value: start + size / 2, label: `centre of ${object.name}` },
        { value: start + size, label: `edge of ${object.name}` },
      ];
    });
}

function gridCandidates(edges: readonly number[], size: number): Candidate[] {
  return edges.flatMap((e) => [
    { value: Math.floor(e / size) * size, label: 'grid' },
    { value: Math.ceil(e / size) * size, label: 'grid' },
  ]);
}

interface AxisSnap {
  d: number;
  to: string | null;
  rank: number;
  distance: number;
}

function snapAxis(
  doc: AnimationDoc,
  edges: readonly number[],
  axis: Axis,
  { threshold, exclude }: SnapOptions,
): AxisSnap {
  const { snap, grid } = doc.view;
  const groups: Candidate[][] = [];
  groups.push(
    snap.guides
      ? (axis === 'x' ? doc.guides.x : doc.guides.y).map((value) => ({ value, label: 'guide' }))
      : [],
  );
  groups.push(snap.objects ? objectCandidates(doc, axis, exclude) : []);
  // The grid attracts only while it is shown: nothing jumps to lines the student cannot see.
  groups.push(snap.grid && grid.show ? gridCandidates(edges, grid.size) : []);
  for (const [rank, candidates] of groups.entries()) {
    if (candidates.length === 0) continue;
    let best: AxisSnap | null = null;
    for (const edge of edges) {
      const hit = snapValue(edge, candidates, threshold);
      if (hit.to === null) continue;
      const distance = Math.abs(hit.value - edge);
      if (!best || distance < best.distance)
        best = { d: hit.value - edge, to: hit.to, rank, distance };
    }
    if (best) return best;
  }
  if (snap.pixels) {
    const first = edges[0]!;
    return { d: Math.round(first) - first, to: null, rank: groups.length, distance: 0 };
  }
  return { d: 0, to: null, rank: Infinity, distance: Infinity };
}

/** How far to move a box so that an edge or its centre snaps, and to what. */
export function snapBox(doc: AnimationDoc, box: Bounds, options: SnapOptions): SnapResult {
  if (options.off) return { dx: 0, dy: 0, to: null };
  const sx = snapAxis(doc, [box.x, box.x + box.width / 2, box.x + box.width], 'x', options);
  const sy = snapAxis(doc, [box.y, box.y + box.height / 2, box.y + box.height], 'y', options);
  const lead = sx.rank < sy.rank || (sx.rank === sy.rank && sx.distance <= sy.distance) ? sx : sy;
  return { dx: r6(sx.d), dy: r6(sy.d), to: lead.to };
}

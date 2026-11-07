// G5 (M18): align and distribute, as the coursebook's Layer ▸ Align and Distribute (Figures 18.14,
// 18.15). Objects are measured by the box round what is drawn (a turned object's corners), so a
// turned star lines up by its points. Only how far each object moves is worked out here; moving
// is an edit like any other (in Animation mode it is keyed at the playhead).
import { boundsOf, type Bounds } from '../animation/geometry.ts';
import type { AnimObject, Id } from '../animation/types.ts';

export type AlignEdge = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';

/**
 * What they line up with: the box round all of them, the first one chosen (it stays where it is:
 * the key object), or the canvas (one object can be centred on the canvas).
 */
export type AlignTo = 'selection' | 'first' | 'canvas';

export type DistributeAxis = 'horizontal' | 'vertical';

/**
 * How they are spaced: their centres the same distance apart, or the same gap between each one's
 * edge and the next one's ("make the space between objects the same": the coursebook's key word).
 */
export type DistributeBy = 'centres' | 'gaps';

export interface Move {
  id: Id;
  dx: number;
  dy: number;
}

const union = (boxes: readonly Bounds[]): Bounds => {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
};

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Where an edge (or the centre) of a box is, along its axis. */
function at(b: Bounds, edge: AlignEdge): number {
  switch (edge) {
    case 'left':
      return b.x;
    case 'centre':
      return b.x + b.width / 2;
    case 'right':
      return b.x + b.width;
    case 'top':
      return b.y;
    case 'middle':
      return b.y + b.height / 2;
    case 'bottom':
      return b.y + b.height;
  }
}

const horizontal = (edge: AlignEdge) => edge === 'left' || edge === 'centre' || edge === 'right';

/**
 * G5: the moves that line `objects` (in the order chosen) up along `edge`. With 'selection' or
 * 'first' at least two are needed; the canvas works for one. Objects already in line do not move.
 */
export function alignMoves(
  objects: readonly AnimObject[],
  edge: AlignEdge,
  to: AlignTo,
  canvas: { width: number; height: number },
): Move[] {
  if (objects.length === 0 || (to !== 'canvas' && objects.length < 2)) return [];
  const boxes = objects.map(boundsOf);
  const target =
    to === 'canvas'
      ? { x: 0, y: 0, width: canvas.width, height: canvas.height }
      : to === 'first'
        ? boxes[0]!
        : union(boxes);
  const line = at(target, edge);
  return objects
    .map((o, i) => {
      const d = round(line - at(boxes[i]!, edge));
      return horizontal(edge) ? { id: o.id, dx: d, dy: 0 } : { id: o.id, dx: 0, dy: d };
    })
    .filter((m) => m.dx !== 0 || m.dy !== 0);
}

/**
 * G5: the moves that space three or more objects evenly between the two furthest apart, which
 * stay where they are. The others keep their order along the axis.
 */
export function distributeMoves(
  objects: readonly AnimObject[],
  axis: DistributeAxis,
  by: DistributeBy,
): Move[] {
  if (objects.length < 3) return [];
  const across = axis === 'horizontal';
  const placed = objects
    .map((o) => {
      const b = boundsOf(o);
      const start = across ? b.x : b.y;
      const size = across ? b.width : b.height;
      return { id: o.id, start, size, centre: start + size / 2 };
    })
    .sort((a, b) => a.centre - b.centre || a.start - b.start);
  const first = placed[0]!;
  const last = placed.at(-1)!;
  const n = placed.length - 1;
  const moves: Move[] = [];
  if (by === 'centres') {
    const step = (last.centre - first.centre) / n;
    placed.forEach((p, i) => {
      const d = round(first.centre + step * i - p.centre);
      if (d !== 0) moves.push(across ? { id: p.id, dx: d, dy: 0 } : { id: p.id, dx: 0, dy: d });
    });
    return moves;
  }
  const total = placed.reduce((sum, p) => sum + p.size, 0);
  const gap = (last.start + last.size - first.start - total) / n;
  let edge = first.start;
  for (const p of placed) {
    const d = round(edge - p.start);
    if (d !== 0) moves.push(across ? { id: p.id, dx: d, dy: 0 } : { id: p.id, dx: 0, dy: d });
    edge += p.size + gap;
  }
  return moves;
}

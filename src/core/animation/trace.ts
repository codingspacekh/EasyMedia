// AN5: Trace bitmap. A picture's pixels are reduced to a few colours (k-means), each colour's
// connected regions are found and their outlines followed along the pixel edges, the outlines are
// simplified (Ramer–Douglas–Peucker: the detail setting) and given curve handles (the smoothing
// setting). The regions come largest first, so a region inside another is drawn over it; holes are
// not cut, as the regions in them cover them. Detail is lost, as the coursebook warns.
import { fileNameOf } from '../project/relocate.ts';
import { createGroup, createPath } from './factory.ts';
import type { GroupObject, PathObject, PathPoint, PictureObject } from './types.ts';

/** RGBA pixels, row by row (an ImageData in the app). */
export interface Pixels {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export interface TraceOptions {
  /** How many colours the picture is reduced to (2–16). */
  colours: number;
  /** 0–100: more detail keeps more points and smaller specks. */
  detail: number;
  /** 0–100: 0 keeps the corners; more gives the points longer curve handles. */
  smoothing: number;
}

export interface TracedRegion {
  /** Hex, e.g. "#e6141e". */
  colour: string;
  /** The outline (closed), in the picture's pixels. */
  points: PathPoint[];
  /** In pixels. */
  area: number;
}

/** In `index`, a see-through pixel. */
export const CLEAR = 255;

export const TRACE_LIMITS = { colours: { min: 2, max: 16 } } as const;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const hex = (c: number) =>
  `#${[c >> 16, (c >> 8) & 255, c & 255].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const dist2 = (a: number, b: number) =>
  ((a >> 16) - (b >> 16)) ** 2 +
  (((a >> 8) & 255) - ((b >> 8) & 255)) ** 2 +
  ((a & 255) - (b & 255)) ** 2;

/**
 * The picture's `n` main colours (fewer if it has fewer) and each pixel's colour as an index into
 * them; CLEAR for pixels less than half opaque.
 */
export function quantise(pixels: Pixels, n: number): { palette: string[]; index: Uint8Array } {
  const { width, height, data } = pixels;
  const counts = new Map<number, number>();
  for (let i = 0; i < width * height; i++) {
    if (data[i * 4 + 3]! < 128) continue;
    const c = (data[i * 4]! << 16) | (data[i * 4 + 1]! << 8) | data[i * 4 + 2]!;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const colours = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const k = Math.min(clamp(Math.round(n), 1, CLEAR - 1), colours.length);
  const centres = k === colours.length ? colours.map(([c]) => c) : kMeans(colours, k);

  const nearest = new Map<number, number>();
  const nearestOf = (c: number) => {
    let best = nearest.get(c);
    if (best === undefined) {
      best = 0;
      for (let j = 1; j < centres.length; j++)
        if (dist2(c, centres[j]!) < dist2(c, centres[best]!)) best = j;
      nearest.set(c, best);
    }
    return best;
  };
  const index = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++)
    index[i] =
      data[i * 4 + 3]! < 128
        ? CLEAR
        : nearestOf((data[i * 4]! << 16) | (data[i * 4 + 1]! << 8) | data[i * 4 + 2]!);
  return { palette: centres.map(hex), index };
}

/** k-means over the distinct colours weighted by their counts; starts from the commonest colour and the farthest ones. */
function kMeans(colours: [number, number][], k: number): number[] {
  // Many distinct colours (a photo): cluster their 5-bit buckets instead, for speed.
  if (colours.length > 4096) {
    const buckets = new Map<number, [number, number, number, number]>();
    for (const [c, w] of colours) {
      const key = ((c >> 19) << 10) | (((c >> 11) & 31) << 5) | ((c >> 3) & 31);
      const b = buckets.get(key) ?? [0, 0, 0, 0];
      b[0] += (c >> 16) * w;
      b[1] += ((c >> 8) & 255) * w;
      b[2] += (c & 255) * w;
      b[3] += w;
      buckets.set(key, b);
    }
    colours = [...buckets.values()]
      .map(([r, g, b, w]): [number, number] => [
        (Math.round(r / w) << 16) | (Math.round(g / w) << 8) | Math.round(b / w),
        w,
      ])
      .sort((a, b) => b[1] - a[1]);
  }
  const centres = [colours[0]![0]];
  while (centres.length < k) {
    let far = colours[0]![0];
    let farD = -1;
    for (const [c, w] of colours) {
      const d = Math.min(...centres.map((m) => dist2(c, m))) * Math.sqrt(w);
      if (d > farD) [far, farD] = [c, d];
    }
    centres.push(far);
  }
  for (let round = 0; round < 10; round++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const [c, w] of colours) {
      let best = 0;
      for (let j = 1; j < k; j++) if (dist2(c, centres[j]!) < dist2(c, centres[best]!)) best = j;
      const s = sums[best]!;
      s[0]! += (c >> 16) * w;
      s[1]! += ((c >> 8) & 255) * w;
      s[2]! += (c & 255) * w;
      s[3]! += w;
    }
    let moved = false;
    sums.forEach(([r, g, b, w], j) => {
      if (!w) return;
      const next = (Math.round(r! / w) << 16) | (Math.round(g! / w) << 8) | Math.round(b! / w);
      if (next !== centres[j]) [centres[j], moved] = [next, true];
    });
    if (!moved) break;
  }
  return centres;
}

// Directions clockwise on the screen (y down): east, south, west, north.
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
// The pixel on the right and on the left of the edge leaving a corner (x, y) in each direction.
const RIGHT = [
  [0, 0],
  [-1, 0],
  [-1, -1],
  [0, -1],
];
const LEFT = [
  [0, -1],
  [0, 0],
  [-1, 0],
  [-1, -1],
];

export function traceBitmap(pixels: Pixels, options: TraceOptions): TracedRegion[] {
  const { width, height } = pixels;
  const detail = clamp(options.detail, 0, 100) / 100;
  const smoothing = clamp(options.smoothing, 0, 100) / 100;
  const { palette, index } = quantise(
    pixels,
    clamp(options.colours, TRACE_LIMITS.colours.min, TRACE_LIMITS.colours.max),
  );
  const minArea =
    detail >= 1 ? 1 : Math.max(1, Math.round(width * height * 0.002 * (1 - detail) ** 2));
  const tolerance = 0.5 + (1 - detail) * 0.02 * Math.max(width, height);

  const label = new Int32Array(width * height).fill(-1);
  const stack = new Int32Array(width * height);
  const regions: TracedRegion[] = [];
  for (let start = 0; start < width * height; start++) {
    const colour = index[start]!;
    if (colour === CLEAR || label[start] !== -1) continue;
    // Flood the region (8-connected, as the outline follows it).
    const id = start;
    let area = 0;
    let top = 0;
    stack[top++] = start;
    label[start] = id;
    while (top > 0) {
      const p = stack[--top]!;
      area++;
      const px = p % width;
      const py = (p - px) / width;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx;
          const y = py + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const q = y * width + x;
          if (label[q] === -1 && index[q] === colour) {
            label[q] = id;
            stack[top++] = q;
          }
        }
    }
    if (area < minArea) continue;
    const outline = follow(label, width, height, id, start % width, Math.floor(start / width));
    regions.push({
      colour: palette[colour]!,
      points: smooth(simplify(outline, tolerance), smoothing),
      area,
    });
  }
  // Stable: equal areas keep their order on the picture.
  return regions.sort((a, b) => b.area - a.area);
}

/** The region's outer outline along the pixel edges, keeping the region on the right; corners only. */
function follow(
  label: Int32Array,
  width: number,
  height: number,
  id: number,
  sx: number,
  sy: number,
): { x: number; y: number }[] {
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && label[y * width + x] === id;
  const edge = (x: number, y: number, d: number) =>
    inside(x + RIGHT[d]![0]!, y + RIGHT[d]![1]!) && !inside(x + LEFT[d]![0]!, y + LEFT[d]![1]!);
  const points: { x: number; y: number }[] = [];
  // The top-left corner of the first pixel: nothing of the region is above or to its left.
  let [x, y, d] = [sx, sy, 3];
  do {
    // Turn left if possible, else straight on, else right (else back: a one-pixel spike).
    let next = d;
    for (const turn of [3, 0, 1, 2]) {
      next = (d + turn) % 4;
      if (edge(x, y, next)) break;
    }
    if (next !== d) points.push({ x, y });
    d = next;
    x += DX[d]!;
    y += DY[d]!;
  } while (x !== sx || y !== sy);
  return points;
}

const offLine = (
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  return length === 0
    ? Math.hypot(p.x - a.x, p.y - a.y)
    : Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / length;
};

/** Ramer–Douglas–Peucker on an open chain, keeping both ends. */
function rdp(points: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const a = points[0]!;
  const b = points.at(-1)!;
  let far = 0;
  let farD = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const d = offLine(points[i]!, a, b);
    if (d > farD) [far, farD] = [i, d];
  }
  if (farD <= tolerance) return [a, b];
  return [
    ...rdp(points.slice(0, far + 1), tolerance).slice(0, -1),
    ...rdp(points.slice(far), tolerance),
  ];
}

/** RDP on a closed outline: split at the point farthest from the first; at least a triangle. */
function simplify(
  points: { x: number; y: number }[],
  tolerance: number,
): { x: number; y: number }[] {
  if (points.length <= 4) return points;
  const first = points[0]!;
  let far = 1;
  for (let i = 2; i < points.length; i++)
    if (
      Math.hypot(points[i]!.x - first.x, points[i]!.y - first.y) >
      Math.hypot(points[far]!.x - first.x, points[far]!.y - first.y)
    )
      far = i;
  const kept = [
    ...rdp(points.slice(0, far + 1), tolerance).slice(0, -1),
    ...rdp([...points.slice(far), first], tolerance).slice(0, -1),
  ];
  if (kept.length >= 3) return kept;
  const third = Math.floor(points.length / 3);
  return [points[0]!, points[third]!, points[2 * third]!];
}

/** Catmull-Rom handles: each point's handles lie along the line from the point before to the one after. */
function smooth(points: { x: number; y: number }[], smoothing: number): PathPoint[] {
  if (smoothing === 0) return points.map((p) => ({ x: p.x, y: p.y }));
  const f = smoothing / 6;
  return points.map((p, i) => {
    const before = points[(i - 1 + points.length) % points.length]!;
    const after = points[(i + 1) % points.length]!;
    const tx = (after.x - before.x) * f;
    const ty = (after.y - before.y) * f;
    return { x: p.x, y: p.y, in: { x: p.x - tx, y: p.y - ty }, out: { x: p.x + tx, y: p.y + ty } };
  });
}

/**
 * AN5: the traced regions as a group of filled shapes in the picture's place: its box, turn,
 * opacity and keyframes, so it can be edited and animated part by part. `traced` is the size the
 * pixels were read at.
 */
export function tracedGroup(
  picture: PictureObject,
  regions: readonly TracedRegion[],
  traced: { width: number; height: number },
): GroupObject {
  const sx = picture.width / traced.width;
  const sy = picture.height / traced.height;
  const scale = (p: { x: number; y: number }) => ({ x: p.x * sx, y: p.y * sy });
  const children = regions.map((region, i): PathObject => {
    const shape = createPath(region.points.map(scale), true, `Colour ${i + 1}`);
    const at = (p: { x: number; y: number }) => {
      const q = scale(p);
      return { x: q.x - shape.x, y: q.y - shape.y };
    };
    return {
      ...shape,
      points: region.points.map((p) => ({
        ...at(p),
        ...(p.in ? { in: at(p.in) } : {}),
        ...(p.out ? { out: at(p.out) } : {}),
      })),
      fill: { kind: 'solid', colour: region.colour },
      stroke: undefined,
    };
  });
  const { id } = createGroup(children);
  return {
    kind: 'group',
    id,
    name: `Traced ${fileNameOf(picture.name)}`,
    x: picture.x,
    y: picture.y,
    width: picture.width,
    height: picture.height,
    rotation: picture.rotation,
    opacity: picture.opacity,
    fill: { kind: 'none' },
    children,
    ...(picture.tracks ? { tracks: picture.tracks } : {}),
    ...(picture.paths ? { paths: picture.paths } : {}),
  };
}

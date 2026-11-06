// AN19: stage backgrounds, drawn at 1280 × 720 and stretched to the stage, on a layer of their
// own at the bottom. Their parts (sun, clouds, waves…) can be animated as the secondary
// components of an animation (the background). Three kinds: scenes (a classroom, a lab, space…),
// paper and boards (graph paper, a cork board…), and calm patterns (dots, stripes, bricks…) kept
// low in contrast so the cartoons and text on top stay easy to read. Each stays at most a few
// hundred shapes, since the stage redraws every frame on weak school laptops.
import {
  arc,
  circle,
  ellipse,
  group,
  line,
  rect,
  shape,
  star,
  turnedRect,
  type Fill,
  type LibraryItem,
  type Part,
} from './build.ts';

const W = 1280;
const H = 720;

const background = (id: string, name: string, keywords: string[], parts: Part[]): LibraryItem => ({
  id,
  name,
  category: 'backgrounds',
  keywords: ['background', 'scene', ...keywords],
  width: W,
  height: H,
  parts,
});

/** A row of hills: a closed shape along a wavy top edge down to the bottom of the stage. */
function hills(name: string, top: number, height: number, waves: number, colour: string): Part {
  const edge = Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * W;
    return [x, top + height * (0.5 - 0.5 * Math.sin((i / 40) * waves * 2 * Math.PI))] as [
      number,
      number,
    ];
  });
  return shape(name, [...edge, [W, H], [0, H]], colour);
}

const cloud = (name: string, x: number, y: number, s: number): Part =>
  group(name, [
    rect('Base', x, y + 20 * s, 120 * s, 34 * s, '#ffffff', { radius: 17 * s }),
    circle('Left puff', x + 34 * s, y + 26 * s, 26 * s, '#ffffff'),
    circle('Right puff', x + 76 * s, y + 20 * s, 32 * s, '#ffffff'),
  ]);

const FIRST_SCENES: readonly LibraryItem[] = [
  background(
    'background.sky',
    'Sky and grass',
    ['outdoors', 'day', 'field', 'park', 'nature'],
    [
      rect('Sky', 0, 0, W, 520, { from: '#5fb4ff', to: '#d6efff', angle: 90 }),
      circle('Sun', 1110, 120, 64, '#ffd84a'),
      cloud('Cloud 1', 160, 90, 1.4),
      cloud('Cloud 2', 620, 160, 1),
      hills('Far hills', 400, 90, 1.5, '#7cc96b'),
      rect('Grass', 0, 500, W, 220, { from: '#5cb85c', to: '#3d8b3d', angle: 90 }),
    ],
  ),
  background(
    'background.underwater',
    'Underwater',
    ['sea', 'ocean', 'fish', 'water'],
    [
      rect('Water', 0, 0, W, H, { from: '#2aa7e0', to: '#0b3d66', angle: 90 }),
      hills('Sand', 600, 50, 2, '#e8cf8f'),
      group(
        'Seaweed',
        [180, 420, 900, 1120].map((x, i) =>
          shape(
            `Seaweed ${i + 1}`,
            [
              ...Array.from(
                { length: 9 },
                (_, k) => [x + 14 * Math.sin(k), 640 - k * 40] as [number, number],
              ),
              ...Array.from(
                { length: 9 },
                (_, k) => [x + 22 + 14 * Math.sin(8 - k), 320 + k * 40] as [number, number],
              ),
            ],
            '#2f9e5a',
          ),
        ),
      ),
      group(
        'Bubbles',
        [
          [300, 300, 14],
          [330, 240, 9],
          [760, 200, 16],
          [790, 140, 10],
          [1000, 380, 12],
        ].map(([x, y, r], i) =>
          circle(`Bubble ${i + 1}`, x!, y!, r!, '#bfe9ff', { opacity: 70, stroke: ['#ffffff', 2] }),
        ),
      ),
    ],
  ),
  background(
    'background.night',
    'Night sky',
    ['night', 'stars', 'moon', 'dark', 'space'],
    [
      rect('Sky', 0, 0, W, H, { from: '#0b1030', to: '#2a2f6b', angle: 90 }),
      group(
        'Stars',
        [
          [120, 90],
          [300, 160],
          [520, 70],
          [700, 210],
          [880, 110],
          [1180, 230],
          [420, 280],
          [980, 300],
          [200, 330],
        ].map(([x, y], i) => star(`Star ${i + 1}`, x! - 9, y! - 9, 18, 18, '#fff6c8', 5, 0.45)),
      ),
      group('Moon', [
        circle('Moon', 1050, 130, 60, '#fff3b0'),
        circle('Shadow', 1078, 112, 52, '#1a2050'),
      ]),
      hills('Hills', 520, 80, 1, '#141a3a'),
    ],
  ),
  background(
    'background.sunset',
    'Sunset over the sea',
    ['evening', 'sea', 'beach', 'sun'],
    [
      rect('Sky', 0, 0, W, 460, { from: '#ff8a3d', to: '#7b3fa0', angle: 270 }),
      shape('Sun', [...arc(640, 460, 120, 120, 180, 360, 24)], '#ffd23f'),
      rect('Sea', 0, 460, W, 260, { from: '#3a4f9a', to: '#1b2552', angle: 90 }),
      group(
        'Sun on the water',
        [500, 540, 580].map((y, i) =>
          rect(`Glint ${i + 1}`, 560 + i * 20, y, 160 - i * 40, 8, '#ffd23f', {
            radius: 4,
            opacity: 80,
          }),
        ),
      ),
    ],
  ),
  background(
    'background.classroom',
    'Classroom',
    ['school', 'class', 'board', 'learn', 'indoors'],
    [
      rect('Wall', 0, 0, W, 560, '#f2e6c9'),
      rect('Floor', 0, 560, W, 160, '#c08a52'),
      rect('Board frame', 250, 70, 780, 380, '#8b5a2b', { radius: 8 }),
      rect('Board', 270, 90, 740, 340, '#2f5d46'),
      rect('Chalk tray', 290, 440, 700, 14, '#a0703f'),
      group('Clock', [
        circle('Clock face', 1150, 120, 50, '#ffffff', { stroke: ['#2d2a32', 6] }),
        rect('Hand', 1147, 84, 6, 40, '#2d2a32'),
      ]),
      group('Desk', [
        rect('Desk top', 80, 520, 300, 30, '#a0703f'),
        rect('Desk leg', 100, 550, 20, 140, '#7a4f2b'),
        rect('Desk leg 2', 340, 550, 20, 140, '#7a4f2b'),
      ]),
    ],
  ),
  background(
    'background.city',
    'City skyline',
    ['town', 'buildings', 'street', 'urban'],
    [
      rect('Sky', 0, 0, W, H, { from: '#9fd3ff', to: '#e9f6ff', angle: 90 }),
      group(
        'Buildings',
        [
          [40, 260, 160],
          [220, 160, 140],
          [380, 320, 180],
          [580, 120, 150],
          [750, 230, 170],
          [940, 180, 130],
          [1090, 290, 170],
        ].map(([x, top, w], i) =>
          rect(
            `Building ${i + 1}`,
            x!,
            top!,
            w!,
            620 - top!,
            ['#5a6b80', '#6f7f94', '#4c5c70'][i % 3]!,
          ),
        ),
      ),
      group(
        'Windows',
        Array.from({ length: 14 }, (_, i) =>
          rect(
            `Window ${i + 1}`,
            70 + (i % 7) * 165,
            340 + Math.floor(i / 7) * 90,
            40,
            46,
            '#ffe9a6',
            { opacity: 85 },
          ),
        ),
      ),
      rect('Road', 0, 620, W, 100, '#3a3a40'),
      group(
        'Road lines',
        Array.from({ length: 8 }, (_, i) =>
          rect(`Line ${i + 1}`, 40 + i * 160, 666, 90, 8, '#f2f2f2'),
        ),
      ),
    ],
  ),
];

// ---- helpers for the scenes, papers and patterns below ----

type Pt = readonly [number, number];
interface Extra {
  opacity?: number;
  stroke?: readonly [string, number];
  radius?: number;
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** The same "random" numbers every time, so a background looks the same on every computer. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A colour part of the way from one to another (#rrggbb). */
function mix(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const n = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(n(a, i) + (n(b, i) - n(a, i)) * k)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** The points turned by `deg` about (cx, cy). */
function turn(points: readonly Pt[], cx: number, cy: number, deg: number): Pt[] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return points.map(([x, y]) => [
    cx + (x - cx) * c - (y - cy) * s,
    cy + (x - cx) * s + (y - cy) * c,
  ]);
}

/** A closed shape cut down to the stage, so a pattern runs right to the edges. */
function clipToStage(points: readonly Pt[]): Pt[] {
  let out: Pt[] = [...points];
  const sides: [0 | 1, number, number][] = [
    [0, 0, 1],
    [0, W, -1],
    [1, 0, 1],
    [1, H, -1],
  ];
  for (const [k, v, sign] of sides) {
    const input = out;
    out = [];
    const inside = (p: Pt) => sign * (p[k] - v) >= -1e-9;
    input.forEach((cur, i) => {
      const prev = input[(i + input.length - 1) % input.length]!;
      const cut = (): Pt => {
        const t = (v - prev[k]) / (cur[k] - prev[k]);
        const p: [number, number] = [
          prev[0] + t * (cur[0] - prev[0]),
          prev[1] + t * (cur[1] - prev[1]),
        ];
        p[k] = v;
        return p;
      };
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut());
        out.push(cur);
      } else if (inside(prev)) out.push(cut());
    });
    if (out.length === 0) break;
  }
  return out;
}

const onStage = (points: readonly Pt[]) =>
  points.every(([x, y]) => x >= 0 && x <= W && y >= 0 && y <= H);

/** A closed shape, cut to the stage; nothing if none of it is on the stage. */
function piece(name: string, points: readonly Pt[], fill: Fill, o: Extra = {}): Part | null {
  const p = onStage(points) ? points : clipToStage(points);
  return p.length >= 3 ? shape(name, p, fill, o) : null;
}

const kept = (parts: readonly (Part | null)[]): Part[] =>
  parts.filter((p): p is Part => p !== null);

/** A circle, cut to the stage where it runs over an edge. */
function dot(name: string, cx: number, cy: number, r: number, fill: Fill, o: Extra = {}) {
  if (cx - r >= 0 && cx + r <= W && cy - r >= 0 && cy + r <= H)
    return circle(name, cx, cy, r, fill, o);
  return piece(name, arc(cx, cy, r, r, 0, 360, 28).slice(0, -1), fill, o);
}

/** A rectangle, cut to the stage. */
function block(
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: Fill,
  o: Extra = {},
) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  return x1 - x0 > 0.5 && y1 - y0 > 0.5 ? rect(name, x0, y0, x1 - x0, y1 - y0, fill, o) : null;
}

/** Points along a wavy line right across the stage. */
const wavy = (y: number, amp: number, waves: number, phase = 0, steps = 48): Pt[] =>
  range(steps + 1).map((i) => [
    (i / steps) * W,
    y + amp * Math.sin((i / steps) * waves * 2 * Math.PI + phase),
  ]);

/** Land (or water) from a wavy top edge down to the bottom of the stage. */
const ground = (name: string, y: number, amp: number, waves: number, phase: number, fill: Fill) =>
  shape(name, [...wavy(y, amp, waves, phase), [W, H], [0, H]], fill);

/** A fir tree of three tiers standing on `base`, `h` tall; with a trunk or snow if given. */
function pine(
  name: string,
  x: number,
  base: number,
  h: number,
  colour: string,
  o: { trunk?: string; snow?: string } = {},
): Part {
  // Each tier: its top and bottom (as heights above the base) and half its width, × h.
  const tiers: [string, number, number, number][] = [
    ['Bottom branches', 0.62, 0.14, 0.38],
    ['Middle branches', 0.82, 0.38, 0.3],
    ['Top branches', 1, 0.6, 0.22],
  ];
  // A tree at the edge of the stage is cut off by it, as by a window frame.
  return group(
    name,
    kept([
      o.trunk ? block('Trunk', x - 0.05 * h, base - 0.16 * h, 0.1 * h, 0.16 * h, o.trunk) : null,
      ...tiers.flatMap(([tier, top, bottom, half]) => {
        const y0 = base - top * h;
        const th = (top - bottom) * h;
        const hw = half * h;
        return [
          piece(
            tier,
            [
              [x, y0],
              [x + hw, y0 + th],
              [x - hw, y0 + th],
            ],
            colour,
          ),
          o.snow
            ? piece(
                `Snow on the ${tier.toLowerCase()}`,
                [
                  [x, y0],
                  [x + hw * 0.45, y0 + th * 0.45],
                  [x + hw * 0.18, y0 + th * 0.36],
                  [x, y0 + th * 0.48],
                  [x - hw * 0.18, y0 + th * 0.36],
                  [x - hw * 0.45, y0 + th * 0.45],
                ],
                o.snow,
              )
            : null,
        ];
      }),
    ]),
  );
}

/** The outline of a leaf from its stalk at (x, y), pointing at `deg`, bending down by `droop`. */
function leafPoints(x: number, y: number, deg: number, len: number, wide: number, droop = 0) {
  const a = (deg * Math.PI) / 180;
  const [dx, dy] = [Math.cos(a), Math.sin(a)];
  const mid = (t: number): Pt => [x + dx * len * t, y + dy * len * t + droop * len * t * t];
  const side = (sign: number) =>
    range(13).map((i): Pt => {
      const t = i / 12;
      const [mx, my] = mid(t);
      const w = (sign * wide * Math.sin(Math.PI * Math.pow(t, 0.8))) / 2;
      return [mx - dy * w, my + dx * w];
    });
  return {
    outline: [...side(1), ...side(-1).reverse().slice(1, -1)],
    rib: range(7).map((i) => mid(i / 8)),
  };
}

/** A small seagull: two arcs. */
const gull = (name: string, x: number, y: number, s: number, colour = '#4a5560'): Part =>
  line(
    name,
    [
      ...arc(x - 10 * s, y + 6 * s, 10 * s, 7 * s, 200, 320, 5),
      ...arc(x + 10 * s, y + 6 * s, 10 * s, 7 * s, 220, 340, 5),
    ],
    colour,
    3 * s,
  );

// ---- the world's land, as longitude/latitude pairs, for the world map and the globe ----
// Simplified outlines: enough to know each continent, not to find a town.

const LAND: readonly (readonly [string, readonly number[]])[] = [
  [
    'North America',
    [
      -166, 68, -157, 71, -141, 70, -128, 70, -115, 68.5, -100, 68, -88, 68.5, -82, 66, -75, 63,
      -65, 60, -62, 56, -56, 52, -60, 47, -66, 44, -70, 42, -74, 40, -76, 35, -81, 31, -80.5, 27,
      -80, 25.3, -81.5, 25.5, -82.7, 28, -84, 30, -89, 30, -94, 29.5, -97, 27.5, -97.5, 22, -95,
      18.5, -91, 18.5, -90.5, 21, -87, 21.5, -88, 16, -84, 15, -83.5, 11, -81.5, 9, -79, 9, -77.5,
      8, -78.5, 7, -80, 7.5, -85, 10, -87.5, 13, -92, 14.5, -96, 15.7, -105, 19.5, -106, 23.5, -109,
      26.5, -112.5, 30, -114.7, 31.7, -112.5, 28, -109.5, 23, -112, 25, -115, 28, -116.5, 31.5,
      -117.2, 32.7, -120.5, 34.5, -122.5, 37.5, -124, 40.5, -124.5, 46, -123, 48.5, -128, 51, -131,
      54, -134, 57.5, -137, 58.5, -141, 60, -146, 61, -150, 60, -152, 58, -157, 57, -162, 55, -165,
      54.5, -158, 58, -162, 58.5, -165, 61, -165, 63.5, -162, 64.5, -166, 65.5,
    ],
  ],
  [
    'Arctic islands',
    [-120, 72, -105, 73, -95, 76, -80, 80, -65, 82, -80, 83, -100, 80, -118, 77, -123, 74],
  ],
  ['Baffin Island', [-80, 73, -72, 72, -62, 67, -64, 63, -72, 64, -78, 65, -85, 70]],
  [
    'Greenland',
    [
      -73, 78, -60, 82, -40, 83.5, -22, 82, -18, 76, -20, 70, -24, 68, -32, 66, -40, 65, -43, 60,
      -48, 61, -52, 65, -54, 68, -55, 71, -60, 76, -68, 77,
    ],
  ],
  ['Iceland', [-22.5, 66, -16, 66.5, -13.6, 65, -18.5, 63.4, -22.7, 64]],
  ['Cuba', [-85, 21.8, -82, 23.1, -77.5, 21.8, -74.2, 20.2, -77.5, 19.9, -81, 21.5]],
  ['Hispaniola', [-74.4, 19.8, -68.5, 19, -68.3, 18.4, -71.5, 17.6, -74.5, 18.4]],
  [
    'South America',
    [
      -77.5, 8.5, -75, 11, -71.5, 12.4, -68, 10.6, -62, 10.7, -60, 8.5, -57, 6, -52, 5, -50, 1.5,
      -48, -1, -44, -2.5, -39, -3.5, -35, -5.5, -35, -9, -38.5, -13, -39, -17.5, -41, -22, -44, -23,
      -48, -26, -48.5, -28.5, -52, -32, -55, -35, -57.5, -36, -57, -38.5, -62, -39, -65, -41, -64,
      -43, -67, -46, -66, -48, -68.5, -50.5, -69, -52.5, -68, -55, -71, -54, -74, -52, -75, -48,
      -74, -43, -73.5, -37, -71.5, -30, -70.5, -23, -70.3, -18, -75, -15, -77, -12, -79, -8, -81,
      -5, -80, -2, -80, 1, -78.8, 1.5, -77.5, 4, -77.5, 7,
    ],
  ],
  [
    'Europe and Asia',
    [
      -9, 43, -1.5, 43.5, -1.5, 46.5, -4.5, 48.5, -1.5, 49.7, 2, 51, 4, 52, 5, 53.5, 8.5, 54, 8.3,
      57, 10.5, 57.7, 10.5, 54.5, 12, 54.3, 14, 54, 18, 54.8, 21, 55, 21, 57, 24, 57.5, 24, 59.3,
      28, 59.7, 23, 60, 21.5, 61.5, 21.5, 63.5, 25, 65, 22, 65.8, 19, 63.5, 17.5, 62, 18.5, 59.5,
      16.5, 57, 14, 55.5, 12.5, 56, 11, 58.5, 8, 58, 5.5, 59, 5, 62, 8, 63.5, 12, 66, 15, 68.5, 19,
      70, 24, 71, 28, 71, 31, 70, 33, 69, 40, 67.5, 41, 66.5, 36, 66, 38, 64.5, 44, 66, 44, 68.5,
      53, 68.5, 58, 68.5, 60, 69.8, 68, 69, 66, 71, 69, 73, 72, 72.5, 73, 69, 78, 72, 83, 70, 87,
      74, 98, 76, 104, 77.5, 112, 74, 122, 73, 130, 71, 140, 72, 150, 71, 160, 69.5, 170, 70, 180,
      68.5, 180, 65, 178, 64.5, 172, 60.5, 163, 59.8, 162, 57, 156, 51, 155, 57, 160, 61, 155, 59.5,
      150, 59.5, 143, 59, 138, 56, 141, 52, 140, 48, 135, 43, 132, 43, 129, 40.5, 129, 35.5, 126.5,
      34.5, 126, 37.5, 124.5, 39.8, 121, 40.5, 121.5, 39, 119, 37.5, 122.5, 37, 120, 34.5, 121.5,
      31, 122, 29, 119.5, 25, 117, 23.5, 113, 22, 110, 21, 108, 21.5, 106.5, 19, 108.5, 16, 109, 12,
      107, 10.5, 105, 8.8, 104.5, 10.5, 102, 12.5, 100.5, 13.5, 99.5, 10, 100.3, 7, 102, 6, 103.5,
      1.5, 101, 2.8, 98.5, 7.5, 98.3, 10.5, 97.5, 16.5, 94.5, 17, 94, 19.5, 92, 21.5, 89, 21.8,
      86.5, 20, 84, 17.5, 80.3, 15.5, 80, 10.5, 77.5, 8, 76, 10, 74.5, 14, 73, 18, 72.7, 21, 70, 22,
      68, 23.8, 66.5, 25.4, 61.5, 25.2, 57.5, 25.7, 56.4, 27, 54, 26.6, 51, 28, 48.5, 30, 50, 26.5,
      51.5, 24.2, 54, 24.2, 56.3, 26.3, 56.5, 24.5, 58.5, 23.5, 59.8, 22.5, 58.5, 20.5, 57.5, 18.9,
      55, 17, 52, 16, 48.5, 14, 45, 13, 43.5, 12.7, 42.8, 15, 42, 18, 39.5, 21.5, 38.5, 24, 35.5,
      28, 34.5, 29.5, 32.5, 31, 34.8, 32.5, 35.8, 34.5, 36, 36.5, 34, 36.3, 32, 36.1, 30, 36.4,
      27.5, 36.7, 26.3, 38.5, 26.5, 40.2, 26, 41, 24, 40.5, 22.8, 40.5, 23.5, 38, 22, 36.5, 21, 38,
      19.5, 40, 19.5, 41.8, 16, 43.5, 13.7, 45.2, 12.3, 45.3, 12.5, 44, 14, 42, 16, 41, 18.5, 40,
      17, 39, 16.5, 38, 15.7, 40, 14, 40.8, 12, 42, 10.5, 43, 9, 44.3, 7.5, 43.8, 5, 43.3, 3.2, 43,
      3.2, 41.9, 0.8, 41, 0, 39.5, -0.7, 37.6, -2.2, 36.7, -4.5, 36.6, -6, 36.2, -7, 37.2, -8.8, 37,
      -9, 39,
    ],
  ],
  [
    'Great Britain',
    [
      -5.7, 50, 1.5, 51.2, 1.7, 52.7, 0, 53.5, -0.5, 54.5, -2, 55.8, -1.8, 57.5, -3.5, 58.6, -5,
      58.6, -5.8, 57, -5.5, 55.4, -3, 55, -3, 53.4, -4.6, 52.8, -5.2, 51.7, -3, 51.5, -4.2, 51.2,
    ],
  ],
  ['Ireland', [-6, 52.2, -6, 54, -7.5, 55.3, -8.5, 54.5, -10, 53.5, -10, 51.6, -8, 51.6]],
  [
    'Africa',
    [
      -17, 21, -16.5, 24, -14.5, 26.2, -13, 27.8, -10, 29.5, -9.6, 31, -6.8, 34, -5.9, 35.8, -2,
      35.1, 1, 36.5, 5, 36.8, 10, 37.3, 11, 36.8, 10.2, 34.5, 11, 33.2, 15, 32.3, 19.7, 30.5, 20,
      32, 23, 32.6, 25, 31.7, 29, 30.9, 32.3, 31.3, 32.6, 29.9, 33.7, 27.5, 35.5, 24, 37.2, 21,
      38.5, 18, 39.7, 15.5, 41.5, 13.8, 43.3, 12, 44, 10.5, 45, 10.5, 48, 11.2, 51.2, 11.8, 51,
      10.5, 49.5, 7, 47.5, 4.5, 44, 1, 41.5, -1.8, 39.8, -4, 39, -6.5, 39.5, -9, 40.5, -11, 40.5,
      -15, 39, -16.8, 36.5, -18.8, 35.3, -22, 35.5, -24, 33, -25.8, 32.8, -28.5, 30.5, -31, 27.5,
      -33.5, 25, -34, 22, -34.4, 20, -34.8, 18.4, -34, 18, -32, 17.2, -29, 15.3, -27, 14.5, -23, 13,
      -20, 11.8, -17, 12.3, -13.5, 13.7, -11, 13.2, -8.7, 12.2, -6, 11.8, -4, 9.5, -2, 9.3, 1, 9.8,
      3.5, 8.5, 4.5, 6, 4.3, 4.5, 6.3, 2, 6.3, -1, 5.1, -4, 5.2, -7.5, 4.4, -9.5, 5.4, -12, 7.3,
      -13.3, 9, -15, 11, -16.7, 12.5, -17.3, 14.7, -16.4, 16.5, -16.2, 19.5,
    ],
  ],
  [
    'Madagascar',
    [
      49.3, -12, 50.5, -15.5, 49.5, -17, 48, -22, 47, -25, 45, -25.5, 43.7, -23.5, 43.3, -21.5,
      44.4, -19.8, 44, -17, 46.3, -15.8, 48, -13.8,
    ],
  ],
  ['Sri Lanka', [79.8, 9.8, 81.8, 7.5, 81.5, 6.1, 80, 6, 79.7, 8]],
  [
    'Japan',
    [
      130, 31.2, 131.5, 31.5, 132, 33.8, 135, 33.5, 136.8, 34.3, 139, 34.7, 140.8, 35.7, 141, 38,
      142, 39.5, 141.4, 41.4, 140, 40.5, 139.8, 38.5, 138.5, 37.5, 136.8, 37.2, 135.5, 35.5, 133,
      35.5, 131, 34.5, 129.8, 33.2,
    ],
  ],
  ['Hokkaido', [140, 41.5, 141, 43.2, 141.7, 45.4, 145.5, 43.4, 143.3, 42, 141, 41.8]],
  ['Taiwan', [121, 25.2, 122, 25, 120.8, 22, 120.2, 23]],
  ['Luzon', [120, 18.5, 122.3, 18.5, 122, 16.5, 124, 13.5, 122, 13.8, 120.6, 14.2, 120.5, 16.5]],
  ['Sumatra', [95.3, 5.6, 98, 4, 103.5, -1, 106, -3, 106, -5.8, 104.5, -5.8, 101, -2.5, 98.7, 1.7]],
  [
    'Borneo',
    [
      109, 1.5, 111, 1.8, 113, 3.2, 115.5, 5.2, 117.3, 6.9, 119, 5, 118, 1, 117.5, 0.5, 116.5, -3,
      114.5, -4, 111.5, -3, 110, -1.5,
    ],
  ],
  ['Java', [105.5, -6.8, 108, -6.3, 111, -6.5, 114.5, -7.8, 111, -8.2, 106.5, -7.4]],
  [
    'New Guinea',
    [
      131, -1, 134, -0.9, 137.5, -1.6, 141, -2.6, 145, -4.5, 147.5, -6.2, 150, -10.5, 147, -10,
      143.5, -9, 141, -9.1, 139, -8, 138, -5.5, 135, -4.3, 132.5, -4, 132, -2.8,
    ],
  ],
  [
    'Australia',
    [
      113.5, -22, 114, -26, 115, -30, 115, -34, 117.5, -35, 122, -34, 124, -33, 128, -32, 131,
      -31.5, 134, -32.5, 135.6, -34.8, 137.5, -35.6, 138.5, -34.5, 140, -37.7, 143.5, -38.7, 146.3,
      -39, 148, -37.8, 150, -37.3, 151.2, -34, 153, -31, 153.5, -28, 153, -25, 150.8, -22.5, 149,
      -20.5, 146.3, -19, 145.4, -15, 143.5, -14, 142.5, -10.7, 141.5, -13, 141.6, -16.5, 140.5,
      -17.5, 139, -17, 136, -15, 136.8, -12.2, 132.5, -11.5, 130.3, -12.6, 129, -15, 127, -14, 125,
      -15, 123, -16.5, 121, -19.5, 117, -20.7,
    ],
  ],
  ['Tasmania', [145, -40.8, 148.3, -40.9, 148, -43, 146.5, -43.6, 145.3, -42.2]],
  [
    'New Zealand North Island',
    [
      172.7, -34.5, 174.8, -36.8, 178.5, -37.7, 177, -39.5, 175, -41.5, 174.5, -39.5, 173.8, -39,
      174.5, -37.5,
    ],
  ],
  [
    'New Zealand South Island',
    [
      172.8, -40.5, 174.3, -41.7, 173, -43.8, 171, -45, 169, -46.6, 166.5, -46, 168, -44, 170.5,
      -42.8,
    ],
  ],
];

/** Seas inside the land, drawn over it in the sea's colour. */
const SEAS: readonly (readonly [string, readonly number[]])[] = [
  [
    'Hudson Bay',
    [
      -95, 59, -94, 61, -91, 63.5, -87, 64.5, -82, 64, -78, 62.5, -77, 60, -78, 56, -80, 53, -82,
      52.5, -85, 55, -89, 56.5, -93, 57.5,
    ],
  ],
  [
    'Black Sea',
    [
      28, 41.2, 28.5, 43.5, 30, 45.8, 33, 46, 33.5, 44.5, 36, 45.2, 38, 47, 39.5, 47, 38, 45, 41.5,
      41.6, 37, 41, 33, 42, 29.5, 41.2,
    ],
  ],
  [
    'Caspian Sea',
    [
      47, 44.5, 50, 46.5, 53, 46.8, 53, 45, 51, 44.5, 52.8, 41.5, 54, 40, 53.5, 37.5, 51, 36.7, 49,
      38, 49.5, 40.3, 48.5, 42,
    ],
  ],
];

const SAHARA = [
  -15, 20, -10, 28, 0, 31, 10, 31.5, 20, 29.5, 31, 29.5, 34, 22, 30, 16, 15, 14, 0, 15, -12, 16,
];

const pairs = (flat: readonly number[]): Pt[] =>
  range(flat.length / 2).map((i) => [flat[2 * i]!, flat[2 * i + 1]!]);

/** Longitude/latitude to a point on a flat map of the world (x 40–1240, y 50–673). */
const onMap = ([lon, lat]: Pt): Pt => [40 + (lon + 180) * (1200 / 360), 50 + (85 - lat) * 4.3];

/**
 * Land drawn on a globe of radius r at (cx, cy), seen from above (lon0, lat0): the part on the
 * far side is cut off, and the cut follows the globe's edge.
 */
function onGlobe(cx: number, cy: number, r: number, lon0: number, lat0: number) {
  const rad = Math.PI / 180;
  const p0 = lat0 * rad;
  const to3 = ([lon, lat]: Pt): [number, number, number] => {
    const l = (lon - lon0) * rad;
    const p = lat * rad;
    return [
      Math.cos(p) * Math.sin(l),
      Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l),
      Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l),
    ];
  };
  const edge = (angle: number): Pt => [cx + r * Math.cos(angle), cy - r * Math.sin(angle)];
  return (flat: readonly number[]): Pt[] => {
    const v = pairs(flat).map(to3);
    const start = v.findIndex((p) => p[2] >= 0);
    if (start < 0) return [];
    const out: Pt[] = [];
    let left = 0;
    for (let k = 0; k < v.length; k++) {
      const a = v[(start + k) % v.length]!;
      const b = v[(start + k + 1) % v.length]!;
      if (a[2] >= 0) out.push([cx + r * a[0], cy - r * a[1]]);
      if (a[2] >= 0 !== b[2] >= 0) {
        const [i, o] = a[2] >= 0 ? [a, b] : [b, a];
        const t = i[2] / (i[2] - o[2]);
        const angle = Math.atan2(i[1] + t * (o[1] - i[1]), i[0] + t * (o[0] - i[0]));
        if (a[2] >= 0) {
          left = angle;
          out.push(edge(angle));
        } else {
          let d = angle - left;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          const steps = Math.ceil(Math.abs(d) / (6 * rad));
          for (let s = 1; s < steps; s++) out.push(edge(left + (d * s) / steps));
          out.push(edge(angle));
        }
      }
    }
    return out;
  };
}

/** Stars scattered over the stage (the same every time). */
function starField(seed: number, count: number, top = 0, bottom = H): Part {
  const rnd = seeded(seed);
  const tints = ['#ffffff', '#fff4d6', '#dfe8ff'];
  return group(
    'Stars',
    range(count).map((i) => {
      const r = 0.8 + rnd() * rnd() * 2.2;
      return circle(
        `Star ${i + 1}`,
        r + rnd() * (W - 2 * r),
        top + r + rnd() * (bottom - top - 2 * r),
        r,
        tints[i % 3]!,
        { opacity: 55 + Math.round(rnd() * 45) },
      );
    }),
  );
}

const sparkle = (name: string, x: number, y: number, s: number, colour = '#ffffff'): Part =>
  star(name, x - s, y - s, 2 * s, 2 * s, colour, 4, 0.22);

// ---- scenes for lessons ----

/** A conical flask on a shelf at `base`, with coloured liquid. */
const conicalFlask = (name: string, x: number, base: number, liquid: string): Part =>
  group(name, [
    shape(
      'Glass',
      [
        [x - 9, base - 92],
        [x + 9, base - 92],
        [x + 9, base - 56],
        [x + 36, base],
        [x - 36, base],
        [x - 9, base - 56],
      ],
      '#eef8fa',
      { stroke: ['#9dbfc7', 2], opacity: 90 },
    ),
    shape(
      'Liquid',
      [
        [x - 22, base - 28],
        [x + 22, base - 28],
        [x + 35, base - 1],
        [x - 35, base - 1],
      ],
      liquid,
      { opacity: 85 },
    ),
  ]);
const roundFlask = (name: string, x: number, base: number, liquid: string): Part =>
  group(name, [
    rect('Neck', x - 7, base - 96, 14, 44, '#eef8fa', { stroke: ['#9dbfc7', 2] }),
    circle('Bulb', x, base - 31, 31, '#eef8fa', { stroke: ['#9dbfc7', 2] }),
    shape('Liquid', arc(x, base - 31, 29, 29, 10, 170, 16), liquid, { opacity: 85 }),
  ]);
const beaker = (name: string, x: number, base: number, liquid: string): Part =>
  group(name, [
    rect('Glass', x - 28, base - 70, 56, 70, '#eef8fa', { stroke: ['#9dbfc7', 2], opacity: 90 }),
    rect('Liquid', x - 27, base - 36, 54, 35, liquid, { opacity: 80 }),
    rect('Lip', x - 31, base - 72, 62, 5, '#cfe3e8', { radius: 2 }),
  ]);
const reagentBottle = (name: string, x: number, base: number, glass: string): Part =>
  group(name, [
    rect('Bottle', x - 18, base - 60, 36, 60, glass, { radius: 5 }),
    rect('Neck', x - 8, base - 72, 16, 14, glass),
    rect('Stopper', x - 10, base - 80, 20, 10, '#3b3f45', { radius: 2 }),
    rect('Label', x - 14, base - 44, 28, 22, '#f6f0e1', { radius: 2 }),
  ]);
function tubeRack(name: string, x: number, base: number): Part {
  const colours = ['#7cc6f0', '#f29b9b', '#a6dd8f', '#f5d36e'];
  return group(name, [
    ...colours.flatMap((c, i) => [
      rect(`Test tube ${i + 1}`, x + 10 + i * 26, base - 74, 14, 66, '#eef8fa', {
        stroke: ['#9dbfc7', 1.5],
        radius: 7,
      }),
      rect(`Liquid ${i + 1}`, x + 11.5 + i * 26, base - 40, 11, 30, c, { radius: 5.5 }),
    ]),
    rect('Rack top', x, base - 50, 118, 8, '#c8955c', { radius: 2 }),
    rect('Rack base', x, base - 8, 118, 8, '#a8763f', { radius: 2 }),
  ]);
}

/** A row of books on a shelf from x0 to x1, standing on `base`. */
function books(name: string, x0: number, x1: number, base: number, rnd: () => number): Part {
  const colours = [
    '#a8574a',
    '#4f6d8f',
    '#6b8f5e',
    '#c49a4a',
    '#7a5c8a',
    '#3f6f6f',
    '#b5734a',
    '#8a3f3f',
    '#5a7a9a',
    '#c7ad78',
  ];
  const parts: Part[] = [];
  let x = x0 + 4;
  let n = 1;
  while (x < x1 - 20) {
    if (rnd() < 0.06) {
      x += 24;
      continue;
    }
    const w = Math.min(18 + rnd() * 26, x1 - 2 - x);
    const h = 92 + rnd() * 50;
    const colour = colours[Math.floor(rnd() * colours.length)]!;
    parts.push(rect(`Book ${n}`, x, base - h, w - 2, h, colour, { radius: 2 }));
    if (rnd() < 0.45)
      parts.push(rect(`Book ${n} band`, x, base - h + 12, w - 2, 6, '#ead9a8', { opacity: 70 }));
    x += w;
    n++;
  }
  return group(name, parts);
}

const SCENES: readonly LibraryItem[] = [
  background(
    'background.chalkboard',
    'Chalkboard',
    ['educational', 'blackboard', 'board', 'school', 'class', 'teacher', 'lesson'],
    [
      rect('Wooden frame', 0, 0, W, H, { from: '#a87447', to: '#7d5130', angle: 90 }),
      group('Frame grain', [
        rect('Grain 1', 0, 12, W, 2, '#8e5e37', { opacity: 50 }),
        rect('Grain 2', 0, 24, W, 2, '#8e5e37', { opacity: 35 }),
        rect('Grain 3', 0, 690, W, 2, '#6a4326', { opacity: 50 }),
        rect('Grain 4', 0, 704, W, 2, '#6a4326', { opacity: 35 }),
      ]),
      rect('Frame shadow', 34, 34, W - 68, 612, '#5e3b20'),
      rect('Board', 40, 40, W - 80, 600, { from: '#3b6f56', to: '#264c3b', radial: true }),
      group('Chalk dust', [
        ellipse('Smudge 1', 110, 110, 520, 170, '#ffffff', { opacity: 3 }),
        ellipse('Smudge 2', 600, 300, 560, 210, '#ffffff', { opacity: 3 }),
        ellipse('Smudge 3', 230, 420, 420, 140, '#ffffff', { opacity: 3 }),
      ]),
      group('Chalk tray', [
        rect('Tray shadow', 24, 668, W - 48, 10, '#000000', { opacity: 25 }),
        rect('Tray', 24, 644, W - 48, 26, '#93603a', { radius: 3 }),
        rect('Tray lip', 24, 644, W - 48, 6, '#b5835a', { radius: 3 }),
      ]),
      group('Chalk', [
        rect('White chalk', 190, 633, 64, 12, '#f4f4ef', { radius: 6 }),
        rect('Yellow chalk', 270, 634, 48, 11, '#f3e07a', { radius: 5.5 }),
        rect('Pink chalk', 1010, 633, 40, 12, '#f2a7b8', { radius: 6 }),
      ]),
      group('Board eraser', [
        rect('Felt', 850, 630, 120, 14, '#3d3f4a', { radius: 3 }),
        rect('Handle', 850, 616, 120, 16, '#c8a06e', { radius: 4 }),
      ]),
    ],
  ),
  background(
    'background.whiteboard',
    'Whiteboard',
    ['educational', 'board', 'school', 'class', 'office', 'lesson', 'presentation'],
    [
      rect('Wall', 0, 0, W, H, { from: '#eef1f5', to: '#dbe1e8', angle: 90 }),
      rect('Board shadow', 70, 44, W - 132, 604, '#000000', { opacity: 8, radius: 10 }),
      rect(
        'Aluminium frame',
        60,
        30,
        W - 120,
        600,
        { from: '#dde2e7', to: '#a7b0ba', angle: 90 },
        { radius: 8 },
      ),
      rect('Board', 74, 44, W - 148, 572, { from: '#ffffff', to: '#eef2f6', angle: 120 }),
      group('Magnets', [
        circle('Red magnet', 120, 90, 11, '#e06060'),
        circle('Blue magnet', W - 120, 90, 11, '#4a8ad8'),
      ]),
      group('Marker tray', [
        rect('Tray', 140, 626, W - 280, 16, '#b4bcc5', { radius: 4 }),
        rect('Tray edge', 140, 638, W - 280, 6, '#99a2ac', { radius: 3 }),
      ]),
      group(
        'Markers',
        (
          [
            ['Blue', 300, '#2f6fd0'],
            ['Red', 410, '#d94848'],
            ['Green', 520, '#3a9a52'],
            ['Black', 960, '#2d2f33'],
          ] as const
        ).map(([c, x, colour]) =>
          group(`${c} marker`, [
            rect('Pen', x, 612, 84, 14, '#f4f5f6', { radius: 7, stroke: ['#d5d9de', 1] }),
            rect('Cap', x + 58, 612, 28, 14, colour, { radius: 6 }),
          ]),
        ),
      ),
      group('Board wiper', [
        rect('Wiper felt', 760, 616, 110, 10, '#5b6470'),
        rect('Wiper top', 760, 600, 110, 18, '#3e7cc0', { radius: 5 }),
      ]),
    ],
  ),
  background(
    'background.sciencelab',
    'Science lab',
    ['educational', 'laboratory', 'lab', 'science', 'chemistry', 'school', 'experiment', 'indoors'],
    [
      rect('Wall', 0, 0, W, 460, '#e4eeed'),
      rect('Tiles', 0, 330, W, 130, '#f4f8f8'),
      group('Tile lines', [
        ...range(4).map((i) => rect(`Tile row ${i + 1}`, 0, 330 + i * 32.5, W, 2, '#d3e0df')),
        ...range(39).map((i) => rect(`Tile column ${i + 1}`, 32 + i * 32, 330, 2, 130, '#d3e0df')),
      ]),
      group('Top shelf', [
        rect('Shelf', 80, 150, 560, 12, '#b98a5a', { radius: 2 }),
        rect('Left bracket', 110, 162, 10, 24, '#8f6a45'),
        rect('Right bracket', 600, 162, 10, 24, '#8f6a45'),
        conicalFlask('Conical flask', 150, 150, '#8fd17a'),
        roundFlask('Round flask', 250, 150, '#7fb8f0'),
        reagentBottle('Brown bottle', 330, 150, '#8a5a2b'),
        reagentBottle('Blue bottle', 380, 150, '#3f6fa0'),
        beaker('Beaker', 460, 150, '#f5a35c'),
        conicalFlask('Small flask', 560, 150, '#d59be8'),
      ]),
      group('Lower shelf', [
        rect('Shelf', 80, 290, 560, 12, '#b98a5a', { radius: 2 }),
        rect('Left bracket', 110, 302, 10, 24, '#8f6a45'),
        rect('Right bracket', 600, 302, 10, 24, '#8f6a45'),
        tubeRack('Test tube rack', 110, 290),
        beaker('Tall beaker', 290, 290, '#7fd3c7'),
        reagentBottle('Green bottle', 370, 290, '#4f8a5a'),
        roundFlask('Flask', 450, 290, '#f28b8b'),
        reagentBottle('Amber bottle', 540, 290, '#a8642b'),
      ]),
      group('Periodic table', [
        rect('Poster', 750, 30, 440, 250, '#ffffff', { stroke: ['#c9d3d8', 2], radius: 4 }),
        rect('Title bar', 770, 46, 400, 16, '#4a7d8c', { radius: 3 }),
        ...[
          [0, 0, 'a'],
          [0, 17, 'n'],
          ...[0, 1].map((c) => [1, c, c === 0 ? 'a' : 'e']),
          ...range(6).map((c) => [1, 12 + c, c === 5 ? 'n' : 'm']),
          ...[0, 1].map((c) => [2, c, c === 0 ? 'a' : 'e']),
          ...range(6).map((c) => [2, 12 + c, c === 5 ? 'n' : c === 0 ? 'p' : 'm']),
          ...[3, 4, 5, 6].flatMap((r) =>
            range(18).map((c) => [
              r,
              c,
              c === 0 ? 'a' : c === 1 ? 'e' : c < 12 ? 't' : c === 17 ? 'n' : c < 15 ? 'p' : 'm',
            ]),
          ),
        ].map(([r, c, kind]) =>
          rect(
            `Element ${Number(r) + 1}-${Number(c) + 1}`,
            772 + Number(c) * 22,
            74 + Number(r) * 28,
            20,
            26,
            { a: '#f6b6a8', e: '#f8d7a0', t: '#f3e6a3', p: '#bfe3c0', m: '#b9dcf2', n: '#d8c8f0' }[
              String(kind)
            ]!,
            { radius: 2 },
          ),
        ),
      ]),
      group('Bench', [
        rect('Bench top', 0, 460, W, 26, '#37424d'),
        rect('Bench edge', 0, 460, W, 4, '#58646f'),
        rect('Cupboards', 0, 486, W, 234, '#cdd8de'),
        ...range(8).map((i) =>
          rect(`Cupboard door ${i + 1}`, 10 + i * 158.75, 500, 148, 186, '#d9e2e7', { radius: 3 }),
        ),
        ...range(8).map((i) =>
          rect(
            `Handle ${i + 1}`,
            i % 2 ? 22 + i * 158.75 : 134 + i * 158.75,
            560,
            6,
            40,
            '#8a99a4',
            { radius: 3 },
          ),
        ),
        rect('Kick plate', 0, 696, W, 24, '#8a99a4'),
      ]),
      group('Microscope', [
        rect('Base', 1010, 444, 130, 16, '#2f3a44', { radius: 5 }),
        shape(
          'Arm',
          [
            [1100, 444],
            [1122, 444],
            [1122, 352],
            [1104, 318],
            [1086, 330],
            [1100, 356],
          ],
          '#3c4a56',
        ),
        rect('Stage', 1030, 394, 90, 9, '#2f3a44', { radius: 2 }),
        rect('Slide', 1052, 389, 46, 5, '#d6eef5'),
        shape('Tube', turnedRect(1072, 338, 26, 84, -16), '#e9edf0', { stroke: ['#9aa6b0', 2] }),
        shape('Eyepiece', turnedRect(1060, 296, 32, 16, -16), '#3c4a56'),
        rect('Lens', 1074, 374, 16, 14, '#3c4a56', { radius: 2 }),
      ]),
      group('Bunsen burner', [
        rect('Burner base', 760, 446, 70, 14, '#5b6670', { radius: 4 }),
        rect('Barrel', 787, 380, 16, 66, '#9aa6b0'),
        shape(
          'Flame',
          [
            [795, 312],
            [810, 350],
            [804, 378],
            [786, 378],
            [780, 350],
          ],
          '#7fb2ff',
          { opacity: 85 },
        ),
        shape(
          'Inner flame',
          [
            [795, 340],
            [802, 362],
            [788, 362],
          ],
          '#d6e6ff',
        ),
      ]),
    ],
  ),
  (() => {
    const rnd = seeded(11);
    const bays: [number, number][] = [
      [30, 410],
      [440, 840],
      [870, 1250],
    ];
    const rows = [22, 196, 370, 544];
    return background(
      'background.library',
      'Library bookshelves',
      ['educational', 'books', 'bookshelf', 'reading', 'school', 'study', 'indoors'],
      [
        rect('Bookcase', 0, 0, W, H, { from: '#865733', to: '#6a4226', angle: 90 }),
        ...rows.flatMap((top, r) => [
          ...bays.map(([x0, x1], b) =>
            rect(`Shelf ${r + 1} back ${b + 1}`, x0, top, x1 - x0, 150, {
              from: '#3e2716',
              to: '#5a3a22',
              angle: 90,
            }),
          ),
          ...bays.map(([x0, x1], b) => books(`Books ${r + 1}-${b + 1}`, x0, x1, top + 150, rnd)),
          rect(`Shelf ${r + 1}`, 18, top + 150, W - 36, 18, '#a06c42', { radius: 2 }),
          rect(`Shelf ${r + 1} edge`, 18, top + 164, W - 36, 4, '#7a4f2e'),
        ]),
      ],
    );
  })(),
  background(
    'background.computerroom',
    'Computer room',
    ['educational', 'computers', 'ict', 'lab', 'school', 'technology', 'it', 'indoors'],
    [
      rect('Wall', 0, 0, W, 420, '#e8edf2'),
      ...[120, 760].map((x, i) =>
        group(`Window ${i + 1}`, [
          rect('Frame', x, 46, 400, 190, '#ffffff', { radius: 4 }),
          rect('Glass', x + 12, 58, 376, 166, { from: '#a9d8f7', to: '#e4f4ff', angle: 90 }),
          rect('Bar', x + 196, 58, 8, 166, '#ffffff'),
        ]),
      ),
      group('Clock', [
        circle('Clock face', 640, 130, 40, '#ffffff', { stroke: ['#47515c', 5] }),
        rect('Hour hand', 638, 106, 4, 26, '#47515c'),
        rect('Minute hand', 638, 128, 24, 4, '#47515c'),
      ]),
      rect('Floor', 0, 420, W, 300, { from: '#b9c3cc', to: '#a1acb7', angle: 90 }),
      rect('Desk', 0, 396, W, 24, '#e3d3b2'),
      rect('Desk front', 0, 420, W, 120, '#d0bd97'),
      rect('Desk shadow', 0, 540, W, 10, '#000000', { opacity: 10 }),
      ...range(4).map((i) => {
        const cx = 160 + i * 320;
        return group(`Computer ${i + 1}`, [
          rect('Monitor', cx - 112, 226, 224, 144, '#2b2f36', { radius: 8 }),
          rect('Screen', cx - 102, 236, 204, 124, { from: '#5a9be0', to: '#2b5fa6', angle: 120 }),
          ...range(3).map((k) =>
            rect(
              `Line ${k + 1}`,
              cx - 86,
              256 + k * 18,
              [110, 150, 80][(i + k) % 3]!,
              7,
              '#ffffff',
              { opacity: 35, radius: 3 },
            ),
          ),
          rect('Stand', cx - 10, 370, 20, 20, '#3a3f47'),
          rect('Foot', cx - 42, 388, 84, 10, '#3a3f47', { radius: 4 }),
          rect('Keyboard', cx - 96, 400, 150, 9, '#f0f2f4', { radius: 3, stroke: ['#c4cad1', 1] }),
          ellipse('Mouse', cx + 70, 399, 20, 12, '#f0f2f4', { stroke: ['#c4cad1', 1] }),
        ]);
      }),
      ...range(4).map((i) => {
        const cx = 160 + i * 320;
        return group(`Chair ${i + 1}`, [
          rect('Post', cx - 8, 640, 16, 80, '#2d2f33'),
          rect('Back', cx - 84, 500, 168, 150, '#3d5f8f', { radius: 24 }),
          rect('Cushion', cx - 70, 514, 140, 122, '#4a6fa3', { radius: 18 }),
        ]);
      }),
    ],
  ),
  background(
    'background.hallway',
    'School hallway',
    ['educational', 'lockers', 'corridor', 'school', 'indoors'],
    [
      rect('Wall', 0, 0, W, 170, '#f0e6cd'),
      group('Notice board', [
        rect('Board frame', 120, 26, 360, 114, '#a0703f', { radius: 4 }),
        rect('Cork', 128, 34, 344, 98, '#cfa271'),
        rect('Notice 1', 150, 46, 70, 70, '#ffffff'),
        rect('Notice 2', 240, 54, 90, 60, '#fff3a3'),
        rect('Notice 3', 350, 44, 100, 74, '#d6ecff'),
      ]),
      group('Clock', [
        circle('Clock face', 1000, 84, 44, '#ffffff', { stroke: ['#3b4552', 6] }),
        rect('Hour hand', 998, 56, 4, 30, '#3b4552'),
        rect('Minute hand', 998, 82, 28, 4, '#3b4552'),
      ]),
      rect('Trim', 0, 162, W, 10, '#c9b88f'),
      rect('Locker frame', 0, 172, W, 430, '#3d6896'),
      ...range(16).map((i) => {
        const x = i * 80;
        return group(`Locker ${i + 1}`, [
          rect('Door', x + 3, 175, 74, 424, i % 2 ? '#5a87bc' : '#5f8dc2', { radius: 2 }),
          ...range(4).map((k) =>
            rect(`Vent ${k + 1}`, x + 20, 196 + k * 11, 40, 4, '#406c9b', { radius: 2 }),
          ),
          rect('Handle', x + 60, 370, 6, 32, '#d0d8e0', { radius: 3 }),
        ]);
      }),
      rect('Plinth', 0, 602, W, 14, '#2c4c70'),
      rect('Floor', 0, 616, W, 104, { from: '#ddd5c4', to: '#c4baa6', angle: 90 }),
      ellipse('Floor shine', 340, 640, 600, 50, '#ffffff', { opacity: 25 }),
      rect('Floor seam', 0, 666, W, 2, '#b5ab97'),
    ],
  ),
  background(
    'background.playground',
    'School field',
    ['educational', 'playground', 'sports', 'football', 'school', 'outdoors', 'pe', 'field'],
    [
      rect('Sky', 0, 0, W, 400, { from: '#6dbcf5', to: '#dff1fd', angle: 90 }),
      circle('Sun', 1120, 90, 48, '#ffe27a'),
      cloud('Cloud 1', 520, 60, 1.2),
      cloud('Cloud 2', 860, 130, 0.9),
      group(
        'Trees',
        range(16).map((i) =>
          circle(
            `Tree ${i + 1}`,
            460 + i * 52 + (i % 3) * 8,
            372 - (i % 2) * 8,
            30 + (i % 3) * 6,
            i % 2 ? '#6aa85b' : '#77b766',
          ),
        ),
      ),
      group('School', [
        rect('Building', 70, 230, 360, 160, '#e8c7a0'),
        shape(
          'Roof',
          [
            [50, 236],
            [250, 170],
            [450, 236],
          ],
          '#b0533f',
        ),
        ...range(10)
          .map((i) =>
            rect(
              `Window ${i + 1}`,
              96 + (i % 5) * 66 + (i % 5 > 1 ? 30 : 0),
              256 + Math.floor(i / 5) * 60,
              38,
              38,
              '#9fd0f0',
              { stroke: ['#ffffff', 3] },
            ),
          )
          .filter((_, i) => i % 5 !== 2),
        rect('Door', 226, 316, 48, 74, '#7a4f2e'),
        rect('Flag pole', 248, 112, 4, 70, '#8a9099'),
        rect('Flag', 252, 112, 40, 24, '#e05a4f'),
      ]),
      ...[400, 420, 446, 478, 518, 568, 628, 696].map((y, i, ys) =>
        rect(`Grass stripe ${i + 1}`, 0, y, W, (ys[i + 1] ?? H) - y, i % 2 ? '#74bd62' : '#7fc66c'),
      ),
      group('Pitch lines', [
        line(
          'Side line',
          [
            [0, 470],
            [W, 470],
          ],
          '#f4fbf2',
          4,
        ),
        line(
          'Box',
          [
            [760, 470],
            [720, 590],
            [1280, 590],
          ],
          '#f4fbf2',
          4,
        ),
      ]),
      group('Goal', [
        ...range(9).map((i) =>
          line(
            `Net line ${i + 1}`,
            [
              [900 + i * 30, 380],
              [920 + i * 27, 460],
            ],
            '#ffffff',
            1.5,
          ),
        ),
        ...range(4).map((i) =>
          line(
            `Net row ${i + 1}`,
            [
              [904 + i * 4, 400 + i * 20],
              [1140 + i * 4, 400 + i * 20],
            ],
            '#ffffff',
            1.5,
          ),
        ),
        line(
          'Goal frame',
          [
            [880, 480],
            [880, 380],
            [1160, 380],
            [1160, 480],
          ],
          '#ffffff',
          8,
        ),
      ]),
    ],
  ),
  background(
    'background.stage',
    'Stage with curtains',
    ['educational', 'theatre', 'theater', 'presentation', 'show', 'concert', 'curtain', 'indoors'],
    [
      rect('Back wall', 0, 0, W, H, { from: '#3b2431', to: '#1d1219', angle: 90 }),
      circle(
        'Spotlight glow',
        640,
        330,
        290,
        { from: '#73535c', to: '#2d1b26', radial: true },
        { opacity: 75 },
      ),
      rect('Stage floor', 0, 560, W, 160, { from: '#a06a3b', to: '#6e4424', angle: 90 }),
      group(
        'Floor boards',
        range(5).map((i) =>
          rect(`Board line ${i + 1}`, 0, 584 + i * 22, W, 2, '#5a361c', { opacity: 45 }),
        ),
      ),
      ellipse(
        'Spotlight',
        440,
        580,
        400,
        90,
        { from: '#f6dfb0', to: '#a06a3b', radial: true },
        { opacity: 75 },
      ),
      rect('Stage edge', 0, 690, W, 30, '#3a2414'),
      ...(
        [
          ['Left curtain', 0],
          ['Right curtain', W - 260],
        ] as const
      ).map(([name, x0]) =>
        group(name, [
          ...range(5).map((k) =>
            rect(`Fold ${k + 1}`, x0 + k * 52, 0, 52, 692, {
              from: '#b3202f',
              to: '#7c1220',
              angle: k % 2 ? 180 : 0,
            }),
          ),
          rect('Tie-back', x0 === 0 ? 200 : x0 + 6, 380, 54, 14, '#e2b650', { radius: 7 }),
        ]),
      ),
      shape(
        'Valance',
        [
          [0, 0],
          [W, 0],
          [W, 96],
          ...range(10).flatMap((i) => arc(W - 64 - i * 128, 96, 64, 34, 0, 180, 10)),
          [0, 96],
        ],
        { from: '#a81d2e', to: '#781020', angle: 90 },
      ),
      line(
        'Gold trim',
        range(10).flatMap((i) => arc(W - 64 - i * 128, 96, 64, 34, 0, 180, 10)),
        '#e2b650',
        6,
      ),
      rect('Top band', 0, 0, W, 16, '#5e0c17'),
    ],
  ),
  background(
    'background.worldmap',
    'World map',
    ['educational', 'map', 'world', 'geography', 'continents', 'countries', 'globe'],
    [
      rect('Sea', 0, 0, W, H, { from: '#d8edf8', to: '#c3e0f2', angle: 90 }),
      group(
        'Lines of longitude',
        range(13).map((i) =>
          rect(`Longitude ${i * 30 - 180}°`, 39.25 + i * 100, 50, 1.5, 623, '#b7d7ec'),
        ),
      ),
      group(
        'Lines of latitude',
        [60, 30, 0, -30].map((lat) =>
          rect(
            lat === 0 ? 'Equator' : `Latitude ${lat}°`,
            40,
            onMap([0, lat])[1] - (lat === 0 ? 1.25 : 0.75),
            1200,
            lat === 0 ? 2.5 : 1.5,
            lat === 0 ? '#9ec8e4' : '#b7d7ec',
          ),
        ),
      ),
      group(
        'Land',
        LAND.map(([name, flat]) =>
          shape(name, pairs(flat).map(onMap), '#a9d18e', { stroke: ['#84b46c', 1.5] }),
        ),
      ),
      group(
        'Seas',
        SEAS.map(([name, flat]) =>
          shape(name, pairs(flat).map(onMap), '#cfe7f5', { stroke: ['#84b46c', 1.5] }),
        ),
      ),
    ],
  ),
  background(
    'background.space',
    'Outer space',
    ['educational', 'space', 'planets', 'stars', 'astronomy', 'galaxy', 'universe', 'night'],
    [
      rect('Space', 0, 0, W, H, { from: '#1c2452', to: '#06070f', radial: true }),
      // The nebula shares the sky's middle and ends in the sky's own colour there: no hard edge.
      circle('Nebula', 640, 360, 330, {
        from: '#55408f',
        to: mix('#1c2452', '#06070f', 330 / 640),
        radial: true,
      }),
      starField(5, 150),
      group('Sparkles', [
        sparkle('Sparkle 1', 180, 120, 9),
        sparkle('Sparkle 2', 700, 420, 7),
        sparkle('Sparkle 3', 1180, 300, 8),
        sparkle('Sparkle 4', 420, 640, 6),
        sparkle('Sparkle 5', 980, 680, 7),
      ]),
      group('Ringed planet', [
        line(
          'Ring behind',
          turn(arc(930, 240, 150, 34, 180, 360, 24), 930, 240, -14),
          '#e3c890',
          10,
        ),
        circle('Planet', 930, 240, 72, { from: '#f3dca2', to: '#c4934f', angle: 120 }),
        shape(
          'Band',
          turn(
            [...arc(930, 240, 70, 70, -20, 20, 6), ...arc(930, 240, 70, 70, 160, 200, 6)],
            930,
            240,
            -14,
          ),
          '#b98544',
          { opacity: 35 },
        ),
        line(
          'Ring in front',
          turn(arc(930, 240, 150, 34, 0, 180, 24), 930, 240, -14),
          '#e3c890',
          10,
        ),
      ]),
      group('Red planet', [
        circle('Planet', 250, 540, 40, { from: '#ec8d5f', to: '#a7442a', angle: 120 }),
        circle('Crater 1', 238, 528, 7, '#b85a38', { opacity: 70 }),
        circle('Crater 2', 262, 556, 5, '#b85a38', { opacity: 70 }),
      ]),
      group('Ice planet', [
        circle('Planet', 1130, 590, 52, { from: '#9fe0ef', to: '#3d86b5', angle: 120 }),
      ]),
      group('Small moon', [
        circle('Moon', 1060, 160, 14, { from: '#e9e6df', to: '#9a968e', angle: 120 }),
      ]),
    ],
  ),
  (() => {
    const [cx, cy, r] = [880, 360, 290];
    const globe = onGlobe(cx, cy, r, 18, 18);
    return background(
      'background.earth',
      'Earth from space',
      ['educational', 'space', 'earth', 'planet', 'globe', 'world', 'geography', 'astronomy'],
      [
        rect('Space', 0, 0, W, H, { from: '#121a3e', to: '#04050c', radial: true }),
        starField(9, 110),
        circle('Atmosphere glow', cx, cy, r + 16, '#5aa8ff', { opacity: 18 }),
        circle('Atmosphere', cx, cy, r + 6, '#7cc0ff', { opacity: 35 }),
        circle('Ocean', cx, cy, r, { from: '#3f94db', to: '#163f7c', radial: true }),
        group(
          'Land',
          kept(
            LAND.map(([name, flat]) => {
              const p = globe(flat);
              return p.length >= 3 ? shape(name, p, '#67a64e') : null;
            }),
          ),
        ),
        shape('Sahara', globe(SAHARA), '#cdb57c', { opacity: 85 }),
        group(
          'Seas',
          kept(
            SEAS.map(([name, flat]) => {
              const p = globe(flat);
              return p.length >= 3 ? shape(name, p, '#2f78bd') : null;
            }),
          ),
        ),
        group('Clouds', [
          ellipse('Cloud 1', 700, 190, 160, 26, '#ffffff', { opacity: 55 }),
          ellipse('Cloud 2', 900, 420, 200, 24, '#ffffff', { opacity: 50 }),
          ellipse('Cloud 3', 760, 520, 130, 22, '#ffffff', { opacity: 50 }),
          ellipse('Cloud 4', 980, 250, 120, 20, '#ffffff', { opacity: 45 }),
          ellipse('Cloud 5', 640, 330, 90, 18, '#ffffff', { opacity: 45 }),
        ]),
        shape(
          'Night side',
          [...arc(cx, cy, r, r, -90, 90, 32), ...arc(cx, cy, r * 0.45, r, 90, -90, 32)],
          '#000814',
          { opacity: 45 },
        ),
        group('Moon', [
          circle('Moon', 170, 140, 42, { from: '#f1efe8', to: '#a19d94', angle: 120 }),
          circle('Crater 1', 158, 128, 8, '#b5b1a8', { opacity: 80 }),
          circle('Crater 2', 186, 156, 6, '#b5b1a8', { opacity: 80 }),
          circle('Crater 3', 178, 118, 4, '#b5b1a8', { opacity: 80 }),
        ]),
      ],
    );
  })(),
  background(
    'background.desert',
    'Desert',
    ['educational', 'sand', 'dunes', 'cactus', 'hot', 'outdoors', 'geography', 'nature'],
    [
      rect('Sky', 0, 0, W, 480, { from: '#7fc6ec', to: '#fde8c3', angle: 90 }),
      circle('Sun glow', 980, 140, 92, '#fff4c4', { opacity: 40 }),
      circle('Sun', 980, 140, 58, '#fff1b0'),
      shape(
        'Mesas',
        [
          [0, 470],
          [0, 360],
          [40, 360],
          [70, 330],
          [250, 330],
          [290, 380],
          [420, 380],
          [450, 350],
          [560, 350],
          [600, 420],
          [1280, 420],
          [1280, 470],
        ],
        '#e3ae86',
        { opacity: 80 },
      ),
      ground('Far dunes', 430, 16, 1.3, 0.5, '#f1d09a'),
      ground('Middle dunes', 520, 22, 1, 2.2, '#e8bd7c'),
      ground('Near dunes', 620, 18, 1.6, 4.1, '#dca760'),
      ...(
        [
          ['Big cactus', 200, 640, 180],
          ['Small cactus', 1090, 610, 110],
        ] as const
      ).map(([name, x, base, h]) =>
        group(name, [
          rect('Left arm', x - 58, base - h * 0.75, 22, h * 0.32, '#5e9a4f', { radius: 11 }),
          rect('Left elbow', x - 58, base - h * 0.5, 50, 22, '#5e9a4f', { radius: 11 }),
          rect('Right arm', x + 36, base - h * 0.88, 22, h * 0.36, '#5e9a4f', { radius: 11 }),
          rect('Right elbow', x + 8, base - h * 0.6, 50, 22, '#5e9a4f', { radius: 11 }),
          rect('Trunk', x - 17, base - h, 34, h, '#6aa85a', { radius: 17 }),
          rect('Stripe', x - 3, base - h + 14, 6, h - 20, '#5e9a4f', { radius: 3 }),
        ]),
      ),
      group('Rocks', [
        ellipse('Rock 1', 540, 640, 70, 34, '#b98c62'),
        ellipse('Rock 2', 590, 652, 44, 24, '#a87c55'),
        ellipse('Rock 3', 880, 560, 40, 20, '#c69a6c'),
      ]),
    ],
  ),
  (() => {
    const rnd = seeded(23);
    return background(
      'background.forest',
      'Forest',
      ['educational', 'trees', 'woods', 'nature', 'outdoors', 'pine', 'geography'],
      [
        rect('Sky', 0, 0, W, H, { from: '#d8eef6', to: '#f4f8ec', angle: 90 }),
        group(
          'Far trees',
          range(23).map((i) =>
            pine(`Far tree ${i + 1}`, 10 + i * 57 + rnd() * 20, 400, 120 + rnd() * 70, '#a8cbb7'),
          ),
        ),
        ground('Far ground', 390, 10, 1.5, 0, '#a2c7a6'),
        group(
          'Middle trees',
          range(15).map((i) =>
            pine(`Tree ${i + 1}`, 30 + i * 88 + rnd() * 30, 470, 170 + rnd() * 70, '#6f9f78'),
          ),
        ),
        ground('Middle ground', 460, 12, 1, 1, '#7fae84'),
        ground('Forest floor', 540, 14, 1.4, 2, { from: '#5a9660', to: '#447a4c', angle: 90 }),
        shape(
          'Woodland path',
          [
            [500, H],
            [560, 680],
            [612, 650],
            [640, 620],
            [628, 594],
            [644, 574],
            [662, 562],
            [678, 562],
            [684, 576],
            [674, 600],
            [694, 630],
            [744, 662],
            [806, 692],
            [870, H],
          ],
          '#c8ad7f',
        ),
        ...[
          [70, 300],
          [190, 250],
          [1060, 270],
          [1200, 320],
        ].map(([x, h], i) =>
          pine(`Big tree ${i + 1}`, x!, 640 + (i % 2) * 30, h!, '#3d774a', { trunk: '#6b4a2f' }),
        ),
        group('Mushrooms', [
          rect('Stalk 1', 404, 642, 8, 14, '#f3eadb'),
          shape('Cap 1', arc(408, 644, 15, 12, 180, 360, 10), '#d9534f'),
          rect('Stalk 2', 432, 650, 6, 10, '#f3eadb'),
          shape('Cap 2', arc(435, 652, 11, 9, 180, 360, 10), '#d9534f'),
        ]),
      ],
    );
  })(),
  (() => {
    const far: Pt[] = [
      [0, 330],
      [120, 230],
      [230, 300],
      [380, 150],
      [520, 280],
      [640, 190],
      [780, 310],
      [900, 170],
      [1040, 260],
      [1160, 200],
      [1280, 290],
    ];
    const near: Pt[] = [
      [0, 420],
      [160, 330],
      [300, 410],
      [460, 300],
      [620, 420],
      [800, 340],
      [960, 430],
      [1120, 320],
      [1280, 400],
    ];
    const caps = far.flatMap(([px, py], i) => {
      if (i === 0 || i === far.length - 1 || py > 240) return [];
      const [lx, ly] = far[i - 1]!;
      const [rx, ry] = far[i + 1]!;
      const f = 0.32;
      const L: Pt = [px + (lx - px) * f, py + (ly - py) * f];
      const R: Pt = [px + (rx - px) * f, py + (ry - py) * f];
      return [
        shape(
          `Snow cap ${i}`,
          [
            [px, py],
            R,
            [px + (R[0] - px) * 0.55, R[1] - 12],
            [px, Math.max(R[1], L[1]) - 6],
            [px + (L[0] - px) * 0.55, L[1] - 12],
            L,
          ],
          '#f7fbff',
        ),
      ];
    });
    return background(
      'background.mountains',
      'Mountains',
      ['educational', 'mountain', 'hills', 'snow', 'nature', 'outdoors', 'geography', 'landscape'],
      [
        rect('Sky', 0, 0, W, H, { from: '#9fd2f2', to: '#eef8fd', angle: 90 }),
        circle('Sun', 1090, 100, 44, '#fff6d2'),
        cloud('Cloud', 300, 70, 0.9),
        shape('Far mountains', [...far, [W, 560], [0, 560]], {
          from: '#97afc9',
          to: '#b7c9da',
          angle: 90,
        }),
        group('Snow caps', caps),
        shape('Near mountains', [...near, [W, 600], [0, 600]], {
          from: '#6c8cab',
          to: '#8aa5bd',
          angle: 90,
        }),
        ground('Hills', 500, 26, 1.2, 0.6, '#86bd7d'),
        ground('Meadow', 590, 16, 0.8, 2.4, { from: '#74b26c', to: '#5c9a58', angle: 90 }),
        ...[70, 150, 1130, 1205].map((x, i) =>
          pine(`Fir tree ${i + 1}`, x, 660 + (i % 2) * 20, 150 + (i % 2) * 40, '#3f7a4c', {
            trunk: '#6b4a2f',
          }),
        ),
      ],
    );
  })(),
  background(
    'background.farm',
    'Farm',
    ['educational', 'barn', 'countryside', 'fields', 'animals', 'outdoors', 'village', 'nature'],
    [
      rect('Sky', 0, 0, W, 420, { from: '#86ccf6', to: '#e6f6ff', angle: 90 }),
      circle('Sun', 150, 100, 50, '#ffe27a'),
      cloud('Cloud 1', 420, 70, 1.1),
      cloud('Cloud 2', 980, 110, 0.9),
      ground('Far hill', 330, 30, 1.2, 0.3, '#bcdb8c'),
      ground('Field', 400, 20, 0.8, 2.5, '#a8d070'),
      ...[470, 486, 506, 532, 564, 604, 654].map((y, i, ys) =>
        rect(`Crop row ${i + 1}`, 0, y, W, (ys[i + 1] ?? H) - y, i % 2 ? '#8fbe58' : '#9ac962'),
      ),
      group('Tree', [
        rect('Trunk', 252, 380, 22, 100, '#7a5534'),
        circle('Leaves 1', 238, 360, 46, '#5f9e4b'),
        circle('Leaves 2', 292, 352, 42, '#6aab55'),
        circle('Leaves 3', 262, 318, 44, '#74b65e'),
      ]),
      group('Barn', [
        rect('Walls', 740, 380, 250, 150, '#c0392b'),
        shape(
          'Roof',
          [
            [720, 386],
            [865, 296],
            [1010, 386],
          ],
          '#7a2a22',
        ),
        rect('Roof trim', 740, 380, 250, 8, '#f3ece0'),
        rect('Hayloft', 845, 330, 40, 34, '#f3ece0'),
        rect('Door', 820, 442, 90, 88, '#a32f24', { stroke: ['#f3ece0', 5] }),
        line(
          'Door cross 1',
          [
            [822, 444],
            [908, 528],
          ],
          '#f3ece0',
          5,
        ),
        line(
          'Door cross 2',
          [
            [908, 444],
            [822, 528],
          ],
          '#f3ece0',
          5,
        ),
      ]),
      group('Silo', [
        rect('Tower', 1010, 330, 72, 200, '#cdd3d9'),
        shape('Dome', arc(1046, 332, 36, 34, 180, 360, 12), '#98a2ad'),
        ...range(4).map((i) => rect(`Band ${i + 1}`, 1010, 370 + i * 40, 72, 3, '#aab3bc')),
      ]),
      group('Hay bales', [
        rect('Bale 1', 600, 500, 70, 44, '#e5c46a', { radius: 6 }),
        ellipse('Bale 1 end', 652, 500, 30, 44, '#d4ae4f'),
        rect('Bale 2', 1110, 510, 64, 40, '#e5c46a', { radius: 6 }),
        ellipse('Bale 2 end', 1156, 510, 28, 40, '#d4ae4f'),
      ]),
      group('Fence', [
        rect('Top rail', 0, 590, W, 9, '#ece2cf'),
        rect('Bottom rail', 0, 618, W, 9, '#ece2cf'),
        ...range(22).map((i) =>
          rect(`Post ${i + 1}`, 4 + i * 60, 576, 14, 70, '#e2d5bd', { radius: 2 }),
        ),
      ]),
    ],
  ),
  (() => {
    const trunk = range(13).map((i): Pt => {
      const t = i / 12;
      return [150 + 120 * t * t, 700 - 380 * t];
    });
    const fronds = [200, 235, 270, 310, 345, 20].map((deg, i) => {
      const { outline, rib } = leafPoints(270, 320, deg, 150 + (i % 2) * 20, 46, 0.35);
      return group(`Palm leaf ${i + 1}`, [
        shape('Leaf', outline, i % 2 ? '#4f9a4a' : '#5aab52'),
        line('Vein', rib, '#3f7f3a', 2),
      ]);
    });
    return background(
      'background.beach',
      'Beach',
      ['educational', 'sea', 'seaside', 'sand', 'holiday', 'summer', 'palm', 'outdoors'],
      [
        rect('Sky', 0, 0, W, 380, { from: '#79c4f1', to: '#e2f4fd', angle: 90 }),
        circle('Sun', 1060, 100, 50, '#fff3b5'),
        cloud('Cloud', 620, 80, 1),
        rect('Sea', 0, 380, W, 180, { from: '#2f9fd0', to: '#7fd3e6', angle: 90 }),
        group(
          'Sparkles on the sea',
          range(6).map((i) =>
            rect(`Sparkle ${i + 1}`, 820 + i * 50, 400 + (i % 3) * 22, 30, 4, '#ffffff', {
              opacity: 55,
              radius: 2,
            }),
          ),
        ),
        ground('Wet sand', 540, 8, 3, 0.4, '#e6cf9c'),
        shape('Foam', [...wavy(538, 8, 3, 0.4), ...wavy(548, 8, 3, 0.4).reverse()], '#ffffff', {
          opacity: 85,
        }),
        ground('Sand', 566, 10, 2, 1.8, { from: '#f6e3b4', to: '#ead09a', angle: 90 }),
        group('Palm tree', [
          shape(
            'Trunk',
            [
              ...trunk.map(([x, y], i): Pt => [x - 16 + i * 0.8, y]),
              ...trunk.map(([x, y], i): Pt => [x + 16 - i * 0.8, y]).reverse(),
            ],
            '#9a7046',
          ),
          ...range(6).map((i) =>
            line(
              `Ring ${i + 1}`,
              [
                [trunk[i * 2]![0] - 14, trunk[i * 2]![1]],
                [trunk[i * 2]![0] + 14, trunk[i * 2]![1] - 4],
              ],
              '#7d5733',
              2.5,
            ),
          ),
          ...fronds,
          circle('Coconut 1', 262, 334, 11, '#6b4a2b'),
          circle('Coconut 2', 282, 338, 10, '#5e4126'),
        ]),
        group('Beach umbrella', [
          line(
            'Pole',
            [
              [990, 410],
              [1000, 640],
            ],
            '#f4f1ea',
            6,
          ),
          ...range(6).map((i) =>
            shape(
              `Canopy part ${i + 1}`,
              [[990, 400], ...arc(990, 410, 130, 66, 180 + i * 30, 210 + i * 30, 4)],
              i % 2 ? '#ffffff' : '#ef6b5b',
            ),
          ),
        ]),
        group('Towel', [
          shape('Towel', turnedRect(820, 640, 180, 70, -8), '#5bb7e8'),
          shape('Towel stripe', turnedRect(820, 640, 180, 14, -8), '#ffffff', { opacity: 85 }),
        ]),
        group('Shells', [
          ellipse('Shell 1', 520, 660, 22, 16, '#f6c9b7'),
          ellipse('Shell 2', 600, 690, 16, 12, '#f3dcc5'),
        ]),
      ],
    );
  })(),
  (() => {
    const rnd = seeded(31);
    const greens = ['#3f8f4a', '#4fa356', '#2f7a3e', '#5cb062', '#367f45'];
    const corners: [number, number, number, number][] = [
      [0, 720, -80, -5],
      [1280, 720, 185, 260],
      [0, 0, 5, 80],
      [1280, 0, 100, 175],
    ];
    const leaves = corners.flatMap(([x, y, a0, a1], c) =>
      range(7).map((i) => {
        const deg = a0 + ((a1 - a0) * i) / 6 + (rnd() - 0.5) * 8;
        const { outline, rib } = leafPoints(x, y, deg, 230 + rnd() * 120, 90 + rnd() * 40, 0);
        return group(
          `Leaf ${c * 7 + i + 1}`,
          kept([
            piece('Leaf', outline, greens[(c + i) % 5]!),
            line(
              'Vein',
              rib.filter(([vx, vy]) => vx >= 0 && vx <= W && vy >= 0 && vy <= H),
              '#2a6a36',
              2,
            ),
          ]),
        );
      }),
    );
    return background(
      'background.jungle',
      'Rainforest',
      ['educational', 'jungle', 'rainforest', 'tropical', 'leaves', 'nature', 'outdoors', 'plants'],
      [
        rect('Forest light', 0, 0, W, H, { from: '#79b56e', to: '#1f4d32', radial: true }),
        group(
          'Sun rays',
          [0, 1, 2].map((i) =>
            shape(
              `Ray ${i + 1}`,
              [
                [420 + i * 160, 0],
                [480 + i * 160, 0],
                [640 + i * 200, H],
                [540 + i * 200, H],
              ],
              '#f5f3c4',
              { opacity: 9 },
            ),
          ),
        ),
        group('Tree trunks', [
          rect('Trunk 1', 300, 0, 46, H, '#2c4a2e'),
          rect('Trunk 2', 560, 0, 30, H, '#35553a', { opacity: 80 }),
          rect('Trunk 3', 930, 0, 54, H, '#2c4a2e'),
        ]),
        group(
          'Vines',
          [380, 520, 760, 880].map((x, i) => {
            const len = 260 + (i % 2) * 140;
            const pts = range(9).map((k): Pt => [x + 10 * Math.sin(k * 0.9), (k / 8) * len]);
            return group(`Vine ${i + 1}`, [
              line('Stem', pts, '#3f7f3a', 5),
              ...range(4).map((k) => {
                const [vx, vy] = pts[2 * k + 1]!;
                return shape(
                  `Vine leaf ${k + 1}`,
                  leafPoints(vx, vy, k % 2 ? 30 : 150, 34, 16).outline,
                  '#5aab52',
                );
              }),
            ]);
          }),
        ),
        ...leaves,
        group(
          'Flowers',
          [
            [200, 560],
            [1110, 140],
          ].map(([fx, fy], i) =>
            group(`Flower ${i + 1}`, [
              ...range(5).map((k) =>
                circle(
                  `Petal ${k + 1}`,
                  fx! + 16 * Math.cos((k * 72 * Math.PI) / 180),
                  fy! + 16 * Math.sin((k * 72 * Math.PI) / 180),
                  13,
                  i ? '#f6a34a' : '#ef5f88',
                ),
              ),
              circle('Middle', fx!, fy!, 8, '#ffe07a'),
            ]),
          ),
        ),
      ],
    );
  })(),
  (() => {
    const rnd = seeded(41);
    const crests = range(8).flatMap((r) => {
      const t = (r + 1) / 8.5;
      const y = 300 + 420 * Math.pow(t, 1.5);
      const s = 0.4 + 1.4 * t;
      const n = 13 - r;
      const sea = mix('#5fbde2', '#1c6aa0', (y - 300) / 420);
      return range(n).map((i) => {
        const x = ((i + 0.5 + (rnd() - 0.5) * 0.6) / n) * W;
        const w = 26 * s;
        return line(
          `Wave ${r + 1}-${i + 1}`,
          arc(Math.min(W - w, Math.max(w, x)), y - 6 * s, w, 6 * s, 200, 340, 6),
          mix(sea, '#ffffff', 0.38),
          1 + 1.3 * s,
        );
      });
    });
    return background(
      'background.ocean',
      'Open sea',
      ['educational', 'ocean', 'sea', 'waves', 'water', 'boat', 'outdoors', 'geography'],
      [
        rect('Sky', 0, 0, W, 300, { from: '#86ccf4', to: '#e8f6ff', angle: 90 }),
        circle('Sun', 300, 110, 46, '#fff6cf'),
        cloud('Cloud 1', 700, 60, 1),
        cloud('Cloud 2', 1020, 140, 0.7),
        rect('Sea', 0, 300, W, 420, { from: '#5fbde2', to: '#1c6aa0', angle: 90 }),
        group(
          'Sun on the water',
          range(5).map((i) =>
            rect(`Glint ${i + 1}`, 270 + ((i * 37) % 50), 316 + i * 20, 60 - i * 6, 4, '#fff6cf', {
              opacity: 70,
              radius: 2,
            }),
          ),
        ),
        group('Waves', crests),
        group('Sailing boat', [
          shape(
            'Hull',
            [
              [880, 292],
              [960, 292],
              [948, 304],
              [892, 304],
            ],
            '#7a4f2e',
          ),
          rect('Mast', 917, 230, 3, 62, '#5a3d24'),
          shape(
            'Main sail',
            [
              [921, 234],
              [921, 288],
              [956, 288],
            ],
            '#ffffff',
          ),
          shape(
            'Front sail',
            [
              [915, 240],
              [915, 288],
              [888, 288],
            ],
            '#f3efe6',
          ),
        ]),
        group('Seagulls', [
          gull('Seagull 1', 560, 150, 1.2),
          gull('Seagull 2', 610, 180, 0.9),
          gull('Seagull 3', 1150, 220, 1),
        ]),
      ],
    );
  })(),
  (() => {
    const rnd = seeded(53);
    const ceiling = range(33).map((i): Pt => [
      (i / 32) * W,
      60 + 40 * Math.sin(i * 1.7) * Math.sin(i * 0.4) + 20,
    ]);
    const floor = range(33).map((i): Pt => [
      (i / 32) * W,
      590 + 22 * Math.sin(i * 1.3) + 10 * Math.cos(i * 0.7),
    ]);
    const opening: Pt[] = [
      [780, 470],
      [770, 380],
      [800, 300],
      [860, 250],
      [940, 230],
      [1010, 260],
      [1060, 330],
      [1080, 420],
      [1070, 480],
    ];
    return background(
      'background.cave',
      'Cave',
      ['educational', 'cavern', 'rocks', 'underground', 'stalactite', 'geography', 'dark'],
      [
        rect('Cave', 0, 0, W, H, { from: '#6b5849', to: '#241c18', radial: true }),
        shape(
          'Rock around the opening',
          turn(
            opening.map(([x, y]): Pt => [925 + (x - 925) * 1.12, 360 + (y - 360) * 1.1]),
            925,
            360,
            0,
          ),
          '#3b3029',
        ),
        shape('Cave mouth', opening, { from: '#f8ecd2', to: '#c4a988', radial: true }),
        shape(
          'Light on the floor',
          [
            [790, 470],
            [1060, 470],
            [1150, 660],
            [620, 660],
          ],
          '#f8ecd2',
          { opacity: 14 },
        ),
        shape('Ceiling', [[0, 0], [W, 0], ...ceiling.slice().reverse()], '#3a2f28'),
        group(
          'Stalactites',
          range(12).map((i) => {
            const x = 50 + i * 106 + rnd() * 40;
            const [, top] = ceiling[Math.round((x / W) * 32)]!;
            const len = 40 + rnd() * 120;
            const w = 14 + rnd() * 14;
            return shape(
              `Stalactite ${i + 1}`,
              [
                [x - w, top - 10],
                [x + w, top - 10],
                [x, top + len],
              ],
              i % 2 ? '#4a3c33' : '#54453a',
            );
          }),
        ),
        shape('Floor', [...floor, [W, H], [0, H]], { from: '#4a3d34', to: '#2a221d', angle: 90 }),
        group(
          'Stalagmites',
          range(7).map((i) => {
            const x = 60 + i * 190 + rnd() * 50;
            const [, top] = floor[Math.round((x / W) * 32)]!;
            const h = 50 + rnd() * 90;
            const w = 18 + rnd() * 14;
            return shape(
              `Stalagmite ${i + 1}`,
              [
                [x - w, top + 14],
                [x, top - h],
                [x + w, top + 14],
              ],
              i % 2 ? '#56473c' : '#4c3f35',
            );
          }),
        ),
        group('Pool', [
          ellipse('Water', 340, 640, 280, 46, '#5c7f93', { opacity: 60 }),
          ellipse('Shine', 400, 652, 120, 10, '#bcd6e2', { opacity: 50 }),
        ]),
        group('Crystals', [
          shape(
            'Crystal 1',
            [
              [1140, 640],
              [1150, 590],
              [1164, 640],
            ],
            '#a9b8ff',
          ),
          shape(
            'Crystal 2',
            [
              [1160, 640],
              [1178, 570],
              [1194, 640],
            ],
            '#c2b2ff',
          ),
          shape(
            'Crystal 3',
            [
              [1190, 640],
              [1200, 604],
              [1212, 640],
            ],
            '#9fd0ff',
          ),
        ]),
      ],
    );
  })(),
  (() => {
    const rnd = seeded(61);
    return background(
      'background.snow',
      'Snowy day',
      ['educational', 'snow', 'winter', 'cold', 'christmas', 'snowman', 'outdoors', 'nature'],
      [
        rect('Sky', 0, 0, W, H, { from: '#c4dff3', to: '#f1f7fc', angle: 90 }),
        ground('Far snow', 380, 24, 1.3, 0.4, '#e1edf7'),
        group(
          'Far trees',
          range(14).map((i) =>
            pine(
              `Far tree ${i + 1}`,
              40 + i * 92 + rnd() * 30,
              410 + rnd() * 20,
              90 + rnd() * 50,
              '#6d9a95',
              { snow: '#f5f9fc' },
            ),
          ),
        ),
        ground('Snowy hill', 470, 20, 0.9, 2, '#eef4fa'),
        ...[80, 200, 1190].map((x, i) =>
          pine(`Fir tree ${i + 1}`, x, 560 + (i % 2) * 24, 200 + (i % 2) * 40, '#3f6e66', {
            trunk: '#6b4a2f',
            snow: '#ffffff',
          }),
        ),
        ground('Snow', 590, 10, 1.2, 1, '#ffffff'),
        group('Snowman', [
          ellipse('Shadow', 930, 668, 150, 24, '#dbe7f2'),
          circle('Bottom', 1004, 620, 56, '#ffffff', { stroke: ['#d5e2ee', 2] }),
          circle('Middle', 1004, 534, 42, '#ffffff', { stroke: ['#d5e2ee', 2] }),
          circle('Head', 1004, 468, 30, '#ffffff', { stroke: ['#d5e2ee', 2] }),
          rect('Scarf', 976, 494, 56, 12, '#d9534f', { radius: 6 }),
          rect('Scarf end', 1012, 500, 12, 34, '#d9534f', { radius: 4 }),
          circle('Left eye', 994, 460, 3.5, '#2d2f33'),
          circle('Right eye', 1014, 460, 3.5, '#2d2f33'),
          shape(
            'Carrot nose',
            [
              [1004, 468],
              [1032, 474],
              [1004, 476],
            ],
            '#f08a2c',
          ),
          circle('Button 1', 1004, 528, 4, '#2d2f33'),
          circle('Button 2', 1004, 548, 4, '#2d2f33'),
          line(
            'Left arm',
            [
              [966, 530],
              [926, 504],
              [912, 506],
            ],
            '#6b4a2f',
            4,
          ),
          line(
            'Right arm',
            [
              [1042, 530],
              [1082, 506],
              [1096, 498],
            ],
            '#6b4a2f',
            4,
          ),
        ]),
        group(
          'Snowflakes',
          range(90).map((i) =>
            circle(
              `Snowflake ${i + 1}`,
              6 + rnd() * (W - 12),
              6 + rnd() * 560,
              1.8 + rnd() * 3.2,
              '#ffffff',
              { opacity: 85 },
            ),
          ),
        ),
      ],
    );
  })(),
  (() => {
    const rnd = seeded(71);
    const mito = (name: string, x: number, y: number, deg: number): Part =>
      group(name, [
        shape(
          'Outer membrane',
          turn(arc(x, y, 64, 30, 0, 360, 28).slice(0, -1), x, y, deg),
          '#f8bf96',
          { stroke: ['#e8956a', 3] },
        ),
        line(
          'Cristae',
          turn(
            range(11).map((i): Pt => [x - 50 + i * 10, y + (i % 2 ? 16 : -16)]),
            x,
            y,
            deg,
          ),
          '#e8956a',
          3,
        ),
      ]);
    // The rough endoplasmic reticulum: folded membranes round the nucleus, dotted with ribosomes.
    const erPoint = (r: number, deg: number): Pt => {
      const a = (deg * Math.PI) / 180;
      const rr = r + 5 * Math.sin(deg * 0.3);
      return [40 + rr * Math.cos(a), 520 + rr * Math.sin(a)];
    };
    const er = (name: string, r: number): Part =>
      group(name, [
        shape(
          'Membrane',
          [
            ...range(23).map((i) => erPoint(r, -76 + i * 2.75)),
            ...range(23).map((i) => erPoint(r + 13, -76 + (22 - i) * 2.75)),
          ],
          '#efd6f5',
          { stroke: ['#c99ad8', 2.5] },
        ),
        ...range(9).map((i) => {
          const [x, y] = erPoint(r + 18, -73 + i * 7);
          return circle(`Ribosome ${i + 1}`, x, y, 3, '#a978b8');
        }),
      ]);
    return background(
      'background.cell',
      'Inside a cell',
      [
        'educational',
        'biology',
        'cell',
        'organelles',
        'mitochondria',
        'nucleus',
        'science',
        'cytoplasm',
      ],
      [
        rect('Cytoplasm', 0, 0, W, H, { from: '#fde9f0', to: '#f3cadb', radial: true }),
        group(
          'Ribosomes',
          range(60).map((i) =>
            circle(
              `Ribosome ${i + 1}`,
              10 + rnd() * (W - 20),
              10 + rnd() * (H - 20),
              2.5 + rnd() * 1.5,
              '#c99ac8',
              { opacity: 70 },
            ),
          ),
        ),
        group('Endoplasmic reticulum', [er('Fold 1', 300), er('Fold 2', 330), er('Fold 3', 360)]),
        group(
          'Nucleus',
          kept([
            dot('Nuclear envelope', 40, 520, 250, '#e3c3ee', { stroke: ['#c49ad6', 8] }),
            circle('Nucleolus', 120, 540, 60, '#c9a0dc'),
            ...range(8).map((i) => {
              const a = ((-80 + i * 20) * Math.PI) / 180;
              return dot(
                `Nuclear pore ${i + 1}`,
                40 + 250 * Math.cos(a),
                520 + 250 * Math.sin(a),
                6,
                '#f7e6fb',
              );
            }),
          ]),
        ),
        mito('Mitochondrion 1', 640, 170, -20),
        mito('Mitochondrion 2', 1040, 420, 30),
        mito('Mitochondrion 3', 560, 560, 10),
        group(
          'Golgi body',
          range(4).map((i) =>
            line(
              `Golgi layer ${i + 1}`,
              arc(1000, 130 + i * 22, 110 - i * 12, 50, 200, 340, 12),
              i % 2 ? '#f6d68f' : '#f0c160',
              9,
            ),
          ),
        ),
        group(
          'Vesicles',
          range(10).map((i) => {
            const [x, y] = [
              [860, 260],
              [900, 300],
              [1180, 230],
              [760, 380],
              [420, 380],
              [1160, 620],
              [820, 640],
              [700, 300],
              [350, 90],
              [1220, 520],
            ][i]!;
            return circle(`Vesicle ${i + 1}`, x!, y!, 10 + (i % 3) * 5, '#fbe1ea', {
              stroke: ['#e6a4c0', 3],
            });
          }),
        ),
        group('Lysosomes', [
          circle('Lysosome 1', 860, 520, 22, '#cfe8a8', { stroke: ['#a8cf78', 3] }),
          circle('Lysosome 2', 300, 300, 18, '#cfe8a8', { stroke: ['#a8cf78', 3] }),
        ]),
      ],
    );
  })(),
  (() => {
    const rnd = seeded(83);
    const traces: Part[] = [];
    const pads: Part[] = [];
    range(11).forEach((k) => {
      const y = 40 + k * 64;
      let x = 20 + rnd() * 140;
      for (let t = 0; t < 2 && x < W - 240; t++) {
        const x1 = x + 120 + rnd() * 240;
        const jog = (rnd() < 0.5 ? -1 : 1) * 32;
        const y2 = y + jog < 20 || y + jog > H - 20 ? y - jog : y + jog;
        const x2 = x1 + 32;
        const x3 = Math.min(W - 20, x2 + 80 + rnd() * 220);
        traces.push(
          line(
            `Trace ${traces.length + 1}`,
            [
              [x, y],
              [x1, y],
              [x2, y2],
              [x3, y2],
            ],
            '#3a9a70',
            4,
          ),
        );
        pads.push(circle(`Pad ${pads.length + 1}`, x, y, 7, '#0f5a40', { stroke: ['#c9a85a', 3] }));
        pads.push(
          circle(`Pad ${pads.length + 1}`, x3, y2, 7, '#0f5a40', { stroke: ['#c9a85a', 3] }),
        );
        x = x3 + 60 + rnd() * 80;
      }
    });
    const chip = (
      name: string,
      x: number,
      y: number,
      w: number,
      h: number,
      pinsAcross: number,
      pinsDown: number,
    ): Part =>
      group(name, [
        ...range(pinsAcross).flatMap((i) => {
          const px = x + ((i + 0.5) * w) / pinsAcross - 3;
          return [
            rect(`Pin top ${i + 1}`, px, y - 10, 6, 12, '#c3cccc'),
            rect(`Pin bottom ${i + 1}`, px, y + h - 2, 6, 12, '#c3cccc'),
          ];
        }),
        ...range(pinsDown).flatMap((i) => {
          const py = y + ((i + 0.5) * h) / pinsDown - 3;
          return [
            rect(`Pin left ${i + 1}`, x - 10, py, 12, 6, '#c3cccc'),
            rect(`Pin right ${i + 1}`, x + w - 2, py, 12, 6, '#c3cccc'),
          ];
        }),
        rect('Body', x, y, w, h, '#1f2828', { radius: 4 }),
        rect('Top', x + 10, y + 10, w - 20, h - 20, '#283434', { radius: 3 }),
        circle('Dot', x + 18, y + 18, 4, '#3d4b4b'),
      ]);
    return background(
      'background.circuit',
      'Circuit board',
      ['educational', 'technology', 'computer', 'electronics', 'pcb', 'chip', 'tech', 'computing'],
      [
        rect('Board', 0, 0, W, H, { from: '#14694b', to: '#0c4a35', angle: 135 }),
        group('Traces', traces),
        group('Pads', pads),
        group(
          'Vias',
          range(24).map((i) =>
            circle(`Via ${i + 1}`, 30 + rnd() * (W - 60), 30 + rnd() * (H - 60), 4, '#0f5a40', {
              stroke: ['#3a9a70', 2],
            }),
          ),
        ),
        chip('Processor', 900, 380, 180, 180, 9, 9),
        chip('Memory chip', 200, 470, 200, 70, 8, 0),
        chip('Small chip', 980, 110, 120, 60, 5, 0),
        group(
          'Components',
          range(6).map((i) => {
            const [x, y] = [
              [560, 150],
              [640, 330],
              [520, 600],
              [740, 520],
              [160, 260],
              [1180, 640],
            ][i]!;
            return group(`Resistor ${i + 1}`, [
              rect('Body', x!, y!, 36, 14, '#2a2a2a', { radius: 2 }),
              rect('Left end', x!, y!, 8, 14, '#c3cccc'),
              rect('Right end', x! + 28, y!, 8, 14, '#c3cccc'),
            ]);
          }),
        ),
      ],
    );
  })(),
  background(
    'background.blueprint',
    'Blueprint',
    [
      'educational',
      'plan',
      'design',
      'engineering',
      'technical drawing',
      'architecture',
      'grid',
      'pattern',
    ],
    [
      rect('Paper', 0, 0, W, H, { from: '#22558f', to: '#1a4579', angle: 90 }),
      group('Fine grid', [
        ...range(39)
          .filter((i) => (i + 1) % 5)
          .map((i) =>
            rect(`Column ${i + 1}`, 32 + i * 32 - 0.5, 0, 1, H, '#ffffff', { opacity: 9 }),
          ),
        ...range(22)
          .filter((i) => (i + 1) % 5)
          .map((i) => rect(`Row ${i + 1}`, 0, 32 + i * 32 - 0.5, W, 1, '#ffffff', { opacity: 9 })),
      ]),
      group('Bold grid', [
        ...range(7).map((i) =>
          rect(`Bold column ${i + 1}`, 160 + i * 160 - 1, 0, 2, H, '#ffffff', { opacity: 18 }),
        ),
        ...range(4).map((i) =>
          rect(`Bold row ${i + 1}`, 0, 160 + i * 160 - 1, W, 2, '#ffffff', { opacity: 18 }),
        ),
      ]),
      rect('Border', 24, 24, W - 48, H - 48, null, { stroke: ['#e6f0ff', 3], opacity: 70 }),
      group('Floor plan', [
        rect('Outer walls', 704, 96, 448, 352, null, { stroke: ['#e6f0ff', 8], opacity: 85 }),
        line(
          'Wall 1',
          [
            [928, 96],
            [928, 300],
          ],
          '#e6f0ff',
          5,
        ),
        line(
          'Wall 2',
          [
            [704, 300],
            [880, 300],
          ],
          '#e6f0ff',
          5,
        ),
        line(
          'Wall 3',
          [
            [960, 300],
            [1152, 300],
          ],
          '#e6f0ff',
          5,
        ),
        line(
          'Door 1',
          [
            [880, 300],
            [880, 252],
          ],
          '#e6f0ff',
          2,
        ),
        line('Door 1 swing', arc(880, 300, 48, 48, 270, 360, 8), '#e6f0ff', 1.5),
        line(
          'Door 2',
          [
            [960, 300],
            [960, 252],
          ],
          '#e6f0ff',
          2,
        ),
        line('Door 2 swing', arc(960, 300, 48, 48, 180, 270, 8), '#e6f0ff', 1.5),
        rect('Window 1', 770, 90, 96, 12, '#22558f', { stroke: ['#e6f0ff', 2] }),
        rect('Window 2', 1000, 90, 96, 12, '#22558f', { stroke: ['#e6f0ff', 2] }),
        rect('Window 3', 1146, 340, 12, 70, '#22558f', { stroke: ['#e6f0ff', 2] }),
      ]),
      group('Measurements', [
        line(
          'Width line',
          [
            [704, 70],
            [1152, 70],
          ],
          '#e6f0ff',
          1.5,
        ),
        line(
          'Width end 1',
          [
            [704, 62],
            [704, 78],
          ],
          '#e6f0ff',
          1.5,
        ),
        line(
          'Width end 2',
          [
            [1152, 62],
            [1152, 78],
          ],
          '#e6f0ff',
          1.5,
        ),
        line(
          'Height line',
          [
            [1186, 96],
            [1186, 448],
          ],
          '#e6f0ff',
          1.5,
        ),
        line(
          'Height end 1',
          [
            [1178, 96],
            [1194, 96],
          ],
          '#e6f0ff',
          1.5,
        ),
        line(
          'Height end 2',
          [
            [1178, 448],
            [1194, 448],
          ],
          '#e6f0ff',
          1.5,
        ),
      ]),
      group('Title block', [
        rect('Box', 896, 536, 336, 136, null, { stroke: ['#e6f0ff', 2.5], opacity: 80 }),
        line(
          'Divider 1',
          [
            [896, 580],
            [1232, 580],
          ],
          '#e6f0ff',
          1.5,
        ),
        line(
          'Divider 2',
          [
            [896, 626],
            [1232, 626],
          ],
          '#e6f0ff',
          1.5,
        ),
        line(
          'Divider 3',
          [
            [1080, 580],
            [1080, 672],
          ],
          '#e6f0ff',
          1.5,
        ),
      ]),
      group('Compass', [
        circle('Ring', 120, 600, 40, null, { stroke: ['#e6f0ff', 2], opacity: 70 }),
        shape(
          'North arrow',
          [
            [120, 554],
            [132, 600],
            [120, 592],
            [108, 600],
          ],
          '#e6f0ff',
          { opacity: 85 },
        ),
      ]),
    ],
  ),
];

// ---- paper and boards ----

/** Lines every `step` px across the stage (skipping the edges); `skip` leaves out every nth. */
function gridLines(
  name: string,
  step: number,
  width: number,
  colour: string,
  o: { skip?: number; opacity?: number; down?: boolean; across?: boolean } = {},
): Part {
  const keep = (k: number) => !o.skip || k % o.skip !== 0;
  const look = o.opacity === undefined ? {} : { opacity: o.opacity };
  return group(name, [
    ...(o.down === false
      ? []
      : range(Math.floor((W - 1) / step))
          .map((i) => i + 1)
          .filter(keep)
          .map((k) =>
            rect(`${name} column ${k}`, k * step - width / 2, 0, width, H, colour, look),
          )),
    ...(o.across === false
      ? []
      : range(Math.floor((H - 1) / step))
          .map((i) => i + 1)
          .filter(keep)
          .map((k) => rect(`${name} row ${k}`, 0, k * step - width / 2, W, width, colour, look))),
  ]);
}

const PAPERS: readonly LibraryItem[] = [
  background(
    'background.graphpaper',
    'Graph paper',
    ['paper', 'grid', 'maths', 'math', 'graph', 'texture', 'educational', 'millimetre'],
    [
      rect('Paper', 0, 0, W, H, '#fbfdff'),
      gridLines('Fine lines', 16, 1, '#d3e5f3', { skip: 5 }),
      gridLines('Bold lines', 80, 2, '#9fc5e3'),
    ],
  ),
  background(
    'background.linedpaper',
    'Lined paper',
    ['paper', 'notebook', 'exercise book', 'writing', 'lines', 'texture', 'educational', 'school'],
    [
      rect('Paper', 0, 0, W, H, '#fffdf6'),
      group(
        'Lines',
        range(18).map((i) => rect(`Line ${i + 1}`, 0, 120 + i * 34, W, 2, '#a9c8e8')),
      ),
      rect('Top line', 0, 86, W, 2, '#a9c8e8'),
      rect('Margin', 150, 0, 2, H, '#e79a9a'),
      rect('Second margin line', 156, 0, 2, H, '#e79a9a'),
      group(
        'Punched holes',
        [180, 360, 540].map((y, i) =>
          circle(`Hole ${i + 1}`, 60, y, 17, '#ddd8cb', { stroke: ['#cbc5b6', 2] }),
        ),
      ),
    ],
  ),
  background(
    'background.dottedpaper',
    'Dotted paper',
    ['paper', 'dot grid', 'bullet journal', 'dots', 'notebook', 'texture', 'educational'],
    [
      rect('Paper', 0, 0, W, H, '#fbfaf6'),
      group(
        'Dots',
        range(22 * 12).map((i) =>
          circle(
            `Dot ${i + 1}`,
            640 + ((i % 22) - 10.5) * 58,
            360 + (Math.floor(i / 22) - 5.5) * 58,
            2.6,
            '#b9bcc2',
          ),
        ),
      ),
    ],
  ),
  background(
    'background.squaredpaper',
    'Squared maths paper',
    [
      'paper',
      'squares',
      'maths',
      'math',
      'exercise book',
      'grid',
      'texture',
      'educational',
      'school',
    ],
    [
      rect('Paper', 0, 0, W, H, '#f8fbff'),
      gridLines('Squares', 40, 1.5, '#c5d4e5'),
      rect('Margin', 119, 0, 2.5, H, '#e59a9a'),
    ],
  ),
  (() => {
    const rnd = seeded(97);
    const tones = ['#a8774a', '#e2bf8f', '#8f6236', '#b98653'];
    return background(
      'background.corkboard',
      'Cork board',
      ['board', 'notice board', 'pin board', 'bulletin', 'cork', 'texture', 'school', 'classroom'],
      [
        rect('Frame', 0, 0, W, H, { from: '#b27c4b', to: '#8a5a32', angle: 90 }),
        rect('Frame highlight', 0, 0, W, 5, '#c79462'),
        rect('Frame shadow', 30, 30, W - 60, H - 60, '#6e4526'),
        rect('Cork', 36, 36, W - 72, H - 72, { from: '#d6aa77', to: '#bf8e5a', radial: true }),
        group(
          'Cork grain',
          range(240).map((i) => {
            const r = 1.2 + rnd() * 2.6;
            return circle(
              `Speck ${i + 1}`,
              40 + r + rnd() * (W - 80 - 2 * r),
              40 + r + rnd() * (H - 80 - 2 * r),
              r,
              tones[i % 4]!,
              { opacity: 45 + Math.round(rnd() * 35) },
            );
          }),
        ),
      ],
    );
  })(),
  (() => {
    const rnd = seeded(101);
    return background(
      'background.kraft',
      'Kraft paper',
      ['paper', 'cardboard', 'brown paper', 'card', 'texture', 'craft'],
      [
        rect('Paper', 0, 0, W, H, { from: '#d2aa78', to: '#c39864', angle: 120 }),
        group(
          'Fibres',
          range(220).map((i) => {
            const len = 10 + rnd() * 26;
            const [x, y] = [20 + rnd() * (W - 40), 20 + rnd() * (H - 40)];
            return shape(
              `Fibre ${i + 1}`,
              turnedRect(x, y, len, 1.6, rnd() * 180),
              i % 3 ? '#b78a55' : '#e0bf90',
              { opacity: 55 },
            );
          }),
        ),
        group(
          'Specks',
          range(50).map((i) =>
            circle(
              `Speck ${i + 1}`,
              10 + rnd() * (W - 20),
              10 + rnd() * (H - 20),
              1 + rnd() * 1.8,
              '#8e6638',
              { opacity: 50 },
            ),
          ),
        ),
      ],
    );
  })(),
  (() => {
    const rnd = seeded(107);
    const colours = ['#fff3a3', '#ffd1dc', '#c9ecff', '#d4f5c4', '#ffe0b2', '#e6d4ff'];
    const notes = range(18)
      .filter((i) => i !== 8 && i !== 9)
      .map((i) => {
        const [col, row] = [i % 6, Math.floor(i / 6)];
        const [cx, cy] = [
          107 + col * 213 + (rnd() - 0.5) * 16,
          125 + row * 235 + (rnd() - 0.5) * 16,
        ];
        const deg = (rnd() - 0.5) * 9;
        return group(`Sticky note ${i + 1}`, [
          shape('Shadow', turnedRect(cx + 4, cy + 6, 168, 168, deg), '#000000', { opacity: 9 }),
          shape(
            'Note',
            turnedRect(cx, cy, 168, 168, deg),
            colours[[0, 3, 1, 4, 2, 5, 2, 5, 0, 0, 0, 3, 4, 1, 3, 0, 5, 2][i]!]!,
          ),
          shape('Sticky strip', turn(turnedRect(cx, cy - 70, 168, 28, 0), cx, cy, deg), '#000000', {
            opacity: 4,
          }),
          ...range(3).map((k) =>
            shape(
              `Writing ${k + 1}`,
              turn(
                turnedRect(
                  cx - 10 + (k === 2 ? -24 : 0),
                  cy - 20 + k * 26,
                  k === 2 ? 76 : 124,
                  4,
                  0,
                ),
                cx,
                cy,
                deg,
              ),
              '#6b6f78',
              { opacity: 22 },
            ),
          ),
        ]);
      });
    return background(
      'background.stickynotes',
      'Sticky note wall',
      [
        'notes',
        'post-it',
        'board',
        'ideas',
        'brainstorm',
        'planning',
        'office',
        'paper',
        'texture',
      ],
      [rect('Wall', 0, 0, W, H, { from: '#eef1f4', to: '#e1e6eb', angle: 90 }), ...notes],
    );
  })(),
];

// ---- patterns ----

/** Which of the three brick colours each brick is (the same every time). */
const tone = seeded(89);

const PATTERNS: readonly LibraryItem[] = [
  background(
    'background.polkadots',
    'Polka dots',
    ['pattern', 'dots', 'spots', 'circles', 'cute'],
    [
      rect('Base', 0, 0, W, H, '#fdeef2'),
      group(
        'Dots',
        kept(
          range(16).flatMap((r) =>
            range(15).map((c) =>
              dot(`Dot ${r + 1}-${c + 1}`, (r % 2 ? 48 : 0) + c * 96 - 48, r * 48, 16, '#f7cfda'),
            ),
          ),
        ),
      ),
    ],
  ),
  background(
    'background.stripes',
    'Diagonal stripes',
    ['pattern', 'stripes', 'lines', 'diagonal'],
    [
      rect('Base', 0, 0, W, H, '#eaf3fb'),
      group(
        'Stripes',
        kept(
          range(29).map((i) => {
            const x = i * 72 - 36;
            return piece(
              `Stripe ${i + 1}`,
              [
                [x, 0],
                [x + 36, 0],
                [x + 36 - H, H],
                [x - H, H],
              ],
              '#d9e8f6',
            );
          }),
        ),
      ),
    ],
  ),
  background(
    'background.checkerboard',
    'Checkerboard',
    ['pattern', 'checks', 'squares', 'chess', 'checkered', 'grid'],
    [
      rect('Base', 0, 0, W, H, '#eef4ea'),
      group(
        'Squares',
        range(16 * 9)
          .filter((i) => ((i % 16) + Math.floor(i / 16)) % 2 === 0)
          .map((i) =>
            rect(`Square ${i + 1}`, (i % 16) * 80, Math.floor(i / 16) * 80, 80, 80, '#e0ebda'),
          ),
      ),
    ],
  ),
  (() => {
    const r = 46;
    const w = Math.sqrt(3) * r;
    const hex = (cx: number, cy: number, s: number): Pt[] =>
      range(6).map((k) => [
        cx + s * Math.cos(((-90 + 60 * k) * Math.PI) / 180),
        cy + s * Math.sin(((-90 + 60 * k) * Math.PI) / 180),
      ]);
    return background(
      'background.honeycomb',
      'Honeycomb',
      ['pattern', 'hexagons', 'hexagon', 'bees', 'geometric', 'texture'],
      [
        rect('Wax', 0, 0, W, H, '#f0dca4'),
        group(
          'Cells',
          kept(
            range(12).flatMap((j) =>
              range(18).map((k) =>
                piece(
                  `Cell ${j + 1}-${k + 1}`,
                  hex(k * w + (j % 2 ? w / 2 : 0) - w / 2, j * 1.5 * r, r - 3.5),
                  '#fbf0cf',
                ),
              ),
            ),
          ),
        ),
      ],
    );
  })(),
  background(
    'background.bricks',
    'Brick wall',
    ['pattern', 'bricks', 'wall', 'texture', 'building'],
    [
      rect('Mortar', 0, 0, W, H, '#efe6dc'),
      group(
        'Bricks',
        kept(
          range(15).flatMap((j) =>
            range(11).map((k) =>
              block(
                `Brick ${j + 1}-${k + 1}`,
                k * 128 - (j % 2 ? 64 : 0) + 3,
                j * 48 + 3,
                122,
                42,
                ['#dcb39c', '#d6a88f', '#e1bba6'][Math.floor(tone() * 3)]!,
              ),
            ),
          ),
        ),
      ),
    ],
  ),
  (() => {
    const rnd = seeded(113);
    const tones = ['#e4c495', '#dbb886', '#e9cda2'];
    const planks: Part[] = [];
    range(8).forEach((row) => {
      const y = row * 90;
      let x = -((row * 233) % 460) - 20;
      while (x < W) {
        const len = 360 + rnd() * 380;
        const x0 = Math.max(0, x + 2);
        const x1 = Math.min(W, x + len - 2);
        const n = planks.length + 1;
        planks.push(
          group(`Plank ${n}`, [
            rect('Wood', x0, y + 2, x1 - x0, 86, tones[n % 3]!),
            ...range(3).map((g) =>
              line(
                `Grain ${g + 1}`,
                range(9).map((i): Pt => [
                  x0 + 12 + ((x1 - x0 - 24) * i) / 8,
                  y + 20 + g * 24 + 4 * Math.sin(i * 1.3 + n + g),
                ]),
                '#cfa97a',
                1.5,
              ),
            ),
            ...(rnd() < 0.35 && x1 - x0 > 120
              ? [ellipse('Knot', x0 + 40 + rnd() * (x1 - x0 - 100), y + 34, 26, 14, '#c99d6c')]
              : []),
          ]),
        );
        x += len;
      }
    });
    return background(
      'background.woodplanks',
      'Wood planks',
      ['pattern', 'wood', 'floor', 'planks', 'texture', 'wooden'],
      [rect('Gaps', 0, 0, W, H, '#b88f5f'), ...planks],
    );
  })(),
  (() => {
    const rnd = seeded(127);
    return background(
      'background.triangles',
      'Soft triangles',
      ['pattern', 'triangles', 'geometric', 'low poly', 'shapes', 'abstract'],
      [
        rect('Base', 0, 0, W, H, '#e2e6f5'),
        group(
          'Triangles',
          kept(
            range(6).flatMap((j) =>
              range(18).map((i) => {
                const [y0, y1] = [j * 120, j * 120 + 120];
                const up = (i + j) % 2 === 0;
                const pts: Pt[] = up
                  ? [
                      [(i - 1) * 80, y1],
                      [i * 80, y0],
                      [(i + 1) * 80, y1],
                    ]
                  : [
                      [(i - 1) * 80, y0],
                      [(i + 1) * 80, y0],
                      [i * 80, y1],
                    ];
                const t = ((i * 80) / W) * 0.65 + (j / 6) * 0.35 + (rnd() - 0.5) * 0.4;
                return piece(`Triangle ${j + 1}-${i + 1}`, pts, mix('#bfd7f3', '#efd0e7', t));
              }),
            ),
          ),
        ),
      ],
    );
  })(),
  background(
    'background.waves',
    'Gentle waves',
    ['pattern', 'waves', 'wavy', 'water', 'calm', 'lines'],
    [
      rect('Base', 0, 0, W, H, '#e8f4fb'),
      group(
        'Wave bands',
        kept(
          range(11).map((i) =>
            piece(
              `Wave band ${i + 1}`,
              [
                ...wavy(i * 72 - 36, 14, 3, i * 0.5, 64),
                ...wavy(i * 72 + 36, 14, 3, (i + 1) * 0.5, 64).reverse(),
              ],
              mix('#e0effa', '#b9d9ee', i / 10),
            ),
          ),
        ),
      ),
      group(
        'Crests',
        range(10).map((i) =>
          line(`Crest ${i + 1}`, wavy((i + 1) * 72 - 36, 14, 3, (i + 1) * 0.5, 64), '#f6fbfe', 3),
        ),
      ),
    ],
  ),
  background(
    'background.chevrons',
    'Chevrons',
    ['pattern', 'zigzag', 'chevron', 'stripes', 'geometric'],
    [
      rect('Base', 0, 0, W, H, '#f5faf9'),
      group(
        'Zigzags',
        kept(
          range(10).map((i) => {
            const top = range(33).map((k): Pt => [k * 40, i * 80 - 20 + (k % 2 ? 30 : 0)]);
            return piece(
              `Zigzag ${i + 1}`,
              [
                ...top,
                ...top
                  .slice()
                  .reverse()
                  .map(([x, y]): Pt => [x, y + 36]),
              ],
              '#dbeee9',
            );
          }),
        ),
      ),
    ],
  ),
  (() => {
    const rnd = seeded(131);
    const colours = ['#f7a1a1', '#9fd3f7', '#ffd57a', '#a8e6a1', '#c9a7f2', '#ffb38a'];
    return background(
      'background.confetti',
      'Confetti',
      ['pattern', 'party', 'celebration', 'birthday', 'fun', 'festive'],
      [
        rect('Base', 0, 0, W, H, '#fffaf3'),
        group(
          'Confetti',
          range(16 * 10).map((i) => {
            const [cx, cy] = [
              ((i % 16) + 0.15 + rnd() * 0.7) * 80,
              (Math.floor(i / 16) + 0.15 + rnd() * 0.7) * 72,
            ];
            const colour = colours[Math.floor(rnd() * 6)]!;
            const kind = Math.floor(rnd() * 3);
            if (kind === 0)
              return circle(`Dot ${i + 1}`, cx, cy, 4 + rnd() * 3, colour, { opacity: 85 });
            if (kind === 1)
              return shape(`Strip ${i + 1}`, turnedRect(cx, cy, 16, 6, rnd() * 180), colour, {
                opacity: 85,
              });
            return line(
              `Curl ${i + 1}`,
              turn(
                range(5).map((k): Pt => [cx - 12 + k * 6, cy + (k % 2 ? 4 : -4)]),
                cx,
                cy,
                rnd() * 180,
              ),
              colour,
              3,
            );
          }),
        ),
      ],
    );
  })(),
  (() => {
    const rnd = seeded(137);
    return background(
      'background.stars',
      'Stars pattern',
      ['pattern', 'stars', 'star', 'night', 'sparkle', 'cute'],
      [
        rect('Base', 0, 0, W, H, '#f0f1fb'),
        group(
          'Stars',
          range(10).flatMap((j) =>
            range(j % 2 ? 9 : 10).map((k) => {
              const s = 12 + rnd() * 8;
              const [x, y] = [
                (j % 2 ? 128 : 64) + k * 128 + (rnd() - 0.5) * 30,
                36 + j * 72 + (rnd() - 0.5) * 14,
              ];
              return star(
                `Star ${j + 1}-${k + 1}`,
                x - s,
                y - s,
                2 * s,
                2 * s,
                (j + k) % 3 ? '#dcdff6' : '#f5e3a8',
                5,
                0.48,
              );
            }),
          ),
        ),
      ],
    );
  })(),
  (() => {
    const rnd = seeded(149);
    const lights = range(34).map((i) => {
      const big = i < 12;
      const r = big ? 70 + rnd() * 90 : 12 + rnd() * 30;
      const [x, y] = [r + rnd() * (W - 2 * r), r + rnd() * (H - 2 * r)];
      return circle(
        `Light ${i + 1}`,
        x,
        y,
        r,
        { from: '#ffffff', to: mix('#c4dbf5', '#f6d0de', x / W), radial: true },
        { opacity: big ? 30 + Math.round(rnd() * 15) : 40 + Math.round(rnd() * 25) },
      );
    });
    return background(
      'background.bokeh',
      'Soft bokeh lights',
      ['pattern', 'gradient', 'soft', 'blur', 'lights', 'bokeh', 'calm', 'abstract'],
      [
        rect('Gradient', 0, 0, W, H, { from: '#b7d2f2', to: '#f6cadb', angle: 25 }),
        group('Lights', lights),
      ],
    );
  })(),
  background(
    'background.halftone',
    'Halftone dots',
    ['pattern', 'dots', 'halftone', 'comic', 'pop art', 'texture'],
    [
      rect('Base', 0, 0, W, H, '#f4f7fb'),
      group(
        'Dots',
        kept(
          range(17).flatMap((j) =>
            range(16).map((k) => {
              const [x, y] = [(j % 2 ? 44 : 0) + k * 88, j * 45];
              const r = 2 + 17 * Math.pow((x / W + y / H) / 2, 1.2);
              return r < 3 ? null : dot(`Dot ${j + 1}-${k + 1}`, x, y, r, '#d3deec');
            }),
          ),
        ),
      ),
    ],
  ),
  background(
    'background.tiles',
    'Patterned tiles',
    ['pattern', 'tiles', 'mosaic', 'floor', 'geometric', 'texture'],
    [
      rect('Base', 0, 0, W, H, '#f2f6f9'),
      group(
        'Circles',
        kept(
          range(9).flatMap((k) =>
            range(6).map((m) =>
              dot(`Circle ${k + 1}-${m + 1}`, k * 160, -40 + m * 160, 46, '#d6e4ef'),
            ),
          ),
        ),
      ),
      group(
        'Diamonds',
        kept(
          range(8).flatMap((k) =>
            range(5).map((m) => {
              const [cx, cy] = [80 + k * 160, 40 + m * 160];
              return piece(
                `Diamond ${k + 1}-${m + 1}`,
                [
                  [cx, cy - 48],
                  [cx + 48, cy],
                  [cx, cy + 48],
                  [cx - 48, cy],
                ],
                '#e2ebf3',
              );
            }),
          ),
        ),
      ),
      group(
        'Centres',
        kept(
          range(8).flatMap((k) =>
            range(5).map((m) =>
              dot(`Centre ${k + 1}-${m + 1}`, 80 + k * 160, 40 + m * 160, 10, '#c3d6e6'),
            ),
          ),
        ),
      ),
      group('Grout', [
        ...range(7).map((k) =>
          rect(`Grout column ${k + 1}`, 160 + k * 160 - 2, 0, 4, H, '#dde6ed'),
        ),
        ...range(4).map((m) => rect(`Grout row ${m + 1}`, 0, 120 + m * 160 - 2, W, 4, '#dde6ed')),
      ]),
    ],
  ),
];

export const BACKGROUNDS: readonly LibraryItem[] = [
  ...FIRST_SCENES,
  ...SCENES,
  ...PAPERS,
  ...PATTERNS,
];

// AN19: biology clip-art (the library's Biology tab) — the human body and its organs, cells and
// microbes, plants and animals, for explainer animations. Every part is named ("Left femur",
// "Nucleus", "Petal 3"), so a student can find it in the Layers and animate it on its own.
import {
  arc,
  circle,
  ellipse,
  group,
  line,
  polygon,
  rect,
  shape,
  type LibraryItem,
  type Part,
} from './build.ts';

const INK = '#2d2a32';
const OUTLINE = [INK, 3] as const;
const THIN = [INK, 2] as const;
const BONE = '#f4efe1';
const HOLE = '#4a4450';
const HEART = '#d9434e';
const ARTERY = '#e8505b';
const VEIN = '#4f7fd8';
const LUNG = '#f39aa8';
const AIRWAY = '#f8d3d3';
const AIRWAY_LINE = '#d9707f';
const BRAIN = '#f7b3c0';
const BRAIN_FOLD = '#d9748b';
const PULP = '#f07c8a';
const NEURON = '#f7b84b';
const URINE = '#f6d26b';
const WING = '#f5892b';
const FROG = '#7cc95a';
const MUSCLE = '#e05a63';
const KIDNEY: Pt[] = [
  [24, 14],
  [36, 20],
  [34, 32],
  [30, 40],
  [36, 52],
  [26, 60],
  [12, 54],
  [8, 36],
  [12, 20],
];
const ANIMAL_CELL: Pt[] = [
  [10, 42],
  [20, 12],
  [56, 5],
  [92, 12],
  [106, 40],
  [98, 74],
  [60, 86],
  [20, 78],
];

type Pt = [number, number];

const item = (
  id: string,
  name: string,
  keywords: string[],
  parts: Part[],
  width = 100,
  height = 100,
): LibraryItem => ({ id, name, category: 'biology', keywords, width, height, parts });

// ---- helpers ----

/** A smooth closed curve through the points (Catmull-Rom), `steps` points per span. */
function smooth(pts: readonly Pt[], steps = 6): Pt[] {
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    for (let s = 0; s < steps; s++) out.push(spline(p0, p1, p2, p3, s / steps));
  }
  return out;
}

/** A smooth open curve through the points. */
function smoothOpen(pts: readonly Pt[], steps = 6): Pt[] {
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p3 = pts[Math.min(n - 1, i + 2)]!;
    for (let s = 0; s < steps; s++) out.push(spline(p0, pts[i]!, pts[i + 1]!, p3, s / steps));
  }
  out.push(pts[n - 1]!);
  return out;
}

function spline(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

type Stroke = { stroke?: readonly [string, number] };

/** A smooth closed blob through the points. */
const blob = (name: string, pts: readonly Pt[], fill: string, o: Stroke = { stroke: THIN }): Part =>
  shape(name, smooth(pts), fill, o);

/** A ribbon `width` px wide along a smooth curve through the points, with rounded ends. */
function band(
  name: string,
  pts: readonly Pt[],
  width: number,
  fill: string,
  o: Stroke = { stroke: THIN },
): Part {
  const c = smoothOpen(pts, 6);
  const r = width / 2;
  const normal = (i: number): Pt => {
    const a = c[Math.max(0, i - 1)]!;
    const b = c[Math.min(c.length - 1, i + 1)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  };
  const left = c.map((p, i) => [p[0] + normal(i)[0] * r, p[1] + normal(i)[1] * r] as Pt);
  const right = c.map((p, i) => [p[0] - normal(i)[0] * r, p[1] - normal(i)[1] * r] as Pt);
  // A round end: from one side to the other, around the outside of the end.
  const cap = (p: Pt, n: Pt, turnBy: number): Pt[] => {
    const start = (Math.atan2(n[1], n[0]) * 180) / Math.PI + turnBy;
    return arc(p[0], p[1], r, r, start, start - 180, 6).slice(1, -1);
  };
  const end = c.length - 1;
  return shape(
    name,
    [...left, ...cap(c[end]!, normal(end), 0), ...right.reverse(), ...cap(c[0]!, normal(0), 180)],
    fill,
    o,
  );
}

/** A long bone from `a` to `b`: a shaft `w` px wide with rounded ends `end` px wide. */
function bone(name: string, a: Pt, b: Pt, w: number, end: number, fill = BONE): Part {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  const [ux, uy] = [dx / len, dy / len];
  const r = end / 2;
  const k = Math.min(r * 1.5, len / 3);
  const local: Pt[] = [
    [0, 0],
    [r * 0.35, r],
    [k, w / 2],
    [len / 2, w * 0.45],
    [len - k, w / 2],
    [len - r * 0.35, r],
    [len, 0],
    [len - r * 0.35, -r],
    [len - k, -w / 2],
    [len / 2, -w * 0.45],
    [k, -w / 2],
    [r * 0.35, -r],
  ];
  const pts = smooth(local, 5).map(
    ([u, v]) => [a[0] + u * ux - v * uy, a[1] + u * uy + v * ux] as Pt,
  );
  return shape(name, pts, fill, { stroke: THIN });
}

/**
 * A cartoon bone centred on (cx, cy), turned by `deg`: a shaft `len` long and `w` wide with two
 * round knobs of radius `r` at each end.
 */
function cartoonBone(cx: number, cy: number, len: number, w: number, r: number, deg: number): Pt[] {
  const h = w / 2;
  const off = r * 0.9; // each knob's centre sits this far above or below the shaft's middle
  const join = (Math.asin((off - h) / r) * 180) / Math.PI; // where a knob meets the shaft
  const notch = (Math.atan2(off, Math.sqrt(Math.max(0, r * r - off * off))) * 180) / Math.PI;
  const [x0, x1] = [cx - len / 2, cx + len / 2];
  const pts: Pt[] = [
    ...arc(x1, cy - off, r, r, 180 - join, 360 + notch, 14),
    ...arc(x1, cy + off, r, r, -notch, 180 + join, 14),
    ...arc(x0, cy + off, r, r, -join, 180 + notch, 14),
    ...arc(x0, cy - off, r, r, 180 - notch, 360 + join, 14),
  ];
  return turn(pts, cx, cy, deg);
}

/** The points turned by `deg` about (cx, cy). */
const turn = (pts: readonly Pt[], cx: number, cy: number, deg: number): Pt[] => {
  const a = (deg * Math.PI) / 180;
  return pts.map(([x, y]) => [
    cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
    cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
  ]);
};

/** A leaf (a lens shape) from `a` to `b`, `bulge` px wide on each side. */
function leaf(
  name: string,
  a: Pt,
  b: Pt,
  bulge: number,
  fill: string,
  o: Stroke = { stroke: THIN },
): Part {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  const [nx, ny] = [-dy / len, dx / len];
  const side = (sign: number): Pt[] =>
    Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      const w = sign * bulge * Math.sin(Math.PI * t);
      return [a[0] + dx * t + nx * w, a[1] + dy * t + ny * w];
    });
  return shape(name, [...side(1), ...side(-1).reverse().slice(1, -1)], fill, o);
}

/** A point `r` from (cx, cy) at `deg`° (0° is to the right, 90° down). */
const polar = (cx: number, cy: number, r: number, deg: number): Pt => [
  cx + r * Math.cos((deg * Math.PI) / 180),
  cy + r * Math.sin((deg * Math.PI) / 180),
];

/** A zigzag line from `a` to `b` with `n` teeth `h` px high (the folds inside a mitochondrion). */
function zigzag(a: Pt, b: Pt, n: number, h: number): Pt[] {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  const [nx, ny] = [-dy / len, dx / len];
  return Array.from({ length: 2 * n + 1 }, (_, i) => {
    const t = i / (2 * n);
    const w = i === 0 || i === 2 * n ? 0 : i % 2 ? h : -h;
    return [a[0] + dx * t + nx * w, a[1] + dy * t + ny * w] as Pt;
  });
}

/** A mitochondrion: a capsule from `a` to `b` with its folded inner membrane. */
const mitochondrion = (name: string, a: Pt, b: Pt, w: number): Part =>
  group(name, [
    band(`${name} outer membrane`, [a, b], w, '#f4844f'),
    line(`${name} folds (cristae)`, zigzag(a, b, 4, w * 0.28), '#b94a24', 1.5),
  ]);

// ---- the skeleton ----

/** One side of the skeleton: s = 1 is its own left (on the right of the picture). */
function arm(s: 1 | -1): Part {
  const side = s === 1 ? 'Left' : 'Right';
  const x = (d: number) => 70 + s * d;
  const finger = (label: string, base: Pt, tip: Pt) =>
    band(`${side} ${label}`, [base, tip], 2.6, BONE, { stroke: [INK, 1.5] });
  return group(`${side} arm`, [
    bone(`${side} humerus`, [x(33), 70], [x(39), 124], 6, 11),
    bone(`${side} ulna`, [x(37), 127], [x(43), 168], 3.4, 5.5),
    bone(`${side} radius`, [x(42), 128], [x(48), 167], 3.4, 5.5),
    group(`${side} hand`, [
      finger('thumb', [x(50), 176], [x(54), 188]),
      finger('index finger', [x(49), 184], [x(51), 198]),
      finger('middle finger', [x(46.5), 185], [x(47.5), 200]),
      finger('ring finger', [x(44), 184], [x(44), 198]),
      finger('little finger', [x(41.5), 183], [x(40.5), 195]),
      shape(
        `${side} palm (metacarpals)`,
        smooth([
          [x(41), 175],
          [x(49), 174],
          [x(51), 185],
          [x(40.5), 185],
        ]),
        BONE,
        { stroke: [INK, 1.5] },
      ),
      ellipse(`${side} wrist (carpals)`, Math.min(x(40), x(51)), 168, 11, 8, BONE, {
        stroke: [INK, 1.5],
      }),
    ]),
  ]);
}

function leg(s: 1 | -1): Part {
  const side = s === 1 ? 'Left' : 'Right';
  const x = (d: number) => 70 + s * d;
  const toe = (i: number) =>
    ellipse(
      `${side} toe ${i + 1}`,
      Math.min(x(9 + i * 3.6), x(12.4 + i * 3.6)),
      292 - i * 0.6,
      3.4,
      6 - i * 0.6,
      BONE,
      {
        stroke: [INK, 1.5],
      },
    );
  return group(`${side} leg`, [
    bone(`${side} femur`, [x(22), 150], [x(15), 220], 7.5, 13),
    bone(`${side} fibula`, [x(21), 228], [x(20), 280], 3.2, 5.5),
    bone(`${side} tibia`, [x(14), 225], [x(14), 282], 7, 12),
    ellipse(`${side} kneecap (patella)`, Math.min(x(11), x(19)), 214, 8, 9, BONE, { stroke: THIN }),
    group(`${side} foot`, [
      ...[4, 3, 2, 1, 0].map(toe),
      shape(
        `${side} foot bones (metatarsals)`,
        smooth([
          [x(10), 284],
          [x(20), 283],
          [x(27), 292],
          [x(9), 293],
        ]),
        BONE,
        { stroke: [INK, 1.5] },
      ),
      ellipse(`${side} ankle bones (tarsals)`, Math.min(x(9), x(21)), 280, 12, 7, BONE, {
        stroke: [INK, 1.5],
      }),
    ]),
  ]);
}

function skeleton(): Part[] {
  const ribs = [16, 22, 26, 28, 29, 28, 26];
  const rib = (i: number, s: 1 | -1): Part => {
    const y = 72 + i * 7.4;
    const w = ribs[i]!;
    const pts = arc(70, y + 11, w, 11, s === 1 ? -90 : 270, s === 1 ? 35 : 145, 8).slice(1);
    return band(`Rib ${i + 1} ${s === 1 ? 'left' : 'right'}`, [[70 + s * 4, y], ...pts], 3.6, BONE);
  };
  const vertebra = (i: number) => {
    const w = 7 + i * 0.6;
    return rect(`Vertebra ${i + 1}`, 70 - w / 2, 48 + i * 7.5, w, 6.2, BONE, {
      radius: 2,
      stroke: [INK, 1.5],
    });
  };
  return [
    group('Shoulder blades', [
      blob(
        'Left shoulder blade (scapula)',
        [
          [98, 69],
          [84, 71],
          [90, 98],
          [97, 84],
        ],
        BONE,
      ),
      blob(
        'Right shoulder blade (scapula)',
        [
          [42, 69],
          [56, 71],
          [50, 98],
          [43, 84],
        ],
        BONE,
      ),
    ]),
    group(
      'Spine',
      Array.from({ length: 12 }, (_, i) => vertebra(i)),
    ),
    group('Rib cage', [
      ...Array.from({ length: 7 }, (_, i) => rib(i, 1)),
      ...Array.from({ length: 7 }, (_, i) => rib(i, -1)),
    ]),
    shape(
      'Sternum',
      smooth([
        [66, 68],
        [74, 68],
        [73, 104],
        [70, 112],
        [67, 104],
      ]),
      BONE,
      { stroke: THIN },
    ),
    leg(1),
    leg(-1),
    group('Hips', [
      blob(
        'Pelvis',
        [
          [46, 128],
          [58, 131],
          [70, 135],
          [82, 131],
          [94, 128],
          [98, 138],
          [93, 149],
          [89, 158],
          [80, 165],
          [73, 165],
          [70, 160],
          [67, 165],
          [60, 165],
          [51, 158],
          [47, 149],
          [42, 138],
        ],
        BONE,
      ),
      shape(
        'Sacrum',
        smooth([
          [62, 134],
          [78, 134],
          [72, 150],
          [70, 153],
          [68, 150],
        ]),
        '#e8e0cc',
        { stroke: [INK, 1.5] },
      ),
      shape('Left hip hole', turn(arc(79, 157, 4.5, 3.2, 0, 360, 16).slice(1), 79, 157, 35), HOLE),
      shape(
        'Right hip hole',
        turn(arc(61, 157, 4.5, 3.2, 0, 360, 16).slice(1), 61, 157, -35),
        HOLE,
      ),
    ]),
    group('Collarbones', [
      band(
        'Left collarbone (clavicle)',
        [
          [73, 68],
          [84, 64],
          [99, 67],
        ],
        4,
        BONE,
      ),
      band(
        'Right collarbone (clavicle)',
        [
          [67, 68],
          [56, 64],
          [41, 67],
        ],
        4,
        BONE,
      ),
    ]),
    arm(1),
    arm(-1),
    group('Head', [
      blob(
        'Jaw (mandible)',
        [
          [55, 31],
          [57, 42],
          [64, 48],
          [70, 49.5],
          [76, 48],
          [83, 42],
          [85, 31],
          [78, 36],
          [62, 36],
        ],
        BONE,
      ),
      blob(
        'Skull',
        [
          [70, 3],
          [87, 8],
          [93, 21],
          [90, 31],
          [84, 36],
          [78, 38.5],
          [70, 39],
          [62, 38.5],
          [56, 36],
          [50, 31],
          [47, 21],
          [53, 8],
        ],
        BONE,
        { stroke: OUTLINE },
      ),
      blob(
        'Left eye socket',
        [
          [73, 21],
          [83, 20],
          [85, 27],
          [78, 30],
          [73, 27],
        ],
        HOLE,
        { stroke: [INK, 1] },
      ),
      blob(
        'Right eye socket',
        [
          [67, 21],
          [57, 20],
          [55, 27],
          [62, 30],
          [67, 27],
        ],
        HOLE,
        { stroke: [INK, 1] },
      ),
      shape(
        'Nose hole',
        [
          [70, 29],
          [73, 35],
          [70, 36],
          [67, 35],
        ],
        HOLE,
      ),
      group(
        'Upper teeth',
        Array.from({ length: 6 }, (_, i) =>
          rect(`Upper tooth ${i + 1}`, 61 + i * 3, 36, 3, 4.5, '#ffffff', {
            radius: 1,
            stroke: [INK, 1],
          }),
        ),
      ),
      group(
        'Lower teeth',
        Array.from({ length: 6 }, (_, i) =>
          rect(`Lower tooth ${i + 1}`, 61 + i * 3, 40.5, 3, 4, '#ffffff', {
            radius: 1,
            stroke: [INK, 1],
          }),
        ),
      ),
    ]),
  ];
}

export const BIOLOGY: readonly LibraryItem[] = [
  item(
    'biology.skeleton',
    'Human skeleton',
    ['skeleton', 'bone', 'bones', 'human body', 'anatomy', 'biology', 'science', 'skull'],
    skeleton(),
    140,
    300,
  ),
  item(
    'biology.skull',
    'Skull',
    ['skull', 'skeleton', 'bone', 'head', 'cranium', 'human body', 'anatomy', 'biology'],
    [
      blob(
        'Jaw (mandible)',
        [
          [26, 60],
          [29, 80],
          [40, 92],
          [50, 95],
          [60, 92],
          [71, 80],
          [74, 60],
          [64, 70],
          [36, 70],
        ],
        BONE,
        { stroke: OUTLINE },
      ),
      blob(
        'Cranium',
        [
          [50, 4],
          [76, 10],
          [89, 30],
          [87, 50],
          [79, 61],
          [68, 67],
          [50, 69],
          [32, 67],
          [21, 61],
          [13, 50],
          [11, 30],
          [24, 10],
        ],
        BONE,
        { stroke: OUTLINE },
      ),
      ellipse('Shine', 28, 14, 22, 10, '#ffffff', { opacity: 70 }),
      line(
        'Left cheekbone',
        smoothOpen([
          [66, 60],
          [76, 56],
          [84, 50],
        ]),
        '#c9bfa6',
        3,
      ),
      line(
        'Right cheekbone',
        smoothOpen([
          [34, 60],
          [24, 56],
          [16, 50],
        ]),
        '#c9bfa6',
        3,
      ),
      blob(
        'Left eye socket',
        [
          [55, 38],
          [72, 35],
          [77, 45],
          [67, 54],
          [56, 50],
        ],
        HOLE,
        { stroke: THIN },
      ),
      blob(
        'Right eye socket',
        [
          [45, 38],
          [28, 35],
          [23, 45],
          [33, 54],
          [44, 50],
        ],
        HOLE,
        { stroke: THIN },
      ),
      blob(
        'Nose hole',
        [
          [50, 50],
          [55, 61],
          [50, 63],
          [45, 61],
        ],
        HOLE,
        { stroke: THIN },
      ),
      group(
        'Upper teeth',
        Array.from({ length: 7 }, (_, i) =>
          rect(`Upper tooth ${i + 1}`, 33 + i * 5, 66, 5, 7, '#ffffff', {
            radius: 1.5,
            stroke: [INK, 1.5],
          }),
        ),
      ),
      group(
        'Lower teeth',
        Array.from({ length: 7 }, (_, i) =>
          rect(`Lower tooth ${i + 1}`, 33 + i * 5, 73, 5, 6, '#ffffff', {
            radius: 1.5,
            stroke: [INK, 1.5],
          }),
        ),
      ),
    ],
  ),
  item(
    'biology.bone',
    'Bone',
    ['bone', 'skeleton', 'femur', 'calcium', 'human body', 'anatomy', 'biology'],
    [
      shape('Bone', cartoonBone(50, 50, 64, 13, 11, -35), BONE, { stroke: OUTLINE }),
      line(
        'Shine',
        turn(
          [
            [36, 46],
            [62, 46],
          ],
          50,
          50,
          -35,
        ),
        '#ffffff',
        3,
      ),
    ],
  ),
  item(
    'biology.heart',
    'Heart',
    [
      'heart',
      'organ',
      'blood',
      'circulation',
      'circulatory system',
      'human body',
      'anatomy',
      'biology',
      'cardiac',
    ],
    [
      band(
        'Superior vena cava',
        [
          [34, 8],
          [34, 44],
        ],
        12,
        VEIN,
      ),
      group('Aorta', [
        band(
          'Branch 1',
          [
            [46, 22],
            [42, 8],
          ],
          6,
          ARTERY,
        ),
        band(
          'Branch 2',
          [
            [56, 16],
            [56, 7],
          ],
          6,
          ARTERY,
        ),
        band(
          'Branch 3',
          [
            [64, 18],
            [68, 8],
          ],
          6,
          ARTERY,
        ),
        band(
          'Aortic arch',
          [
            [50, 44],
            [50, 24],
            [60, 16],
            [72, 20],
            [76, 34],
          ],
          13,
          ARTERY,
        ),
      ]),
      blob(
        'Heart',
        [
          [24, 48],
          [42, 38],
          [64, 40],
          [84, 44],
          [92, 60],
          [86, 78],
          [66, 96],
          [48, 86],
          [30, 72],
          [21, 60],
        ],
        HEART,
        { stroke: OUTLINE },
      ),
      blob(
        'Right atrium',
        [
          [22, 50],
          [34, 40],
          [44, 44],
          [42, 58],
          [30, 64],
        ],
        '#c23b44',
        { stroke: THIN },
      ),
      blob(
        'Left atrium',
        [
          [78, 44],
          [90, 48],
          [92, 58],
          [82, 58],
        ],
        '#c23b44',
        { stroke: THIN },
      ),
      band(
        'Pulmonary artery',
        [
          [56, 52],
          [58, 36],
          [70, 30],
          [86, 34],
        ],
        11,
        VEIN,
      ),
      line(
        'Coronary artery',
        smoothOpen([
          [52, 56],
          [58, 70],
          [62, 88],
        ]),
        '#ffd2d2',
        3,
      ),
      line(
        'Coronary branch',
        smoothOpen([
          [58, 70],
          [72, 74],
          [82, 70],
        ]),
        '#ffd2d2',
        2,
      ),
    ],
  ),
  item(
    'biology.lungs',
    'Lungs',
    [
      'lungs',
      'lung',
      'organ',
      'breathing',
      'respiration',
      'respiratory system',
      'gas exchange',
      'human body',
      'anatomy',
      'biology',
    ],
    [
      blob(
        'Right lung',
        [
          [44, 16],
          [54, 30],
          [54, 86],
          [40, 96],
          [12, 96],
          [8, 72],
          [16, 40],
        ],
        LUNG,
        { stroke: OUTLINE },
      ),
      blob(
        'Left lung',
        [
          [76, 16],
          [66, 30],
          [66, 64],
          [78, 76],
          [80, 96],
          [108, 96],
          [112, 72],
          [104, 40],
        ],
        LUNG,
        { stroke: OUTLINE },
      ),
      group('Airways', [
        line(
          'Right bronchiole 1',
          smoothOpen([
            [46, 52],
            [34, 50],
            [26, 42],
          ]),
          AIRWAY_LINE,
          2.5,
        ),
        line(
          'Right bronchiole 2',
          smoothOpen([
            [46, 54],
            [36, 66],
            [26, 74],
          ]),
          AIRWAY_LINE,
          2.5,
        ),
        line(
          'Right bronchiole 3',
          smoothOpen([
            [40, 60],
            [36, 76],
            [38, 88],
          ]),
          AIRWAY_LINE,
          2.5,
        ),
        line(
          'Left bronchiole 1',
          smoothOpen([
            [74, 52],
            [86, 50],
            [94, 42],
          ]),
          AIRWAY_LINE,
          2.5,
        ),
        line(
          'Left bronchiole 2',
          smoothOpen([
            [74, 54],
            [84, 66],
            [94, 74],
          ]),
          AIRWAY_LINE,
          2.5,
        ),
        line(
          'Left bronchiole 3',
          smoothOpen([
            [80, 60],
            [88, 76],
            [96, 88],
          ]),
          AIRWAY_LINE,
          2.5,
        ),
        band(
          'Right bronchus',
          [
            [60, 40],
            [50, 46],
            [44, 54],
          ],
          7,
          AIRWAY,
        ),
        band(
          'Left bronchus',
          [
            [60, 40],
            [70, 46],
            [76, 54],
          ],
          7,
          AIRWAY,
        ),
        band(
          'Trachea (windpipe)',
          [
            [60, 8],
            [60, 42],
          ],
          11,
          AIRWAY,
        ),
        ...[14, 20, 26, 32].map((y, i) =>
          line(
            `Trachea ring ${i + 1}`,
            [
              [55.5, y],
              [64.5, y],
            ],
            '#d99a9a',
            2,
          ),
        ),
      ]),
    ],
    120,
    100,
  ),
  item(
    'biology.brain',
    'Brain',
    [
      'brain',
      'organ',
      'nervous system',
      'mind',
      'think',
      'neuroscience',
      'human body',
      'anatomy',
      'biology',
    ],
    [
      band(
        'Brain stem',
        [
          [64, 62],
          [62, 83],
        ],
        11,
        '#e7a0ae',
      ),
      blob(
        'Cerebellum',
        [
          [68, 62],
          [90, 58],
          [102, 66],
          [94, 78],
          [76, 79],
          [66, 71],
        ],
        '#e98ba0',
        { stroke: THIN },
      ),
      ...[66, 71, 75].map((y, i) =>
        line(
          `Cerebellum fold ${i + 1}`,
          smoothOpen([
            [72, y],
            [86, y - 3],
            [97, y - 1],
          ]),
          '#c9667e',
          2,
        ),
      ),
      blob(
        'Cerebrum',
        [
          [8, 44],
          [14, 22],
          [34, 8],
          [60, 6],
          [86, 12],
          [102, 30],
          [102, 50],
          [92, 60],
          [70, 62],
          [50, 66],
          [28, 64],
          [12, 58],
        ],
        BRAIN,
        { stroke: OUTLINE },
      ),
      line(
        'Lateral fissure',
        smoothOpen([
          [28, 54],
          [44, 46],
          [62, 44],
        ]),
        BRAIN_FOLD,
        3,
      ),
      line(
        'Central fissure',
        smoothOpen([
          [56, 8],
          [54, 22],
          [58, 34],
        ]),
        BRAIN_FOLD,
        3,
      ),
      line(
        'Fold 1',
        smoothOpen([
          [16, 34],
          [26, 28],
          [24, 18],
        ]),
        BRAIN_FOLD,
        2.5,
      ),
      line(
        'Fold 2',
        smoothOpen([
          [22, 44],
          [34, 38],
          [36, 22],
          [44, 14],
        ]),
        BRAIN_FOLD,
        2.5,
      ),
      line(
        'Fold 3',
        smoothOpen([
          [40, 30],
          [48, 36],
          [46, 22],
        ]),
        BRAIN_FOLD,
        2.5,
      ),
      line(
        'Fold 4',
        smoothOpen([
          [64, 22],
          [74, 26],
          [76, 14],
        ]),
        BRAIN_FOLD,
        2.5,
      ),
      line(
        'Fold 5',
        smoothOpen([
          [68, 40],
          [80, 34],
          [92, 38],
          [96, 26],
        ]),
        BRAIN_FOLD,
        2.5,
      ),
      line(
        'Fold 6',
        smoothOpen([
          [34, 58],
          [48, 54],
          [62, 56],
          [80, 52],
        ]),
        BRAIN_FOLD,
        2.5,
      ),
    ],
    110,
    90,
  ),
  item(
    'biology.eye',
    'Eye',
    [
      'eye',
      'organ',
      'sight',
      'vision',
      'see',
      'lens',
      'retina',
      'sense',
      'human body',
      'anatomy',
      'biology',
    ],
    [
      band(
        'Optic nerve',
        [
          [88, 54],
          [103, 59],
        ],
        12,
        '#f2cf6b',
      ),
      circle('Sclera', 58, 50, 40, '#ffffff', { stroke: OUTLINE }),
      circle('Retina', 58, 50, 35, '#f08c7e'),
      circle('Vitreous humour', 59, 50, 31, '#eef7ff'),
      shape('Blind spot', turn(arc(92, 52, 3, 6, 0, 360, 16).slice(1), 92, 52, 15), '#f2cf6b'),
      shape('Cornea', [...arc(24, 50, 13, 22, 90, 270, 16)], '#cfe8ff', {
        stroke: THIN,
        opacity: 90,
      }),
      rect('Iris top', 24, 28, 6, 15, '#3f86d6', { radius: 2, stroke: [INK, 1.5] }),
      rect('Iris bottom', 24, 57, 6, 15, '#3f86d6', { radius: 2, stroke: [INK, 1.5] }),
      ellipse('Lens', 29, 38, 12, 24, '#bfe0ff', { stroke: THIN }),
      line(
        'Ciliary muscle top',
        [
          [36, 26],
          [34, 39],
        ],
        '#c9667e',
        3,
      ),
      line(
        'Ciliary muscle bottom',
        [
          [36, 74],
          [34, 61],
        ],
        '#c9667e',
        3,
      ),
    ],
    110,
    100,
  ),
  item(
    'biology.tooth',
    'Tooth',
    ['tooth', 'teeth', 'molar', 'dentist', 'enamel', 'mouth', 'human body', 'anatomy', 'biology'],
    [
      rect('Jaw bone', 2, 64, 76, 34, '#efe3c6', { radius: 6, stroke: THIN }),
      blob(
        'Gum',
        [
          [4, 50],
          [16, 44],
          [40, 52],
          [64, 44],
          [76, 50],
          [76, 68],
          [40, 70],
          [4, 68],
        ],
        '#f29bb0',
      ),
      blob(
        'Enamel',
        [
          [12, 44],
          [10, 22],
          [16, 8],
          [28, 5],
          [40, 11],
          [52, 5],
          [64, 8],
          [70, 22],
          [68, 44],
          [64, 60],
          [62, 84],
          [56, 96],
          [50, 92],
          [46, 66],
          [40, 61],
          [34, 66],
          [30, 92],
          [24, 96],
          [18, 84],
          [16, 60],
        ],
        '#ffffff',
        { stroke: OUTLINE },
      ),
      blob(
        'Dentine',
        [
          [16, 42],
          [15, 24],
          [20, 14],
          [28, 12],
          [40, 18],
          [52, 12],
          [60, 14],
          [65, 24],
          [64, 42],
          [60, 58],
          [58, 82],
          [55, 89],
          [51, 64],
          [40, 56],
          [29, 64],
          [25, 89],
          [22, 82],
          [20, 58],
        ],
        '#fbefcf',
        { stroke: [INK, 1] },
      ),
      band(
        'Root canal 1',
        [
          [31, 44],
          [27, 66],
          [25, 84],
        ],
        4,
        PULP,
        { stroke: [INK, 1] },
      ),
      band(
        'Root canal 2',
        [
          [49, 44],
          [53, 66],
          [55, 84],
        ],
        4,
        PULP,
        { stroke: [INK, 1] },
      ),
      blob(
        'Pulp',
        [
          [26, 30],
          [33, 24],
          [40, 29],
          [47, 24],
          [54, 30],
          [52, 46],
          [40, 50],
          [28, 46],
        ],
        PULP,
        { stroke: [INK, 1] },
      ),
    ],
    80,
    100,
  ),
  item(
    'biology.animalcell',
    'Animal cell',
    [
      'animal cell',
      'cell',
      'cells',
      'nucleus',
      'mitochondria',
      'organelle',
      'cytoplasm',
      'biology',
      'science',
    ],
    [
      blob('Cytoplasm', ANIMAL_CELL, '#ffe7c2', { stroke: [INK, 0] }),
      group(
        'Endoplasmic reticulum',
        [0, 1, 2].map((i) =>
          line(
            `Endoplasmic reticulum ${i + 1}`,
            arc(50, 44, 22 + i * 4.5, 19 + i * 4.5, 120, 230, 10),
            '#7fb0e6',
            2.5,
          ),
        ),
      ),
      circle('Nucleus', 52, 44, 17, '#b691ea', { stroke: THIN }),
      circle('Nucleolus', 55, 41, 6, '#7848c0'),
      mitochondrion('Mitochondrion 1', [76, 22], [94, 32], 10),
      mitochondrion('Mitochondrion 2', [30, 70], [50, 74], 10),
      group(
        'Golgi body',
        [0, 1, 2].map((i) =>
          band(
            `Golgi layer ${i + 1}`,
            arc(84, 74 - i * 5, 14 - i * 2, 6, 200, 340, 8),
            3.5,
            '#f2c14e',
            {
              stroke: [INK, 1],
            },
          ),
        ),
      ),
      circle('Vesicle 1', 72, 82, 2.5, '#f2c14e', { stroke: [INK, 1] }),
      circle('Vesicle 2', 97, 60, 2.5, '#f2c14e', { stroke: [INK, 1] }),
      group(
        'Ribosomes',
        (
          [
            [24, 30],
            [30, 22],
            [20, 46],
            [38, 82],
            [62, 72],
            [74, 54],
            [86, 46],
            [66, 16],
            [44, 14],
            [96, 46],
            [16, 60],
            [56, 82],
          ] as Pt[]
        ).map(([x, y], i) => circle(`Ribosome ${i + 1}`, x, y, 1.7, '#5a3f8f')),
      ),
      shape('Cell membrane', smooth(ANIMAL_CELL), null, { stroke: ['#c26a2e', 3] }),
    ],
    110,
    90,
  ),
  item(
    'biology.plantcell',
    'Plant cell',
    [
      'plant cell',
      'cell',
      'cells',
      'plant',
      'chloroplast',
      'cell wall',
      'vacuole',
      'organelle',
      'photosynthesis',
      'biology',
      'science',
    ],
    [
      rect('Cell wall', 3, 3, 104, 84, '#8fcf5e', { radius: 8, stroke: OUTLINE }),
      rect('Cell membrane', 10, 10, 90, 70, '#eaf8d6', { radius: 5, stroke: ['#4f9a36', 2] }),
      blob(
        'Vacuole',
        [
          [26, 24],
          [56, 20],
          [76, 28],
          [80, 52],
          [66, 66],
          [36, 66],
          [22, 50],
        ],
        '#cfe7ff',
        { stroke: THIN },
      ),
      circle('Nucleus', 88, 66, 8, '#b691ea', { stroke: THIN }),
      circle('Nucleolus', 89, 65, 3, '#7848c0'),
      mitochondrion('Mitochondrion', [80, 16], [94, 20], 7),
      ...(
        [
          [18, 16, -20],
          [16, 64, 70],
          [42, 74, 0],
          [64, 75, 10],
          [92, 38, 80],
          [50, 13, 5],
        ] as [number, number, number][]
      ).map(([x, y, deg], i) =>
        group(`Chloroplast ${i + 1}`, [
          shape(
            `Chloroplast ${i + 1} body`,
            turn(arc(x, y, 7, 4, 0, 360, 20).slice(1), x, y, deg),
            '#3fa34d',
            {
              stroke: ['#1f6a2b', 1.5],
            },
          ),
          line(
            `Chloroplast ${i + 1} grana`,
            turn(
              [
                [x - 4, y],
                [x + 4, y],
              ],
              x,
              y,
              deg,
            ),
            '#bfe8a6',
            1.5,
          ),
        ]),
      ),
    ],
    110,
    90,
  ),
  item(
    'biology.bacterium',
    'Bacterium',
    [
      'bacterium',
      'bacteria',
      'microbe',
      'microorganism',
      'germ',
      'prokaryote',
      'cell',
      'disease',
      'biology',
      'science',
    ],
    [
      line(
        'Flagellum',
        smoothOpen([
          [96, 36],
          [104, 28],
          [112, 40],
          [120, 30],
          [127, 38],
        ]),
        INK,
        2.5,
      ),
      ...(
        [
          [24, 16, 18, 6],
          [48, 14, 48, 4],
          [72, 16, 78, 6],
          [24, 56, 18, 66],
          [48, 58, 48, 68],
          [72, 56, 78, 66],
        ] as [number, number, number, number][]
      ).map(([x1, y1, x2, y2], i) =>
        line(
          `Pilus ${i + 1}`,
          [
            [x1, y1],
            [x2, y2],
          ],
          INK,
          2,
        ),
      ),
      band(
        'Capsule (slime layer)',
        [
          [26, 36],
          [76, 36],
        ],
        44,
        '#e4f5d8',
        { stroke: THIN },
      ),
      band(
        'Cell wall',
        [
          [26, 36],
          [76, 36],
        ],
        36,
        '#78c556',
        { stroke: THIN },
      ),
      band(
        'Cell membrane',
        [
          [26, 36],
          [76, 36],
        ],
        29,
        '#d6f3b9',
        { stroke: ['#4f9a36', 1.5] },
      ),
      shape(
        'DNA (nucleoid)',
        smooth([
          [36, 30],
          [46, 42],
          [56, 28],
          [66, 40],
          [60, 44],
          [50, 32],
          [42, 44],
          [32, 38],
        ]),
        null,
        { stroke: ['#7848c0', 2.5] },
      ),
      circle('Plasmid 1', 22, 32, 4, null, { stroke: ['#d9434e', 2] }),
      circle('Plasmid 2', 78, 42, 3.5, null, { stroke: ['#d9434e', 2] }),
      group(
        'Ribosomes',
        (
          [
            [26, 44],
            [34, 26],
            [70, 28],
            [82, 32],
            [58, 46],
            [18, 38],
          ] as Pt[]
        ).map(([x, y], i) => circle(`Ribosome ${i + 1}`, x, y, 1.6, '#3d6b2a')),
      ),
    ],
    130,
    72,
  ),
  item(
    'biology.virus',
    'Virus',
    [
      'virus',
      'microbe',
      'germ',
      'coronavirus',
      'flu',
      'infection',
      'disease',
      'pathogen',
      'biology',
      'science',
    ],
    [
      group(
        'Spikes',
        Array.from({ length: 12 }, (_, i) => {
          const deg = i * 30 + 15;
          return group(`Spike ${i + 1}`, [
            line(
              `Spike ${i + 1} stalk`,
              [polar(50, 50, 28, deg), polar(50, 50, 40, deg)],
              '#c23b44',
              3,
            ),
            circle(`Spike ${i + 1} head`, ...polar(50, 50, 42, deg), 5, '#e8505b', {
              stroke: THIN,
            }),
          ]);
        }),
      ),
      circle('Envelope', 50, 50, 31, '#f6a35c', { stroke: OUTLINE }),
      circle('Capsid', 50, 50, 21, '#fbd08a', { stroke: [INK, 1.5] }),
      line(
        'Genetic material (RNA)',
        smoothOpen([
          [36, 52],
          [40, 42],
          [46, 54],
          [52, 42],
          [58, 56],
          [64, 46],
        ]),
        '#7848c0',
        3,
      ),
    ],
  ),
  item(
    'biology.phage',
    'Bacteriophage',
    ['bacteriophage', 'phage', 'virus', 'microbe', 'bacteria', 'infection', 'biology', 'science'],
    [
      group(
        'Tail fibres',
        [-1, 1].flatMap((s) =>
          [0, 1, 2].map((i) =>
            line(
              `Tail fibre ${s < 0 ? 'left' : 'right'} ${i + 1}`,
              [
                [40 + s * 6, 78],
                [40 + s * (16 + i * 6), 84 + i * 2],
                [40 + s * (14 + i * 8), 98],
              ],
              INK,
              2.5,
            ),
          ),
        ),
      ),
      polygon('Head (capsid)', 18, 2, 44, 42, 6, '#a184ea', { stroke: OUTLINE }),
      line(
        'DNA',
        smoothOpen([
          [30, 18],
          [38, 12],
          [44, 22],
          [50, 16],
          [46, 30],
          [36, 26],
          [32, 34],
        ]),
        '#ffffff',
        2.5,
      ),
      rect('Collar', 30, 43, 20, 5, '#7b8ba3', { radius: 2, stroke: THIN }),
      rect('Tail sheath', 34, 48, 12, 26, '#a9b6c8', { radius: 2, stroke: THIN }),
      ...[54, 60, 66].map((y, i) =>
        line(
          `Sheath ring ${i + 1}`,
          [
            [34, y],
            [46, y],
          ],
          '#7b8ba3',
          2,
        ),
      ),
      rect('Base plate', 27, 74, 26, 6, '#7b8ba3', { radius: 2, stroke: THIN }),
    ],
    80,
    100,
  ),
  item(
    'biology.neuron',
    'Neuron',
    [
      'neuron',
      'nerve cell',
      'cell',
      'nervous system',
      'axon',
      'brain',
      'impulse',
      'synapse',
      'biology',
      'science',
    ],
    [
      group('Dendrites', [
        band(
          'Dendrite 1',
          [
            [30, 34],
            [18, 22],
            [8, 20],
          ],
          3.5,
          NEURON,
        ),
        band(
          'Dendrite 2',
          [
            [18, 22],
            [16, 8],
          ],
          2.5,
          NEURON,
        ),
        band(
          'Dendrite 3',
          [
            [28, 44],
            [14, 50],
            [4, 46],
          ],
          3.5,
          NEURON,
        ),
        band(
          'Dendrite 4',
          [
            [14, 50],
            [10, 62],
          ],
          2.5,
          NEURON,
        ),
        band(
          'Dendrite 5',
          [
            [34, 30],
            [36, 14],
            [30, 4],
          ],
          3.5,
          NEURON,
        ),
        band(
          'Dendrite 6',
          [
            [34, 52],
            [34, 66],
            [26, 76],
          ],
          3.5,
          NEURON,
        ),
        band(
          'Dendrite 7',
          [
            [34, 66],
            [44, 74],
          ],
          2.5,
          NEURON,
        ),
      ]),
      band(
        'Axon',
        [
          [44, 40],
          [140, 40],
        ],
        4,
        NEURON,
      ),
      blob(
        'Cell body',
        [
          [36, 26],
          [46, 32],
          [50, 40],
          [44, 50],
          [34, 54],
          [26, 46],
          [26, 34],
        ],
        NEURON,
      ),
      circle('Nucleus', 37, 40, 6, '#8a5cd6', { stroke: THIN }),
      group(
        'Myelin sheath',
        [0, 1, 2, 3].map((i) =>
          rect(`Myelin sheath ${i + 1}`, 58 + i * 20, 34, 16, 12, '#fff1b0', {
            radius: 6,
            stroke: THIN,
          }),
        ),
      ),
      group('Axon terminals', [
        band(
          'Terminal branch 1',
          [
            [138, 40],
            [148, 28],
            [152, 24],
          ],
          2.5,
          NEURON,
        ),
        band(
          'Terminal branch 2',
          [
            [138, 40],
            [152, 40],
          ],
          2.5,
          NEURON,
        ),
        band(
          'Terminal branch 3',
          [
            [138, 40],
            [148, 52],
            [152, 56],
          ],
          2.5,
          NEURON,
        ),
        circle('Terminal 1', 153, 23, 3.5, NEURON, { stroke: THIN }),
        circle('Terminal 2', 154, 40, 3.5, NEURON, { stroke: THIN }),
        circle('Terminal 3', 153, 57, 3.5, NEURON, { stroke: THIN }),
      ]),
    ],
    160,
    80,
  ),
  item(
    'biology.flower',
    'Flower',
    ['flower', 'plant', 'petal', 'pollination', 'bloom', 'nature', 'biology', 'science'],
    [
      band(
        'Stem',
        [
          [50, 50],
          [52, 80],
          [50, 106],
        ],
        6,
        '#3c9a40',
      ),
      leaf('Left leaf', [51, 92], [20, 74], 9, '#5cbf60'),
      leaf('Right leaf', [51, 84], [82, 68], 9, '#5cbf60'),
      ...Array.from({ length: 6 }, (_, i) =>
        leaf(`Petal ${i + 1}`, [50, 36], polar(50, 36, 34, i * 60 - 90), 12, '#f27fb2'),
      ),
      circle('Flower centre', 50, 36, 11, '#ffc83d', { stroke: THIN }),
      ...Array.from({ length: 5 }, (_, i) =>
        circle(`Pollen ${i + 1}`, ...polar(50, 36, 6, i * 72 - 90), 1.8, '#e08a00'),
      ),
    ],
    100,
    110,
  ),
  item(
    'biology.digestive',
    'Digestive system',
    [
      'digestive system',
      'digestion',
      'organ',
      'stomach',
      'intestine',
      'liver',
      'gut',
      'human body',
      'anatomy',
      'biology',
    ],
    [
      blob(
        'Body outline',
        [
          [40, 2],
          [60, 2],
          [62, 12],
          [86, 20],
          [94, 44],
          [92, 84],
          [90, 116],
          [70, 128],
          [30, 128],
          [10, 116],
          [8, 84],
          [6, 44],
          [14, 20],
          [38, 12],
        ],
        '#fde3cf',
      ),
      band(
        'Large intestine',
        [
          [30, 108],
          [22, 96],
          [22, 76],
          [36, 72],
          [64, 72],
          [78, 76],
          [78, 100],
          [68, 112],
          [54, 114],
          [52, 124],
        ],
        10,
        '#d98c5f',
      ),
      band(
        'Appendix',
        [
          [24, 104],
          [26, 114],
        ],
        3.5,
        '#d98c5f',
      ),
      band(
        'Small intestine',
        [
          [58, 80],
          [36, 82],
          [36, 88],
          [66, 88],
          [66, 94],
          [34, 94],
          [34, 100],
          [64, 100],
          [62, 106],
          [40, 108],
          [32, 104],
        ],
        5,
        '#f6b6a2',
      ),
      band(
        'Oesophagus',
        [
          [50, 4],
          [50, 28],
          [56, 42],
        ],
        6,
        '#f2a0a0',
      ),
      band(
        'Pancreas',
        [
          [46, 66],
          [62, 64],
          [76, 60],
        ],
        6,
        '#f6c26b',
      ),
      blob(
        'Stomach',
        [
          [54, 40],
          [66, 36],
          [80, 42],
          [82, 56],
          [72, 66],
          [56, 68],
          [48, 62],
          [58, 58],
          [66, 52],
          [60, 46],
        ],
        '#f08a8a',
      ),
      blob(
        'Liver',
        [
          [14, 40],
          [34, 34],
          [56, 38],
          [52, 48],
          [36, 56],
          [20, 60],
          [12, 52],
        ],
        '#b5523b',
      ),
      ellipse('Gall bladder', 31, 54, 8, 7, '#7ab648', { stroke: THIN }),
    ],
    100,
    130,
  ),
  item(
    'biology.kidneys',
    'Kidneys',
    [
      'kidneys',
      'kidney',
      'organ',
      'urinary system',
      'excretion',
      'bladder',
      'urine',
      'human body',
      'anatomy',
      'biology',
    ],
    [
      band(
        'Aorta',
        [
          [45, 4],
          [45, 72],
        ],
        7,
        ARTERY,
      ),
      band(
        'Vena cava',
        [
          [55, 4],
          [55, 72],
        ],
        7,
        VEIN,
      ),
      band(
        'Right renal artery',
        [
          [45, 36],
          [30, 36],
        ],
        4,
        ARTERY,
      ),
      band(
        'Right renal vein',
        [
          [55, 41],
          [30, 42],
        ],
        4,
        VEIN,
      ),
      band(
        'Left renal artery',
        [
          [45, 33],
          [70, 34],
        ],
        4,
        ARTERY,
      ),
      band(
        'Left renal vein',
        [
          [55, 38],
          [70, 39],
        ],
        4,
        VEIN,
      ),
      band(
        'Right ureter',
        [
          [28, 48],
          [34, 66],
          [44, 80],
        ],
        3.5,
        URINE,
      ),
      band(
        'Left ureter',
        [
          [72, 46],
          [66, 66],
          [56, 80],
        ],
        3.5,
        URINE,
      ),
      blob(
        'Right kidney',
        KIDNEY.map(([x, y]) => [x, y] as Pt),
        '#c0504a',
        { stroke: OUTLINE },
      ),
      blob(
        'Left kidney',
        KIDNEY.map(([x, y]) => [100 - x, y - 2] as Pt),
        '#c0504a',
        { stroke: OUTLINE },
      ),
      blob(
        'Bladder',
        [
          [38, 78],
          [62, 78],
          [66, 88],
          [56, 94],
          [44, 94],
          [34, 88],
        ],
        URINE,
      ),
      band(
        'Urethra',
        [
          [50, 93],
          [50, 98],
        ],
        4,
        URINE,
      ),
    ],
  ),
  item(
    'biology.bloodcells',
    'Blood cells',
    [
      'blood cells',
      'blood',
      'red blood cell',
      'white blood cell',
      'platelet',
      'cell',
      'circulation',
      'immune system',
      'biology',
      'science',
    ],
    [
      group('Red blood cell 1', [
        circle('Red blood cell 1 rim', 24, 24, 18, '#e0393e', { stroke: THIN }),
        circle('Red blood cell 1 dip', 24, 24, 8, '#f26b6e'),
      ]),
      group('Red blood cell 2', [
        circle('Red blood cell 2 rim', 26, 66, 16, '#e0393e', { stroke: THIN }),
        circle('Red blood cell 2 dip', 26, 66, 7, '#f26b6e'),
      ]),
      blob(
        'Red blood cell 3 (side view)',
        [
          [70, 6],
          [80, 4],
          [98, 4],
          [108, 9],
          [98, 14],
          [89, 12],
          [80, 14],
          [70, 12],
        ],
        '#e0393e',
      ),
      group('White blood cell', [
        circle('White blood cell', 78, 52, 24, '#eef0ff', { stroke: OUTLINE }),
        blob(
          'Lobed nucleus',
          [
            [66, 44],
            [74, 40],
            [80, 46],
            [88, 42],
            [94, 50],
            [88, 58],
            [80, 56],
            [76, 64],
            [66, 62],
            [70, 54],
          ],
          '#8a5cd6',
        ),
      ]),
      group(
        'Platelets',
        (
          [
            [52, 24],
            [52, 84],
            [104, 84],
          ] as Pt[]
        ).map(([x, y], i) =>
          blob(
            `Platelet ${i + 1}`,
            [
              [x - 4, y - 1],
              [x, y - 3],
              [x + 4, y - 1],
              [x + 2, y + 3],
              [x - 3, y + 2],
            ],
            '#f6c26b',
            { stroke: [INK, 1] },
          ),
        ),
      ),
    ],
    110,
    90,
  ),
  item(
    'biology.leaf',
    'Leaf',
    ['leaf', 'plant', 'photosynthesis', 'chlorophyll', 'veins', 'nature', 'biology', 'science'],
    [
      band(
        'Leaf stalk',
        [
          [22, 78],
          [8, 94],
        ],
        5,
        '#3c9a40',
      ),
      leaf('Leaf blade', [20, 80], [92, 8], 30, '#5cbf60', { stroke: OUTLINE }),
      line(
        'Midrib',
        [
          [20, 80],
          [88, 12],
        ],
        '#2f7d34',
        3,
      ),
      ...[0.25, 0.42, 0.59, 0.76].flatMap((t, i) => {
        const [x, y] = [20 + 68 * t, 80 - 68 * t];
        const len = 20 * Math.sin(Math.PI * (t + 0.08));
        return [
          line(
            `Vein ${2 * i + 1}`,
            [
              [x, y],
              [x + len * 0.15, y - len],
            ],
            '#3a8f3f',
            2,
          ),
          line(
            `Vein ${2 * i + 2}`,
            [
              [x, y],
              [x + len, y - len * 0.15],
            ],
            '#3a8f3f',
            2,
          ),
        ];
      }),
    ],
  ),
  item(
    'biology.mushroom',
    'Mushroom',
    [
      'mushroom',
      'fungus',
      'fungi',
      'toadstool',
      'spores',
      'decomposer',
      'nature',
      'biology',
      'science',
    ],
    [
      group(
        'Mycelium',
        [
          [
            [44, 88],
            [32, 94],
            [18, 92],
          ],
          [
            [50, 90],
            [48, 98],
          ],
          [
            [56, 88],
            [70, 96],
            [84, 94],
          ],
          [
            [38, 92],
            [30, 99],
          ],
          [
            [64, 92],
            [74, 99],
          ],
        ].map((pts, i) => line(`Hypha ${i + 1}`, smoothOpen(pts as Pt[]), '#c7b08a', 2)),
      ),
      blob(
        'Stalk',
        [
          [42, 54],
          [58, 54],
          [60, 76],
          [62, 90],
          [50, 92],
          [38, 90],
          [40, 76],
        ],
        '#f6efe0',
      ),
      band(
        'Ring',
        [
          [40, 64],
          [50, 67],
          [60, 64],
        ],
        4,
        '#e8dcc2',
        { stroke: [INK, 1.5] },
      ),
      ellipse('Gills', 14, 46, 72, 14, '#e8d2b0', { stroke: THIN }),
      shape('Cap', [...arc(50, 52, 42, 46, 180, 360, 24), [92, 52], [8, 52]], '#e84545', {
        stroke: OUTLINE,
      }),
      ...[20, 30, 40, 60, 70, 80].map((x, i) =>
        line(
          `Gill line ${i + 1}`,
          [
            [x, 53.5],
            [50 + (x - 50) * 0.55, 58.5],
          ],
          '#b99a70',
          1.5,
        ),
      ),
      circle('Spot 1', 32, 26, 6, '#ffffff'),
      circle('Spot 2', 56, 16, 5, '#ffffff'),
      circle('Spot 3', 72, 34, 6, '#ffffff'),
      circle('Spot 4', 20, 44, 3.5, '#ffffff'),
      circle('Spot 5', 48, 38, 4, '#ffffff'),
      circle('Spot 6', 84, 46, 3, '#ffffff'),
    ],
  ),
  item(
    'biology.butterfly',
    'Butterfly',
    [
      'butterfly',
      'insect',
      'animal',
      'life cycle',
      'metamorphosis',
      'invertebrate',
      'nature',
      'biology',
    ],
    [
      line(
        'Left antenna',
        smoothOpen([
          [52, 22],
          [46, 10],
          [38, 4],
        ]),
        INK,
        2,
      ),
      line(
        'Right antenna',
        smoothOpen([
          [58, 22],
          [64, 10],
          [72, 4],
        ]),
        INK,
        2,
      ),
      circle('Left antenna tip', 38, 5, 2.5, INK),
      circle('Right antenna tip', 72, 5, 2.5, INK),
      blob(
        'Left upper wing',
        [
          [52, 30],
          [36, 14],
          [12, 10],
          [4, 24],
          [12, 46],
          [50, 48],
        ],
        WING,
        { stroke: OUTLINE },
      ),
      blob(
        'Right upper wing',
        [
          [58, 30],
          [74, 14],
          [98, 10],
          [106, 24],
          [98, 46],
          [60, 48],
        ],
        WING,
        { stroke: OUTLINE },
      ),
      blob(
        'Left lower wing',
        [
          [52, 46],
          [24, 50],
          [16, 70],
          [28, 84],
          [46, 76],
          [53, 58],
        ],
        '#f7b84b',
        { stroke: OUTLINE },
      ),
      blob(
        'Right lower wing',
        [
          [58, 46],
          [86, 50],
          [94, 70],
          [82, 84],
          [64, 76],
          [57, 58],
        ],
        '#f7b84b',
        { stroke: OUTLINE },
      ),
      circle('Left wing spot 1', 18, 24, 5, INK),
      circle('Right wing spot 1', 92, 24, 5, INK),
      circle('Left wing spot 2', 30, 66, 4, '#ffffff', { stroke: THIN }),
      circle('Right wing spot 2', 80, 66, 4, '#ffffff', { stroke: THIN }),
      rect('Body', 51, 22, 8, 56, '#4a3b2a', { radius: 4, stroke: THIN }),
      circle('Head', 55, 21, 5, '#4a3b2a', { stroke: THIN }),
    ],
    110,
    90,
  ),
  item(
    'biology.frog',
    'Frog',
    ['frog', 'amphibian', 'animal', 'life cycle', 'pond', 'vertebrate', 'nature', 'biology'],
    [
      blob(
        'Left back leg',
        [
          [18, 54],
          [6, 70],
          [10, 84],
          [32, 86],
          [36, 70],
        ],
        FROG,
        { stroke: OUTLINE },
      ),
      blob(
        'Right back leg',
        [
          [92, 54],
          [104, 70],
          [100, 84],
          [78, 86],
          [74, 70],
        ],
        FROG,
        { stroke: OUTLINE },
      ),
      blob(
        'Body',
        [
          [55, 20],
          [86, 30],
          [92, 60],
          [80, 84],
          [55, 88],
          [30, 84],
          [18, 60],
          [24, 30],
        ],
        FROG,
        {
          stroke: OUTLINE,
        },
      ),
      blob(
        'Belly',
        [
          [55, 50],
          [72, 56],
          [74, 76],
          [55, 84],
          [36, 76],
          [38, 56],
        ],
        '#c8eb9a',
        { stroke: [INK, 0] },
      ),
      blob(
        'Left front foot',
        [
          [36, 78],
          [46, 80],
          [48, 88],
          [32, 88],
        ],
        FROG,
        { stroke: THIN },
      ),
      blob(
        'Right front foot',
        [
          [74, 78],
          [64, 80],
          [62, 88],
          [78, 88],
        ],
        FROG,
        { stroke: THIN },
      ),
      circle('Left eye', 36, 22, 12, FROG, { stroke: OUTLINE }),
      circle('Right eye', 74, 22, 12, FROG, { stroke: OUTLINE }),
      circle('Left eyeball', 36, 21, 8, '#ffffff'),
      circle('Right eyeball', 74, 21, 8, '#ffffff'),
      circle('Left pupil', 37, 21, 4, INK),
      circle('Right pupil', 73, 21, 4, INK),
      line(
        'Mouth',
        smoothOpen([
          [36, 40],
          [55, 48],
          [74, 40],
        ]),
        INK,
        2.5,
      ),
      circle('Left cheek', 30, 44, 3.5, '#f29bb0'),
      circle('Right cheek', 80, 44, 3.5, '#f29bb0'),
    ],
    110,
    92,
  ),
  item(
    'biology.fish',
    'Fish',
    ['fish', 'animal', 'gills', 'vertebrate', 'water', 'ocean', 'sea', 'nature', 'biology'],
    [
      blob(
        'Tail fin',
        [
          [88, 40],
          [114, 14],
          [118, 40],
          [114, 66],
        ],
        '#f59a2b',
        { stroke: OUTLINE },
      ),
      blob(
        'Top fin',
        [
          [40, 22],
          [56, 6],
          [72, 10],
          [76, 26],
        ],
        '#f59a2b',
        { stroke: OUTLINE },
      ),
      blob(
        'Bottom fin',
        [
          [54, 56],
          [62, 72],
          [74, 68],
          [72, 56],
        ],
        '#f59a2b',
        { stroke: OUTLINE },
      ),
      blob(
        'Body',
        [
          [6, 40],
          [24, 22],
          [52, 16],
          [80, 24],
          [94, 40],
          [80, 56],
          [52, 64],
          [24, 58],
        ],
        '#ffc23d',
        {
          stroke: OUTLINE,
        },
      ),
      line(
        'Gill',
        smoothOpen([
          [32, 26],
          [37, 40],
          [32, 54],
        ]),
        '#e0902b',
        3,
      ),
      ...[0, 1, 2].map((i) =>
        line(`Scale ${i + 1}`, arc(52 + i * 12, 40, 6, 9, 300, 420, 6), '#e0a22b', 2),
      ),
      blob(
        'Side fin',
        [
          [42, 44],
          [56, 46],
          [50, 54],
        ],
        '#f59a2b',
        { stroke: THIN },
      ),
      circle('Eye', 20, 36, 5, '#ffffff', { stroke: THIN }),
      circle('Pupil', 19, 36, 2.5, INK),
      line(
        'Mouth',
        [
          [7, 42],
          [13, 44],
        ],
        INK,
        2,
      ),
    ],
    120,
    80,
  ),
  item(
    'biology.bee',
    'Bee',
    ['bee', 'insect', 'pollination', 'animal', 'invertebrate', 'honey', 'nature', 'biology'],
    [
      group(
        'Legs',
        [36, 50, 64].flatMap((x, i) => [
          line(
            `Front leg ${i + 1}`,
            [
              [x, 60],
              [x - 6, 72],
              [x - 2, 80],
            ],
            INK,
            2.5,
          ),
        ]),
      ),
      leaf('Back wing', [52, 40], [70, 6], 12, '#dff1ff', { stroke: THIN }),
      blob(
        'Abdomen',
        [
          [56, 50],
          [70, 34],
          [92, 36],
          [104, 52],
          [92, 68],
          [70, 68],
        ],
        '#ffc83d',
        { stroke: OUTLINE },
      ),
      band(
        'Stripe 1',
        [
          [74, 36],
          [72, 66],
        ],
        6,
        INK,
        { stroke: [INK, 0] },
      ),
      band(
        'Stripe 2',
        [
          [88, 37],
          [88, 66],
        ],
        6,
        INK,
        { stroke: [INK, 0] },
      ),
      shape(
        'Stinger',
        [
          [103, 49],
          [110, 53],
          [103, 56],
        ],
        INK,
      ),
      circle('Thorax', 48, 52, 13, '#8a6a3a', { stroke: OUTLINE }),
      leaf('Front wing', [46, 40], [36, 6], 11, '#eef8ff', { stroke: THIN }),
      circle('Head', 24, 54, 12, '#ffc83d', { stroke: OUTLINE }),
      circle('Eye', 18, 50, 4, INK),
      line(
        'Left antenna',
        smoothOpen([
          [24, 42],
          [20, 30],
          [12, 26],
        ]),
        INK,
        2,
      ),
      line(
        'Right antenna',
        smoothOpen([
          [28, 43],
          [30, 30],
          [36, 24],
        ]),
        INK,
        2,
      ),
      line(
        'Smile',
        smoothOpen([
          [14, 58],
          [19, 62],
          [24, 60],
        ]),
        INK,
        2,
      ),
    ],
    112,
    86,
  ),
  item(
    'biology.muscles',
    'Arm muscles',
    [
      'muscle',
      'muscles',
      'biceps',
      'triceps',
      'arm',
      'antagonistic',
      'movement',
      'skeleton',
      'human body',
      'anatomy',
      'biology',
    ],
    [
      blob(
        'Shoulder blade (scapula)',
        [
          [8, 6],
          [40, 4],
          [34, 16],
          [14, 26],
        ],
        BONE,
      ),
      bone('Humerus', [30, 10], [32, 72], 8, 15),
      bone('Ulna', [30, 76], [92, 78], 5, 9),
      bone('Radius', [34, 70], [92, 70], 5, 9),
      group('Hand', [
        ...[0, 1, 2, 3].map((i) =>
          band(
            `Finger ${i + 1}`,
            [
              [98, 66 + i * 5],
              [109, 66 + i * 5.4],
            ],
            4,
            BONE,
            {
              stroke: [INK, 1.5],
            },
          ),
        ),
        band(
          'Thumb',
          [
            [94, 66],
            [102, 58],
          ],
          4.5,
          BONE,
          { stroke: [INK, 1.5] },
        ),
        blob(
          'Palm bones',
          [
            [90, 64],
            [100, 62],
            [102, 72],
            [100, 84],
            [90, 82],
          ],
          BONE,
        ),
      ]),
      blob(
        'Triceps',
        [
          [24, 12],
          [16, 30],
          [12, 52],
          [20, 70],
          [28, 78],
          [26, 50],
          [28, 24],
        ],
        MUSCLE,
        {
          stroke: OUTLINE,
        },
      ),
      blob(
        'Biceps',
        [
          [36, 14],
          [52, 30],
          [58, 48],
          [52, 64],
          [44, 70],
          [40, 50],
          [36, 30],
        ],
        MUSCLE,
        {
          stroke: OUTLINE,
        },
      ),
      line(
        'Biceps tendon',
        [
          [46, 68],
          [50, 72],
        ],
        '#f4efe1',
        3,
      ),
      line(
        'Biceps line',
        smoothOpen([
          [40, 26],
          [48, 42],
          [48, 58],
        ]),
        '#b8333d',
        2,
      ),
      line(
        'Triceps line',
        smoothOpen([
          [22, 24],
          [18, 44],
          [22, 64],
        ]),
        '#b8333d',
        2,
      ),
    ],
    112,
    90,
  ),
  item(
    'biology.tree',
    'Tree with roots',
    [
      'tree',
      'roots',
      'plant',
      'nature',
      'ecosystem',
      'photosynthesis',
      'forest',
      'biology',
      'science',
    ],
    [
      rect('Soil', 2, 80, 96, 38, '#b07a4a', { radius: 6, stroke: THIN }),
      line(
        'Grass',
        [
          [2, 80],
          [98, 80],
        ],
        '#5cbf60',
        4,
      ),
      group(
        'Roots',
        [
          [
            [48, 84],
            [36, 96],
            [20, 104],
          ],
          [
            [52, 84],
            [64, 98],
            [82, 104],
          ],
          [
            [50, 86],
            [48, 102],
            [52, 114],
          ],
          [
            [40, 92],
            [30, 112],
          ],
          [
            [60, 94],
            [72, 112],
          ],
          [
            [28, 102],
            [14, 112],
          ],
        ].map((pts, i) =>
          band(`Root ${i + 1}`, pts as Pt[], i < 3 ? 4.5 : 3, '#8a5a32', { stroke: [INK, 1.5] }),
        ),
      ),
      shape(
        'Trunk',
        [
          [44, 84],
          [46, 50],
          [54, 50],
          [56, 84],
        ],
        '#8a5a32',
        { stroke: THIN },
      ),
      band(
        'Branch',
        [
          [52, 60],
          [64, 48],
        ],
        4,
        '#8a5a32',
      ),
      group('Crown', [
        circle('Leaves left', 30, 40, 20, '#4cae50', { stroke: THIN }),
        circle('Leaves right', 70, 40, 20, '#4cae50', { stroke: THIN }),
        circle('Leaves top', 50, 24, 22, '#5cbf60', { stroke: THIN }),
        circle('Leaves middle', 50, 44, 18, '#5cbf60'),
      ]),
    ],
    100,
    120,
  ),
];

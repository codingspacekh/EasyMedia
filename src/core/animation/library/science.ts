// AN19: physics and chemistry clip-art (the library's Science tab) — circuits, light, forces and
// machines, waves, magnets, space and laboratory things for explainer animations, drawn from the
// app's own shapes. Letters and signs are drawn as lines, as there is no text part; every part is
// named ("Bob", "Light ray in", "Push arrow") so a student can animate it on its own.
import {
  arc,
  circle,
  ellipse,
  group,
  line,
  rect,
  shape,
  turnedRect,
  type Fill,
  type LibraryItem,
  type Part,
} from './build.ts';

const INK = '#2d2a32';
const OUTLINE = [INK, 3] as const;
const THIN = [INK, 2] as const;
const BLUE = '#2f7fe0';
const RED = '#e84545';
const GREEN = '#5cbf60';
const ORANGE = '#ff9f43';
const GOLD = '#ffc83d';
const DARK_GOLD = '#e0a800';
const WOOD = '#a0673a';
const DARK_WOOD = '#7a4e2d';
const GLASS = '#e8f4ff';
const STEEL = '#9aa4b2';
const DARK_STEEL = '#6b7685';
const SLATE = '#3d4452';
const COPPER = '#d0803a';
const ROPE = '#c8a165';
const RAY = '#ff5a1f';
const SPECTRUM = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa'];

type Pt = [number, number];

const PHYSICS = ['physics'];
const CHEMISTRY = ['chemistry', 'laboratory', 'lab', 'experiment'];

const item = (
  id: string,
  name: string,
  keywords: string[],
  parts: Part[],
  width = 100,
  height = 100,
): LibraryItem => ({
  id,
  name,
  category: 'science',
  keywords: [...keywords, 'science'],
  width,
  height,
  parts,
});

const rad = (deg: number) => (deg * Math.PI) / 180;
const along = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A triangle arrowhead with its point at `tip`, pointing along `a` → `tip`. */
function head(name: string, a: Pt, tip: Pt, colour: string, size: number): Part {
  const len = Math.hypot(tip[0] - a[0], tip[1] - a[1]);
  const [ux, uy] = [(tip[0] - a[0]) / len, (tip[1] - a[1]) / len];
  const [bx, by] = [tip[0] - ux * size, tip[1] - uy * size];
  const w = size * 0.6;
  return shape(name, [tip, [bx - uy * w, by + ux * w], [bx + uy * w, by - ux * w]], colour);
}

/** An arrow from `a` to `b`: a line and a triangle head, grouped under one name. */
function arrow(name: string, a: Pt, b: Pt, colour: string, width = 4, size = 11): Part {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const end = along(a, b, (len - size * 0.8) / len);
  return group(name, [
    line(`${name} line`, [a, end], colour, width),
    head(`${name} head`, a, b, colour, size),
  ]);
}

/** A measuring arrow with a head at both ends. */
function doubleArrow(name: string, a: Pt, b: Pt, colour: string, width = 2.5, size = 8): Part {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const t = (size * 0.8) / len;
  return group(name, [
    line(`${name} line`, [along(a, b, t), along(a, b, 1 - t)], colour, width),
    head(`${name} head 1`, b, a, colour, size),
    head(`${name} head 2`, a, b, colour, size),
  ]);
}

/** A straight band `w` px wide from `a` to `b` (a beam of light, a bond). */
function band(a: Pt, b: Pt, w: number): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [nx, ny] = [((a[1] - b[1]) / len) * (w / 2), ((b[0] - a[0]) / len) * (w / 2)];
  return [
    [a[0] + nx, a[1] + ny],
    [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny],
    [a[0] - nx, a[1] - ny],
  ];
}

/** A zigzag (a spring, a filament) from (x, y0) down to (x, y1), `half` px to each side. */
function zigzag(x: number, y0: number, y1: number, half: number, n: number): Pt[] {
  const step = (y1 - y0) / n;
  return [
    [x, y0],
    ...Array.from({ length: n }, (_, i): Pt => [x + (i % 2 ? -half : half), y0 + (i + 0.5) * step]),
    [x, y1],
  ];
}

/** A flame: round at `baseY`, pointed at `tipY` (above or below), `hw` px half-wide. */
function flame(
  name: string,
  cx: number,
  baseY: number,
  tipY: number,
  hw: number,
  fill: Fill,
): Part {
  const d = Math.sign(tipY - baseY);
  const cy = baseY + d * hw;
  const side = (sign: number): Pt[] =>
    Array.from({ length: 9 }, (_, i): Pt => {
      const s = i / 8;
      return [cx + sign * hw * Math.sin((s * Math.PI) / 2), tipY + (cy - tipY) * s];
    });
  return shape(
    name,
    [
      ...side(1),
      ...arc(cx, cy, hw, hw, 0, d < 0 ? 180 : -180, 12).slice(1, -1),
      ...side(-1).reverse(),
    ],
    fill,
  );
}

/** A lens shape from `a` to `b`, `bulge` px wide on each side. */
function leaf(name: string, a: Pt, b: Pt, bulge: number, fill: Fill, opacity = 100): Part {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  const [nx, ny] = [-dy / len, dx / len];
  const side = (sign: number): Pt[] =>
    Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      const w = sign * bulge * Math.sin(Math.PI * t);
      return [a[0] + dx * t + nx * w, a[1] + dy * t + ny * w];
    });
  return shape(name, [...side(1), ...side(-1).reverse().slice(1, -1)], fill, {
    stroke: THIN,
    opacity,
  });
}

/** A ring's slice between radii `r1` and `r2`, from `from`° to `to`°. */
const slice = (
  name: string,
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  from: number,
  to: number,
  fill: string,
): Part =>
  shape(name, [...arc(cx, cy, r2, r2, from, to, 12), ...arc(cx, cy, r1, r1, to, from, 8)], fill);

/** A cog with square teeth. */
function gear(
  name: string,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  teeth: number,
  turn: number,
  fill: string,
): Part {
  const pts: Pt[] = [];
  const at = (deg: number, r: number): Pt => [
    cx + r * Math.cos(rad(deg)),
    cy + r * Math.sin(rad(deg)),
  ];
  const each = 360 / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = turn + i * each;
    pts.push(
      at(a, inner),
      at(a + each * 0.12, outer),
      at(a + each * 0.45, outer),
      at(a + each * 0.57, inner),
    );
  }
  return shape(name, pts, fill, { stroke: THIN });
}

// ---- letters drawn as lines (there is no text part) ----

const letterN = (name: string, x: number, y: number, h: number, colour: string, w = 3): Part =>
  line(
    name,
    [
      [x - h * 0.3, y + h / 2],
      [x - h * 0.3, y - h / 2],
      [x + h * 0.3, y + h / 2],
      [x + h * 0.3, y - h / 2],
    ],
    colour,
    w,
  );
const letterS = (name: string, x: number, y: number, h: number, colour: string, w = 3): Part =>
  line(
    name,
    [
      ...arc(x, y - h / 4, h * 0.27, h / 4, 330, 90, 10),
      ...arc(x, y + h / 4, h * 0.27, h / 4, 270, 510, 10).slice(1),
    ],
    colour,
    w,
  );
const letterA = (name: string, x: number, y: number, h: number, colour: string, w = 2.5): Part =>
  group(name, [
    line(
      `${name} sides`,
      [
        [x - h * 0.38, y + h / 2],
        [x, y - h / 2],
        [x + h * 0.38, y + h / 2],
      ],
      colour,
      w,
    ),
    line(
      `${name} bar`,
      [
        [x - h * 0.22, y + h * 0.12],
        [x + h * 0.22, y + h * 0.12],
      ],
      colour,
      w,
    ),
  ]);
const letterV = (name: string, x: number, y: number, h: number, colour: string, w = 2.5): Part =>
  line(
    name,
    [
      [x - h * 0.38, y - h / 2],
      [x, y + h / 2],
      [x + h * 0.38, y - h / 2],
    ],
    colour,
    w,
  );

const SCIENCE_ITEMS: LibraryItem[] = [
  // ---- electricity ----
  item(
    'science.circuit',
    'Electric circuit',
    [
      'circuit',
      'electricity',
      'electric',
      'current',
      'cell',
      'battery',
      'switch',
      'lamp',
      'bulb',
      'wire',
      ...PHYSICS,
    ],
    [
      line(
        'Wires',
        [
          [14, 40],
          [14, 30],
          [106, 30],
          [106, 86],
          [14, 86],
          [14, 76],
        ],
        INK,
        3,
      ),
      circle('Glow', 60, 16, 15, GOLD, { opacity: 35 }),
      circle(
        'Bulb',
        60,
        15,
        10,
        { from: '#fffbe0', to: '#ffd84d', radial: true },
        { stroke: THIN },
      ),
      line('Filament', zigzag(60, 25, 13, 4, 4), '#b35c00', 1.5),
      rect('Lamp holder', 51, 24, 18, 10, SLATE, { radius: 2, stroke: THIN }),
      rect('Cell terminal', 10, 37, 8, 6, STEEL, { radius: 1, stroke: THIN }),
      rect('Cell', 5, 42, 18, 34, SLATE, { radius: 3, stroke: THIN }),
      rect('Cell top', 6, 43, 16, 12, COPPER, { radius: 2 }),
      rect('Plus across', 10, 48, 8, 2.4, '#ffffff'),
      rect('Plus down', 12.8, 45.2, 2.4, 8, '#ffffff'),
      rect('Switch base', 40, 81, 40, 10, WOOD, { radius: 2, stroke: THIN }),
      circle('Switch contact 1', 47, 86, 3, STEEL, { stroke: THIN }),
      circle('Switch contact 2', 73, 86, 3, STEEL, { stroke: THIN }),
      line(
        'Switch lever',
        [
          [47, 85],
          [76, 85],
        ],
        DARK_STEEL,
        4,
      ),
      circle('Switch knob', 78, 85, 3.5, RED, { stroke: THIN }),
      arrow('Current arrow', [114, 46], [114, 70], RED, 3, 9),
    ],
    120,
    100,
  ),
  item(
    'science.lamp',
    'Filament lamp',
    ['lamp', 'light bulb', 'bulb', 'filament', 'light', 'electricity', 'idea', 'glow', ...PHYSICS],
    [
      ...[200, 240, 270, 300, 340].map((deg, i) =>
        line(
          `Light ray ${i + 1}`,
          [
            [40 + 31 * Math.cos(rad(deg)), 36 + 31 * Math.sin(rad(deg))],
            [40 + 38 * Math.cos(rad(deg)), 36 + 38 * Math.sin(rad(deg))],
          ],
          DARK_GOLD,
          3,
        ),
      ),
      shape(
        'Glass',
        [...arc(40, 36, 24, 24, 125, 415, 24), [49, 72], [31, 72]],
        { from: '#fffbe0', to: '#ffd84d', radial: true },
        { stroke: OUTLINE },
      ),
      line(
        'Wire 1',
        [
          [36, 72],
          [34, 40],
        ],
        DARK_STEEL,
        1.5,
      ),
      line(
        'Wire 2',
        [
          [44, 72],
          [46, 40],
        ],
        DARK_STEEL,
        1.5,
      ),
      line(
        'Filament',
        [
          [34, 40],
          [36, 34],
          [38, 40],
          [40, 34],
          [42, 40],
          [44, 34],
          [46, 40],
        ],
        '#e05a00',
        2,
      ),
      rect('Screw base', 29, 72, 22, 18, STEEL, { radius: 2, stroke: THIN }),
      ...[77, 83].map((y, i) =>
        line(
          `Thread ${i + 1}`,
          [
            [29, y],
            [51, y + 2],
          ],
          INK,
          1.5,
        ),
      ),
      shape(
        'Contact',
        [
          [32, 90],
          [48, 90],
          [44, 97],
          [36, 97],
        ],
        SLATE,
        { stroke: THIN },
      ),
    ],
    80,
    100,
  ),
  item(
    'science.symbols',
    'Circuit symbols',
    [
      'circuit symbols',
      'symbol',
      'circuit',
      'electricity',
      'cell',
      'resistor',
      'lamp',
      'switch',
      'ammeter',
      'voltmeter',
      ...PHYSICS,
    ],
    [
      rect('Card', 2, 2, 136, 96, '#ffffff', { radius: 8, stroke: OUTLINE }),
      group('Cell symbol', [
        line(
          'Cell wire 1',
          [
            [8, 30],
            [21, 30],
          ],
          INK,
          2,
        ),
        line(
          'Long plate',
          [
            [21, 18],
            [21, 42],
          ],
          INK,
          2.5,
        ),
        line(
          'Short plate',
          [
            [29, 23],
            [29, 37],
          ],
          INK,
          5,
        ),
        line(
          'Cell wire 2',
          [
            [29, 30],
            [42, 30],
          ],
          INK,
          2,
        ),
      ]),
      group('Resistor symbol', [
        line(
          'Resistor wire 1',
          [
            [52, 30],
            [58, 30],
          ],
          INK,
          2,
        ),
        rect('Resistor box', 58, 24, 24, 12, '#ffffff', { stroke: THIN }),
        line(
          'Resistor wire 2',
          [
            [82, 30],
            [88, 30],
          ],
          INK,
          2,
        ),
      ]),
      group('Lamp symbol', [
        line(
          'Lamp wire 1',
          [
            [97, 30],
            [105, 30],
          ],
          INK,
          2,
        ),
        circle('Lamp circle', 115, 30, 10, '#ffffff', { stroke: THIN }),
        line(
          'Lamp cross 1',
          [
            [108, 23],
            [122, 37],
          ],
          INK,
          2,
        ),
        line(
          'Lamp cross 2',
          [
            [108, 37],
            [122, 23],
          ],
          INK,
          2,
        ),
        line(
          'Lamp wire 2',
          [
            [125, 30],
            [133, 30],
          ],
          INK,
          2,
        ),
      ]),
      group('Switch symbol', [
        line(
          'Switch wire 1',
          [
            [8, 74],
            [16, 74],
          ],
          INK,
          2,
        ),
        circle('Switch pivot', 18, 74, 2.5, '#ffffff', { stroke: THIN }),
        line(
          'Switch blade',
          [
            [19, 73],
            [33, 64],
          ],
          INK,
          2,
        ),
        circle('Switch contact', 34, 74, 2.5, '#ffffff', { stroke: THIN }),
        line(
          'Switch wire 2',
          [
            [36, 74],
            [42, 74],
          ],
          INK,
          2,
        ),
      ]),
      group('Ammeter symbol', [
        line(
          'Ammeter wire 1',
          [
            [52, 74],
            [60, 74],
          ],
          INK,
          2,
        ),
        circle('Ammeter circle', 70, 74, 10, '#ffffff', { stroke: THIN }),
        letterA('Letter A', 70, 74, 11, INK, 2),
        line(
          'Ammeter wire 2',
          [
            [80, 74],
            [88, 74],
          ],
          INK,
          2,
        ),
      ]),
      group('Voltmeter symbol', [
        line(
          'Voltmeter wire 1',
          [
            [97, 74],
            [105, 74],
          ],
          INK,
          2,
        ),
        circle('Voltmeter circle', 115, 74, 10, '#ffffff', { stroke: THIN }),
        letterV('Letter V', 115, 74, 11, INK, 2),
        line(
          'Voltmeter wire 2',
          [
            [125, 74],
            [133, 74],
          ],
          INK,
          2,
        ),
      ]),
    ],
    140,
    100,
  ),
  item(
    'science.ammeter',
    'Ammeter',
    [
      'ammeter',
      'meter',
      'dial',
      'current',
      'measure',
      'electricity',
      'voltmeter',
      'gauge',
      ...PHYSICS,
    ],
    [
      rect('Case', 4, 4, 102, 72, SLATE, { radius: 8, stroke: OUTLINE }),
      rect('Dial', 12, 10, 86, 50, '#fffdf2', { radius: 4, stroke: THIN }),
      line('Scale', arc(55, 58, 38, 38, 215, 325, 20), INK, 2),
      ...Array.from({ length: 11 }, (_, i) => {
        const a = rad(215 + i * 11);
        const r = i % 5 === 0 ? 30 : 33;
        return line(
          `Tick ${i + 1}`,
          [
            [55 + 38 * Math.cos(a), 58 + 38 * Math.sin(a)],
            [55 + r * Math.cos(a), 58 + r * Math.sin(a)],
          ],
          INK,
          i % 5 === 0 ? 2 : 1.5,
        );
      }),
      line('Red zone', arc(55, 58, 40, 40, 315, 325, 4), RED, 3),
      letterA('Letter A', 55, 38, 10, INK, 2),
      line(
        'Needle',
        [
          [55, 58],
          [55 + 36 * Math.cos(rad(295)), 58 + 36 * Math.sin(rad(295))],
        ],
        RED,
        2.5,
      ),
      circle('Pivot', 55, 58, 4, INK),
      rect('Base', 12, 76, 86, 10, DARK_WOOD, { radius: 3, stroke: THIN }),
      circle('Red terminal', 30, 68, 4.5, RED, { stroke: THIN }),
      circle('Black terminal', 80, 68, 4.5, INK, { stroke: THIN }),
    ],
    110,
    90,
  ),
  item(
    'science.electromagnet',
    'Electromagnet',
    [
      'electromagnet',
      'magnet',
      'magnetism',
      'coil',
      'nail',
      'electricity',
      'current',
      'force',
      ...PHYSICS,
    ],
    [
      line(
        'Wire to cell',
        [
          [30, 42],
          [30, 80],
          [44, 80],
        ],
        COPPER,
        3,
      ),
      line(
        'Wire from cell',
        [
          [76, 80],
          [86, 80],
          [86, 42],
        ],
        COPPER,
        3,
      ),
      rect('Cell', 44, 72, 32, 16, SLATE, { radius: 3, stroke: THIN }),
      rect('Cell top', 45, 73, 10, 14, COPPER, { radius: 2 }),
      rect('Cell terminal', 76, 76, 4, 8, STEEL),
      rect('Nail head', 6, 22, 6, 24, STEEL, { radius: 2, stroke: THIN }),
      shape(
        'Nail',
        [
          [12, 30],
          [94, 30],
          [106, 34],
          [94, 38],
          [12, 38],
        ],
        { from: '#c6ccd6', to: '#8a94a3', angle: 90 },
        { stroke: THIN },
      ),
      ...Array.from({ length: 9 }, (_, i) =>
        ellipse(`Coil turn ${i + 1}`, 28 + i * 6.5, 25, 6, 18, null, { stroke: [COPPER, 3] }),
      ),
      ...[0, 1].map((i) =>
        group(`Paper clip ${i + 1}`, [
          rect(`Paper clip ${i + 1} outer`, 103, 38 + i * 21, 8, 22, null, {
            radius: 4,
            stroke: [DARK_STEEL, 2],
          }),
          rect(`Paper clip ${i + 1} inner`, 105.5, 42 + i * 21, 3, 14, null, {
            radius: 1.5,
            stroke: [DARK_STEEL, 1.5],
          }),
        ]),
      ),
    ],
    120,
    92,
  ),

  // ---- light ----
  item(
    'science.lens',
    'Convex lens',
    [
      'lens',
      'convex',
      'converging',
      'light',
      'ray',
      'focus',
      'focal point',
      'optics',
      'refraction',
      ...PHYSICS,
    ],
    [
      line(
        'Principal axis',
        [
          [2, 50],
          [138, 50],
        ],
        STEEL,
        1.5,
      ),
      ...[24, 50, 76].map((y, i) => {
        const f: Pt = [116, 50];
        const end = along([60, y], f, 76 / 56);
        return group(`Light ray ${i + 1}`, [
          line(
            `Light ray ${i + 1} in`,
            [
              [4, y],
              [60, y],
            ],
            RAY,
            3,
          ),
          line(`Light ray ${i + 1} out`, [[60, y], end], RAY, 3),
          head(`Light ray ${i + 1} arrow`, [20, y], [34, y], RAY, 9),
        ]);
      }),
      leaf('Lens', [60, 4], [60, 96], 11, { from: '#d8efff', to: '#9fd3ff', angle: 0 }, 80),
      circle('Focal point', 116, 50, 3.5, INK),
    ],
    140,
    100,
  ),
  item(
    'science.prism',
    'Prism',
    [
      'prism',
      'light',
      'rainbow',
      'spectrum',
      'colours',
      'colors',
      'dispersion',
      'refraction',
      'optics',
      ...PHYSICS,
    ],
    (() => {
      const apex: Pt = [64, 8];
      const left: Pt = [22, 92];
      const right: Pt = [106, 92];
      const entry = along(apex, left, 0.5);
      const exits = Array.from({ length: 8 }, (_, i) => along(apex, right, 0.47 + i * 0.02));
      const ends = Array.from({ length: 8 }, (_, i): Pt => [138, 56 + i * 6]);
      const names = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'];
      return [
        shape(
          'Prism',
          [apex, right, left],
          { from: '#eef8ff', to: '#b9dcf7', angle: 90 },
          { stroke: OUTLINE },
        ),
        shape('Light inside', [entry, exits[0]!, exits[7]!], '#ffffff', { opacity: 90 }),
        group(
          'Spectrum',
          SPECTRUM.map((colour, i) =>
            shape(`${names[i]} band`, [exits[i]!, ends[i]!, ends[i + 1]!, exits[i + 1]!], colour),
          ),
        ),
        shape('White light in', band([2, 74], entry, 6), '#ffffff', { stroke: THIN }),
      ];
    })(),
    140,
    100,
  ),
  // ---- forces and machines ----
  item(
    'science.forces',
    'Forces on a block',
    [
      'forces',
      'force',
      'free body',
      'push',
      'friction',
      'weight',
      'gravity',
      'reaction',
      'arrow',
      ...PHYSICS,
    ],
    [
      rect('Ground', 4, 84, 132, 8, '#c9b28a', { stroke: THIN }),
      rect(
        'Block',
        46,
        46,
        48,
        38,
        { from: '#ffd27a', to: '#e0a040', angle: 90 },
        { radius: 3, stroke: OUTLINE },
      ),
      arrow('Push arrow', [94, 62], [134, 62], RED, 5, 13),
      arrow('Friction arrow', [46, 76], [8, 76], ORANGE, 5, 13),
      arrow('Weight arrow', [70, 70], [70, 108], BLUE, 5, 13),
      arrow('Reaction arrow', [70, 46], [70, 4], GREEN, 5, 13),
    ],
    140,
    110,
  ),
  item(
    'science.pendulum',
    'Pendulum',
    [
      'pendulum',
      'swing',
      'oscillation',
      'gravity',
      'force',
      'time period',
      'bob',
      'clock',
      ...PHYSICS,
    ],
    (() => {
      const pivot: Pt = [50, 12];
      const len = 64;
      const at = (deg: number): Pt => [
        pivot[0] + len * Math.sin(rad(deg)),
        pivot[1] + len * Math.cos(rad(deg)),
      ];
      const bob = at(28);
      const ghost = at(-28);
      return [
        rect('Support', 12, 4, 76, 8, WOOD, { radius: 2, stroke: THIN }),
        line('Rest line', [pivot, [50, 84]], STEEL, 1.5),
        line('Swing path', arc(50, 12, len, len, 62, 118, 16), STEEL, 2),
        line('Other side string', [pivot, ghost], STEEL, 1.5),
        circle('Other side bob', ghost[0], ghost[1], 10, GOLD, { opacity: 35 }),
        line('String', [pivot, bob], INK, 2),
        circle(
          'Bob',
          bob[0],
          bob[1],
          11,
          { from: '#fff0b0', to: DARK_GOLD, radial: true },
          { stroke: OUTLINE },
        ),
        circle('Pivot', 50, 12, 3.5, SLATE),
      ];
    })(),
  ),
  item(
    'science.spring',
    'Spring and mass',
    ['spring', 'hooke', 'extension', 'stretch', 'elastic', 'mass', 'weight', 'force', ...PHYSICS],
    [
      rect('Support', 4, 4, 76, 8, WOOD, { radius: 2, stroke: THIN }),
      rect('Ruler', 66, 12, 14, 84, '#ffe9a8', { stroke: THIN }),
      ...Array.from({ length: 10 }, (_, i) =>
        line(
          `Ruler mark ${i + 1}`,
          [
            [66, 18 + i * 8],
            [i % 2 ? 72 : 76, 18 + i * 8],
          ],
          INK,
          1.5,
        ),
      ),
      line('Spring', zigzag(36, 12, 60, 11, 12), DARK_STEEL, 3),
      line(
        'Hook',
        [
          [36, 60],
          [36, 67],
        ],
        INK,
        2.5,
      ),
      line(
        'Pointer',
        [
          [48, 66],
          [66, 66],
        ],
        RED,
        2,
      ),
      rect(
        'Mass',
        20,
        66,
        32,
        26,
        { from: '#6b7685', to: SLATE, angle: 90 },
        { radius: 4, stroke: OUTLINE },
      ),
      rect('Mass shine', 25, 70, 6, 16, '#ffffff', { radius: 3, opacity: 35 }),
      arrow('Weight arrow', [9, 64], [9, 96], BLUE, 3.5, 10),
    ],
    84,
    100,
  ),
  item(
    'science.pulley',
    'Pulley',
    ['pulley', 'lift', 'rope', 'wheel', 'machine', 'load', 'effort', 'force', ...PHYSICS],
    [
      rect('Ceiling', 4, 2, 92, 8, WOOD, { radius: 2, stroke: THIN }),
      line(
        'Bracket',
        [
          [50, 10],
          [50, 30],
        ],
        SLATE,
        5,
      ),
      circle(
        'Wheel',
        50,
        30,
        20,
        { from: '#d5dce4', to: '#8a94a3', radial: true },
        { stroke: OUTLINE },
      ),
      line('Rope', [[34, 66], ...arc(50, 30, 16, 16, 180, 360, 16), [66, 84]], ROPE, 3),
      circle('Axle', 50, 30, 5, SLATE, { stroke: THIN }),
      line(
        'Hook',
        [
          [34, 62],
          [34, 68],
        ],
        INK,
        2.5,
      ),
      rect('Load', 20, 68, 28, 24, WOOD, { radius: 2, stroke: OUTLINE }),
      line(
        'Load plank',
        [
          [20, 80],
          [48, 80],
        ],
        DARK_WOOD,
        2,
      ),
      circle('Hand grip', 66, 86, 4, '#f1c27d', { stroke: THIN }),
      arrow('Effort arrow', [82, 54], [82, 92], RED, 4, 11),
      arrow('Lift arrow', [9, 92], [9, 60], GREEN, 4, 11),
    ],
  ),
  item(
    'science.lever',
    'Lever',
    [
      'lever',
      'see-saw',
      'seesaw',
      'fulcrum',
      'pivot',
      'moment',
      'load',
      'effort',
      'force',
      'machine',
      ...PHYSICS,
    ],
    [
      rect('Ground', 4, 84, 132, 4, DARK_WOOD, { radius: 2 }),
      shape(
        'Fulcrum',
        [
          [52, 60],
          [66, 84],
          [38, 84],
        ],
        STEEL,
        { stroke: OUTLINE },
      ),
      rect('Beam', 6, 52, 128, 8, WOOD, { radius: 2, stroke: THIN }),
      rect('Load', 10, 30, 26, 22, SLATE, { radius: 3, stroke: OUTLINE }),
      rect('Load handle', 18, 26, 10, 5, SLATE, { radius: 2 }),
      arrow('Load arrow', [23, 2], [23, 24], BLUE, 4, 10),
      arrow('Effort arrow', [122, 8], [122, 49], RED, 5, 12),
    ],
    140,
    90,
  ),
  item(
    'science.gears',
    'Gears',
    [
      'gears',
      'cogs',
      'gear',
      'cog',
      'machine',
      'turning',
      'mechanism',
      'force',
      'engineering',
      ...PHYSICS,
    ],
    [
      gear('Big gear', 40, 60, 34, 27, 12, 5.15, '#ffb347'),
      circle('Big gear hub', 40, 60, 10, '#ffffff', { stroke: THIN }),
      circle('Big gear axle', 40, 60, 4, SLATE),
      gear('Small gear', 86, 32, 23, 17, 8, 0.9, '#5bb6f0'),
      circle('Small gear hub', 86, 32, 7, '#ffffff', { stroke: THIN }),
      circle('Small gear axle', 86, 32, 3, SLATE),
    ],
    112,
    96,
  ),
  item(
    'science.cradle',
    "Newton's cradle",
    [
      "newton's cradle",
      'newton',
      'cradle',
      'momentum',
      'energy',
      'collision',
      'pendulum',
      'force',
      ...PHYSICS,
    ],
    (() => {
      const xs = [45, 63, 81, 99, 117];
      const bob = (i: number): Pt =>
        i === 0 ? [45 - 52 * Math.sin(rad(32)), 12 + 52 * Math.cos(rad(32))] : [xs[i]!, 64];
      return [
        rect('Base', 2, 90, 136, 8, DARK_WOOD, { radius: 3, stroke: THIN }),
        rect('Left post', 4, 8, 6, 84, STEEL, { stroke: THIN }),
        rect('Right post', 130, 8, 6, 84, STEEL, { stroke: THIN }),
        rect('Top bar', 4, 6, 132, 6, STEEL, { radius: 2, stroke: THIN }),
        ...xs.map((x, i) => line(`String ${i + 1}`, [[x, 12], bob(i)], INK, 1.5)),
        ...xs.map((_, i) =>
          circle(
            `Ball ${i + 1}`,
            bob(i)[0],
            bob(i)[1],
            9,
            { from: '#f4f6f9', to: '#7d8796', radial: true },
            { stroke: THIN },
          ),
        ),
      ];
    })(),
    140,
    100,
  ),
  item(
    'science.balance',
    'Balance scales',
    ['balance', 'scales', 'weigh', 'mass', 'weight', 'compare', 'measure', 'force', ...PHYSICS],
    (() => {
      const tilt = -9;
      const ends: Pt[] = [-1, 1].map((s) => [
        60 + s * 42 * Math.cos(rad(tilt)),
        22 + s * 42 * Math.sin(rad(tilt)),
      ]);
      const pan = (name: string, [x, y]: Pt): Part[] => [
        line(
          `${name} chain left`,
          [
            [x, y],
            [x - 15, y + 30],
          ],
          DARK_STEEL,
          1.5,
        ),
        line(
          `${name} chain right`,
          [
            [x, y],
            [x + 15, y + 30],
          ],
          DARK_STEEL,
          1.5,
        ),
        shape(name, arc(x, y + 30, 17, 8, 0, 180, 12), GOLD, { stroke: THIN }),
      ];
      const [l, r] = [ends[0]!, ends[1]!];
      return [
        rect('Base', 32, 88, 56, 8, DARK_WOOD, { radius: 3, stroke: THIN }),
        rect('Post', 56, 22, 8, 68, DARK_GOLD, { stroke: THIN }),
        shape('Beam', turnedRect(60, 22, 88, 6, tilt), DARK_GOLD, { stroke: THIN }),
        circle('Pivot', 60, 22, 5, GOLD, { stroke: THIN }),
        rect('Weight', l[0] - 8, l[1] + 16, 16, 14, SLATE, { radius: 2, stroke: THIN }),
        ...pan('Left pan', l),
        circle('Apple', r[0], r[1] + 24, 6, RED, { stroke: THIN }),
        ...pan('Right pan', r),
      ];
    })(),
    120,
    100,
  ),
  item(
    'science.mass',
    'Mass (1 kg)',
    ['mass', 'weight', '1 kg', 'kilogram', 'kg', 'heavy', 'measure', 'force', ...PHYSICS],
    [
      shape(
        'Handle',
        [
          ...arc(45, 24, 14, 16, 180, 360, 12),
          [52, 24],
          ...arc(45, 24, 7, 9, 360, 180, 10),
          [38, 24],
        ],
        SLATE,
        { stroke: THIN },
      ),
      shape(
        'Mass',
        [
          [24, 24],
          [66, 24],
          [86, 86],
          [4, 86],
        ],
        { from: '#6b7685', to: SLATE, angle: 90 },
        { stroke: OUTLINE },
      ),
      line(
        'Digit 1',
        [
          [21, 52],
          [26, 46],
          [26, 72],
        ],
        '#ffffff',
        3.5,
      ),
      group('Letter k', [
        line(
          'Letter k stem',
          [
            [38, 46],
            [38, 72],
          ],
          '#ffffff',
          3.5,
        ),
        line(
          'Letter k arms',
          [
            [50, 54],
            [38, 64],
            [50, 72],
          ],
          '#ffffff',
          3.5,
        ),
      ]),
      group('Letter g', [
        circle('Letter g bowl', 62, 61, 6, null, { stroke: ['#ffffff', 3.5] }),
        line('Letter g tail', [[68, 55], ...arc(62, 70, 6, 8, 0, 160, 10)], '#ffffff', 3.5),
      ]),
    ],
    90,
    90,
  ),

  // ---- waves ----
  item(
    'science.wave',
    'Transverse wave',
    [
      'wave',
      'transverse',
      'wavelength',
      'amplitude',
      'crest',
      'trough',
      'frequency',
      'sound',
      'light',
      ...PHYSICS,
    ],
    (() => {
      const y = (x: number) => 54 - 26 * Math.sin((2 * Math.PI * (x - 8)) / 60);
      return [
        line(
          'Rest line',
          [
            [4, 54],
            [136, 54],
          ],
          STEEL,
          1.5,
        ),
        line(
          'Wave',
          Array.from({ length: 61 }, (_, i): Pt => [8 + i * 2, y(8 + i * 2)]),
          BLUE,
          4,
        ),
        line(
          'Wavelength end 1',
          [
            [23, 6],
            [23, 24],
          ],
          INK,
          1.5,
        ),
        line(
          'Wavelength end 2',
          [
            [83, 6],
            [83, 24],
          ],
          INK,
          1.5,
        ),
        doubleArrow('Wavelength', [23, 12], [83, 12], RED),
        doubleArrow('Amplitude', [113, 54], [113, 80], GREEN),
        circle('Crest', 23, 28, 3, INK),
        circle('Trough', 53, 80, 3, INK),
      ];
    })(),
    140,
    96,
  ),
  item(
    'science.sound',
    'Sound waves',
    [
      'sound',
      'sound waves',
      'loudspeaker',
      'speaker',
      'noise',
      'vibration',
      'music',
      'wave',
      'hearing',
      ...PHYSICS,
    ],
    [
      rect('Magnet', 6, 34, 16, 24, SLATE, { radius: 3, stroke: THIN }),
      shape(
        'Cone',
        [
          [22, 36],
          [44, 12],
          [44, 80],
          [22, 56],
        ],
        { from: '#6b7685', to: '#c6ccd6', angle: 0 },
        { stroke: OUTLINE },
      ),
      ellipse('Dust cap', 40, 38, 8, 16, SLATE),
      ...[24, 42, 60].map((r, i) =>
        line(`Sound wave ${i + 1}`, arc(48, 46, r, r, -42, 42, 12), BLUE, 4 - i * 0.5),
      ),
    ],
    112,
    92,
  ),

  // ---- magnetism ----
  item(
    'science.magnetfield',
    'Magnetic field',
    [
      'magnetic field',
      'magnet',
      'bar magnet',
      'field lines',
      'magnetism',
      'north',
      'south',
      'pole',
      'force',
      ...PHYSICS,
    ],
    (() => {
      const FIELD = '#7a5cc2';
      const loops = [1, 2, 3].flatMap((k) => {
        const rx = 34 + 10 * k;
        const ry = 6 + 12 * k;
        return [-1, 1].map((s) => {
          const name = `Field line ${s < 0 ? 'above' : 'below'} ${k}`;
          const from = s < 0 ? 195 : 165;
          const to = s < 0 ? 345 : 15;
          const pts: Pt[] = [
            [45, 50 + s * 4],
            ...arc(80, 50, rx, ry, from, to, 24),
            [115, 50 + s * 4],
          ];
          const mid: Pt = [80, 50 + s * ry];
          return group(name, [
            line(`${name} curve`, pts, FIELD, 2),
            head(`${name} arrow`, [mid[0] - 5, mid[1]], [mid[0] + 4, mid[1]], FIELD, 8),
          ]);
        });
      });
      return [
        ...loops,
        group('Field line left', [
          line(
            'Field line left line',
            [
              [45, 50],
              [4, 50],
            ],
            FIELD,
            2,
          ),
          head('Field line left arrow', [26, 50], [16, 50], FIELD, 8),
        ]),
        group('Field line right', [
          line(
            'Field line right line',
            [
              [115, 50],
              [156, 50],
            ],
            FIELD,
            2,
          ),
          head('Field line right arrow', [146, 50], [136, 50], FIELD, 8),
        ]),
        rect('North pole', 45, 39, 35, 22, RED, { stroke: THIN }),
        rect('South pole', 80, 39, 35, 22, BLUE, { stroke: THIN }),
        letterN('Letter N', 62, 50, 12, '#ffffff'),
        letterS('Letter S', 98, 50, 12, '#ffffff'),
      ];
    })(),
    160,
    100,
  ),

  // ---- space ----
  item(
    'science.solarsystem',
    'Solar system',
    [
      'solar system',
      'sun',
      'planets',
      'orbit',
      'space',
      'astronomy',
      'earth',
      'mars',
      'jupiter',
      ...PHYSICS,
    ],
    (() => {
      const orbits: [string, number, number, number, number, Fill][] = [
        ['Mercury', 22, 10, 300, 3, '#a8a29e'],
        ['Venus', 34, 16, 140, 4.5, '#f2c46d'],
        ['Earth', 47, 23, 35, 5, { from: '#7cc8ff', to: '#1f6fd0', radial: true }],
        ['Mars', 61, 31, 215, 4, '#e0603a'],
        ['Jupiter', 76, 42, 325, 8, { from: '#f3d9b1', to: '#c48a4a', angle: 90 }],
      ];
      return [
        ...orbits.map(([n, rx, ry]) =>
          ellipse(`${n} orbit`, 80 - rx, 50 - ry, 2 * rx, 2 * ry, null, { stroke: [STEEL, 1.5] }),
        ),
        circle('Sun glow', 80, 50, 16, GOLD, { opacity: 40 }),
        circle(
          'Sun',
          80,
          50,
          12,
          { from: '#fff27a', to: '#ff9f1a', radial: true },
          { stroke: THIN },
        ),
        ...orbits.map(([n, rx, ry, deg, r, fill]) =>
          circle(n, 80 + rx * Math.cos(rad(deg)), 50 + ry * Math.sin(rad(deg)), r, fill, {
            stroke: THIN,
          }),
        ),
      ];
    })(),
    160,
    100,
  ),
  item(
    'science.satellite',
    'Satellite orbiting Earth',
    [
      'satellite',
      'orbit',
      'earth',
      'space',
      'gravity',
      'moon',
      'communication',
      'astronomy',
      ...PHYSICS,
    ],
    [
      line('Orbit behind', arc(60, 52, 54, 20, 180, 360, 24), STEEL, 2),
      circle(
        'Earth',
        60,
        50,
        26,
        { from: '#7cc8ff', to: '#1f6fd0', radial: true },
        { stroke: OUTLINE },
      ),
      shape(
        'Land 1',
        [
          [44, 34],
          [56, 30],
          [60, 40],
          [52, 50],
          [54, 62],
          [44, 64],
          [40, 50],
        ],
        GREEN,
      ),
      shape(
        'Land 2',
        [
          [66, 44],
          [76, 40],
          [82, 50],
          [76, 64],
          [68, 60],
        ],
        GREEN,
      ),
      line('Orbit in front', arc(60, 52, 54, 20, 0, 180, 24), STEEL, 2),
      group('Satellite', [
        rect('Left solar panel', 92, 60, 10, 8, BLUE, { stroke: THIN }),
        rect('Right solar panel', 114, 60, 10, 8, BLUE, { stroke: THIN }),
        rect('Satellite body', 102, 58, 12, 12, GOLD, { radius: 2, stroke: THIN }),
        line(
          'Antenna',
          [
            [108, 58],
            [108, 52],
          ],
          INK,
          2,
        ),
        circle('Dish', 108, 51, 2.5, '#ffffff', { stroke: THIN }),
      ]),
      arrow('Orbit arrow', [36, 70], [24, 67], DARK_STEEL, 2, 7),
    ],
    124,
    100,
  ),
  item(
    'science.rocket',
    'Rocket',
    ['rocket', 'space', 'launch', 'thrust', 'spaceship', 'astronomy', 'force', ...PHYSICS],
    (() => {
      const half = (y: number) => 15 * Math.sqrt(Math.max(0, (y - 4) / 32));
      const nose = (to: number): Pt[] => {
        const ys = Array.from({ length: 11 }, (_, i) => 4 + ((to - 4) * i) / 10);
        return [
          ...ys.map((y): Pt => [40 + half(y), y]),
          ...ys.reverse().map((y): Pt => [40 - half(y), y]),
        ];
      };
      return [
        flame('Outer flame', 40, 88, 120, 13, { from: '#ffd23d', to: '#ff6a00', angle: 90 }),
        flame('Inner flame', 40, 92, 110, 6, '#fff3b0'),
        shape(
          'Nozzle',
          [
            [32, 86],
            [48, 86],
            [52, 96],
            [28, 96],
          ],
          STEEL,
          { stroke: THIN },
        ),
        shape(
          'Left fin',
          [
            [26, 58],
            [8, 84],
            [8, 96],
            [26, 86],
          ],
          RED,
          { stroke: THIN },
        ),
        shape(
          'Right fin',
          [
            [54, 58],
            [72, 84],
            [72, 96],
            [54, 86],
          ],
          RED,
          { stroke: THIN },
        ),
        shape(
          'Body',
          [...nose(36), [55, 36], [55, 88], [25, 88], [25, 36]],
          { from: '#ffffff', to: '#c6ccd6', angle: 0 },
          { stroke: OUTLINE },
        ),
        shape('Nose cone', nose(20), RED, { stroke: THIN }),
        circle(
          'Window',
          40,
          50,
          8,
          { from: '#bfe6ff', to: '#2f7fe0', radial: true },
          { stroke: [SLATE, 3] },
        ),
        rect('Middle fin', 37, 70, 6, 24, RED, { radius: 2, stroke: THIN }),
      ];
    })(),
    80,
    122,
  ),

  // ---- radiation ----
  item(
    'science.radiation',
    'Radiation sign',
    [
      'radiation',
      'radioactive',
      'radioactivity',
      'nuclear',
      'hazard',
      'warning',
      'danger',
      'trefoil',
      ...PHYSICS,
    ],
    [
      circle('Sign', 50, 50, 46, '#ffd400', { stroke: OUTLINE }),
      ...[270, 30, 150].map((deg, i) =>
        slice(`Blade ${i + 1}`, 50, 50, 13, 38, deg - 30, deg + 30, INK),
      ),
      circle('Centre', 50, 50, 8, INK),
    ],
  ),

  // ---- chemistry ----
  item(
    'science.bunsen',
    'Bunsen burner',
    ['bunsen', 'burner', 'flame', 'fire', 'heat', 'gas', 'heating', ...CHEMISTRY],
    [
      flame('Flame', 40, 42, 2, 15, { from: '#3b5bdb', to: '#9cc4ff', angle: 90 }),
      flame('Inner cone', 40, 40, 18, 7, '#a5f3ff'),
      rect('Hose', 48, 76, 30, 8, ORANGE, { radius: 3, stroke: THIN }),
      rect('Base', 8, 84, 64, 12, SLATE, { radius: 4, stroke: OUTLINE }),
      rect(
        'Barrel',
        31,
        38,
        18,
        48,
        { from: '#c6ccd6', to: '#7d8796', angle: 0 },
        { radius: 1, stroke: OUTLINE },
      ),
      rect('Collar', 27, 62, 26, 12, DARK_STEEL, { radius: 2, stroke: THIN }),
      circle('Air hole', 40, 68, 3.2, INK),
    ],
    80,
    100,
  ),
  item(
    'science.molecule',
    'Water molecule',
    [
      'molecule',
      'water',
      'h2o',
      'atoms',
      'bond',
      'ball and stick',
      'oxygen',
      'hydrogen',
      'compound',
      ...CHEMISTRY,
    ],
    (() => {
      const o: Pt = [60, 34];
      const hs: Pt[] = [-1, 1].map((s) => [
        o[0] + s * 42 * Math.sin(rad(52)),
        o[1] + 42 * Math.cos(rad(52)),
      ]);
      return [
        ...hs.map((h, i) => shape(`Bond ${i + 1}`, band(o, h, 8), '#d5dce4', { stroke: THIN })),
        circle(
          'Oxygen atom',
          o[0],
          o[1],
          22,
          { from: '#ff8a80', to: '#d32f2f', radial: true },
          { stroke: OUTLINE },
        ),
        ellipse('Oxygen shine', 48, 20, 10, 7, '#ffffff', { opacity: 55 }),
        ...hs.map((h, i) =>
          circle(
            `Hydrogen atom ${i + 1}`,
            h[0],
            h[1],
            14,
            { from: '#ffffff', to: '#c9d1dc', radial: true },
            { stroke: OUTLINE },
          ),
        ),
      ];
    })(),
    120,
    80,
  ),
  item(
    'science.co2',
    'Carbon dioxide molecule',
    [
      'carbon dioxide',
      'co2',
      'molecule',
      'atoms',
      'bond',
      'double bond',
      'gas',
      'greenhouse',
      'oxygen',
      'carbon',
      ...CHEMISTRY,
    ],
    [
      ...[24, 36].flatMap((y, i) => [
        rect(`Left bond ${i + 1}`, 30, y - 2.5, 40, 5, '#d5dce4', { stroke: THIN }),
        rect(`Right bond ${i + 1}`, 70, y - 2.5, 40, 5, '#d5dce4', { stroke: THIN }),
      ]),
      circle(
        'Left oxygen atom',
        24,
        30,
        19,
        { from: '#ff8a80', to: '#d32f2f', radial: true },
        { stroke: OUTLINE },
      ),
      circle(
        'Carbon atom',
        70,
        30,
        16,
        { from: '#8a8f99', to: '#2d2f36', radial: true },
        { stroke: OUTLINE },
      ),
      circle(
        'Right oxygen atom',
        116,
        30,
        19,
        { from: '#ff8a80', to: '#d32f2f', radial: true },
        { stroke: OUTLINE },
      ),
    ],
    140,
    60,
  ),
  item(
    'science.element',
    'Periodic table tile',
    ['periodic table', 'element', 'carbon', 'atomic number', 'symbol', 'tile', ...CHEMISTRY],
    [
      rect(
        'Tile',
        4,
        4,
        82,
        92,
        { from: '#e6f4ea', to: '#b9e3c6', angle: 90 },
        { radius: 6, stroke: OUTLINE },
      ),
      line(
        'Atomic number',
        [...arc(19, 21, 8, 13, 290, 180, 8), ...arc(17, 24, 6, 6, 180, 540, 16)],
        INK,
        2.5,
      ),
      line('Symbol', arc(46, 52, 20, 22, 40, 320, 24), INK, 8),
      rect('Name line', 20, 78, 50, 5, DARK_STEEL, { radius: 2.5 }),
      rect('Mass line', 30, 87, 30, 4, STEEL, { radius: 2 }),
    ],
    90,
    100,
  ),
  item(
    'science.filtration',
    'Filtration',
    [
      'filtration',
      'filter',
      'filter paper',
      'funnel',
      'separating',
      'mixture',
      'residue',
      'filtrate',
      ...CHEMISTRY,
    ],
    [
      shape(
        'Flask',
        [
          [36, 64],
          [54, 64],
          [54, 76],
          [84, 106],
          [6, 106],
          [36, 76],
        ],
        GLASS,
        { stroke: OUTLINE },
      ),
      shape(
        'Filtrate',
        [
          [21, 91],
          [69, 91],
          [82, 104],
          [8, 104],
        ],
        '#9fd8ff',
      ),
      shape(
        'Funnel',
        [
          [10, 10],
          [80, 10],
          [49, 48],
          [49, 78],
          [41, 78],
          [41, 48],
        ],
        GLASS,
        { stroke: OUTLINE, opacity: 90 },
      ),
      shape(
        'Filter paper',
        [
          [16, 12],
          [74, 12],
          [45, 46],
        ],
        '#ffffff',
        { stroke: THIN },
      ),
      line(
        'Paper fold',
        [
          [45, 12],
          [45, 46],
        ],
        STEEL,
        1.5,
      ),
      shape(
        'Mixture',
        [
          [26, 24],
          [64, 24],
          [45, 44],
        ],
        '#a0673a',
        { opacity: 85 },
      ),
      flame('Drop', 45, 87, 81, 2.6, '#6ec6ff'),
    ],
    90,
    110,
  ),
  item(
    'science.evaporation',
    'Evaporating dish',
    [
      'evaporation',
      'evaporate',
      'evaporating dish',
      'crystallisation',
      'tripod',
      'gauze',
      'heat',
      'steam',
      ...CHEMISTRY,
    ],
    [
      ...[0, 1, 2].map((i) =>
        line(
          `Steam ${i + 1}`,
          Array.from({ length: 9 }, (_, k): Pt => [
            36 + i * 14 + 3 * Math.sin(k * 1.2),
            32 - k * 3.5,
          ]),
          STEEL,
          2.5,
        ),
      ),
      flame('Flame', 50, 82, 58, 7, { from: '#3b5bdb', to: '#9cc4ff', angle: 90 }),
      flame('Inner cone', 50, 81, 68, 3.5, '#a5f3ff'),
      rect('Burner base', 36, 100, 28, 7, SLATE, { radius: 2, stroke: THIN }),
      rect('Burner barrel', 45, 78, 10, 23, STEEL, { radius: 1, stroke: THIN }),
      rect('Burner collar', 43, 90, 14, 5, DARK_STEEL, { radius: 1 }),
      line(
        'Left leg',
        [
          [22, 52],
          [8, 106],
        ],
        DARK_STEEL,
        4,
      ),
      line(
        'Right leg',
        [
          [78, 52],
          [92, 106],
        ],
        DARK_STEEL,
        4,
      ),
      rect('Gauze', 12, 48, 76, 5, '#c6ccd6', { stroke: THIN }),
      ...[22, 32, 42, 52, 62, 72, 82].map((x, i) =>
        line(
          `Gauze wire ${i + 1}`,
          [
            [x, 48],
            [x, 53],
          ],
          DARK_STEEL,
          1,
        ),
      ),
      shape('Dish', arc(50, 36, 26, 12, 0, 180, 16), '#ffffff', { stroke: OUTLINE }),
      ellipse('Solution', 28, 33, 44, 7, '#9fd8ff', { stroke: THIN }),
    ],
    100,
    110,
  ),
];

export const SCIENCE: readonly LibraryItem[] = SCIENCE_ITEMS;

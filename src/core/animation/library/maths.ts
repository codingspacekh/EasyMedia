// AN19: maths clip-art (the library's Maths tab) — signs, graphs, 3D solids and geometry for
// explainer animations, drawn from the app's own shapes. Digits, letters and signs are drawn as
// thick lines, as there is no text part; every part is named so it can be animated on its own.
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
const BLUE = '#2f7fe0';
const RED = '#e84545';
const GREEN = '#5cbf60';
const GOLD = '#ffc83d';
const PURPLE = '#8a5cf6';
const ORANGE = '#ff9f43';
const TEAL = '#2bb5a8';
const STEEL = '#9aa4b2';
const WOOD = '#a0673a';
const GRID = '#cfe3f7';

type Pt = [number, number];

const item = (
  id: string,
  name: string,
  keywords: string[],
  parts: Part[],
  width = 100,
  height = 100,
): LibraryItem => ({ id, name, category: 'maths', keywords, width, height, parts });

const MATHS_WORDS = ['maths', 'math'];
const SOLID = [...MATHS_WORDS, '3d shape', 'solid', 'shape', 'geometry', 'volume', 'surface area'];

/** A bar `w` px wide from `a` to `b` (a straight leg, a pencil). */
function bar(a: Pt, b: Pt, w: number): Pt[] {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  const [nx, ny] = [((-dy / len) * w) / 2, ((dx / len) * w) / 2];
  return [
    [a[0] + nx, a[1] + ny],
    [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny],
    [a[0] - nx, a[1] - ny],
  ];
}

/** A dashed line (a hidden edge) from `a` to `b`, as short strokes in one group. */
function dashed(name: string, a: Pt, b: Pt, colour = INK, width = 2, dash = 5): Part {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(len / (2 * dash)));
  const at = (t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return group(
    name,
    Array.from({ length: n }, (_, i) =>
      line(
        `Dash ${i + 1}`,
        [at((2 * i) / (2 * n - 1)), at((2 * i + 1) / (2 * n - 1))],
        colour,
        width,
      ),
    ),
  );
}

/** A dashed curve through the points: every other step is drawn. */
function dashedCurve(name: string, pts: Pt[], colour = INK, width = 2): Part {
  const dashes: Part[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2)
    dashes.push(line(`Dash ${dashes.length + 1}`, [pts[i]!, pts[i + 1]!], colour, width));
  return group(name, dashes);
}

/** An arrowhead at `tip`, pointing away from `from`. */
function arrowhead(name: string, from: Pt, tip: Pt, size: number, fill: string): Part {
  const [dx, dy] = [tip[0] - from[0], tip[1] - from[1]];
  const len = Math.hypot(dx, dy);
  const [ux, uy] = [dx / len, dy / len];
  return shape(
    name,
    [
      tip,
      [tip[0] - ux * size - uy * size * 0.6, tip[1] - uy * size + ux * size * 0.6],
      [tip[0] - ux * size + uy * size * 0.6, tip[1] - uy * size - ux * size * 0.6],
    ],
    fill,
  );
}

/** A digit 0–9 written as one thick stroke in the box (x, y, w, h). */
function digit(
  name: string,
  d: number,
  x: number,
  y: number,
  w: number,
  h: number,
  colour = INK,
  width = 3,
): Part {
  const unit: Pt[] = (() => {
    switch (d) {
      case 0:
        return arc(0.5, 0.5, 0.5, 0.5, -90, 270, 28);
      case 1:
        return [
          [0.15, 0.25],
          [0.6, 0],
          [0.6, 1],
        ];
      case 2:
        return [...arc(0.5, 0.3, 0.45, 0.3, 195, 380, 14), [0.04, 1], [1, 1]];
      case 3:
        return [
          ...arc(0.48, 0.25, 0.42, 0.25, 200, 450, 14),
          ...arc(0.48, 0.73, 0.5, 0.27, -90, 160, 14),
        ];
      case 4:
        return [
          [0.72, 1],
          [0.72, 0],
          [0, 0.7],
          [1, 0.7],
        ];
      case 5:
        return [[0.92, 0], [0.18, 0], [0.1, 0.46], ...arc(0.48, 0.68, 0.48, 0.32, -145, 155, 16)];
      case 6:
        return [
          ...arc(0.62, 0.62, 0.6, 0.62, -80, -180, 10),
          ...arc(0.5, 0.7, 0.48, 0.3, 180, 540, 20),
        ];
      case 7:
        return [
          [0, 0],
          [1, 0],
          [0.35, 1],
        ];
      case 8:
        return [
          ...arc(0.5, 0.24, 0.4, 0.24, 90, 450, 20),
          ...arc(0.5, 0.74, 0.5, 0.26, -90, 270, 22),
        ];
      default:
        return [...arc(0.5, 0.3, 0.48, 0.3, 0, 360, 20), [0.95, 0.6], [0.8, 0.9], [0.5, 1]];
    }
  })();
  return line(
    name,
    unit.map(([u, v]) => [x + u * w, y + v * h]),
    colour,
    width,
  );
}

/** A lemniscate's loop (∞): t from `from`° to `to`°. */
const lemniscate = (cx: number, cy: number, a: number, from: number, to: number): Pt[] =>
  Array.from({ length: 33 }, (_, i) => {
    const t = ((from + ((to - from) * i) / 32) * Math.PI) / 180;
    const s = 1 + Math.sin(t) ** 2;
    return [cx + (a * Math.cos(t)) / s, cy + (a * Math.sin(t) * Math.cos(t)) / s];
  });

/** A box drawn with a light front face and darker top and side faces, hidden edges dashed. */
function box(
  front: readonly [x: number, y: number, w: number, h: number],
  depth: Pt,
  colours: readonly [front: string, top: string, side: string],
): Part[] {
  const [x, y, w, h] = front;
  const [dx, dy] = depth;
  const back: Pt = [x + dx, y + h + dy];
  return [
    shape(
      'Top face',
      [
        [x, y],
        [x + w, y],
        [x + w + dx, y + dy],
        [x + dx, y + dy],
      ],
      colours[1],
      { stroke: OUTLINE },
    ),
    shape(
      'Side face',
      [
        [x + w, y],
        [x + w + dx, y + dy],
        [x + w + dx, y + h + dy],
        [x + w, y + h],
      ],
      colours[2],
      { stroke: OUTLINE },
    ),
    rect('Front face', x, y, w, h, colours[0], { stroke: OUTLINE }),
    group('Hidden edges', [
      dashed('Hidden edge 1', back, [x, y + h], INK, 2, 4),
      dashed('Hidden edge 2', back, [x + w + dx, y + h + dy], INK, 2, 4),
      dashed('Hidden edge 3', back, [x + dx, y + dy], INK, 2, 4),
    ]),
  ];
}

const pythagoras = (): Part[] => {
  const s = 10;
  const C: Pt = [40, 76];
  const A: Pt = [C[0] + 4 * s, C[1]];
  const B: Pt = [C[0], C[1] - 3 * s];
  const out: Pt = [3 * s, -4 * s];
  const add = (p: Pt, q: Pt, k = 1): Pt => [p[0] + q[0] * k, p[1] + q[1] * k];
  /** Unit-square grid lines inside the square p0, p1, p2, p3 (n × n). */
  const grid = (name: string, p0: Pt, p1: Pt, p3: Pt, n: number): Part =>
    group(
      name,
      Array.from({ length: n - 1 }, (_, i) => {
        const t = (i + 1) / n;
        const across: Pt = [p1[0] - p0[0], p1[1] - p0[1]];
        const down: Pt = [p3[0] - p0[0], p3[1] - p0[1]];
        return [
          line(`Line ${2 * i + 1}`, [add(p0, across, t), add(p3, across, t)], '#ffffff', 1),
          line(`Line ${2 * i + 2}`, [add(p0, down, t), add(p1, down, t)], '#ffffff', 1),
        ];
      }).flat(),
    );
  const sqA: Pt[] = [B, C, add(C, [-3 * s, 0]), add(B, [-3 * s, 0])];
  const sqB: Pt[] = [C, A, add(A, [0, 4 * s]), add(C, [0, 4 * s])];
  const sqC: Pt[] = [B, add(B, out), add(A, out), A];
  return [
    shape('Square on side a', sqA, BLUE, { stroke: THIN }),
    grid('Grid on side a', sqA[0]!, sqA[3]!, sqA[1]!, 3),
    shape('Square on side b', sqB, GREEN, { stroke: THIN }),
    grid('Grid on side b', sqB[0]!, sqB[1]!, sqB[3]!, 4),
    shape('Square on hypotenuse c', sqC, RED, { stroke: THIN }),
    grid('Grid on hypotenuse c', sqC[0]!, sqC[1]!, sqC[3]!, 5),
    shape('Right-angled triangle', [C, A, B], GOLD, { stroke: OUTLINE }),
    line('Hypotenuse', [B, A], INK, 4),
    line(
      'Right angle',
      [
        [C[0], C[1] - 9],
        [C[0] + 9, C[1] - 9],
        [C[0] + 9, C[1]],
      ],
      INK,
      2,
    ),
  ];
};

export const MATHS: readonly LibraryItem[] = [
  // ---- signs ----
  item(
    'maths.pi',
    'Pi',
    [...MATHS_WORDS, 'pi', 'π', 'circle', 'circumference', 'symbol', 'greek'],
    [
      line(
        'Top bar',
        [
          [10, 34],
          [18, 26],
          [32, 23],
          [90, 22],
        ],
        BLUE,
        13,
      ),
      line(
        'Left leg',
        [
          [37, 25],
          [35, 52],
          [30, 72],
          [22, 86],
        ],
        BLUE,
        13,
      ),
      line(
        'Right leg',
        [
          [67, 25],
          [65, 56],
          [67, 74],
          [74, 84],
          [86, 82],
        ],
        BLUE,
        13,
      ),
    ],
  ),
  item(
    'maths.squareroot',
    'Square root',
    [...MATHS_WORDS, 'square root', 'root', 'surd', 'symbol', 'algebra'],
    [
      line(
        'Root sign',
        [
          [8, 60],
          [20, 53],
          [38, 90],
          [62, 10],
          [114, 10],
        ],
        GREEN,
        10,
      ),
      line(
        'Letter x stroke 1',
        [
          [72, 34],
          [104, 80],
        ],
        INK,
        8,
      ),
      line(
        'Letter x stroke 2',
        [
          [104, 34],
          [72, 80],
        ],
        INK,
        8,
      ),
    ],
    120,
    100,
  ),
  item(
    'maths.percent',
    'Percent',
    [...MATHS_WORDS, 'percent', 'percentage', '%', 'symbol', 'fraction'],
    [
      shape('Slash', bar([80, 10], [20, 90], 12), RED),
      ellipse('Top ring', 12, 10, 32, 32, null, { stroke: [RED, 9] }),
      ellipse('Bottom ring', 56, 58, 32, 32, null, { stroke: [RED, 9] }),
    ],
  ),
  item(
    'maths.infinity',
    'Infinity',
    [...MATHS_WORDS, 'infinity', 'infinite', '∞', 'forever', 'symbol', 'limit'],
    [
      line('Right loop', lemniscate(60, 35, 50, -90, 90), PURPLE, 12),
      line('Left loop', lemniscate(60, 35, 50, 90, 270), PURPLE, 12),
    ],
    120,
    70,
  ),
  item(
    'maths.lessthan',
    'Less than',
    [...MATHS_WORDS, 'less than', 'inequality', 'compare', 'smaller', 'symbol', 'sign'],
    [
      line(
        'Sign',
        [
          [78, 16],
          [22, 50],
          [78, 84],
        ],
        TEAL,
        16,
      ),
    ],
  ),
  item(
    'maths.greaterthan',
    'Greater than',
    [
      ...MATHS_WORDS,
      'greater than',
      'more than',
      'inequality',
      'compare',
      'bigger',
      'symbol',
      'sign',
    ],
    [
      line(
        'Sign',
        [
          [22, 16],
          [78, 50],
          [22, 84],
        ],
        ORANGE,
        16,
      ),
    ],
  ),

  // ---- number ----
  item(
    'maths.numberline',
    'Number line',
    [...MATHS_WORDS, 'number line', 'number', 'counting', 'add', 'jump', 'integer', 'scale'],
    (() => {
      const x0 = 18;
      const step = 24;
      const y = 40;
      const tick = (i: number) => x0 + i * step;
      return [
        line(
          'Line',
          [
            [6, y],
            [174, y],
          ],
          INK,
          3,
        ),
        arrowhead('Left arrow', [20, y], [2, y], 9, INK),
        arrowhead('Right arrow', [160, y], [178, y], 9, INK),
        ...Array.from({ length: 7 }, (_, i) =>
          line(
            `Tick ${i}`,
            [
              [tick(i), y - 6],
              [tick(i), y + 6],
            ],
            INK,
            3,
          ),
        ),
        ...Array.from({ length: 7 }, (_, i) =>
          digit(`Number ${i}`, i, tick(i) - 4, 52, 8, 13, INK, 2.5),
        ),
        line('Jump', arc(tick(3.5), y - 4, step * 1.5, 26, 180, 360, 20).slice(0, -1), RED, 3),
        arrowhead('Jump arrow', [tick(5) - 2, y - 16], [tick(5), y - 6], 8, RED),
        circle('Start point', tick(2), y, 5, BLUE, { stroke: THIN }),
      ];
    })(),
    180,
    70,
  ),
  item(
    'maths.fraction',
    'Fraction: one half',
    [...MATHS_WORDS, 'fraction', 'half', '½', 'one half', 'divide', 'share', 'part'],
    [
      shape('Shaded half', [[50, 50], ...arc(50, 50, 42, 42, 90, 270, 24)], BLUE, {
        stroke: OUTLINE,
      }),
      shape('Empty half', [[50, 50], ...arc(50, 50, 42, 42, -90, 90, 24)], '#ffffff', {
        stroke: OUTLINE,
      }),
      digit('Numerator 1', 1, 108, 12, 14, 28, INK, 5),
      line(
        'Fraction bar',
        [
          [102, 50],
          [134, 50],
        ],
        INK,
        5,
      ),
      digit('Denominator 2', 2, 106, 60, 22, 28, INK, 5),
    ],
    140,
    100,
  ),
  item(
    'maths.tally',
    'Tally marks',
    [
      ...MATHS_WORDS,
      'tally',
      'tally marks',
      'count',
      'counting',
      'data',
      'frequency',
      'statistics',
    ],
    [
      group('Gate of five', [
        ...[14, 30, 46, 62].map((x, i) =>
          line(
            `Mark ${i + 1}`,
            [
              [x, 18 + (i % 2) * 3],
              [x + 2, 82 - (i % 2) * 2],
            ],
            INK,
            7,
          ),
        ),
        line(
          'Mark 5',
          [
            [4, 70],
            [74, 30],
          ],
          RED,
          7,
        ),
      ]),
      line(
        'Mark 6',
        [
          [90, 20],
          [91, 82],
        ],
        INK,
        7,
      ),
      line(
        'Mark 7',
        [
          [106, 18],
          [108, 80],
        ],
        INK,
        7,
      ),
    ],
    120,
    100,
  ),
  item(
    'maths.abacus',
    'Abacus',
    [...MATHS_WORDS, 'abacus', 'counting', 'count', 'beads', 'place value', 'number'],
    [
      rect('Top bar', 4, 4, 112, 10, WOOD, { radius: 3, stroke: THIN }),
      rect('Bottom bar', 4, 96, 112, 10, WOOD, { radius: 3, stroke: THIN }),
      ...[RED, GOLD, GREEN, BLUE].map((colour, r) => {
        const y = 28 + r * 18;
        const left = [2, 4, 1, 3][r]!;
        return group(`Row ${r + 1}`, [
          line(
            'Wire',
            [
              [10, y],
              [110, y],
            ],
            STEEL,
            2,
          ),
          ...Array.from({ length: 6 }, (_, b) => {
            const x = b < left ? 14 + b * 12 : 107 - (6 - b) * 12;
            return ellipse(`Bead ${b + 1}`, x, y - 7, 11, 14, colour, { stroke: THIN });
          }),
        ]);
      }),
      rect('Left post', 4, 4, 8, 102, WOOD, { radius: 3, stroke: THIN }),
      rect('Right post', 108, 4, 8, 102, WOOD, { radius: 3, stroke: THIN }),
    ],
    120,
    110,
  ),
  item(
    'maths.dice',
    'Dice',
    [...MATHS_WORDS, 'dice', 'die', 'probability', 'chance', 'random', 'game', 'cube'],
    (() => {
      const pip = (name: string, cx: number, cy: number) => circle(name, cx, cy, 5, INK);
      return [
        shape(
          'Top face',
          [
            [8, 34],
            [68, 34],
            [92, 10],
            [32, 10],
          ],
          '#f1f1f4',
          { stroke: OUTLINE },
        ),
        shape(
          'Side face',
          [
            [68, 34],
            [92, 10],
            [92, 70],
            [68, 94],
          ],
          '#d5d6de',
          { stroke: OUTLINE },
        ),
        rect('Front face', 8, 34, 60, 60, '#ffffff', { stroke: OUTLINE }),
        group('Five on the front', [
          pip('Pip 1', 22, 48),
          pip('Pip 2', 54, 48),
          pip('Pip 3', 38, 64),
          pip('Pip 4', 22, 80),
          pip('Pip 5', 54, 80),
        ]),
        group('One on the top', [ellipse('Pip 1', 43, 19, 16, 6, RED)]),
        group('Two on the side', [
          shape('Pip 1', arc(75, 61, 3, 5, 0, 360, 12), INK),
          shape('Pip 2', arc(85, 43, 3, 5, 0, 360, 12), INK),
        ]),
      ];
    })(),
  ),

  // ---- graphs ----
  item(
    'maths.axes',
    'Coordinate axes',
    [
      ...MATHS_WORDS,
      'axes',
      'coordinates',
      'graph',
      'grid',
      'parabola',
      'quadratic',
      'curve',
      'x',
      'y',
    ],
    (() => {
      const [ox, oy, u] = [60, 72, 12];
      const curve: Pt[] = Array.from({ length: 25 }, (_, i) => {
        const x = -3.6 + (7.2 * i) / 24;
        return [ox + x * u, oy - (x * x - 4) * 0.5 * u * 1.0];
      });
      return [
        rect('Graph paper', 4, 4, 112, 112, '#ffffff', { stroke: [GRID, 2] }),
        group('Grid', [
          ...Array.from({ length: 9 }, (_, i) =>
            line(
              `Up line ${i + 1}`,
              [
                [12 + i * u, 6],
                [12 + i * u, 114],
              ],
              GRID,
              1.5,
            ),
          ),
          ...Array.from({ length: 9 }, (_, i) =>
            line(
              `Across line ${i + 1}`,
              [
                [6, 12 + i * u],
                [114, 12 + i * u],
              ],
              GRID,
              1.5,
            ),
          ),
        ]),
        line(
          'x-axis',
          [
            [8, oy],
            [108, oy],
          ],
          INK,
          3,
        ),
        arrowhead('x-axis arrow', [100, oy], [114, oy], 9, INK),
        line(
          'y-axis',
          [
            [ox, 114],
            [ox, 12],
          ],
          INK,
          3,
        ),
        arrowhead('y-axis arrow', [ox, 20], [ox, 6], 9, INK),
        group('Letter x', [
          line(
            'Stroke 1',
            [
              [102, 80],
              [110, 90],
            ],
            INK,
            2.5,
          ),
          line(
            'Stroke 2',
            [
              [110, 80],
              [102, 90],
            ],
            INK,
            2.5,
          ),
        ]),
        line(
          'Letter y',
          [
            [44, 8],
            [48, 15],
            [52, 8],
            [48, 15],
            [44, 22],
          ],
          INK,
          2.5,
        ),
        line('Parabola', curve, RED, 4),
      ];
    })(),
    120,
    120,
  ),
  item(
    'maths.sinewave',
    'Sine wave',
    [...MATHS_WORDS, 'sine', 'sine wave', 'wave', 'graph', 'trigonometry', 'curve', 'periodic'],
    (() => {
      const wave: Pt[] = Array.from({ length: 41 }, (_, i) => [
        12 + (i / 40) * 116,
        50 - 34 * Math.sin((i / 40) * 2 * Math.PI),
      ]);
      return [
        line(
          'x-axis',
          [
            [8, 50],
            [130, 50],
          ],
          INK,
          3,
        ),
        arrowhead('x-axis arrow', [126, 50], [136, 50], 8, INK),
        line(
          'y-axis',
          [
            [12, 94],
            [12, 10],
          ],
          INK,
          3,
        ),
        arrowhead('y-axis arrow', [12, 14], [12, 4], 8, INK),
        dashed('Peak line', [6, 16], [41, 16], STEEL, 2, 3),
        dashed('Trough line', [6, 84], [99, 84], STEEL, 2, 3),
        line('Wave', wave, RED, 4),
      ];
    })(),
    140,
    100,
  ),
  item(
    'maths.scattergraph',
    'Scatter graph',
    [
      ...MATHS_WORDS,
      'scatter graph',
      'scatter',
      'correlation',
      'graph',
      'data',
      'statistics',
      'line of best fit',
    ],
    (() => {
      const pts: Pt[] = [
        [22, 80],
        [30, 70],
        [38, 76],
        [46, 60],
        [56, 64],
        [62, 50],
        [72, 46],
        [80, 52],
        [88, 34],
        [98, 30],
        [106, 20],
      ];
      return [
        line(
          'Axes',
          [
            [10, 4],
            [10, 92],
            [116, 92],
          ],
          INK,
          4,
        ),
        line(
          'Line of best fit',
          [
            [16, 84],
            [112, 18],
          ],
          RED,
          3,
        ),
        group(
          'Points',
          pts.map(([x, y], i) => circle(`Point ${i + 1}`, x, y, 4.5, BLUE, { stroke: [INK, 1.5] })),
        ),
      ];
    })(),
    120,
    96,
  ),
  item(
    'maths.venn',
    'Venn diagram',
    [
      ...MATHS_WORDS,
      'venn',
      'venn diagram',
      'sets',
      'set',
      'probability',
      'overlap',
      'intersection',
      'union',
    ],
    [
      rect('Universal set', 3, 3, 134, 84, '#ffffff', { radius: 6, stroke: THIN }),
      circle('Set A', 52, 45, 33, BLUE, { stroke: THIN, opacity: 55 }),
      circle('Set B', 88, 45, 33, RED, { stroke: THIN, opacity: 55 }),
      group('Letter A', [
        line(
          'Sides',
          [
            [32, 54],
            [38, 36],
            [44, 54],
          ],
          INK,
          3,
        ),
        line(
          'Bar',
          [
            [34.5, 48],
            [41.5, 48],
          ],
          INK,
          3,
        ),
      ]),
      line(
        'Letter B',
        [
          [101, 54],
          [101, 36],
          [105, 36],
          ...arc(105, 40.5, 4.5, 4.5, -90, 90, 8),
          [101, 45],
          [106, 45],
          ...arc(106, 49.5, 4.5, 4.5, -90, 90, 8),
          [101, 54],
        ],
        INK,
        3,
      ),
    ],
    140,
    90,
  ),

  // ---- geometry ----
  item(
    'maths.compasses',
    'Compasses',
    [
      ...MATHS_WORDS,
      'compasses',
      'compass',
      'pair of compasses',
      'geometry',
      'circle',
      'arc',
      'construction',
      'stationery',
    ],
    (() => {
      const hinge: Pt = [50, 20];
      const needleEnd: Pt = [24, 80];
      const pencilEnd: Pt = [72, 70];
      const dir = (a: Pt, b: Pt): Pt => {
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
      };
      const [nx, ny] = dir(hinge, needleEnd);
      const [px, py] = dir(hinge, pencilEnd);
      const at = (p: Pt, d: Pt, k: number): Pt => [p[0] + d[0] * k, p[1] + d[1] * k];
      const pencilTop = at(pencilEnd, [px, py], -10);
      const pencilWood = at(pencilEnd, [px, py], 12);
      const pencilTip = at(pencilEnd, [px, py], 22);
      const side: Pt = [-py * 4.5, px * 4.5];
      return [
        rect('Handle', 45, 2, 10, 14, '#3d4452', { radius: 3 }),
        shape('Needle leg', bar(hinge, needleEnd, 10), STEEL, { stroke: THIN }),
        shape(
          'Needle',
          [
            [needleEnd[0] - 3.5, needleEnd[1] - 1],
            [needleEnd[0] + 3.5, needleEnd[1] + 1],
            at(needleEnd, [nx, ny], 16),
          ],
          INK,
        ),
        shape('Pencil leg', bar(hinge, pencilEnd, 10), STEEL, { stroke: THIN }),
        shape('Pencil', bar(pencilTop, pencilWood, 9), GOLD, { stroke: THIN }),
        shape(
          'Pencil point',
          [
            [pencilWood[0] + side[0], pencilWood[1] + side[1]],
            [pencilWood[0] - side[0], pencilWood[1] - side[1]],
            pencilTip,
          ],
          '#f2d1a0',
          { stroke: THIN },
        ),
        (() => {
          const [lx, ly] = at(pencilTip, [px, py], -5);
          const [sx, sy] = [side[0] * 0.45, side[1] * 0.45];
          return shape('Pencil lead', [[lx + sx, ly + sy], [lx - sx, ly - sy], pencilTip], INK);
        })(),
        shape('Clamp', bar(at(pencilEnd, [px, py], -6), at(pencilEnd, [px, py], 2), 16), BLUE, {
          stroke: THIN,
        }),
        circle('Hinge', hinge[0], hinge[1], 8, BLUE, { stroke: THIN }),
        circle('Hinge screw', hinge[0], hinge[1], 2.5, '#ffffff'),
      ];
    })(),
  ),
  item(
    'maths.pythagoras',
    "Pythagoras' theorem",
    [
      ...MATHS_WORDS,
      'pythagoras',
      'theorem',
      'right angle',
      'triangle',
      'hypotenuse',
      'geometry',
      'square',
      'trigonometry',
    ],
    pythagoras(),
    120,
    120,
  ),
  item(
    'maths.angle',
    'Angle',
    [...MATHS_WORDS, 'angle', 'degrees', 'theta', 'acute', 'geometry', 'turn', 'protractor'],
    (() => {
      const v: Pt = [12, 80];
      const a = (-39.5 * Math.PI) / 180;
      const end: Pt = [v[0] + 104 * Math.cos(a), v[1] + 104 * Math.sin(a)];
      return [
        shape('Angle', [v, ...arc(v[0], v[1], 34, 34, -39.5, 0, 12)], GOLD, { opacity: 70 }),
        line('Arc', arc(v[0], v[1], 34, 34, -39.5, 0, 12), INK, 2.5),
        line('Arm 1', [v, [112, 80]], INK, 4),
        line('Arm 2', [v, end], INK, 4),
        circle('Vertex', v[0], v[1], 4, INK),
        group('Theta', [
          ellipse('Loop', 58, 52, 11, 18, null, { stroke: [RED, 2.5] }),
          line(
            'Bar',
            [
              [58, 61],
              [69, 61],
            ],
            RED,
            2.5,
          ),
        ]),
      ];
    })(),
    120,
    90,
  ),
  item(
    'maths.shapes',
    '2D shapes',
    [
      ...MATHS_WORDS,
      '2d shapes',
      'shapes',
      'shape',
      'geometry',
      'circle',
      'square',
      'triangle',
      'hexagon',
      'polygon',
    ],
    [
      circle('Circle', 30, 30, 23, RED, { stroke: OUTLINE }),
      rect('Square', 68, 8, 44, 44, BLUE, { stroke: OUTLINE }),
      shape(
        'Triangle',
        [
          [30, 66],
          [54, 110],
          [6, 110],
        ],
        GREEN,
        { stroke: OUTLINE },
      ),
      polygon('Hexagon', 66, 64, 48, 50, 6, GOLD, { stroke: OUTLINE }),
    ],
    120,
    118,
  ),
  item(
    'maths.symmetry',
    'Line of symmetry',
    [
      ...MATHS_WORDS,
      'symmetry',
      'line of symmetry',
      'mirror',
      'reflection',
      'butterfly',
      'geometry',
    ],
    (() => {
      const wing: Pt[] = [
        [58, 40],
        [80, 12],
        [104, 8],
        [112, 22],
        [100, 44],
        [86, 52],
        [104, 62],
        [106, 82],
        [92, 92],
        [74, 84],
        [58, 62],
      ];
      const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [120 - x, y]);
      const spots: Pt[] = [
        [92, 28],
        [92, 74],
      ];
      return [
        shape('Left wing', mirror(wing), PURPLE, { stroke: OUTLINE }),
        shape('Right wing', wing, PURPLE, { stroke: OUTLINE }),
        ...spots.flatMap(([x, y], i) => [
          circle(`Left spot ${i + 1}`, 120 - x, y, 7, GOLD, { stroke: THIN }),
          circle(`Right spot ${i + 1}`, x, y, 7, GOLD, { stroke: THIN }),
        ]),
        ellipse('Body', 55, 30, 10, 60, INK),
        line(
          'Left feeler',
          [
            [58, 31],
            [52, 18],
            [46, 14],
          ],
          INK,
          2.5,
        ),
        line(
          'Right feeler',
          [
            [62, 31],
            [68, 18],
            [74, 14],
          ],
          INK,
          2.5,
        ),
        dashed('Mirror line', [60, 2], [60, 98], RED, 3, 4),
      ];
    })(),
    120,
    100,
  ),

  // ---- 3D shapes ----
  item(
    'maths.cube',
    'Cube',
    [...SOLID, 'cube', 'faces', 'edges', 'vertices'],
    box([8, 34, 58, 58], [26, -26], ['#9fcbff', '#d4e8ff', '#4f97e6']),
  ),
  item(
    'maths.cuboid',
    'Cuboid',
    [...SOLID, 'cuboid', 'box', 'rectangular prism', 'faces', 'edges', 'vertices'],
    box([8, 32, 82, 52], [32, -24], ['#c6b3fb', '#e6ddfd', '#8a5cf6']),
    130,
    90,
  ),
  item(
    'maths.cylinder',
    'Cylinder',
    [...SOLID, 'cylinder', 'circle', 'radius', 'prism', 'tube'],
    [
      shape(
        'Curved face',
        [[18, 18], ...arc(50, 84, 32, 10, 180, 0, 24), [82, 18]],
        {
          from: '#ffcf96',
          to: '#e07b1f',
          angle: 0,
        },
        { stroke: OUTLINE },
      ),
      dashedCurve('Hidden edge', arc(50, 84, 32, 10, 180, 360, 15)),
      ellipse('Top face', 18, 8, 64, 20, '#ffe2bd', { stroke: OUTLINE }),
      line(
        'Radius',
        [
          [50, 18],
          [82, 18],
        ],
        RED,
        2.5,
      ),
      circle('Centre', 50, 18, 2.5, RED),
    ],
  ),
  item(
    'maths.cone',
    'Cone',
    [...SOLID, 'cone', 'circle', 'apex', 'radius', 'slant height'],
    [
      shape(
        'Curved face',
        [[50, 6], ...arc(50, 84, 38, 11, 180, 0, 24)],
        {
          from: '#ffb3bd',
          to: '#d63a4f',
          angle: 0,
        },
        { stroke: OUTLINE },
      ),
      dashedCurve('Hidden edge', arc(50, 84, 38, 11, 180, 360, 15)),
      dashed('Height', [50, 8], [50, 84], INK, 2, 3),
      line(
        'Radius',
        [
          [50, 84],
          [88, 84],
        ],
        INK,
        2,
      ),
      line(
        'Right angle',
        [
          [50, 77],
          [57, 77],
          [57, 84],
        ],
        INK,
        1.5,
      ),
      circle('Apex', 50, 6, 3, INK),
    ],
  ),
  item(
    'maths.pyramid',
    'Pyramid',
    [...SOLID, 'pyramid', 'square-based pyramid', 'apex', 'faces', 'edges', 'vertices', 'egypt'],
    (() => {
      const apex: Pt = [50, 8];
      const fl: Pt = [10, 78];
      const fr: Pt = [62, 92];
      const br: Pt = [90, 70];
      const bl: Pt = [38, 58];
      return [
        shape('Front face', [apex, fl, fr], '#ffd96e', { stroke: OUTLINE }),
        shape('Side face', [apex, fr, br], '#e0a800', { stroke: OUTLINE }),
        group('Hidden edges', [
          dashed('Hidden edge 1', bl, apex, INK, 2, 4),
          dashed('Hidden edge 2', bl, fl, INK, 2, 4),
          dashed('Hidden edge 3', bl, br, INK, 2, 4),
        ]),
        circle('Apex', apex[0], apex[1], 3, INK),
      ];
    })(),
  ),
  item(
    'maths.sphere',
    'Sphere',
    [...SOLID, 'sphere', 'ball', 'globe', 'round', 'radius'],
    [
      circle(
        'Sphere',
        50,
        50,
        44,
        { from: '#c8f5c0', to: '#2f8a3a', angle: 50 },
        { stroke: OUTLINE },
      ),
      dashedCurve('Back of equator', arc(50, 50, 44, 12, 180, 360, 17)),
      line('Equator', arc(50, 50, 44, 12, 0, 180, 24), INK, 2),
      line(
        'Radius',
        [
          [50, 50],
          [94, 50],
        ],
        RED,
        2.5,
      ),
      circle('Centre', 50, 50, 2.5, RED),
      ellipse('Shine', 26, 18, 22, 14, '#ffffff', { opacity: 55 }),
    ],
  ),
];

// AN19: school and science clip-art for lessons and explainer animations — books and classroom
// things, science equipment, maths signs and charts, drawn from the app's own shapes. Each part
// is named, so a part can be animated on its own (a clock's hands, a traffic light's lamps).
import {
  arc,
  circle,
  ellipse,
  line,
  rect,
  shape,
  star,
  turnedRect,
  type Category,
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
const DARK_GOLD = '#e0a800';
const WOOD = '#a0673a';
const GLASS = '#e8f4ff';
const STEEL = '#9aa4b2';
const SLATE = '#3d4452';

type Pt = [number, number];

const item = (
  id: string,
  name: string,
  keywords: string[],
  parts: Part[],
  width = 100,
  height = 100,
): LibraryItem => ({ id, name, category: 'school', keywords, width, height, parts });

/** A leaf (a lens shape) from `a` to `b`, `bulge` px wide on each side. */
function leaf(name: string, a: Pt, b: Pt, bulge: number, fill: string): Part {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  const [nx, ny] = [-dy / len, dx / len];
  const side = (sign: number): Pt[] =>
    Array.from({ length: 11 }, (_, i) => {
      const t = i / 10;
      const w = sign * bulge * Math.sin(Math.PI * t);
      return [a[0] + dx * t + nx * w, a[1] + dy * t + ny * w];
    });
  return shape(name, [...side(1), ...side(-1).reverse().slice(1, -1)], fill, { stroke: THIN });
}

/** An ellipse's outline turned by `deg` about (cx, cy). */
function orbit(cx: number, cy: number, rx: number, ry: number, deg: number): Pt[] {
  const a = (deg * Math.PI) / 180;
  return arc(0, 0, rx, ry, 0, 360, 40)
    .slice(0, -1)
    .map(([x, y]) => [
      cx + x * Math.cos(a) - y * Math.sin(a),
      cy + x * Math.sin(a) + y * Math.cos(a),
    ]);
}

/** A wedge of a pie from `from`° to `to`°. */
const wedge = (name: string, from: number, to: number, fill: string): Part =>
  shape(name, [[50, 50], ...arc(50, 50, 46, 46, from, to, 24)], fill, {
    stroke: ['#ffffff', 2],
  });

const SIGN = { maths: ['maths', 'math', 'sign', 'symbol', 'number', 'sum'] };

const ALL: readonly LibraryItem[] = [
  // ---- the classroom ----
  item(
    'school.book',
    'Book',
    ['book', 'read', 'reading', 'study', 'library', 'lesson'],
    [
      rect('Pages', 16, 12, 74, 82, '#ffffff', { radius: 3, stroke: THIN }),
      rect('Cover', 10, 6, 72, 86, BLUE, { radius: 4, stroke: OUTLINE }),
      rect('Spine', 10, 6, 12, 86, '#1f5fb0', { radius: 4 }),
      rect('Label', 34, 24, 36, 16, '#ffffff', { radius: 3 }),
    ],
  ),
  item(
    'school.openbook',
    'Open book',
    ['book', 'read', 'reading', 'study', 'story', 'lesson'],
    [
      shape(
        'Cover',
        [
          [70, 20],
          [2, 16],
          [2, 88],
          [70, 90],
          [138, 88],
          [138, 16],
        ],
        '#c0392b',
        { stroke: THIN },
      ),
      shape(
        'Left page',
        [
          [70, 14],
          [40, 4],
          [8, 10],
          [8, 80],
          [40, 74],
          [70, 84],
        ],
        '#ffffff',
        { stroke: THIN },
      ),
      shape(
        'Right page',
        [
          [70, 14],
          [100, 4],
          [132, 10],
          [132, 80],
          [100, 74],
          [70, 84],
        ],
        '#ffffff',
        { stroke: THIN },
      ),
      ...[28, 42, 56].flatMap((y, i) => [
        line(
          `Left line ${i + 1}`,
          [
            [18, y - 4],
            [60, y + 4],
          ],
          STEEL,
          3,
        ),
        line(
          `Right line ${i + 1}`,
          [
            [80, y + 4],
            [122, y - 4],
          ],
          STEEL,
          3,
        ),
      ]),
    ],
    140,
    92,
  ),
  item(
    'school.pencil',
    'Pencil',
    ['pencil', 'write', 'writing', 'draw', 'stationery', 'edit'],
    [
      rect('Eraser', 2, 8, 16, 24, '#f28ca0', { radius: 5, stroke: THIN }),
      rect('Ferrule', 14, 8, 12, 24, '#b8c0cc', { stroke: THIN }),
      rect('Body', 26, 8, 84, 24, GOLD, { stroke: THIN }),
      shape(
        'Wood',
        [
          [110, 8],
          [134, 20],
          [110, 32],
        ],
        '#f2d1a0',
        { stroke: THIN },
      ),
      shape(
        'Lead',
        [
          [126, 16],
          [136, 20],
          [126, 24],
        ],
        INK,
      ),
    ],
    140,
    40,
  ),
  item(
    'school.ruler',
    'Ruler',
    ['ruler', 'measure', 'length', 'maths', 'stationery', 'scale'],
    [
      rect('Ruler', 2, 4, 156, 32, '#ffd84a', { radius: 3, stroke: OUTLINE }),
      ...Array.from({ length: 18 }, (_, i) =>
        line(
          `Mark ${i + 1}`,
          [
            [12 + i * 8, 4],
            [12 + i * 8, i % 5 === 0 ? 22 : 14],
          ],
          INK,
          2,
        ),
      ),
    ],
    160,
    40,
  ),
  item(
    'school.calculator',
    'Calculator',
    ['calculator', 'maths', 'math', 'sum', 'numbers', 'calculate'],
    [
      rect('Case', 2, 2, 76, 96, SLATE, { radius: 8, stroke: OUTLINE }),
      rect('Screen', 10, 10, 60, 20, '#bfe3c0', { radius: 3 }),
      ...Array.from({ length: 16 }, (_, n) =>
        rect(
          `Key ${n + 1}`,
          10 + (n % 4) * 16,
          38 + Math.floor(n / 4) * 15,
          12,
          11,
          n % 4 === 3 ? '#ff9f43' : '#e9edf2',
          { radius: 2 },
        ),
      ),
    ],
    80,
    100,
  ),
  item(
    'school.gradcap',
    'Graduation cap',
    ['graduation', 'graduate', 'cap', 'school', 'university', 'exam', 'success'],
    [
      rect('Cap', 30, 32, 60, 30, '#3a3f4b', { radius: 6, stroke: THIN }),
      shape(
        'Board',
        [
          [60, 4],
          [116, 26],
          [60, 48],
          [4, 26],
        ],
        INK,
      ),
      line(
        'Tassel cord',
        [
          [60, 26],
          [104, 40],
          [104, 70],
        ],
        GOLD,
        3,
      ),
      rect('Tassel', 99, 68, 10, 18, GOLD, { radius: 3 }),
      circle('Button', 60, 26, 4, GOLD),
    ],
    120,
    90,
  ),
  item(
    'school.bag',
    'School bag',
    ['bag', 'backpack', 'school', 'student', 'rucksack'],
    [
      line('Handle', arc(50, 24, 18, 16, 180, 360), INK, 6),
      rect('Bag', 14, 22, 72, 76, '#e8503a', { radius: 16, stroke: OUTLINE }),
      rect('Pocket', 26, 58, 48, 32, '#c43c2a', { radius: 8, stroke: THIN }),
      rect('Buckle', 44, 52, 12, 12, GOLD, { radius: 2, stroke: THIN }),
    ],
  ),
  item(
    'school.board',
    'Chalkboard',
    ['chalkboard', 'blackboard', 'board', 'classroom', 'teacher', 'lesson'],
    [
      rect('Frame', 2, 2, 156, 96, WOOD, { radius: 4, stroke: OUTLINE }),
      rect('Board', 10, 10, 140, 80, '#2f5d46'),
      line(
        'Chalk line 1',
        [
          [24, 30],
          [92, 30],
        ],
        '#ffffff',
        3,
      ),
      line(
        'Chalk line 2',
        [
          [24, 48],
          [124, 48],
        ],
        '#ffffff',
        3,
      ),
      line(
        'Chalk line 3',
        [
          [24, 66],
          [72, 66],
        ],
        '#ffffff',
        3,
      ),
      rect('Ledge', 6, 96, 148, 10, '#8a552e', { radius: 2 }),
      rect('Chalk', 112, 90, 22, 6, '#ffffff', { radius: 2 }),
    ],
    160,
    108,
  ),
  item(
    'school.apple',
    'Apple',
    ['apple', 'fruit', 'teacher', 'food', 'healthy'],
    [
      line(
        'Stem',
        [
          [50, 32],
          [54, 12],
        ],
        '#7a4e2d',
        5,
      ),
      leaf('Leaf', [54, 20], [80, 8], 7, GREEN),
      circle('Left half', 38, 58, 30, RED, { stroke: THIN }),
      circle('Right half', 62, 58, 30, RED),
      ellipse('Shine', 22, 44, 10, 16, '#ff8a8a'),
    ],
  ),
  item(
    'school.clock',
    'Alarm clock',
    ['clock', 'time', 'alarm', 'hour', 'minute', 'morning'],
    [
      circle('Left bell', 22, 18, 14, RED, { stroke: THIN }),
      circle('Right bell', 78, 18, 14, RED, { stroke: THIN }),
      circle('Case', 50, 56, 42, RED, { stroke: OUTLINE }),
      circle('Face', 50, 56, 34, '#ffffff'),
      ...[0, 90, 180, 270].map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        return circle(
          `Mark ${[3, 6, 9, 12][i]}`,
          50 + 28 * Math.cos(a),
          56 + 28 * Math.sin(a),
          3,
          INK,
        );
      }),
      line(
        'Hour hand',
        [
          [50, 56],
          [50, 36],
        ],
        INK,
        5,
      ),
      line(
        'Minute hand',
        [
          [50, 56],
          [72, 64],
        ],
        INK,
        4,
      ),
      circle('Centre', 50, 56, 4, INK),
    ],
  ),
  item(
    'school.stopwatch',
    'Stopwatch',
    ['stopwatch', 'timer', 'time', 'race', 'sport', 'seconds'],
    [
      rect('Button', 42, 2, 16, 10, STEEL, { radius: 2, stroke: THIN }),
      rect('Crown', 46, 10, 8, 10, STEEL),
      circle('Case', 50, 58, 40, SLATE, { stroke: OUTLINE }),
      circle('Face', 50, 58, 32, '#ffffff'),
      line(
        'Hand',
        [
          [50, 58],
          [66, 36],
        ],
        RED,
        4,
      ),
      circle('Centre', 50, 58, 4, INK),
    ],
  ),
  item(
    'school.hourglass',
    'Hourglass',
    ['hourglass', 'sand timer', 'time', 'wait', 'timer'],
    [
      shape(
        'Glass',
        [
          [14, 12],
          [66, 12],
          [44, 50],
          [66, 88],
          [14, 88],
          [36, 50],
        ],
        GLASS,
        { stroke: THIN },
      ),
      shape(
        'Top sand',
        [
          [22, 22],
          [58, 22],
          [42, 46],
          [38, 46],
        ],
        '#f0c060',
      ),
      line(
        'Falling sand',
        [
          [40, 46],
          [40, 76],
        ],
        '#f0c060',
        2,
      ),
      shape(
        'Bottom sand',
        [
          [40, 62],
          [60, 86],
          [20, 86],
        ],
        '#f0c060',
      ),
      rect('Top', 6, 2, 68, 10, WOOD, { radius: 3, stroke: THIN }),
      rect('Bottom', 6, 88, 68, 10, WOOD, { radius: 3, stroke: THIN }),
    ],
    80,
    100,
  ),
  item(
    'school.trophy',
    'Trophy',
    ['trophy', 'cup', 'award', 'winner', 'prize', 'success'],
    [
      line('Left handle', arc(24, 32, 16, 16, 90, 270), DARK_GOLD, 6),
      line('Right handle', arc(76, 32, 16, 16, -90, 90), DARK_GOLD, 6),
      rect('Stem', 44, 68, 12, 18, DARK_GOLD),
      shape('Cup', [[22, 8], [78, 8], ...arc(50, 40, 28, 32, 0, 180)], GOLD, { stroke: THIN }),
      star('Trophy star', 40, 20, 20, 20, '#fff4c2'),
      rect('Base', 26, 84, 48, 14, '#7a4e2d', { radius: 3, stroke: THIN }),
    ],
  ),
  item(
    'school.medal',
    'Medal',
    ['medal', 'award', 'winner', 'prize', 'first', 'success'],
    [
      shape(
        'Left ribbon',
        [
          [14, 2],
          [34, 2],
          [48, 50],
          [30, 50],
        ],
        BLUE,
      ),
      shape(
        'Right ribbon',
        [
          [66, 2],
          [46, 2],
          [32, 50],
          [50, 50],
        ],
        RED,
      ),
      circle('Medal', 40, 68, 28, GOLD, { stroke: THIN }),
      star('Medal star', 26, 54, 28, 28, DARK_GOLD),
    ],
    80,
    100,
  ),

  // ---- science ----
  item(
    'school.globe',
    'Globe',
    ['globe', 'earth', 'world', 'geography', 'planet', 'map'],
    [
      line('Stand arm', arc(50, 44, 44, 44, 100, 260), STEEL, 4),
      rect('Pole', 47, 80, 6, 12, STEEL),
      rect('Stand', 26, 90, 48, 8, '#7a4e2d', { radius: 3 }),
      circle('Ocean', 50, 44, 38, '#4aa3df', { stroke: OUTLINE }),
      shape(
        'Land 1',
        [
          [30, 20],
          [46, 14],
          [52, 26],
          [44, 40],
          [48, 54],
          [38, 62],
          [28, 48],
          [22, 32],
        ],
        GREEN,
      ),
      shape(
        'Land 2',
        [
          [60, 30],
          [74, 24],
          [82, 38],
          [76, 56],
          [64, 66],
          [58, 52],
          [64, 42],
        ],
        GREEN,
      ),
    ],
  ),
  item(
    'school.atom',
    'Atom',
    ['atom', 'science', 'physics', 'chemistry', 'electron', 'nucleus'],
    [
      ...[0, 60, 120].map((deg, i) =>
        shape(`Orbit ${i + 1}`, orbit(50, 50, 44, 15, deg), null, { stroke: [BLUE, 3] }),
      ),
      circle('Nucleus', 50, 50, 9, RED, { stroke: THIN }),
      ...[0, 60, 120].map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        return circle(`Electron ${i + 1}`, 50 + 44 * Math.cos(a), 50 + 44 * Math.sin(a), 5, GOLD, {
          stroke: THIN,
        });
      }),
    ],
  ),
  item(
    'school.flask',
    'Flask',
    ['flask', 'science', 'chemistry', 'experiment', 'laboratory', 'lab'],
    [
      shape(
        'Glass',
        [
          [40, 6],
          [60, 6],
          [60, 36],
          [90, 92],
          [10, 92],
          [40, 36],
        ],
        GLASS,
        { stroke: OUTLINE },
      ),
      shape(
        'Liquid',
        [
          [27, 60],
          [73, 60],
          [88, 90],
          [12, 90],
        ],
        '#7bd389',
      ),
      circle('Bubble 1', 44, 76, 4, '#ffffff'),
      circle('Bubble 2', 58, 68, 3, '#ffffff'),
      rect('Rim', 36, 2, 28, 6, '#b8c0cc', { radius: 2, stroke: THIN }),
    ],
  ),
  item(
    'school.beaker',
    'Beaker',
    ['beaker', 'science', 'chemistry', 'experiment', 'laboratory', 'lab', 'measure'],
    [
      shape(
        'Glass',
        [
          [8, 4],
          [84, 4],
          [84, 92],
          [16, 92],
          [16, 14],
        ],
        GLASS,
        { stroke: OUTLINE },
      ),
      rect('Liquid', 18, 44, 64, 46, '#6ec6ff'),
      ...[24, 40, 56, 72].map((y, i) =>
        line(
          `Mark ${i + 1}`,
          [
            [62, y],
            [82, y],
          ],
          INK,
          2,
        ),
      ),
    ],
    92,
    96,
  ),
  item(
    'school.testtubes',
    'Test tubes',
    ['test tube', 'science', 'chemistry', 'experiment', 'laboratory', 'lab'],
    [
      rect('Left leg', 8, 60, 8, 38, WOOD),
      rect('Right leg', 104, 60, 8, 38, WOOD),
      rect('Base', 4, 88, 112, 10, WOOD, { radius: 2, stroke: THIN }),
      ...[RED, '#7bd389', '#6ec6ff'].flatMap((colour, i) => [
        rect(`Tube ${i + 1}`, 22 + i * 30, 4, 20, 80, GLASS, { radius: 10, stroke: THIN }),
        rect(`Liquid ${i + 1}`, 24 + i * 30, 40 - i * 10, 16, 42 + i * 10, colour, { radius: 8 }),
      ]),
      rect('Rack', 4, 58, 112, 12, WOOD, { radius: 2, stroke: THIN }),
    ],
    120,
    100,
  ),
  item(
    'school.microscope',
    'Microscope',
    ['microscope', 'science', 'biology', 'cells', 'laboratory', 'lab'],
    [
      rect('Arm', 60, 26, 14, 62, SLATE, { radius: 6 }),
      shape('Tube', turnedRect(42, 34, 18, 50, -30), STEEL, { stroke: THIN }),
      shape('Eyepiece', turnedRect(29.5, 12.4, 22, 8, -30), INK),
      shape('Lens', turnedRect(54.5, 57, 10, 8, -30), INK),
      rect('Stage', 30, 64, 46, 6, SLATE, { radius: 2 }),
      circle('Mirror', 48, 78, 6, '#b8c0cc', { stroke: THIN }),
      rect('Base', 16, 86, 70, 12, INK, { radius: 4 }),
    ],
  ),
  item(
    'school.magnet',
    'Magnet',
    ['magnet', 'science', 'physics', 'magnetism', 'force', 'attract'],
    [
      shape(
        'Magnet',
        [
          [8, 96],
          ...arc(50, 46, 42, 42, 180, 360, 24),
          [92, 96],
          [70, 96],
          ...arc(50, 46, 20, 20, 360, 180, 16),
          [30, 96],
        ],
        RED,
        { stroke: THIN },
      ),
      rect('North pole', 8, 78, 22, 18, '#d5dce4', { stroke: THIN }),
      rect('South pole', 70, 78, 22, 18, '#d5dce4', { stroke: THIN }),
    ],
  ),
  item(
    'school.battery',
    'Battery',
    ['battery', 'electricity', 'power', 'energy', 'charge', 'physics', 'science'],
    [
      rect('Case', 2, 6, 104, 48, SLATE, { radius: 6, stroke: OUTLINE }),
      rect('Charge', 8, 12, 70, 36, GREEN, { radius: 3 }),
      rect('Terminal', 106, 20, 12, 20, STEEL, { radius: 2, stroke: THIN }),
      rect('Plus across', 84, 28, 14, 4, '#ffffff'),
      rect('Plus down', 89, 23, 4, 14, '#ffffff'),
    ],
    120,
    60,
  ),
  item(
    'school.thermometer',
    'Thermometer',
    ['thermometer', 'temperature', 'heat', 'weather', 'science', 'hot', 'cold'],
    [
      rect('Tube', 16, 2, 18, 76, '#ffffff', { radius: 9, stroke: OUTLINE }),
      rect('Liquid', 21, 30, 8, 52, RED),
      circle('Bulb', 25, 82, 14, RED, { stroke: OUTLINE }),
      ...[14, 26, 38, 50, 62].map((y, i) =>
        line(
          `Mark ${i + 1}`,
          [
            [36, y],
            [44, y],
          ],
          INK,
          2,
        ),
      ),
    ],
    50,
    100,
  ),
  item(
    'school.planet',
    'Planet',
    ['planet', 'saturn', 'space', 'solar system', 'science', 'astronomy'],
    [
      line('Back of ring', arc(60, 44, 56, 16, 180, 360, 24), DARK_GOLD, 5),
      circle('Planet', 60, 40, 30, '#f0a050', { stroke: THIN }),
      ellipse('Stripe', 34, 30, 52, 8, '#d9822b'),
      line('Front of ring', arc(60, 44, 56, 16, 0, 180, 24), GOLD, 5),
    ],
    120,
    80,
  ),
  item(
    'school.moon',
    'Moon',
    ['moon', 'night', 'space', 'crescent', 'astronomy', 'science'],
    [
      shape(
        'Moon',
        [...arc(50, 50, 44, 44, 70, 290, 24), ...arc(65, 50, 22, 41.3, 270, 90, 16).slice(1, -1)],
        '#ffe066',
        { stroke: THIN },
      ),
      circle('Crater 1', 20, 50, 4, '#f0c94a'),
      circle('Crater 2', 30, 28, 3, '#f0c94a'),
      circle('Crater 3', 32, 74, 3, '#f0c94a'),
    ],
  ),
  item(
    'school.seedling',
    'Seedling',
    ['plant', 'seedling', 'grow', 'growth', 'biology', 'nature', 'science'],
    [
      line(
        'Stem',
        [
          [50, 58],
          [50, 30],
        ],
        '#3c9a40',
        5,
      ),
      leaf('Left leaf', [50, 34], [14, 18], 9, GREEN),
      leaf('Right leaf', [50, 28], [86, 10], 9, GREEN),
      shape(
        'Pot',
        [
          [22, 62],
          [78, 62],
          [70, 98],
          [30, 98],
        ],
        '#c0673a',
        { stroke: THIN },
      ),
      rect('Rim', 18, 56, 64, 10, '#d9824f', { radius: 3, stroke: THIN }),
    ],
  ),
  item(
    'school.dna',
    'DNA',
    ['dna', 'biology', 'science', 'genes', 'cells', 'helix'],
    (() => {
      const x = (y: number, phase: number) => 30 + 20 * Math.sin((y / 46) * 2 * Math.PI + phase);
      const strand = (phase: number): Pt[] =>
        Array.from({ length: 31 }, (_, i) => {
          const y = 4 + i * (92 / 30);
          return [x(y, phase), y];
        });
      const rungs = Array.from({ length: 11 }, (_, i) => {
        const y = 10 + i * 8;
        return line(
          `Rung ${i + 1}`,
          [
            [x(y, 0), y],
            [x(y, Math.PI), y],
          ],
          [RED, GOLD, GREEN, BLUE][i % 4]!,
          3,
        );
      });
      return [
        ...rungs,
        line('Strand 1', strand(0), BLUE, 5),
        line('Strand 2', strand(Math.PI), '#8a5cf6', 5),
      ];
    })(),
    60,
    100,
  ),

  // ---- maths ----
  item(
    'school.plus',
    'Plus',
    [...SIGN.maths, 'plus', 'add', 'addition'],
    [
      rect('Across', 6, 38, 88, 24, BLUE, { radius: 6 }),
      rect('Down', 38, 6, 24, 88, BLUE, { radius: 6 }),
    ],
  ),
  item(
    'school.minus',
    'Minus',
    [...SIGN.maths, 'minus', 'subtract', 'take away'],
    [rect('Bar', 6, 38, 88, 24, RED, { radius: 6 })],
  ),
  item(
    'school.times',
    'Times',
    [...SIGN.maths, 'times', 'multiply', 'multiplication'],
    [
      shape('Stroke 1', turnedRect(50, 50, 22, 100, 45), '#8a5cf6'),
      shape('Stroke 2', turnedRect(50, 50, 22, 100, -45), '#8a5cf6'),
    ],
  ),
  item(
    'school.divide',
    'Divide',
    [...SIGN.maths, 'divide', 'division', 'share'],
    [
      circle('Top dot', 50, 18, 12, '#ff9f43'),
      rect('Bar', 6, 40, 88, 20, '#ff9f43', { radius: 6 }),
      circle('Bottom dot', 50, 82, 12, '#ff9f43'),
    ],
  ),
  item(
    'school.equals',
    'Equals',
    [...SIGN.maths, 'equals', 'answer', 'same'],
    [
      rect('Top bar', 6, 24, 88, 20, GREEN, { radius: 6 }),
      rect('Bottom bar', 6, 56, 88, 20, GREEN, { radius: 6 }),
    ],
  ),
  item(
    'school.barchart',
    'Bar chart',
    ['bar chart', 'chart', 'graph', 'data', 'statistics', 'maths', 'results'],
    [
      rect('Bar 1', 22, 52, 18, 40, BLUE),
      rect('Bar 2', 48, 30, 18, 62, '#e8503a'),
      rect('Bar 3', 74, 62, 18, 30, GOLD),
      rect('Bar 4', 98, 16, 18, 76, GREEN),
      line(
        'Axes',
        [
          [10, 4],
          [10, 92],
          [118, 92],
        ],
        INK,
        4,
      ),
    ],
    120,
    96,
  ),
  item(
    'school.piechart',
    'Pie chart',
    ['pie chart', 'chart', 'graph', 'data', 'statistics', 'maths', 'fraction', 'percentage'],
    [
      wedge('Slice 1', -90, 40, BLUE),
      wedge('Slice 2', 40, 140, '#e8503a'),
      wedge('Slice 3', 140, 210, GOLD),
      wedge('Slice 4', 210, 270, GREEN),
    ],
  ),
  item(
    'school.linegraph',
    'Line graph',
    ['line graph', 'chart', 'graph', 'data', 'statistics', 'maths', 'trend'],
    (() => {
      const pts: Pt[] = [
        [20, 78],
        [42, 58],
        [64, 66],
        [86, 34],
        [108, 18],
      ];
      return [
        line(
          'Axes',
          [
            [10, 4],
            [10, 92],
            [118, 92],
          ],
          INK,
          4,
        ),
        line('Line', pts, '#e8503a', 4),
        ...pts.map(([x, y], i) =>
          circle(`Point ${i + 1}`, x, y, 5, '#ffffff', { stroke: ['#e8503a', 3] }),
        ),
      ];
    })(),
    120,
    96,
  ),
  item(
    'school.setsquare',
    'Set square',
    ['set square', 'triangle', 'geometry', 'maths', 'angle', 'stationery'],
    [
      shape(
        'Set square',
        [
          [4, 4],
          [96, 96],
          [4, 96],
        ],
        '#7fd0ff',
        { stroke: OUTLINE, opacity: 85 },
      ),
      shape(
        'Hole',
        [
          [20, 44],
          [58, 82],
          [20, 82],
        ],
        '#e6f6ff',
        { stroke: THIN },
      ),
    ],
  ),
  item(
    'school.protractor',
    'Protractor',
    ['protractor', 'angle', 'degrees', 'geometry', 'maths', 'measure'],
    [
      shape('Protractor', arc(60, 64, 56, 56, 180, 360, 32), '#9fd9ff', {
        stroke: OUTLINE,
        opacity: 85,
      }),
      line('Inner edge', arc(60, 64, 20, 20, 180, 360, 16), INK, 2),
      ...Array.from({ length: 11 }, (_, i) => {
        const a = ((195 + i * 15) * Math.PI) / 180;
        return line(
          `Mark ${i + 1}`,
          [
            [60 + 44 * Math.cos(a), 64 + 44 * Math.sin(a)],
            [60 + 54 * Math.cos(a), 64 + 54 * Math.sin(a)],
          ],
          INK,
          2,
        );
      }),
    ],
    120,
    68,
  ),

  // ---- signs for explaining ----
  item(
    'school.trafficlight',
    'Traffic light',
    ['traffic light', 'traffic', 'signal', 'road', 'sequence', 'stop', 'go'],
    [
      rect('Pole', 26, 96, 8, 22, SLATE),
      rect('Case', 6, 2, 48, 96, INK, { radius: 10 }),
      circle('Red light', 30, 20, 12, RED),
      circle('Amber light', 30, 50, 12, '#ffb400'),
      circle('Green light', 30, 80, 12, GREEN),
    ],
    60,
    120,
  ),
  item(
    'school.question',
    'Question mark',
    ['question', 'ask', 'quiz', 'help', 'why', 'sign'],
    [
      line('Hook', [...arc(35, 30, 22, 22, 190, 405, 20), [36, 60], [36, 70]], BLUE, 12),
      circle('Dot', 36, 88, 8, BLUE),
    ],
    70,
    100,
  ),
  item(
    'school.exclamation',
    'Exclamation mark',
    ['exclamation', 'important', 'attention', 'warning', 'sign'],
    [
      shape(
        'Bar',
        [
          [8, 4],
          [32, 4],
          [26, 66],
          [14, 66],
        ],
        RED,
      ),
      circle('Dot', 20, 86, 10, RED),
    ],
    40,
    100,
  ),
  item(
    'school.magnifier',
    'Magnifying glass',
    ['magnifying glass', 'search', 'find', 'look', 'zoom', 'investigate', 'science'],
    [
      shape('Handle', turnedRect(76, 76, 14, 40, -45), '#7a4e2d', { stroke: THIN }),
      circle('Glass', 40, 40, 30, '#dff1ff', { stroke: [INK, 6] }),
      line('Shine', arc(40, 40, 20, 20, 200, 250, 8), '#ffffff', 4),
    ],
  ),
];

/** Items drawn here that belong on another tab of the library (their ids stay as they are). */
const TAB: Readonly<Record<string, Category>> = {
  ...Object.fromEntries(
    ['plus', 'minus', 'times', 'divide', 'equals', 'barchart', 'piechart', 'linegraph']
      .concat(['setsquare', 'protractor', 'calculator', 'ruler'])
      .map((id) => [`school.${id}`, 'maths' as const]),
  ),
  ...Object.fromEntries(
    [
      'atom',
      'flask',
      'beaker',
      'testtubes',
      'magnet',
      'battery',
      'thermometer',
      'planet',
      'moon',
    ].map((id) => [`school.${id}`, 'science' as const]),
  ),
  ...Object.fromEntries(
    ['microscope', 'seedling', 'dna'].map((id) => [`school.${id}`, 'biology' as const]),
  ),
};

/** School things, and the maths, science and biology pictures first drawn with them. */
export const SCHOOL_AND_MORE: readonly LibraryItem[] = ALL.map((i) => ({
  ...i,
  category: TAB[i.id] ?? 'school',
}));

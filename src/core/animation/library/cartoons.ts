// AN19: cartoon clip-art, drawn for OneEditor from the app's own shapes. Each is a group whose
// parts are named (Head, Left wheel, Tail…), so a part can be moved or turned on its own: the
// animation variables of the syllabus (a car's wheels turning as it drives).
import {
  arc,
  circle,
  ellipse,
  group,
  line,
  polygon,
  rect,
  shape,
  star,
  type LibraryItem,
} from './build.ts';

const INK = '#2d2a32';
const OUTLINE = [INK, 3] as const;
const THIN = [INK, 2] as const;
const SKIN = '#f2c29b';
const eyes = (lx: number, rx: number, y: number, r = 5) => [
  circle('Left eye', lx, y, r, INK),
  circle('Right eye', rx, y, r, INK),
];

export const CARTOONS: readonly LibraryItem[] = [
  {
    id: 'cartoon.person',
    name: 'Child',
    category: 'cartoons',
    keywords: ['person', 'boy', 'girl', 'kid', 'character', 'people'],
    width: 120,
    height: 240,
    parts: [
      rect('Left leg', 38, 170, 18, 56, '#3b4a8c', { stroke: THIN }),
      rect('Right leg', 64, 170, 18, 56, '#3b4a8c', { stroke: THIN }),
      ellipse('Left shoe', 28, 220, 32, 16, INK),
      ellipse('Right shoe', 60, 220, 32, 16, INK),
      rect('Left arm', 12, 100, 18, 64, SKIN, { radius: 9, stroke: THIN }),
      rect('Right arm', 90, 100, 18, 64, SKIN, { radius: 9, stroke: THIN }),
      rect('Body', 28, 94, 64, 86, '#e8503a', { radius: 16, stroke: OUTLINE }),
      group('Head', [
        circle('Face', 60, 56, 38, SKIN, { stroke: OUTLINE }),
        shape('Hair', arc(60, 56, 40, 40, 180, 360), '#5a3a22'),
        ...eyes(46, 74, 60),
        line('Mouth', arc(60, 70, 12, 8, 20, 160, 8), '#8a2e2e', 3),
      ]),
    ],
  },
  {
    id: 'cartoon.cat',
    name: 'Cat',
    category: 'cartoons',
    keywords: ['animal', 'pet', 'kitten'],
    width: 200,
    height: 170,
    parts: [
      rect('Tail', 160, 40, 16, 80, '#f0a050', { radius: 8, stroke: THIN }),
      ellipse('Body', 50, 80, 124, 74, '#f0a050', { stroke: OUTLINE }),
      rect('Front leg', 70, 140, 18, 28, '#f0a050', { radius: 6, stroke: THIN }),
      rect('Back leg', 136, 140, 18, 28, '#f0a050', { radius: 6, stroke: THIN }),
      group('Head', [
        shape(
          'Left ear',
          [
            [24, 40],
            [34, 6],
            [56, 30],
          ],
          '#f0a050',
          { stroke: THIN },
        ),
        shape(
          'Right ear',
          [
            [64, 30],
            [86, 6],
            [96, 40],
          ],
          '#f0a050',
          { stroke: THIN },
        ),
        circle('Face', 60, 64, 40, '#f0a050', { stroke: OUTLINE }),
        circle('Left eye', 46, 60, 6, '#2f8a3a'),
        circle('Right eye', 74, 60, 6, '#2f8a3a'),
        shape(
          'Nose',
          [
            [55, 72],
            [65, 72],
            [60, 78],
          ],
          '#e46a8a',
        ),
        line(
          'Left whiskers',
          [
            [20, 74],
            [46, 78],
          ],
          INK,
          2,
        ),
        line(
          'Right whiskers',
          [
            [74, 78],
            [100, 74],
          ],
          INK,
          2,
        ),
      ]),
    ],
  },
  {
    id: 'cartoon.dog',
    name: 'Dog',
    category: 'cartoons',
    keywords: ['animal', 'pet', 'puppy'],
    width: 210,
    height: 170,
    parts: [
      rect('Tail', 176, 60, 14, 50, '#b97a45', { radius: 7, stroke: THIN }),
      ellipse('Body', 60, 78, 128, 72, '#c98b55', { stroke: OUTLINE }),
      rect('Front leg', 80, 136, 20, 32, '#c98b55', { radius: 6, stroke: THIN }),
      rect('Back leg', 150, 136, 20, 32, '#c98b55', { radius: 6, stroke: THIN }),
      group('Head', [
        circle('Face', 62, 62, 42, '#c98b55', { stroke: OUTLINE }),
        ellipse('Left ear', 14, 36, 26, 56, '#7a4f2b', { stroke: THIN }),
        ellipse('Right ear', 84, 36, 26, 56, '#7a4f2b', { stroke: THIN }),
        ...eyes(48, 76, 56),
        ellipse('Nose', 52, 72, 20, 14, INK),
        line('Mouth', arc(62, 82, 14, 8, 20, 160, 8), INK, 3),
      ]),
    ],
  },
  {
    id: 'cartoon.fish',
    name: 'Fish',
    category: 'cartoons',
    keywords: ['animal', 'sea', 'underwater', 'swim'],
    width: 180,
    height: 110,
    parts: [
      shape(
        'Tail',
        [
          [128, 55],
          [176, 14],
          [176, 96],
        ],
        '#ff7a1a',
        { stroke: OUTLINE },
      ),
      shape(
        'Top fin',
        [
          [64, 24],
          [92, 2],
          [108, 26],
        ],
        '#ff7a1a',
        { stroke: THIN },
      ),
      ellipse('Body', 18, 16, 122, 80, '#ff9b3d', { stroke: OUTLINE }),
      rect('Stripe', 82, 22, 12, 68, '#ffffff', { opacity: 85 }),
      circle('Eye', 48, 46, 9, '#ffffff', { stroke: THIN }),
      circle('Pupil', 50, 46, 4, INK),
      line('Mouth', arc(28, 64, 8, 6, 200, 300, 6), INK, 2),
    ],
  },
  {
    id: 'cartoon.bird',
    name: 'Bird',
    category: 'cartoons',
    keywords: ['animal', 'fly', 'sky'],
    width: 160,
    height: 120,
    parts: [
      shape(
        'Tail',
        [
          [34, 64],
          [2, 50],
          [8, 84],
        ],
        '#2f7fb8',
        { stroke: THIN },
      ),
      ellipse('Body', 28, 42, 92, 64, '#4aa3df', { stroke: OUTLINE }),
      ellipse('Wing', 46, 56, 52, 30, '#2f7fb8', { stroke: THIN }),
      circle('Head', 110, 40, 26, '#4aa3df', { stroke: OUTLINE }),
      shape(
        'Beak',
        [
          [134, 34],
          [158, 42],
          [134, 50],
        ],
        '#f5b82e',
        { stroke: THIN },
      ),
      circle('Eye', 118, 34, 4, INK),
      line(
        'Left leg',
        [
          [64, 104],
          [60, 118],
        ],
        '#d9822b',
        3,
      ),
      line(
        'Right leg',
        [
          [84, 104],
          [88, 118],
        ],
        '#d9822b',
        3,
      ),
    ],
  },
  {
    id: 'cartoon.car',
    name: 'Car',
    category: 'cartoons',
    keywords: ['vehicle', 'transport', 'drive', 'road'],
    width: 260,
    height: 130,
    parts: [
      shape(
        'Roof',
        [
          [60, 52],
          [86, 12],
          [174, 12],
          [206, 52],
        ],
        '#d93a3a',
        { stroke: OUTLINE },
      ),
      rect('Body', 10, 50, 240, 52, '#e84545', { radius: 14, stroke: OUTLINE }),
      shape(
        'Front window',
        [
          [140, 48],
          [140, 20],
          [170, 20],
          [192, 48],
        ],
        '#bfe6ff',
        { stroke: THIN },
      ),
      shape(
        'Back window',
        [
          [74, 48],
          [92, 20],
          [128, 20],
          [128, 48],
        ],
        '#bfe6ff',
        { stroke: THIN },
      ),
      ellipse('Headlight', 234, 62, 14, 10, '#ffe066'),
      group('Back wheel', [
        circle('Tyre', 70, 100, 26, INK),
        circle('Hub', 70, 100, 10, '#c9ced6'),
      ]),
      group('Front wheel', [
        circle('Tyre', 192, 100, 26, INK),
        circle('Hub', 192, 100, 10, '#c9ced6'),
      ]),
    ],
  },
  {
    id: 'cartoon.bus',
    name: 'Bus',
    category: 'cartoons',
    keywords: ['vehicle', 'transport', 'school', 'road'],
    width: 300,
    height: 160,
    parts: [
      rect('Body', 6, 10, 288, 116, '#f5c518', { radius: 16, stroke: OUTLINE }),
      group(
        'Windows',
        [20, 76, 132, 188].map((x, i) =>
          rect(`Window ${i + 1}`, x, 26, 46, 38, '#bfe6ff', { stroke: THIN }),
        ),
      ),
      rect('Door', 244, 26, 36, 84, '#bfe6ff', { stroke: THIN }),
      rect('Stripe', 6, 78, 238, 10, INK),
      group('Back wheel', [
        circle('Tyre', 66, 128, 28, INK),
        circle('Hub', 66, 128, 11, '#c9ced6'),
      ]),
      group('Front wheel', [
        circle('Tyre', 230, 128, 28, INK),
        circle('Hub', 230, 128, 11, '#c9ced6'),
      ]),
    ],
  },
  {
    id: 'cartoon.rocket',
    name: 'Rocket',
    category: 'cartoons',
    keywords: ['space', 'vehicle', 'launch', 'fly'],
    width: 120,
    height: 260,
    parts: [
      shape(
        'Flame',
        [
          [44, 186],
          [60, 256],
          [76, 186],
        ],
        { from: '#ffd23f', to: '#ff5a1f', angle: 90 },
      ),
      shape(
        'Left fin',
        [
          [36, 140],
          [6, 200],
          [36, 188],
        ],
        '#d93a3a',
        { stroke: OUTLINE },
      ),
      shape(
        'Right fin',
        [
          [84, 140],
          [114, 200],
          [84, 188],
        ],
        '#d93a3a',
        { stroke: OUTLINE },
      ),
      rect('Body', 34, 50, 52, 142, '#eef1f5', { radius: 20, stroke: OUTLINE }),
      shape(
        'Nose',
        [
          [34, 74],
          [60, 2],
          [86, 74],
        ],
        '#d93a3a',
        { stroke: OUTLINE },
      ),
      circle('Window', 60, 106, 15, '#6ec6ff', { stroke: OUTLINE }),
    ],
  },
  {
    id: 'cartoon.boat',
    name: 'Sailing boat',
    category: 'cartoons',
    keywords: ['vehicle', 'sea', 'water', 'sail'],
    width: 260,
    height: 160,
    parts: [
      rect('Mast', 126, 8, 8, 96, '#7a4f2b'),
      shape(
        'Sail',
        [
          [138, 16],
          [138, 96],
          [222, 96],
        ],
        '#ffffff',
        { stroke: OUTLINE },
      ),
      shape(
        'Small sail',
        [
          [122, 30],
          [122, 96],
          [62, 96],
        ],
        '#f2f2f2',
        { stroke: OUTLINE },
      ),
      shape(
        'Flag',
        [
          [130, 8],
          [160, 16],
          [130, 24],
        ],
        '#e84545',
      ),
      shape(
        'Hull',
        [
          [8, 100],
          [252, 100],
          [212, 152],
          [48, 152],
        ],
        '#a0522d',
        { stroke: OUTLINE },
      ),
    ],
  },
  {
    id: 'cartoon.tree',
    name: 'Tree',
    category: 'cartoons',
    keywords: ['nature', 'plant', 'park', 'forest'],
    width: 180,
    height: 260,
    parts: [
      rect('Trunk', 74, 140, 32, 118, '#8b5a2b', { stroke: OUTLINE }),
      group('Leaves', [
        circle('Left leaves', 54, 116, 40, '#3fa34d', { stroke: THIN }),
        circle('Right leaves', 126, 116, 40, '#3fa34d', { stroke: THIN }),
        circle('Top leaves', 90, 78, 60, '#4cbb5a', { stroke: THIN }),
      ]),
      group('Apples', [
        circle('Apple 1', 64, 70, 8, '#e84545'),
        circle('Apple 2', 112, 96, 8, '#e84545'),
        circle('Apple 3', 90, 128, 8, '#e84545'),
      ]),
    ],
  },
  {
    id: 'cartoon.house',
    name: 'House',
    category: 'cartoons',
    keywords: ['building', 'home', 'town'],
    width: 240,
    height: 220,
    parts: [
      rect('Chimney', 164, 30, 22, 50, '#a0522d', { stroke: THIN }),
      rect('Walls', 30, 92, 180, 126, '#f3d9a4', { stroke: OUTLINE }),
      shape(
        'Roof',
        [
          [14, 96],
          [120, 10],
          [226, 96],
        ],
        '#d0453a',
        { stroke: OUTLINE },
      ),
      rect('Door', 102, 148, 40, 70, '#8b5a2b', { radius: 4, stroke: THIN }),
      circle('Door knob', 134, 186, 3, '#f5c518'),
      rect('Left window', 48, 116, 40, 36, '#bfe6ff', { stroke: THIN }),
      rect('Right window', 152, 116, 40, 36, '#bfe6ff', { stroke: THIN }),
    ],
  },
  {
    id: 'cartoon.sun',
    name: 'Smiling sun',
    category: 'cartoons',
    keywords: ['weather', 'sky', 'day', 'summer'],
    width: 200,
    height: 200,
    parts: [
      star('Rays', 0, 0, 200, 200, '#ffb400', 12, 0.72),
      circle('Face', 100, 100, 62, '#ffd84a', { stroke: OUTLINE }),
      ...eyes(80, 120, 90, 7),
      line('Smile', arc(100, 110, 26, 18, 20, 160, 10), INK, 4),
    ],
  },
  {
    id: 'cartoon.cloud',
    name: 'Cloud',
    category: 'cartoons',
    keywords: ['weather', 'sky'],
    width: 220,
    height: 120,
    parts: [
      rect('Base', 30, 68, 160, 48, '#ffffff', { radius: 24 }),
      circle('Left puff', 64, 72, 40, '#ffffff'),
      circle('Middle puff', 114, 52, 48, '#ffffff'),
      circle('Right puff', 168, 74, 38, '#ffffff'),
    ],
  },
  {
    id: 'cartoon.flower',
    name: 'Flower',
    category: 'cartoons',
    keywords: ['nature', 'plant', 'garden', 'grow'],
    width: 120,
    height: 220,
    parts: [
      rect('Stem', 56, 88, 8, 130, '#3fa34d'),
      ellipse('Leaf', 64, 140, 42, 18, '#4cbb5a', { stroke: THIN }),
      group(
        'Petals',
        Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3;
          return circle(
            `Petal ${i + 1}`,
            60 + 30 * Math.cos(a),
            60 + 30 * Math.sin(a),
            22,
            '#f06ca0',
            {
              stroke: THIN,
            },
          );
        }),
      ),
      circle('Centre', 60, 60, 18, '#ffd84a', { stroke: THIN }),
    ],
  },
  {
    id: 'cartoon.robot',
    name: 'Robot',
    category: 'cartoons',
    keywords: ['character', 'machine', 'computer', 'technology'],
    width: 160,
    height: 240,
    parts: [
      line(
        'Aerial',
        [
          [80, 4],
          [80, 30],
        ],
        INK,
        4,
      ),
      circle('Aerial light', 80, 8, 7, '#e84545'),
      group('Head', [
        rect('Face', 36, 28, 88, 66, '#9fb3c8', { radius: 10, stroke: OUTLINE }),
        circle('Left eye', 60, 56, 10, '#6ef0ff', { stroke: THIN }),
        circle('Right eye', 100, 56, 10, '#6ef0ff', { stroke: THIN }),
        rect('Mouth', 58, 76, 44, 8, INK, { radius: 4 }),
      ]),
      rect('Body', 26, 100, 108, 90, '#7d93ab', { radius: 10, stroke: OUTLINE }),
      polygon('Button', 68, 128, 24, 24, 6, '#f5c518', { stroke: THIN }),
      rect('Left arm', 4, 108, 18, 66, '#9fb3c8', { radius: 9, stroke: THIN }),
      rect('Right arm', 138, 108, 18, 66, '#9fb3c8', { radius: 9, stroke: THIN }),
      rect('Left leg', 44, 192, 24, 46, '#9fb3c8', { stroke: THIN }),
      rect('Right leg', 92, 192, 24, 46, '#9fb3c8', { stroke: THIN }),
    ],
  },
];

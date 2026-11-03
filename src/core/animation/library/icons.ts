// AN19: icons and symbols — arrows, marks, speech and thought bubbles, weather, and the flowchart
// shapes (workbook Task 7's iteration flowchart). Simple, bold shapes that read at any size.
import {
  arc,
  circle,
  ellipse,
  line,
  rect,
  shape,
  star,
  turnedRect,
  type LibraryItem,
  type Part,
} from './build.ts';

const INK = '#2d2a32';
const BLUE = '#2f7fe0';

/** The right-pointing arrow, turned to point another way (about the 100 × 100 box's centre). */
function arrow(deg: number): Part[] {
  const right = [
    [0, 35],
    [58, 35],
    [58, 8],
    [100, 50],
    [58, 92],
    [58, 65],
    [0, 65],
  ] as const;
  const a = (deg * Math.PI) / 180;
  const pts = right.map(([x, y]) => {
    const dx = x - 50;
    const dy = y - 50;
    return [50 + dx * Math.cos(a) - dy * Math.sin(a), 50 + dx * Math.sin(a) + dy * Math.cos(a)] as [
      number,
      number,
    ];
  });
  return [shape('Arrow', pts, BLUE, { stroke: [INK, 2] })];
}

const heart = (): [number, number][] =>
  Array.from({ length: 48 }, (_, i) => {
    const t = (i / 48) * 2 * Math.PI;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [50 + x * 3, 46 - y * 3];
  });

const cloudParts = (colour: string): Part[] => [
  rect('Cloud base', 10, 44, 80, 30, colour, { radius: 15 }),
  circle('Left puff', 32, 46, 20, colour),
  circle('Top puff', 56, 36, 26, colour),
  circle('Right puff', 76, 50, 16, colour),
];

const drop = (name: string, cx: number, top: number): Part =>
  shape(name, [[cx, top], ...arc(cx, top + 14, 6, 6, -20, 200, 10)], '#4aa3df');

const icon = (
  id: string,
  name: string,
  keywords: string[],
  parts: Part[],
  width = 100,
  height = 100,
): LibraryItem => ({
  id,
  name,
  category: 'icons',
  keywords,
  width,
  height,
  parts,
});

const FLOW = '#ffffff';
const FLOW_LINE = [INK, 3] as const;

export const ICONS: readonly LibraryItem[] = [
  icon('icon.arrow.right', 'Arrow right', ['arrow', 'direction', 'next'], arrow(0)),
  icon('icon.arrow.left', 'Arrow left', ['arrow', 'direction', 'back'], arrow(180)),
  icon('icon.arrow.up', 'Arrow up', ['arrow', 'direction'], arrow(-90)),
  icon('icon.arrow.down', 'Arrow down', ['arrow', 'direction'], arrow(90)),
  icon(
    'icon.star',
    'Star',
    ['shape', 'award', 'favourite'],
    [star('Gold star', 0, 0, 100, 100, '#ffc83d', 5, 0.45, { stroke: [INK, 2] })],
  ),
  icon(
    'icon.heart',
    'Heart',
    ['love', 'like', 'shape'],
    [shape('Heart', heart(), '#e8455a', { stroke: [INK, 2] })],
  ),
  icon(
    'icon.tick',
    'Tick',
    ['correct', 'yes', 'check', 'mark'],
    [
      line(
        'Tick',
        [
          [10, 54],
          [40, 84],
          [90, 18],
        ],
        '#2fa84f',
        14,
      ),
    ],
  ),
  icon(
    'icon.cross',
    'Cross',
    ['wrong', 'no', 'mark'],
    [
      shape('Stroke 1', turnedRect(50, 50, 16, 100, 45), '#e84545'),
      shape('Stroke 2', turnedRect(50, 50, 16, 100, -45), '#e84545'),
    ],
  ),
  icon(
    'icon.speech',
    'Speech bubble',
    ['talk', 'say', 'comic', 'words'],
    [
      shape(
        'Tail',
        [
          [18, 64],
          [12, 96],
          [44, 64],
        ],
        '#ffffff',
        { stroke: [INK, 2] },
      ),
      rect('Bubble', 2, 2, 96, 66, '#ffffff', { radius: 18, stroke: [INK, 3] }),
    ],
  ),
  icon(
    'icon.thought',
    'Thought bubble',
    ['think', 'idea', 'comic'],
    [
      circle('Small bubble', 12, 92, 6, '#ffffff', { stroke: [INK, 2] }),
      circle('Middle bubble', 26, 78, 9, '#ffffff', { stroke: [INK, 2] }),
      ellipse('Bubble', 4, 2, 92, 62, '#ffffff', { stroke: [INK, 3] }),
    ],
  ),
  icon(
    'icon.sun',
    'Sun',
    ['weather', 'sunny', 'day'],
    [star('Rays', 0, 0, 100, 100, '#ffb400', 12, 0.7), circle('Disc', 50, 50, 30, '#ffd84a')],
  ),
  icon('icon.cloud', 'Cloud', ['weather', 'cloudy'], cloudParts('#c7d3e0')),
  icon(
    'icon.rain',
    'Rain',
    ['weather', 'rainy', 'water'],
    [
      ...cloudParts('#9fb0c4'),
      drop('Drop 1', 30, 70),
      drop('Drop 2', 52, 74),
      drop('Drop 3', 74, 70),
    ],
  ),
  icon(
    'icon.lightning',
    'Lightning',
    ['weather', 'storm', 'electricity', 'power'],
    [
      shape(
        'Bolt',
        [
          [58, 0],
          [18, 56],
          [46, 56],
          [34, 100],
          [82, 38],
          [52, 38],
          [70, 0],
        ],
        '#ffd23f',
        { stroke: [INK, 2] },
      ),
    ],
  ),
  icon(
    'icon.snowflake',
    'Snowflake',
    ['weather', 'snow', 'winter', 'cold'],
    [0, 60, 120].map((deg, i) => {
      const a = (deg * Math.PI) / 180;
      return line(
        `Arm ${i + 1}`,
        [
          [50 - 44 * Math.cos(a), 50 - 44 * Math.sin(a)],
          [50 + 44 * Math.cos(a), 50 + 44 * Math.sin(a)],
        ],
        '#6ec6ff',
        7,
      );
    }),
  ),
  icon(
    'icon.music',
    'Music note',
    ['music', 'sound', 'song'],
    [
      ellipse('Note head', 10, 70, 36, 26, INK),
      rect('Stem', 38, 8, 8, 76, INK),
      shape(
        'Flag',
        [
          [46, 8],
          [84, 24],
          [84, 40],
          [46, 26],
        ],
        INK,
      ),
    ],
  ),
  icon(
    'icon.lightbulb',
    'Light bulb',
    ['idea', 'think', 'electricity'],
    [
      circle('Bulb', 50, 38, 34, '#ffe066', { stroke: [INK, 3] }),
      rect('Base', 34, 70, 32, 24, '#9aa4b2', { radius: 4, stroke: [INK, 2] }),
    ],
  ),
  icon(
    'icon.flow.process',
    'Flowchart process',
    ['flowchart', 'process', 'step', 'algorithm', 'box'],
    [rect('Process', 2, 2, 156, 66, FLOW, { stroke: FLOW_LINE })],
    160,
    70,
  ),
  icon(
    'icon.flow.decision',
    'Flowchart decision',
    ['flowchart', 'decision', 'question', 'algorithm', 'diamond'],
    [
      shape(
        'Decision',
        [
          [80, 2],
          [158, 50],
          [80, 98],
          [2, 50],
        ],
        FLOW,
        { stroke: FLOW_LINE },
      ),
    ],
    160,
    100,
  ),
  icon(
    'icon.flow.terminator',
    'Flowchart start / end',
    ['flowchart', 'start', 'end', 'stop', 'algorithm'],
    [rect('Start or end', 2, 2, 156, 56, FLOW, { radius: 28, stroke: FLOW_LINE })],
    160,
    60,
  ),
  icon(
    'icon.flow.data',
    'Flowchart input / output',
    ['flowchart', 'input', 'output', 'data', 'algorithm'],
    [
      shape(
        'Input or output',
        [
          [30, 2],
          [158, 2],
          [130, 66],
          [2, 66],
        ],
        FLOW,
        { stroke: FLOW_LINE },
      ),
    ],
    160,
    70,
  ),
  icon(
    'icon.flow.arrow',
    'Flowchart arrow',
    ['flowchart', 'arrow', 'connector', 'algorithm'],
    [
      line(
        'Line',
        [
          [20, 2],
          [20, 76],
        ],
        INK,
        3,
      ),
      shape(
        'Head',
        [
          [8, 74],
          [32, 74],
          [20, 98],
        ],
        INK,
      ),
    ],
    40,
    100,
  ),
];

// AN19: stage backgrounds, drawn at 1280 × 720 and stretched to the stage, on a layer of their
// own at the bottom. Their parts (sun, clouds, waves…) can be animated as the secondary
// components of an animation (the background).
import { arc, circle, group, rect, shape, star, type LibraryItem, type Part } from './build.ts';

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

export const BACKGROUNDS: readonly LibraryItem[] = [
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

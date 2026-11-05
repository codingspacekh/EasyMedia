// AN19: computers and IT clip-art for the syllabus's own topics — hardware (input, output and
// storage devices), networks and the internet, security, files and media — drawn from the app's
// own shapes, every part named so it can be animated on its own (a router's lights, a key).
import {
  arc,
  circle,
  ellipse,
  line,
  rect,
  shape,
  turnedRect,
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
const STEEL = '#9aa4b2';
const LIGHT = '#e9edf2';
const SLATE = '#3d4452';
const SCREEN = { from: '#4f8cff', to: '#7fd0ff', angle: 90 } as const;

type Pt = [number, number];

const item = (
  id: string,
  name: string,
  keywords: string[],
  parts: Part[],
  width = 100,
  height = 100,
): LibraryItem => ({ id, name, category: 'computers', keywords, width, height, parts });

const HARDWARE = ['computer', 'hardware', 'device'];
const INPUT = [...HARDWARE, 'input device', 'input'];
const OUTPUT = [...HARDWARE, 'output device', 'output'];
const STORAGE = [...HARDWARE, 'storage', 'storage device', 'backing storage'];

/** A person: a head and shoulders, `s` times the size of the 80 × 100 one, at (x, y). */
const person = (prefix: string, x: number, y: number, s: number, fill: string): Part[] => [
  circle(`${prefix}head`, x + 40 * s, y + 26 * s, 22 * s, fill),
  shape(`${prefix}body`, arc(x + 40 * s, y + 96 * s, 36 * s, 40 * s, 180, 360, 20), fill),
];

/** A gear wheel's outline: `teeth` teeth between radius `inner` and `outer`. */
function gear(cx: number, cy: number, teeth: number, inner: number, outer: number): Pt[] {
  const step = 360 / teeth;
  const at = (deg: number, r: number): Pt => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  return Array.from({ length: teeth }, (_, i) => {
    const c = i * step;
    return [
      at(c - step * 0.32, inner),
      at(c - step * 0.2, outer),
      at(c + step * 0.2, outer),
      at(c + step * 0.32, inner),
    ];
  }).flat();
}

/** A fat arrow pointing up (or down) in the 100 × 100 box, its tail at the bottom (or top). */
const fatArrow = (name: string, up: boolean, fill: string): Part => {
  const pts: Pt[] = [
    [38, 76],
    [62, 76],
    [62, 38],
    [80, 38],
    [50, 6],
    [20, 38],
    [38, 38],
  ];
  return shape(name, up ? pts : pts.map(([x, y]) => [x, 82 - y]), fill, { stroke: THIN });
};

export const COMPUTERS: readonly LibraryItem[] = [
  // ---- computers ----
  item(
    'computer.monitor',
    'Monitor',
    [...OUTPUT, 'monitor', 'screen', 'display', 'pc'],
    [
      rect('Neck', 60, 84, 20, 16, STEEL),
      rect('Foot', 40, 98, 60, 10, STEEL, { radius: 4 }),
      rect('Bezel', 2, 2, 136, 86, INK, { radius: 6 }),
      rect('Screen', 10, 10, 120, 68, SCREEN),
      rect('Window', 24, 20, 60, 40, '#ffffff', { radius: 3, opacity: 90 }),
    ],
    140,
    110,
  ),
  item(
    'computer.desktop',
    'Desktop computer',
    [...HARDWARE, 'desktop', 'pc', 'tower', 'system unit'],
    [
      rect('Tower', 118, 10, 38, 96, SLATE, { radius: 4, stroke: THIN }),
      rect('Drive slot', 124, 22, 26, 4, STEEL, { radius: 2 }),
      circle('Power button', 137, 90, 4, GREEN),
      rect('Neck', 46, 78, 16, 14, STEEL),
      rect('Foot', 30, 92, 48, 8, STEEL, { radius: 3 }),
      rect('Bezel', 2, 4, 108, 74, INK, { radius: 5 }),
      rect('Screen', 9, 11, 94, 60, SCREEN),
    ],
    160,
    108,
  ),
  item(
    'computer.laptop',
    'Laptop',
    [...HARDWARE, 'laptop', 'portable', 'notebook'],
    [
      rect('Lid', 22, 4, 116, 76, INK, { radius: 6 }),
      rect('Screen', 30, 12, 100, 60, SCREEN),
      shape(
        'Base',
        [
          [12, 80],
          [148, 80],
          [158, 94],
          [2, 94],
        ],
        '#c5ccd6',
        { stroke: THIN },
      ),
      rect('Touchpad', 66, 84, 28, 6, STEEL, { radius: 2 }),
    ],
    160,
    96,
  ),
  item(
    'computer.tablet',
    'Tablet',
    [...INPUT, ...OUTPUT.slice(3), 'tablet', 'touch screen', 'touchscreen', 'portable'],
    [
      rect('Case', 2, 2, 86, 116, INK, { radius: 10 }),
      rect('Screen', 8, 10, 74, 96, SCREEN),
      circle('Button', 45, 112, 3, STEEL),
    ],
    90,
    120,
  ),
  item(
    'computer.phone',
    'Smartphone',
    [...HARDWARE, 'phone', 'mobile', 'smartphone', 'touch screen', 'communication'],
    [
      rect('Case', 2, 2, 56, 106, INK, { radius: 10 }),
      rect('Screen', 6, 12, 48, 84, SCREEN),
      rect('Speaker', 22, 5, 16, 3, STEEL, { radius: 1.5 }),
      circle('Button', 30, 102, 3.5, STEEL),
    ],
    60,
    110,
  ),
  item(
    'computer.chip',
    'Processor chip',
    [...HARDWARE, 'cpu', 'processor', 'chip', 'microprocessor', 'integrated circuit'],
    [
      ...Array.from({ length: 5 }, (_, i) => [
        rect(`Top pin ${i + 1}`, 24 + i * 12, 6, 6, 14, '#b8c0cc'),
        rect(`Bottom pin ${i + 1}`, 24 + i * 12, 80, 6, 14, '#b8c0cc'),
        rect(`Left pin ${i + 1}`, 6, 24 + i * 12, 14, 6, '#b8c0cc'),
        rect(`Right pin ${i + 1}`, 80, 24 + i * 12, 14, 6, '#b8c0cc'),
      ]).flat(),
      rect('Body', 18, 18, 64, 64, SLATE, { radius: 4, stroke: THIN }),
      rect('Core', 34, 34, 32, 32, '#c9a227', { radius: 2 }),
    ],
  ),
  item(
    'computer.ram',
    'Memory (RAM)',
    [...HARDWARE, 'ram', 'memory', 'primary memory', 'main memory', 'volatile'],
    [
      rect('Board', 2, 8, 156, 40, '#2f8f4f', { radius: 2, stroke: THIN }),
      ...Array.from({ length: 4 }, (_, i) => rect(`Chip ${i + 1}`, 12 + i * 36, 14, 26, 24, INK)),
      ...Array.from({ length: 15 }, (_, i) =>
        rect(`Contact ${i + 1}`, 8 + i * 10, 48, 6, 10, '#e0b84a'),
      ),
    ],
    160,
    60,
  ),

  // ---- input devices ----
  item(
    'computer.keyboard',
    'Keyboard',
    [...INPUT, 'keyboard', 'typing', 'keys'],
    [
      rect('Case', 2, 2, 156, 66, SLATE, { radius: 6, stroke: THIN }),
      ...Array.from({ length: 36 }, (_, n) =>
        rect(`Key ${n + 1}`, 8 + (n % 12) * 12, 8 + Math.floor(n / 12) * 14, 10, 11, LIGHT, {
          radius: 2,
        }),
      ),
      rect('Space bar', 44, 50, 72, 11, LIGHT, { radius: 2 }),
    ],
    160,
    70,
  ),
  item(
    'computer.mouse',
    'Mouse',
    [...INPUT, 'mouse', 'pointer', 'click'],
    [
      line(
        'Cable',
        [
          [35, 22],
          [35, 10],
          [48, 4],
          [64, 4],
        ],
        INK,
        3,
      ),
      rect('Body', 6, 20, 58, 86, LIGHT, { radius: 29, stroke: OUTLINE }),
      line(
        'Divider',
        [
          [35, 20],
          [35, 54],
        ],
        INK,
        2,
      ),
      rect('Wheel', 31, 30, 8, 16, SLATE, { radius: 4 }),
    ],
    70,
    110,
  ),
  item(
    'computer.microphone',
    'Microphone',
    [...INPUT, 'microphone', 'mic', 'record', 'sound', 'audio'],
    [
      line('Holder', arc(35, 40, 24, 24, 0, 180, 16), INK, 4),
      rect('Stand', 32, 64, 6, 30, INK),
      rect('Base', 14, 94, 42, 10, INK, { radius: 4 }),
      rect('Head', 20, 2, 30, 52, STEEL, { radius: 15, stroke: OUTLINE }),
      ...[16, 26, 36].map((y, i) =>
        line(
          `Grille ${i + 1}`,
          [
            [24, y],
            [46, y],
          ],
          INK,
          2,
        ),
      ),
    ],
    70,
    106,
  ),
  item(
    'computer.camera',
    'Camera',
    [...INPUT, 'camera', 'digital camera', 'photo', 'picture', 'image'],
    [
      rect('Top', 36, 6, 40, 16, SLATE, { radius: 4 }),
      rect('Body', 4, 18, 112, 68, SLATE, { radius: 10, stroke: OUTLINE }),
      circle('Lens ring', 60, 52, 26, STEEL, { stroke: THIN }),
      circle('Lens', 60, 52, 16, '#2d4a7a'),
      circle('Shine', 54, 46, 5, '#ffffff', { opacity: 70 }),
      rect('Flash', 92, 26, 14, 8, '#ffe066', { radius: 2 }),
    ],
    120,
    90,
  ),
  item(
    'computer.barcode',
    'Barcode',
    [...INPUT, 'barcode', 'scanner', 'data capture', 'shop', 'product'],
    (() => {
      const widths = [4, 2, 2, 6, 2, 4, 2, 2, 4, 6, 2, 2, 4, 2, 6, 2, 4, 2];
      let x = 12;
      const bars: Part[] = [];
      widths.forEach((w, i) => {
        if (i % 2 === 0) bars.push(rect(`Bar ${bars.length + 1}`, x, 10, w + 1, 50, INK));
        x += w + 1.5;
      });
      return [rect('Label', 2, 2, 116, 66, '#ffffff', { radius: 4, stroke: THIN }), ...bars];
    })(),
    120,
    70,
  ),
  item(
    'computer.qr',
    'QR code',
    [...INPUT, 'qr code', 'qr', 'scan', 'data capture', 'link'],
    (() => {
      const finder = (name: string, x: number, y: number): Part[] => [
        rect(`${name} outside`, x, y, 26, 26, INK),
        rect(`${name} gap`, x + 4, y + 4, 18, 18, '#ffffff'),
        rect(`${name} centre`, x + 8, y + 8, 10, 10, INK),
      ];
      // A made-up pattern of squares between the three corner marks (not a real code).
      const cells = [
        [4, 0],
        [5, 1],
        [4, 2],
        [6, 2],
        [0, 4],
        [2, 4],
        [4, 4],
        [5, 4],
        [7, 4],
        [8, 4],
        [1, 5],
        [3, 5],
        [6, 5],
        [8, 5],
        [4, 6],
        [5, 6],
        [7, 6],
        [4, 7],
        [6, 7],
        [8, 7],
        [5, 8],
        [7, 8],
      ];
      return [
        rect('Back', 2, 2, 96, 96, '#ffffff', { stroke: THIN }),
        ...finder('Top left mark', 8, 8),
        ...finder('Top right mark', 66, 8),
        ...finder('Bottom left mark', 8, 66),
        ...cells.map(([c, r], i) => rect(`Square ${i + 1}`, 10 + c! * 9, 10 + r! * 9, 8, 8, INK)),
      ];
    })(),
  ),
  item(
    'computer.pointer',
    'Mouse pointer',
    ['pointer', 'cursor', 'click', 'mouse', 'arrow', 'interface'],
    [
      shape(
        'Pointer',
        [
          [6, 4],
          [6, 82],
          [24, 64],
          [38, 96],
          [52, 90],
          [38, 58],
          [64, 58],
        ],
        '#ffffff',
        { stroke: OUTLINE },
      ),
    ],
    70,
    100,
  ),

  // ---- output devices ----
  item(
    'computer.printer',
    'Printer',
    [...OUTPUT, 'printer', 'print', 'paper'],
    [
      rect('Paper in', 30, 2, 70, 30, '#ffffff', { stroke: THIN }),
      rect('Body', 4, 28, 122, 50, STEEL, { radius: 8, stroke: OUTLINE }),
      circle('Light', 108, 42, 4, GREEN),
      rect('Slot', 24, 62, 82, 6, INK, { radius: 3 }),
      rect('Paper out', 30, 66, 70, 40, '#ffffff', { stroke: THIN }),
      ...[78, 88, 98].map((y, i) =>
        line(
          `Printed line ${i + 1}`,
          [
            [38, y],
            [i === 2 ? 70 : 92, y],
          ],
          STEEL,
          3,
        ),
      ),
    ],
    130,
    108,
  ),
  item(
    'computer.speaker',
    'Speaker',
    [...OUTPUT, 'speaker', 'loudspeaker', 'sound', 'audio'],
    [
      rect('Box', 4, 2, 72, 106, SLATE, { radius: 8, stroke: OUTLINE }),
      circle('Tweeter', 40, 28, 10, STEEL, { stroke: THIN }),
      circle('Woofer', 40, 72, 24, STEEL, { stroke: THIN }),
      circle('Woofer centre', 40, 72, 9, INK),
    ],
    80,
    110,
  ),
  item(
    'computer.headphones',
    'Headphones',
    [...OUTPUT, 'headphones', 'audio', 'sound', 'listen', 'music'],
    [
      line('Band', arc(55, 52, 42, 44, 180, 360, 20), INK, 8),
      rect('Left cup', 4, 48, 22, 44, '#e8503a', { radius: 8, stroke: THIN }),
      rect('Right cup', 84, 48, 22, 44, '#e8503a', { radius: 8, stroke: THIN }),
    ],
    110,
    96,
  ),

  // ---- storage ----
  item(
    'computer.database',
    'Database',
    [...STORAGE.slice(0, 1), 'storage', 'database', 'data', 'records', 'table', 'sql'],
    [
      ellipse('Bottom', 6, 82, 78, 24, BLUE, { stroke: THIN }),
      rect('Body', 6, 18, 78, 76, BLUE),
      line(
        'Left side',
        [
          [6, 18],
          [6, 94],
        ],
        INK,
        2,
      ),
      line(
        'Right side',
        [
          [84, 18],
          [84, 94],
        ],
        INK,
        2,
      ),
      line('Band 1', arc(45, 44, 39, 12, 0, 180, 16), '#ffffff', 3),
      line('Band 2', arc(45, 68, 39, 12, 0, 180, 16), '#ffffff', 3),
      ellipse('Top', 6, 6, 78, 24, '#5aa0f0', { stroke: THIN }),
    ],
    90,
    108,
  ),
  item(
    'computer.harddisk',
    'Hard disk',
    [...STORAGE, 'hard disk', 'hdd', 'drive', 'magnetic'],
    [
      rect('Case', 4, 4, 102, 72, STEEL, { radius: 6, stroke: OUTLINE }),
      circle('Platter', 44, 40, 28, '#d5dce4', { stroke: THIN }),
      circle('Spindle', 44, 40, 5, INK),
      shape('Arm', turnedRect(78, 46, 6, 40, 30), INK),
      ...[
        [12, 12],
        [98, 12],
        [12, 68],
        [98, 68],
      ].map(([x, y], i) => circle(`Screw ${i + 1}`, x!, y!, 3, '#6b7380')),
    ],
    110,
    80,
  ),
  item(
    'computer.usb',
    'USB stick',
    [...STORAGE, 'usb', 'memory stick', 'flash drive', 'pen drive', 'solid state'],
    [
      rect('Connector', 98, 16, 30, 28, '#b8c0cc', { stroke: THIN }),
      rect('Hole 1', 108, 22, 6, 6, INK),
      rect('Hole 2', 116, 32, 6, 6, INK),
      rect('Body', 4, 8, 98, 44, BLUE, { radius: 10, stroke: OUTLINE }),
      circle('Light', 20, 30, 4, GOLD),
      rect('Label', 34, 20, 52, 20, '#ffffff', { radius: 3 }),
    ],
    130,
    60,
  ),
  item(
    'computer.cloud',
    'Cloud storage',
    ['cloud', 'storage', 'cloud storage', 'online', 'upload', 'internet', 'backup'],
    [
      rect('Cloud base', 10, 40, 100, 36, '#c7e3ff', { radius: 18 }),
      circle('Left puff', 38, 44, 22, '#c7e3ff'),
      circle('Top puff', 64, 34, 28, '#c7e3ff'),
      circle('Right puff', 92, 50, 18, '#c7e3ff'),
      shape(
        'Arrow',
        [
          [60, 40],
          [80, 62],
          [68, 62],
          [68, 94],
          [52, 94],
          [52, 62],
          [40, 62],
        ],
        BLUE,
        { stroke: THIN },
      ),
    ],
    120,
    96,
  ),
  item(
    'computer.folder',
    'Folder',
    ['folder', 'directory', 'files', 'file management', 'storage'],
    [
      shape(
        'Back',
        [
          [4, 10],
          [44, 10],
          [54, 22],
          [116, 22],
          [116, 86],
          [4, 86],
        ],
        '#e0a800',
        { stroke: THIN },
      ),
      rect('Front', 4, 32, 112, 54, GOLD, { radius: 4, stroke: THIN }),
    ],
    120,
    90,
  ),
  item(
    'computer.document',
    'Document',
    ['document', 'file', 'page', 'word processing', 'text', 'report'],
    [
      shape(
        'Page',
        [
          [4, 2],
          [56, 2],
          [76, 22],
          [76, 98],
          [4, 98],
        ],
        '#ffffff',
        { stroke: OUTLINE },
      ),
      shape(
        'Fold',
        [
          [56, 2],
          [56, 22],
          [76, 22],
        ],
        '#d5dce4',
        { stroke: THIN },
      ),
      ...[40, 52, 64, 76].map((y, i) =>
        line(
          `Line ${i + 1}`,
          [
            [16, y],
            [i === 3 ? 44 : 64, y],
          ],
          STEEL,
          4,
        ),
      ),
    ],
    80,
    100,
  ),
  item(
    'computer.spreadsheet',
    'Spreadsheet',
    ['spreadsheet', 'cells', 'table', 'data', 'formula', 'grid', 'model'],
    [
      rect('Sheet', 2, 2, 106, 86, '#ffffff', { stroke: OUTLINE }),
      rect('Header', 2, 2, 106, 16, GREEN),
      ...[30, 56, 82].map((x, i) =>
        line(
          `Column line ${i + 1}`,
          [
            [x, 2],
            [x, 88],
          ],
          STEEL,
          2,
        ),
      ),
      ...[36, 54, 72].map((y, i) =>
        line(
          `Row line ${i + 1}`,
          [
            [2, y],
            [108, y],
          ],
          STEEL,
          2,
        ),
      ),
      rect('Selected cell', 30, 36, 26, 18, null, { stroke: [BLUE, 3] }),
    ],
    110,
    90,
  ),

  // ---- networks and the internet ----
  item(
    'computer.server',
    'Server',
    [...HARDWARE, 'server', 'network', 'data centre', 'data center', 'hosting', 'rack', 'storage'],
    Array.from({ length: 3 }, (_, i) => [
      rect(`Unit ${i + 1}`, 6, 4 + i * 38, 88, 34, SLATE, { radius: 4, stroke: THIN }),
      circle(`Light ${i + 1}`, 18, 21 + i * 38, 4, GREEN),
      rect(`Drive ${i + 1}`, 40, 18 + i * 38, 46, 6, STEEL, { radius: 2 }),
    ]).flat(),
    100,
    120,
  ),
  item(
    'computer.router',
    'Router',
    [...HARDWARE, 'router', 'network', 'internet', 'wifi', 'wi-fi', 'lan'],
    [
      line(
        'Left aerial',
        [
          [30, 50],
          [22, 4],
        ],
        INK,
        5,
      ),
      line(
        'Right aerial',
        [
          [110, 50],
          [118, 4],
        ],
        INK,
        5,
      ),
      rect('Case', 4, 46, 132, 38, LIGHT, { radius: 8, stroke: OUTLINE }),
      ...[30, 46, 62, 78].map((x, i) => circle(`Light ${i + 1}`, x, 66, 4, GREEN)),
    ],
    140,
    88,
  ),
  item(
    'computer.wifi',
    'Wi-Fi signal',
    ['wifi', 'wi-fi', 'wireless', 'network', 'signal', 'internet'],
    [
      circle('Dot', 50, 78, 8, BLUE),
      ...[24, 44, 64].map((r, i) =>
        line(`Wave ${i + 1}`, arc(50, 78, r, r, 225, 315, 12), BLUE, 8),
      ),
    ],
    100,
    90,
  ),
  item(
    'computer.network',
    'Network',
    ['network', 'star topology', 'topology', 'hub', 'switch', 'lan', 'nodes', 'connected'],
    (() => {
      const nodes: Pt[] = [
        [18, 18],
        [102, 18],
        [18, 82],
        [102, 82],
      ];
      return [
        ...nodes.map(([x, y], i) =>
          line(
            `Link ${i + 1}`,
            [
              [60, 50],
              [x, y],
            ],
            INK,
            3,
          ),
        ),
        circle('Hub', 60, 50, 14, BLUE, { stroke: THIN }),
        ...nodes.map(([x, y], i) => circle(`Node ${i + 1}`, x, y, 12, GREEN, { stroke: THIN })),
      ];
    })(),
    120,
    100,
  ),
  item(
    'computer.internet',
    'Internet',
    ['internet', 'web', 'world wide web', 'www', 'online', 'global', 'network'],
    [
      circle('Globe', 50, 50, 46, '#4aa3df', { stroke: OUTLINE }),
      ellipse('Meridian', 30, 4, 40, 92, null, { stroke: ['#ffffff', 3] }),
      line(
        'Middle line',
        [
          [50, 4],
          [50, 96],
        ],
        '#ffffff',
        3,
      ),
      line(
        'Equator',
        [
          [4, 50],
          [96, 50],
        ],
        '#ffffff',
        3,
      ),
      line(
        'North line',
        [
          [10, 28],
          [90, 28],
        ],
        '#ffffff',
        3,
      ),
      line(
        'South line',
        [
          [10, 72],
          [90, 72],
        ],
        '#ffffff',
        3,
      ),
    ],
  ),
  item(
    'computer.satellite',
    'Satellite',
    ['satellite', 'gps', 'communication', 'space', 'signal', 'wireless'],
    [
      line(
        'Left arm',
        [
          [38, 50],
          [48, 50],
        ],
        INK,
        3,
      ),
      line(
        'Right arm',
        [
          [72, 50],
          [82, 50],
        ],
        INK,
        3,
      ),
      rect('Left panel', 4, 38, 36, 24, '#2f5fb0', { stroke: THIN }),
      rect('Right panel', 80, 38, 36, 24, '#2f5fb0', { stroke: THIN }),
      line(
        'Aerial',
        [
          [60, 36],
          [60, 16],
        ],
        INK,
        2,
      ),
      circle('Aerial tip', 60, 14, 4, RED),
      rect('Body', 46, 34, 28, 32, '#b8c0cc', { radius: 3, stroke: THIN }),
      shape('Dish', arc(60, 66, 16, 12, 0, 180, 12), STEEL, { stroke: THIN }),
    ],
    120,
    82,
  ),
  item(
    'computer.email',
    'Email',
    ['email', 'e-mail', 'mail', 'message', 'letter', 'communication', 'envelope'],
    [
      rect('Envelope', 4, 4, 112, 72, '#ffffff', { radius: 4, stroke: OUTLINE }),
      line(
        'Left fold',
        [
          [4, 76],
          [46, 38],
        ],
        INK,
        2,
      ),
      line(
        'Right fold',
        [
          [116, 76],
          [74, 38],
        ],
        INK,
        2,
      ),
      line(
        'Flap',
        [
          [4, 6],
          [60, 46],
          [116, 6],
        ],
        INK,
        3,
      ),
    ],
    120,
    80,
  ),
  item(
    'computer.download',
    'Download',
    ['download', 'save', 'transfer', 'arrow', 'internet'],
    [
      line(
        'Tray',
        [
          [10, 70],
          [10, 92],
          [90, 92],
          [90, 70],
        ],
        INK,
        8,
      ),
      fatArrow('Arrow', false, BLUE),
    ],
  ),
  item(
    'computer.upload',
    'Upload',
    ['upload', 'send', 'transfer', 'arrow', 'internet'],
    [
      line(
        'Tray',
        [
          [10, 70],
          [10, 92],
          [90, 92],
          [90, 70],
        ],
        INK,
        8,
      ),
      fatArrow('Arrow', true, GREEN),
    ],
  ),

  // ---- security ----
  item(
    'computer.padlock',
    'Padlock',
    ['padlock', 'lock', 'locked', 'security', 'password', 'safe', 'encryption'],
    [
      line('Shackle', [[18, 46], ...arc(40, 34, 22, 22, 180, 360, 16), [62, 46]], STEEL, 9),
      rect('Body', 6, 44, 68, 52, GOLD, { radius: 8, stroke: OUTLINE }),
      circle('Keyhole', 40, 64, 7, INK),
      shape(
        'Keyhole slot',
        [
          [37, 66],
          [43, 66],
          [46, 84],
          [34, 84],
        ],
        INK,
      ),
    ],
    80,
    100,
  ),
  item(
    'computer.unlocked',
    'Open padlock',
    ['padlock', 'unlocked', 'open', 'security', 'access', 'password'],
    [
      line('Shackle', [[18, 30], ...arc(40, 24, 22, 22, 180, 360, 16), [62, 46]], STEEL, 9),
      rect('Body', 6, 44, 68, 52, GREEN, { radius: 8, stroke: OUTLINE }),
      circle('Keyhole', 40, 64, 7, INK),
      shape(
        'Keyhole slot',
        [
          [37, 66],
          [43, 66],
          [46, 84],
          [34, 84],
        ],
        INK,
      ),
    ],
    80,
    100,
  ),
  item(
    'computer.key',
    'Key',
    ['key', 'password', 'security', 'encryption', 'unlock', 'access'],
    [
      rect('Shaft', 48, 24, 86, 12, GOLD, { stroke: THIN }),
      rect('Tooth 1', 100, 34, 10, 14, GOLD, { stroke: THIN }),
      rect('Tooth 2', 118, 34, 10, 20, GOLD, { stroke: THIN }),
      circle('Bow', 28, 30, 24, GOLD, { stroke: OUTLINE }),
      circle('Hole', 28, 30, 9, '#ffffff', { stroke: THIN }),
    ],
    140,
    60,
  ),
  item(
    'computer.shield',
    'Shield',
    ['shield', 'security', 'antivirus', 'protection', 'firewall', 'safe'],
    [
      shape(
        'Shield',
        [
          [45, 2],
          [86, 16],
          [84, 52],
          [70, 78],
          [45, 98],
          [20, 78],
          [6, 52],
          [4, 16],
        ],
        BLUE,
        { stroke: OUTLINE },
      ),
      line(
        'Tick',
        [
          [26, 50],
          [40, 66],
          [66, 34],
        ],
        '#ffffff',
        8,
      ),
    ],
    90,
    100,
  ),
  item(
    'computer.bug',
    'Bug (virus)',
    ['bug', 'virus', 'malware', 'error', 'debug', 'security', 'insect'],
    [
      ...(
        [
          [30, 40, 8, 28],
          [28, 58, 6, 58],
          [30, 74, 10, 90],
        ] as const
      ).flatMap(([x1, y1, x2, y2], i) => [
        line(
          `Left leg ${i + 1}`,
          [
            [x1, y1],
            [x2, y2],
          ],
          INK,
          4,
        ),
        line(
          `Right leg ${i + 1}`,
          [
            [100 - x1, y1],
            [100 - x2, y2],
          ],
          INK,
          4,
        ),
      ]),
      line(
        'Left feeler',
        [
          [44, 18],
          [36, 2],
        ],
        INK,
        3,
      ),
      line(
        'Right feeler',
        [
          [56, 18],
          [64, 2],
        ],
        INK,
        3,
      ),
      ellipse('Body', 26, 30, 48, 64, RED, { stroke: OUTLINE }),
      circle('Head', 50, 26, 14, INK),
      line(
        'Back',
        [
          [50, 42],
          [50, 92],
        ],
        INK,
        2,
      ),
      circle('Left spot', 38, 58, 5, INK),
      circle('Right spot', 62, 72, 5, INK),
    ],
  ),

  // ---- software and media ----
  item(
    'computer.window',
    'App window',
    ['window', 'app', 'application', 'software', 'interface', 'gui', 'program'],
    [
      rect('Frame', 2, 2, 136, 96, '#ffffff', { radius: 6, stroke: OUTLINE }),
      rect('Title bar', 2, 2, 136, 20, SLATE, { radius: 6 }),
      circle('Close', 14, 12, 4, RED),
      circle('Minimise', 26, 12, 4, GOLD),
      circle('Maximise', 38, 12, 4, GREEN),
      rect('Side bar', 10, 30, 30, 60, LIGHT, { radius: 3 }),
      rect('Picture', 48, 30, 82, 34, '#c7e3ff', { radius: 3 }),
      rect('Text 1', 48, 72, 82, 6, STEEL, { radius: 3 }),
      rect('Text 2', 48, 84, 54, 6, STEEL, { radius: 3 }),
    ],
    140,
    100,
  ),
  item(
    'computer.code',
    'Code',
    ['code', 'programming', 'html', 'web', 'coding', 'software', 'program'],
    [
      line(
        'Left bracket',
        [
          [36, 24],
          [12, 50],
          [36, 76],
        ],
        INK,
        9,
      ),
      line(
        'Slash',
        [
          [68, 14],
          [52, 86],
        ],
        BLUE,
        8,
      ),
      line(
        'Right bracket',
        [
          [84, 24],
          [108, 50],
          [84, 76],
        ],
        INK,
        9,
      ),
    ],
    120,
    100,
  ),
  item(
    'computer.gear',
    'Gear',
    ['gear', 'settings', 'cog', 'process', 'machine', 'options'],
    [
      shape('Wheel', gear(50, 50, 8, 36, 48), STEEL, { stroke: THIN }),
      circle('Hole', 50, 50, 14, '#ffffff', { stroke: THIN }),
    ],
  ),
  item(
    'computer.user',
    'User',
    ['user', 'person', 'account', 'profile', 'login', 'people'],
    person('', 0, 0, 1, BLUE),
    80,
    100,
  ),
  item(
    'computer.users',
    'Users',
    ['users', 'people', 'group', 'team', 'network', 'accounts'],
    [
      ...person('Left user ', 0, 20, 0.7, '#8fb8f0'),
      ...person('Right user ', 84, 20, 0.7, '#8fb8f0'),
      ...person('Middle user ', 30, 0, 1, BLUE),
    ],
    140,
    100,
  ),
  item(
    'computer.play',
    'Play button',
    ['play', 'video', 'media', 'start', 'button', 'multimedia'],
    [
      circle('Disc', 50, 50, 46, RED),
      shape(
        'Triangle',
        [
          [40, 30],
          [72, 50],
          [40, 70],
        ],
        '#ffffff',
      ),
    ],
  ),
  item(
    'computer.clapper',
    'Clapperboard',
    ['clapperboard', 'film', 'video', 'movie', 'scene', 'animation', 'multimedia'],
    [
      rect('Board', 4, 38, 112, 58, INK, { radius: 4 }),
      rect('Stripe bar', 4, 38, 112, 14, '#ffffff'),
      ...[20, 44, 68, 92].map((x, i) =>
        shape(
          `Stripe ${i + 1}`,
          [
            [x, 38],
            [x + 12, 38],
            [x + 4, 52],
            [x - 8, 52],
          ],
          INK,
        ),
      ),
      shape(
        'Clapper',
        [
          [4, 32],
          [108, 4],
          [112, 18],
          [8, 46],
        ],
        INK,
      ),
      line(
        'Writing 1',
        [
          [16, 66],
          [90, 66],
        ],
        '#ffffff',
        3,
      ),
      line(
        'Writing 2',
        [
          [16, 80],
          [64, 80],
        ],
        '#ffffff',
        3,
      ),
    ],
    120,
    100,
  ),

  // ---- logic gates (inputs on the left, output on the right, so a signal can be animated) ----
  item(
    'computer.and',
    'AND gate',
    [...gateWords(), 'and', 'and gate'],
    [...gateWires(2, 112), gateBody(andBody())],
    150,
    90,
  ),
  item(
    'computer.or',
    'OR gate',
    [...gateWords(), 'or', 'or gate'],
    [...gateWires(2, 116), gateBody(orBody())],
    150,
    90,
  ),
  item(
    'computer.not',
    'NOT gate',
    [...gateWords(), 'not', 'not gate', 'inverter'],
    [
      ...gateWires(1, 120),
      gateBody([
        [44, 12],
        [106, 45],
        [44, 78],
      ]),
      circle('Inversion bubble', 113, 45, 7, '#ffffff', { stroke: OUTLINE }),
    ],
    150,
    90,
  ),
  item(
    'computer.nand',
    'NAND gate',
    [...gateWords(), 'nand', 'nand gate', 'not and'],
    [
      ...gateWires(2, 126),
      gateBody(andBody()),
      circle('Inversion bubble', 119, 45, 7, '#ffffff', { stroke: OUTLINE }),
    ],
    150,
    90,
  ),
  item(
    'computer.nor',
    'NOR gate',
    [...gateWords(), 'nor', 'nor gate', 'not or'],
    [
      ...gateWires(2, 130),
      gateBody(orBody()),
      circle('Inversion bubble', 123, 45, 7, '#ffffff', { stroke: OUTLINE }),
    ],
    150,
    90,
  ),
  item(
    'computer.xor',
    'XOR gate',
    [...gateWords(), 'xor', 'xor gate', 'exclusive or'],
    [
      ...gateWires(2, 116),
      line('Extra input curve', arc(24, 45, 14, 37, 90, -90, 16), INK, 4),
      gateBody(orBody()),
    ],
    150,
    90,
  ),

  // ---- data and inside the computer ----
  item(
    'computer.binary',
    'Binary',
    ['binary', 'bits', 'bit', 'data', 'number', 'digital', 'byte', 'zero and one', 'code'],
    [
      rect('Screen', 2, 2, 136, 76, SLATE, { radius: 8, stroke: OUTLINE }),
      ...[1, 0, 1, 1].map((bit, i) => {
        const x = 11 + i * 32;
        const name = `Bit ${i + 1} (${bit === 1 ? 'one' : 'zero'})`;
        return bit === 1 ? digitOne(name, x, 18, 22, 44) : digitZero(name, x, 18, 22, 44);
      }),
    ],
    140,
    80,
  ),
  item(
    'computer.motherboard',
    'Motherboard',
    [...HARDWARE, 'motherboard', 'mainboard', 'circuit board', 'pcb', 'cpu socket'],
    [
      rect('Circuit board', 2, 2, 116, 106, '#2f8f4f', { radius: 4, stroke: THIN }),
      ...(
        [
          [
            [56, 34],
            [64, 34],
            [64, 66],
          ],
          [
            [36, 54],
            [36, 62],
            [90, 62],
            [90, 70],
          ],
          [
            [86, 36],
            [92, 36],
            [92, 16],
          ],
          [
            [80, 80],
            [88, 80],
          ],
          [
            [10, 60],
            [10, 98],
            [60, 98],
          ],
        ] as Pt[][]
      ).map((pts, i) => line(`Track ${i + 1}`, pts, '#7fd49a', 2)),
      rect('CPU socket', 14, 12, 42, 42, LIGHT, { radius: 2, stroke: THIN }),
      rect('Processor', 21, 19, 28, 28, SLATE, { radius: 2 }),
      rect('Processor core', 29, 27, 12, 12, '#c9a227', { radius: 1 }),
      rect('RAM slot 1', 68, 10, 6, 48, INK, { radius: 1 }),
      rect('RAM slot 2', 78, 10, 6, 48, INK, { radius: 1 }),
      rect('Power connector', 94, 6, 18, 8, '#ffffff', { radius: 1, stroke: THIN }),
      circle('Capacitor 1', 102, 26, 5, BLUE, { stroke: THIN }),
      circle('Capacitor 2', 102, 40, 5, BLUE, { stroke: THIN }),
      circle('Capacitor 3', 102, 54, 5, BLUE, { stroke: THIN }),
      rect('Expansion slot 1', 16, 72, 60, 6, INK, { radius: 1 }),
      rect('Expansion slot 2', 16, 86, 60, 6, INK, { radius: 1 }),
      rect('Chipset', 86, 70, 22, 22, SLATE, { radius: 2, stroke: THIN }),
      circle('BIOS battery', 92, 100, 5.5, STEEL, { stroke: THIN }),
    ],
    120,
    110,
  ),
  item(
    'computer.gpu',
    'Graphics card (GPU)',
    [...HARDWARE, 'graphics card', 'gpu', 'video card', 'graphics', 'expansion card'],
    [
      rect('Bracket', 2, 2, 8, 74, STEEL, { radius: 1, stroke: THIN }),
      rect('Circuit board', 10, 48, 146, 16, '#2f8f4f', { stroke: THIN }),
      rect('Edge contacts', 40, 64, 84, 10, '#e0b84a', { stroke: THIN }),
      rect('Cooler', 10, 6, 146, 46, SLATE, { radius: 6, stroke: THIN }),
      ...[48, 118].flatMap((cx, f) => {
        const side = f === 0 ? 'Left' : 'Right';
        return [
          circle(`${side} fan`, cx, 29, 20, INK, { stroke: THIN }),
          ...[0, 60, 120].map((deg, b) =>
            shape(`${side} fan blade ${b + 1}`, turnedRect(cx, 29, 34, 7, deg), STEEL),
          ),
          circle(`${side} fan hub`, cx, 29, 6, LIGHT, { stroke: THIN }),
        ];
      }),
    ],
    160,
    80,
  ),
  item(
    'computer.ssd',
    'SSD',
    [...STORAGE, 'ssd', 'solid state drive', 'solid state', 'flash memory', 'drive'],
    [
      rect('Case', 4, 4, 132, 82, '#4a5160', { radius: 8, stroke: OUTLINE }),
      rect('Label', 18, 16, 96, 58, BLUE, { radius: 4 }),
      shape(
        'Lightning bolt',
        [
          [72, 22],
          [50, 48],
          [64, 48],
          [56, 68],
          [82, 40],
          [68, 40],
        ],
        '#ffffff',
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        rect(`Connector pin ${i + 1}`, 122, 18 + i * 9, 10, 5, '#e0b84a'),
      ),
    ],
    140,
    90,
  ),
  item(
    'computer.disc',
    'CD / DVD disc',
    [...STORAGE, 'cd', 'dvd', 'disc', 'disk', 'optical', 'blu-ray', 'optical disc'],
    [
      circle(
        'Disc',
        50,
        50,
        46,
        { from: '#f2f5f9', to: '#aab6c6', angle: 45 },
        { stroke: OUTLINE },
      ),
      shape('Rainbow shine 1', [[50, 50], ...arc(50, 50, 42, 42, 200, 245, 8)], '#c9b6ff', {
        opacity: 70,
      }),
      shape('Rainbow shine 2', [[50, 50], ...arc(50, 50, 42, 42, 20, 65, 8)], '#9fe6ff', {
        opacity: 70,
      }),
      circle('Centre ring', 50, 50, 16, LIGHT, { stroke: THIN }),
      circle('Centre hole', 50, 50, 7, '#ffffff', { stroke: THIN }),
    ],
  ),
  item(
    'computer.sdcard',
    'Memory card (SD)',
    [...STORAGE, 'sd card', 'memory card', 'flash memory', 'camera card', 'microsd'],
    [
      shape(
        'Card',
        [
          [4, 4],
          [56, 4],
          [76, 24],
          [76, 96],
          [4, 96],
        ],
        BLUE,
        { stroke: OUTLINE },
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        rect(`Contact ${i + 1}`, 10 + i * 9, 10, 6, 18, '#e0b84a'),
      ),
      rect('Label', 12, 46, 56, 40, '#ffffff', { radius: 3 }),
      rect('Label stripe', 12, 46, 56, 10, GOLD, { radius: 3 }),
      rect('Lock switch', 0, 40, 6, 14, LIGHT, { stroke: THIN }),
    ],
    80,
    100,
  ),

  // ---- more devices ----
  item(
    'computer.smartwatch',
    'Smartwatch',
    [...HARDWARE, 'smartwatch', 'watch', 'wearable', 'fitness', 'sensor'],
    [
      rect('Top strap', 22, 2, 36, 30, SLATE, { radius: 4 }),
      rect('Bottom strap', 22, 88, 36, 30, SLATE, { radius: 4 }),
      rect('Crown', 68, 50, 8, 16, STEEL, { radius: 2, stroke: THIN }),
      rect('Case', 8, 22, 62, 76, INK, { radius: 16 }),
      rect('Screen', 14, 28, 50, 64, SCREEN, { radius: 10 }),
      line(
        'Hour hand',
        [
          [39, 60],
          [39, 44],
        ],
        '#ffffff',
        4,
      ),
      line(
        'Minute hand',
        [
          [39, 60],
          [52, 68],
        ],
        '#ffffff',
        3,
      ),
      circle('Centre dot', 39, 60, 3, '#ffffff'),
    ],
    80,
    120,
  ),
  item(
    'computer.vrheadset',
    'VR headset',
    [...OUTPUT, 'vr', 'virtual reality', 'headset', 'goggles', 'game'],
    [
      rect('Head strap', 2, 32, 136, 16, '#5a6272', { radius: 4, stroke: THIN }),
      shape(
        'Visor',
        [
          ...arc(28, 28, 16, 16, 180, 270, 6),
          ...arc(112, 28, 16, 16, 270, 360, 6),
          ...arc(112, 60, 16, 16, 0, 90, 6),
          ...arc(70, 76, 16, 18, 0, -180, 12),
          ...arc(28, 60, 16, 16, 90, 180, 6),
        ],
        SLATE,
        { stroke: OUTLINE },
      ),
      rect('Visor shine', 26, 18, 88, 7, '#ffffff', { radius: 3.5, opacity: 30 }),
      circle('Left sensor', 34, 42, 5, INK, { stroke: [STEEL, 2] }),
      circle('Right sensor', 106, 42, 5, INK, { stroke: [STEEL, 2] }),
    ],
    140,
    90,
  ),
  item(
    'computer.gamepad',
    'Game controller',
    [...INPUT, 'game controller', 'gamepad', 'controller', 'game', 'console', 'joystick'],
    (() => {
      const right: Pt[] = [
        ...arc(102, 40, 28, 26, -90, 0, 8),
        ...arc(116, 70, 14, 16, -10, 160, 10),
        [92, 60],
      ];
      const body: Pt[] = [...right, ...right.map(([x, y]): Pt => [140 - x, y]).reverse()];
      return [
        shape('Body', body, SLATE, { stroke: OUTLINE }),
        rect('D-pad across', 24, 34, 28, 9, INK, { radius: 2 }),
        rect('D-pad down', 33.5, 24.5, 9, 28, INK, { radius: 2 }),
        circle('Left stick', 56, 54, 8, INK, { stroke: [STEEL, 2] }),
        circle('Right stick', 84, 54, 8, INK, { stroke: [STEEL, 2] }),
        circle('Top button', 102, 27, 5.5, GREEN),
        circle('Left button', 91, 38, 5.5, BLUE),
        circle('Right button', 113, 38, 5.5, RED),
        circle('Bottom button', 102, 49, 5.5, GOLD),
      ];
    })(),
    140,
    90,
  ),
  item(
    'computer.webcam',
    'Webcam',
    [...INPUT, 'webcam', 'web cam', 'camera', 'video call', 'video'],
    [
      rect('Neck', 44, 74, 12, 18, STEEL),
      rect('Stand', 18, 90, 64, 14, SLATE, { radius: 7, stroke: THIN }),
      circle('Camera body', 50, 42, 36, LIGHT, { stroke: OUTLINE }),
      circle('Lens ring', 50, 44, 20, SLATE),
      circle('Lens', 50, 44, 12, '#2d4a7a'),
      circle('Shine', 45, 39, 4, '#ffffff', { opacity: 70 }),
      circle('Light', 50, 15, 3.5, GREEN),
    ],
    100,
    106,
  ),
  item(
    'computer.projector',
    'Projector',
    [...OUTPUT, 'projector', 'presentation', 'beam', 'display'],
    [
      shape(
        'Light beam',
        [
          [100, 38],
          [158, 6],
          [158, 94],
          [100, 62],
        ],
        { from: '#ffe066', to: '#fff8d6', angle: 0 },
        { opacity: 75 },
      ),
      rect('Body', 4, 24, 104, 52, LIGHT, { radius: 8, stroke: OUTLINE }),
      rect('Left foot', 14, 76, 14, 6, SLATE, { radius: 2 }),
      rect('Right foot', 84, 76, 14, 6, SLATE, { radius: 2 }),
      ...[16, 26, 36, 46].map((x, i) =>
        line(
          `Vent ${i + 1}`,
          [
            [x, 36],
            [x, 64],
          ],
          STEEL,
          3,
        ),
      ),
      circle('Status light', 60, 34, 3.5, GREEN),
      circle('Lens ring', 84, 50, 18, SLATE, { stroke: THIN }),
      circle('Lens', 84, 50, 11, '#2d4a7a'),
      circle('Shine', 80, 46, 3.5, '#ffffff', { opacity: 70 }),
    ],
    160,
    100,
  ),
  item(
    'computer.scanner',
    'Scanner',
    [...INPUT, 'scanner', 'flatbed scanner', 'scan', 'photocopy', 'document'],
    [
      shape(
        'Lid',
        [
          [14, 36],
          [126, 36],
          [118, 4],
          [22, 4],
        ],
        SLATE,
        { stroke: THIN },
      ),
      rect('Base', 4, 34, 132, 52, '#c5ccd6', { radius: 6, stroke: OUTLINE }),
      rect(
        'Glass',
        14,
        42,
        112,
        26,
        { from: '#9fd8ff', to: '#dff2ff', angle: 0 },
        { stroke: THIN },
      ),
      rect('Document', 54, 44, 36, 22, '#ffffff'),
      rect('Scan light', 34, 42, 8, 26, '#b6ff8a', { opacity: 90 }),
      circle('Start button', 120, 77, 4, GREEN),
      rect('Front panel', 16, 74, 60, 5, STEEL, { radius: 2.5 }),
    ],
    140,
    90,
  ),
  item(
    'computer.printer3d',
    '3D printer',
    [...OUTPUT, '3d printer', '3d printing', 'printer', 'manufacture', 'additive'],
    [
      rect('Left upright', 8, 8, 10, 100, SLATE),
      rect('Right upright', 102, 8, 10, 100, SLATE),
      rect('Top bar', 8, 4, 104, 12, SLATE, { radius: 3 }),
      rect('Base', 2, 102, 116, 16, INK, { radius: 4 }),
      rect('Print bed', 24, 90, 72, 8, STEEL, { radius: 2, stroke: THIN }),
      rect('Printed object', 44, 66, 32, 24, BLUE, { stroke: THIN }),
      line(
        'Layer line 1',
        [
          [46, 74],
          [74, 74],
        ],
        '#8fbaf5',
        2,
      ),
      line(
        'Layer line 2',
        [
          [46, 82],
          [74, 82],
        ],
        '#8fbaf5',
        2,
      ),
      rect('Gantry rail', 18, 40, 84, 6, STEEL),
      shape(
        'Nozzle',
        [
          [54, 52],
          [66, 52],
          [60, 62],
        ],
        GOLD,
        { stroke: THIN },
      ),
      rect('Print head', 46, 32, 28, 22, RED, { radius: 4, stroke: THIN }),
    ],
    120,
    120,
  ),
  item(
    'computer.sensor',
    'Sensor',
    [...INPUT, 'sensor', 'motion sensor', 'temperature', 'control', 'monitoring', 'iot'],
    [
      line(
        'Wire',
        [
          [4, 50],
          [10, 50],
        ],
        INK,
        4,
      ),
      rect('Sensor body', 8, 30, 42, 40, SLATE, { radius: 8, stroke: OUTLINE }),
      circle('Sensor eye', 34, 50, 9, '#e84545', { stroke: [STEEL, 2] }),
      ...[22, 38, 54].map((r, i) =>
        line(`Signal wave ${i + 1}`, arc(44, 50, r, r, -45, 45, 10), BLUE, 5),
      ),
    ],
    110,
    100,
  ),
  item(
    'computer.robot',
    'Robot',
    ['robot', 'robotics', 'automation', 'ai', 'artificial intelligence', 'machine', 'android'],
    [
      line(
        'Antenna',
        [
          [50, 8],
          [50, 18],
        ],
        INK,
        3,
      ),
      circle('Antenna light', 50, 7, 4.5, RED),
      rect('Left ear', 14, 28, 10, 16, SLATE, { radius: 2 }),
      rect('Right ear', 76, 28, 10, 16, SLATE, { radius: 2 }),
      rect('Head', 20, 16, 60, 40, '#c3ccd9', { radius: 10, stroke: OUTLINE }),
      rect('Face screen', 28, 23, 44, 26, SLATE, { radius: 6 }),
      circle('Left eye', 40, 33, 5, '#7fd0ff'),
      circle('Right eye', 60, 33, 5, '#7fd0ff'),
      rect('Mouth', 40, 42, 20, 3, '#7fd0ff', { radius: 1.5 }),
      rect('Neck', 43, 56, 14, 8, SLATE),
      rect('Left arm', 8, 66, 12, 32, STEEL, { radius: 6, stroke: THIN }),
      rect('Right arm', 80, 66, 12, 32, STEEL, { radius: 6, stroke: THIN }),
      rect('Left leg', 32, 98, 12, 14, SLATE),
      rect('Right leg', 56, 98, 12, 14, SLATE),
      rect('Left foot', 26, 110, 22, 8, INK, { radius: 3 }),
      rect('Right foot', 52, 110, 22, 8, INK, { radius: 3 }),
      rect('Body', 22, 62, 56, 38, BLUE, { radius: 8, stroke: OUTLINE }),
      rect('Chest panel', 34, 70, 32, 18, LIGHT, { radius: 3 }),
      circle('Chest light 1', 42, 79, 3.5, RED),
      circle('Chest light 2', 50, 79, 3.5, GOLD),
      circle('Chest light 3', 58, 79, 3.5, GREEN),
    ],
    100,
    120,
  ),
  item(
    'computer.drone',
    'Drone',
    ['drone', 'quadcopter', 'uav', 'flying', 'camera', 'robot', 'automation'],
    [
      ...(
        [
          ['Left', 64, 46, 27, 36],
          ['Right', 96, 46, 133, 36],
        ] as const
      ).flatMap(([side, x1, y1, x2, y2]) => [
        line(
          `${side} arm`,
          [
            [x1, y1],
            [x2, y2],
          ],
          SLATE,
          6,
        ),
        rect(`${side} motor`, x2 - 6, y2 - 10, 12, 14, INK, { radius: 3 }),
        ellipse(`${side} propeller`, x2 - 25, y2 - 16, 50, 9, STEEL, {
          stroke: THIN,
          opacity: 85,
        }),
        line(
          `${side} leg`,
          [
            [x1 + (side === 'Left' ? 4 : -4), y1 + 12],
            [x1 + (side === 'Left' ? -6 : 6), 88],
          ],
          SLATE,
          4,
        ),
      ]),
      rect('Body', 56, 36, 48, 28, '#ffffff', { radius: 12, stroke: OUTLINE }),
      circle('Status light', 80, 46, 3.5, GREEN),
      rect('Gimbal', 74, 62, 12, 6, INK),
      circle('Camera', 80, 74, 9, INK),
      circle('Camera lens', 80, 74, 4, BLUE),
    ],
    160,
    92,
  ),
  item(
    'computer.chipcard',
    'Bank card (chip and PIN)',
    [
      'bank card',
      'chip and pin',
      'credit card',
      'debit card',
      'smart card',
      'payment',
      'contactless',
      'magnetic stripe',
      'input',
    ],
    [
      rect(
        'Card',
        2,
        6,
        146,
        90,
        { from: '#2f7fe0', to: '#5a3fc0', angle: 135 },
        {
          radius: 9,
          stroke: OUTLINE,
        },
      ),
      rect('Chip', 18, 30, 30, 24, '#e0b84a', { radius: 4, stroke: THIN }),
      line(
        'Chip contact line 1',
        [
          [18, 42],
          [48, 42],
        ],
        '#a8842a',
        1.5,
      ),
      line(
        'Chip contact line 2',
        [
          [33, 30],
          [33, 54],
        ],
        '#a8842a',
        1.5,
      ),
      ...[0, 1, 2].map((i) =>
        line(
          `Contactless wave ${i + 1}`,
          arc(60, 42, 6 + i * 6, 6 + i * 6, -40, 40, 8),
          '#ffffff',
          2.5,
        ),
      ),
      ...[0, 1, 2, 3].map((i) =>
        rect(`Card number ${i + 1}`, 18 + i * 30, 66, 24, 6, '#ffffff', { radius: 3, opacity: 90 }),
      ),
      rect('Name', 18, 80, 56, 5, '#ffffff', { radius: 2.5, opacity: 60 }),
      circle('Logo left', 118, 80, 9, RED, { opacity: 90 }),
      circle('Logo right', 130, 80, 9, GOLD, { opacity: 90 }),
    ],
    150,
    100,
  ),

  // ---- networks ----
  item(
    'computer.bluetooth',
    'Bluetooth',
    ['bluetooth', 'wireless', 'network', 'pairing', 'connection'],
    [
      rect('Badge', 6, 4, 68, 102, BLUE, { radius: 34 }),
      line(
        'Rune',
        [
          [22, 34],
          [58, 72],
          [40, 90],
          [40, 20],
          [58, 38],
          [22, 76],
        ],
        '#ffffff',
        7,
      ),
    ],
    80,
    110,
  ),
  item(
    'computer.ethernet',
    'Ethernet cable',
    [...HARDWARE, 'ethernet', 'cable', 'rj45', 'network cable', 'wired', 'lan', 'network'],
    [
      line(
        'Cable',
        [
          [40, 78],
          [40, 96],
          [32, 108],
          [26, 114],
        ],
        BLUE,
        12,
      ),
      shape(
        'Boot',
        [
          [18, 58],
          [62, 58],
          [54, 82],
          [26, 82],
        ],
        '#1f5fb0',
        { stroke: THIN },
      ),
      rect('Plug', 12, 8, 56, 52, '#e3ecf4', { radius: 3, stroke: OUTLINE }),
      ...Array.from({ length: 8 }, (_, i) =>
        rect(`Contact ${i + 1}`, 17 + i * 6, 11, 3.5, 18, '#e0b84a'),
      ),
      shape(
        'Clip',
        [
          [26, 36],
          [54, 36],
          [50, 56],
          [30, 56],
        ],
        STEEL,
        { stroke: THIN, opacity: 85 },
      ),
    ],
    80,
    118,
  ),
  item(
    'computer.switch',
    'Network switch',
    [...HARDWARE, 'switch', 'network switch', 'hub', 'lan', 'network', 'ports'],
    [
      rect('Case', 2, 12, 156, 46, SLATE, { radius: 5, stroke: OUTLINE }),
      ...Array.from({ length: 8 }, (_, i) => [
        circle(`Port ${i + 1} light`, 20 + i * 17, 24, 2.5, GREEN),
        rect(`Port ${i + 1}`, 13 + i * 17, 30, 14, 14, INK, { radius: 1, stroke: [STEEL, 1.5] }),
      ]).flat(),
      rect('Left foot', 12, 58, 18, 5, INK, { radius: 2 }),
      rect('Right foot', 130, 58, 18, 5, INK, { radius: 2 }),
    ],
    160,
    70,
  ),
  item(
    'computer.packet',
    'Data packet',
    ['packet', 'data packet', 'packet switching', 'header', 'payload', 'network', 'data'],
    [
      rect('Header (addresses)', 4, 20, 34, 50, GOLD, { stroke: OUTLINE }),
      rect('Payload (data)', 38, 20, 76, 50, '#c7e3ff', { stroke: OUTLINE }),
      rect('Trailer (error check)', 114, 20, 22, 50, GREEN, { stroke: OUTLINE }),
      ...[0, 1, 2, 3].map((i) =>
        rect(`Data line ${i + 1}`, 46, 29 + i * 9, i === 3 ? 34 : 60, 4, BLUE, { radius: 2 }),
      ),
      ...[0, 1].map((i) =>
        rect(`Address ${i + 1}`, 10, 30 + i * 16, 22, 6, INK, { radius: 2, opacity: 80 }),
      ),
    ],
    140,
    90,
  ),

  // ---- security and system ----
  item(
    'computer.firewall',
    'Firewall',
    ['firewall', 'security', 'network', 'protection', 'wall', 'block', 'fire'],
    [
      shape(
        'Back flames',
        [
          [12, 50],
          [16, 30],
          [26, 40],
          [32, 14],
          [44, 32],
          [56, 4],
          [66, 30],
          [80, 12],
          [86, 36],
          [98, 22],
          [108, 50],
        ],
        '#ff8a3d',
        { stroke: THIN },
      ),
      shape(
        'Front flames',
        [
          [26, 50],
          [32, 38],
          [40, 42],
          [48, 24],
          [56, 38],
          [64, 20],
          [72, 40],
          [82, 32],
          [92, 50],
        ],
        GOLD,
      ),
      rect('Mortar', 4, 44, 112, 62, '#eadccc', { stroke: OUTLINE }),
      ...firewallBricks(),
    ],
    120,
    108,
  ),
  item(
    'computer.fingerprint',
    'Fingerprint',
    ['fingerprint', 'biometric', 'biometrics', 'security', 'login', 'identity', 'scan'],
    [
      ...(
        [
          [10, 16],
          [22, 30],
          [36, 24],
          [30, 44],
          [50, 34],
          [40, 54],
        ] as const
      ).map(([left, right], i) => {
        // Each ridge goes up one side, over the top and down the other, its sides different lengths.
        const rx = 5 + 7 * i;
        const ry = 6 + 7.4 * i;
        return line(
          `Ridge ${i + 1}`,
          [
            [45 - rx * 0.88, 50 + left],
            ...arc(45, 50, rx, ry, 180, 360, 18),
            [45 + rx * 0.88, 50 + right],
          ],
          '#2f6fd0',
          5,
        );
      }),
    ],
    90,
    110,
  ),
  item(
    'computer.virus',
    'Computer virus',
    ['virus', 'computer virus', 'malware', 'security', 'threat', 'infection', 'hacking'],
    [
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        const end: Pt = [50 + 44 * Math.cos(a), 50 + 44 * Math.sin(a)];
        return [
          line(`Spike ${i + 1}`, [[50, 50], end], INK, 4),
          circle(`Spike tip ${i + 1}`, end[0], end[1], 5, RED, { stroke: THIN }),
        ];
      }).flat(),
      circle('Body', 50, 50, 28, '#7ac74f', { stroke: OUTLINE }),
      circle('Left eye', 40, 46, 5, INK),
      circle('Right eye', 60, 46, 5, INK),
      line('Frown', arc(50, 66, 10, 6, 200, 340, 8), INK, 3),
    ],
  ),
  item(
    'computer.warning',
    'Warning sign',
    ['warning', 'alert', 'error', 'danger', 'caution', 'security', 'risk'],
    [
      shape(
        'Triangle',
        [
          [55, 6],
          [106, 94],
          [4, 94],
        ],
        GOLD,
        { stroke: OUTLINE },
      ),
      shape(
        'Exclamation bar',
        [
          [49, 34],
          [61, 34],
          [58, 68],
          [52, 68],
        ],
        INK,
      ),
      circle('Exclamation dot', 55, 80, 5, INK),
    ],
    110,
    100,
  ),
  item(
    'computer.power',
    'Power button',
    ['power', 'power button', 'on', 'off', 'start', 'shut down', 'button'],
    [
      circle('Button', 50, 50, 46, SLATE, { stroke: OUTLINE }),
      line('Power ring', arc(50, 53, 24, 24, -55, 235, 24), GREEN, 8),
      line(
        'Power bar',
        [
          [50, 18],
          [50, 50],
        ],
        GREEN,
        8,
      ),
    ],
  ),
  item(
    'computer.recyclebin',
    'Recycle bin',
    ['recycle bin', 'bin', 'trash', 'delete', 'rubbish', 'wastebasket', 'file'],
    [
      rect('Lid handle', 32, 2, 26, 10, STEEL, { radius: 4, stroke: THIN }),
      rect('Lid', 6, 10, 78, 12, STEEL, { radius: 4, stroke: OUTLINE }),
      shape(
        'Bin',
        [
          [12, 26],
          [78, 26],
          [70, 106],
          [20, 106],
        ],
        LIGHT,
        { stroke: OUTLINE },
      ),
      ...[30, 45, 60].map((x, i) =>
        line(
          `Rib ${i + 1}`,
          [
            [x, 36],
            [45 + (x - 45) * 0.8, 96],
          ],
          STEEL,
          4,
        ),
      ),
    ],
    90,
    110,
  ),
];

// ---- helpers for the items added after the first 45 (hoisted, so the list above can use them) ----

/** Every logic gate is found by these. */
function gateWords(): string[] {
  return ['logic gate', 'logic', 'gate', 'boolean', 'logic circuit', 'truth table'];
}

/** A gate's body, light blue with the ink outline. */
function gateBody(points: Pt[]): Part {
  return shape('Gate body', points, '#cfe3ff', { stroke: OUTLINE });
}

/** A quadratic curve from `a` to `b`, pulled towards `c`. */
function curve(a: Pt, c: Pt, b: Pt, steps = 12): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return [
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ];
  });
}

/** A gate's input lines (one in the middle, or two) and its output line from `outFrom`. */
function gateWires(inputs: 1 | 2, outFrom: number): Part[] {
  const wire = (name: string, x1: number, x2: number, y: number) =>
    line(
      name,
      [
        [x1, y],
        [x2, y],
      ],
      INK,
      4,
    );
  return [
    ...(inputs === 1
      ? [wire('Input', 2, 50, 45)]
      : [wire('Input A', 2, 56, 28), wire('Input B', 2, 56, 62)]),
    wire('Output', outFrom - 2, 148, 45),
  ];
}

/** The AND gate's D shape: a flat back, a round front reaching x = 112. */
function andBody(): Pt[] {
  return [[40, 10], ...arc(77, 45, 35, 35, -90, 90, 20), [40, 80]];
}

/** The OR gate's shield shape: a curved back, two curves meeting at a point at x = 116. */
function orBody(): Pt[] {
  return [
    ...curve([36, 10], [88, 8], [116, 45]),
    ...curve([116, 45], [88, 82], [36, 80]).slice(1),
    ...arc(36, 45, 14, 35, 90, -90, 16).slice(1, -1),
  ];
}

/** A "1" drawn as one shape (a stem with a flag and a foot) in a w × h box at (x, y). */
function digitOne(name: string, x: number, y: number, w: number, h: number): Part {
  const s = x + w / 2 - 3;
  const pts: Pt[] = [
    [s - 8, y + 9],
    [s + 1, y],
    [s + 8, y],
    [s + 8, y + h - 6],
    [s + 14, y + h - 6],
    [s + 14, y + h],
    [s - 6, y + h],
    [s - 6, y + h - 6],
    [s, y + h - 6],
    [s, y + 12],
    [s - 5, y + 16],
  ];
  return shape(name, pts, '#6ee07a');
}

/** A "0" drawn as an oval ring in a w × h box at (x, y). */
function digitZero(name: string, x: number, y: number, w: number, h: number): Part {
  return ellipse(name, x + 3, y + 3, w - 6, h - 6, null, { stroke: ['#6ee07a', 7] });
}

/** The firewall's bricks, row by row, each row half a brick along from the one above. */
function firewallBricks(): Part[] {
  const bricks: Part[] = [];
  for (let r = 0; r < 4; r++) {
    const y = 46 + r * 15;
    for (let x0 = r % 2 === 0 ? 6 : -12; x0 < 114; x0 += 36) {
      const a = Math.max(6, x0);
      const b = Math.min(114, x0 + 34);
      if (b - a < 4) continue;
      bricks.push(rect(`Brick ${bricks.length + 1}`, a, y, b - a, 13, '#c4553a'));
    }
  }
  return bricks;
}

// M15 exit gate (phase 2): motion paths, morphing and masks in the workbook's Chapter 7 tasks
// (Task 1.2 complete, Task 5, Task 6), the coursebook's Practical Activities 19.04–19.06 and
// exam-style questions 1 and 2 — built through Animation mode's use cases, checked frame by
// frame, saved and opened again, exported and passed by the task checker (T6).
import { describe, expect, it } from 'vitest';
import { drawStage, type StageCanvas } from '../../src/core/animation/draw.ts';
import { centreOf } from '../../src/core/animation/geometry.ts';
import { findObject } from '../../src/core/animation/layers.ts';
import { flattenCurves } from '../../src/core/animation/path.ts';
import { pullHandles } from '../../src/core/animation/pen.ts';
import { presetSize } from '../../src/core/animation/rules.ts';
import { placementOf } from '../../src/core/animation/state.ts';
import type {
  AnimObject,
  Id,
  MotionPath,
  PathObject,
  TextObject,
} from '../../src/core/animation/types.ts';
import { colourOf, picture, studio, task1, type Studio } from '../helpers/animation-studio.ts';

/** The distance from a point to a motion path (its flattened outline). */
function offPath(m: MotionPath, p: { x: number; y: number }): number {
  const pts = flattenCurves(m.points, m.closed);
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t =
      len2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y))));
  }
  return best;
}

/** A new layer with a name; it becomes the layer new objects go on. */
function layer(s: Studio, name: string): Id {
  s.anim.addLayer();
  const id = s.anim.store.get().layerId;
  s.anim.renameLayer(id, name);
  return id;
}

/** A pen path whose given points are made smooth (handles pulled out sideways by `reach`). */
function wavy(s: Studio, points: { x: number; y: number }[], reach = 60): Id {
  s.anim.addPath(points, false);
  const id = s.last().id;
  points.forEach((p, i) => {
    if (i > 0 && i < points.length - 1)
      s.anim.editPath(id, 'Curve point', (path) =>
        pullHandles(path, i, { x: p.x + reach, y: p.y }),
      );
  });
  return id;
}

/** Records the drawing calls (rounded) for checking masks. */
function recorder() {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) =>
      key in target
        ? target[key]
        : (...args: unknown[]) => {
            calls.push(
              `${key}(${args.map((a) => (typeof a === 'number' ? Math.round(a) : typeof a === 'string' ? a : '…')).join(',')})`,
            );
            if (key.startsWith('create')) return { addColorStop: () => {} };
            return undefined;
          },
    set: (target, key: string, value) => ((target[key] = value), true),
  }) as unknown as StageCanvas;
  return { ctx, calls };
}

const paths = (s: Studio, id: Id) => findObject(s.doc(), id)!.object.paths!;

// ---------------------------------------------------------------------------------------------

describe('Workbook Task 1.2 — complete: the circle morphs (WB p.99)', () => {
  function task12() {
    const s = studio();
    const ids = task1(s);
    // The circle becomes a square where it ends, at 3 s.
    s.anim.addShape('rect', { x: 396, y: 196, width: 204, height: 204 });
    const square = s.last().id;
    s.anim.select([ids.circle]);
    s.anim.setFrame(72);
    expect(s.anim.morphInto(ids.circle, square)).toBeNull();
    expect(s.anim.setLength('6 s')).toBeNull();
    for (const id of [ids.circle, ids.rect, ids.text]) s.anim.reverse(id, 'all');
    s.anim.setRepeat(ids.star, 'rotation', 'end');
    s.anim.setLoop({ on: true });
    return { s, ...ids };
  }

  it('round at the start, square at 3 s, round again at 6 s; in between, in between', () => {
    const { s, circle, star } = task12();
    const at = (f: number) => s.at(circle, f) as AnimObject as PathObject;
    expect(at(0).points.length).toBe(64);
    expect(at(72)).toMatchObject({
      kind: 'path',
      closed: true,
      x: 396,
      y: 196,
      width: 204,
      height: 204,
    });
    expect(at(72).points).toHaveLength(4);
    expect(at(144).points.length).toBe(64);
    expect(at(144)).toMatchObject({ x: 0, y: 0 });
    // Halfway the outline reaches further than the circle's, not as far as the square's corners.
    const half = at(36);
    const c = { x: half.width / 2, y: half.height / 2 };
    const reach = Math.max(...half.points.map((p) => Math.hypot(p.x - c.x, p.y - c.y)));
    expect(reach).toBeGreaterThan(102);
    expect(reach).toBeLessThan(102 * Math.SQRT2);
    // The circle keeps its gradient; the star keeps turning clockwise.
    expect(at(36).fill.kind).toBe('linear');
    expect(s.at(star, 108).rotation).toBe(180);
  });

  it('saved as Chapter07_Task1_2 and exported as a 6 s MP4', async () => {
    const { s, circle } = task12();
    await s.saveAndReopen('/work/Chapter07_Task1_2.mvea');
    expect((s.at(circle, 72) as AnimObject as PathObject).points).toHaveLength(4);
    await s.exportAndCheck('mp4', '/work/Chapter07_Task1_2.mp4', {
      name: 'Workbook Task 1.2',
      container: 'mp4',
      width: 600,
      height: 400,
      duration: 6,
      tolerance: 0.1,
    });
  });
});

// ---------------------------------------------------------------------------------------------

describe('Workbook Task 5 — the car on the road (WB p.104)', () => {
  /** A car (body and two wheels, grouped); its wheels turn clockwise or anticlockwise. */
  function car(
    s: Studio,
    x: number,
    y: number,
    scale: number,
    turns: [number, number][],
  ): { car: Id; wheel: Id } {
    s.anim.addShape('rect', { x, y, width: 200 * scale, height: 50 * scale });
    const body = s.last().id;
    s.type(body, 0, { name: 'Body', fill: { kind: 'solid', colour: '#1d4ed8' } });
    const wheels: Id[] = [];
    for (const dx of [30, 130]) {
      s.anim.addShape('ellipse', {
        x: x + dx * scale,
        y: y + 30 * scale,
        width: 40 * scale,
        height: 40 * scale,
      });
      const w = s.last().id;
      wheels.push(w);
      s.anim.setFrame(turns[0]![0]);
      s.anim.insertKeyframe(w, 'rotation');
      for (const [frame, rotation] of turns.slice(1)) s.type(w, frame, { rotation });
    }
    s.anim.select([body, ...wheels]);
    s.anim.setFrame(0);
    s.anim.group();
    return { car: s.anim.store.get().selection[0]!, wheel: wheels[0]! };
  }

  function task5() {
    const s = studio();
    s.stage({ width: 1240, height: 800, background: '#ffffff', length: 288 });
    // The road: a black line 19 px thick at y = 500, appearing from the left over 2 s.
    s.anim.addLine({ x: 0, y: 500 }, { x: 1240, y: 500 });
    const road = s.last().id;
    s.type(road, 0, { name: 'Road', stroke: { colour: '#000000', width: 19, dash: 'solid' } });
    s.anim.setFrame(48);
    s.anim.insertKeyframe(road, 'width');
    s.type(road, 0, { width: 0 });
    // The big car drives on from the left over 5 s, then reverses over 5 s; the wheels turn once a second.
    const big = car(s, 40, 420, 1, [
      [48, 0],
      [168, 1800],
      [288, 0],
    ]);
    s.type(big.car, 0, { x: -260 });
    s.anim.setFrame(48);
    s.anim.insertKeyframe(big.car, 'x');
    s.type(big.car, 168, { x: 1260 });
    s.type(big.car, 288, { x: -260 });
    // The small cars follow undulating paths (on a hidden guide layer), turning with them.
    const guides = layer(s, 'Guides');
    const up = wavy(s, [
      { x: -120, y: 260 },
      { x: 300, y: 180 },
      { x: 700, y: 300 },
      { x: 1100, y: 200 },
      { x: 1360, y: 260 },
    ]);
    const down = wavy(s, [
      { x: 1360, y: 680 },
      { x: 900, y: 600 },
      { x: 500, y: 720 },
      { x: 100, y: 620 },
      { x: -120, y: 680 },
    ]);
    s.anim.toggleLayer(guides, 'visible');
    layer(s, 'Small cars');
    const a = car(s, 0, 0, 0.4, [
      [48, 0],
      [288, 3600],
    ]);
    const b = car(s, 0, 0, 0.4, [
      [48, 0],
      [288, -3600],
    ]);
    for (const [id, path] of [
      [a.car, up],
      [b.car, down],
    ] as const) {
      expect(s.anim.followPath(id, path)).toBeNull();
      expect(s.anim.setMotion(id, 0, { from: 48, to: 288, orient: true })).toBeNull();
    }
    // Car B faces right while it goes left: turned round once on top of the path's heading.
    s.type(b.car, 0, { rotation: 180 });
    s.anim.setLoop({ on: true });
    return { s, road, big, a, b };
  }

  it('the road appears from the left over the first two seconds', () => {
    const { s, road } = task5();
    expect(s.at(road, 0).width).toBe(0);
    expect(s.at(road, 24)).toMatchObject({ x: 0, width: 620 });
    expect(s.at(road, 48)).toMatchObject({ x: 0, width: 1240 });
    expect(s.at(road, 200).stroke).toMatchObject({ width: 19, colour: '#000000' });
    expect(s.at(road, 48).y).toBe(500);
  });

  it('the car drives on and off over 5 s, wheels clockwise once a second; then reverses, wheels anticlockwise', () => {
    const { s, big } = task5();
    expect(placementOf(s.doc(), big.car, 20).x).toBe(-260);
    expect(placementOf(s.doc(), big.car, 108).x).toBe(500);
    expect(placementOf(s.doc(), big.car, 168).x).toBe(1260);
    expect(placementOf(s.doc(), big.car, 288).x).toBe(-260);
    expect(placementOf(s.doc(), big.wheel, 72).rotation).toBe(360);
    expect(placementOf(s.doc(), big.wheel, 168).rotation).toBe(1800);
    expect(placementOf(s.doc(), big.wheel, 192).rotation).toBe(1440);
    // The wheels sit on the road: their bottom at the road's top edge (500 − 19 / 2).
    const w = placementOf(s.doc(), big.wheel, 108);
    expect(w.y + 40).toBeCloseTo(490, 0);
  });

  it('the small cars follow their undulating paths, turned with them; one each way, wheels the right way round', () => {
    const { s, a, b } = task5();
    const pa = paths(s, a.car)[0]!;
    const pb = paths(s, b.car)[0]!;
    for (let f = 48; f <= 288; f += 6) {
      expect(offPath(pa, centreOf(s.at(a.car, f)))).toBeLessThan(0.5);
      expect(offPath(pb, centreOf(s.at(b.car, f)))).toBeLessThan(0.5);
    }
    expect(centreOf(s.at(a.car, 288)).x).toBeGreaterThan(centreOf(s.at(a.car, 48)).x);
    expect(centreOf(s.at(b.car, 288)).x).toBeLessThan(centreOf(s.at(b.car, 48)).x);
    // Turned with the path: the turn changes as the path rises and falls.
    const turns = [60, 120, 180, 240].map((f) => s.at(a.car, f).rotation);
    expect(Math.max(...turns) - Math.min(...turns)).toBeGreaterThan(10);
    // Car B, turned round, still looks the right way up (within a slope of upright).
    const bTurn = (((s.at(b.car, 150).rotation % 360) + 540) % 360) - 180;
    expect(Math.abs(bTurn)).toBeLessThan(45);
    expect(placementOf(s.doc(), a.wheel, 72).rotation).toBeGreaterThan(
      placementOf(s.doc(), a.wheel, 60).rotation,
    );
    expect(placementOf(s.doc(), b.wheel, 72).rotation).toBeLessThan(
      placementOf(s.doc(), b.wheel, 60).rotation,
    );
  });

  it('the guide paths are not drawn; it loops; saved as Chapter07_Task5 and exported as a 12 s MP4', async () => {
    const { s } = task5();
    const { ctx, calls } = recorder();
    drawStage(ctx, s.doc(), { frame: 100 });
    const strokes = calls.filter((c) => c === 'stroke()').length;
    expect(strokes).toBeLessThan(12);
    expect(s.anim.store.get().loop.on).toBe(true);
    await s.saveAndReopen('/work/Chapter07_Task5.mvea');
    await s.exportAndCheck('mp4', '/work/Chapter07_Task5.mp4', {
      name: 'Workbook Task 5',
      container: 'mp4',
      width: 1240,
      height: 800,
      duration: 12,
      tolerance: 0.1,
    });
  });
});

// ---------------------------------------------------------------------------------------------

const COMPUTERS = [
  'ZX Spectrum',
  'Commodore 64',
  'BBC Micro',
  'Atari ST',
  'Amiga 500',
  'Apple Macintosh',
  'Amstrad CPC',
  'IBM PC',
];

describe('Workbook Task 6 — Computers of the 1980s (WB p.105–107)', () => {
  const START = { x: 185, y: 445 };
  const CENTRE = { x: 400, y: 320 };

  async function task6() {
    const media = Object.fromEntries(COMPUTERS.map((n) => [`/task6/${n}.png`, picture(240, 180)]));
    const s = studio(media);
    s.stage({ width: 800, height: 600, background: '#ffffff', length: 792 });
    s.anim.setView({ rulers: true, grid: { show: true, size: 10, over: false } });
    // The heading, centred with the ruler and grid.
    s.anim.addText({ x: 0, y: 20 }, 'Computers of the 1980s');
    const heading = s.last().id;
    s.type(heading, 0, {
      size: 40,
      bold: true,
      fill: { kind: 'solid', colour: '#e8501c' },
    } as Partial<TextObject>);
    s.type(heading, 0, { x: (800 - s.at(heading, 0).width) / 2 });
    // The introduction scrolls up the screen over seven seconds, getting smaller (Star Wars).
    const lines = [
      'A long time ago',
      'in a galaxy far, far away...',
      '',
      'Actually it was',
      'on earth',
      'In the 1980s.',
      '',
      'There was an explosion',
      'in the manufacture of computers.',
    ];
    s.anim.addText({ x: 0, y: 600 }, lines.join('\n'));
    const intro = s.last().id;
    s.type(intro, 0, { size: 28, bold: true, align: 'centre' } as Partial<TextObject>);
    s.type(intro, 0, { x: (800 - s.at(intro, 0).width) / 2 });
    s.type(intro, 168, { y: -s.at(intro, 0).height, size: 14 } as Partial<TextObject>);
    // Two guide paths: out to the centre, and a different way back.
    const guides = layer(s, 'Guides');
    const out = wavy(s, [START, { x: 260, y: 300 }, CENTRE], 40);
    const back = wavy(s, [CENTRE, { x: 380, y: 520 }, START], 40);
    s.anim.toggleLayer(guides, 'visible');
    layer(s, 'Computers');
    const ids: Id[] = [];
    for (const [i, name] of COMPUTERS.entries()) {
      const s0 = 168 + 72 * i;
      s.dialogs.openMedia.mockResolvedValueOnce([`/task6/${name}.png`]);
      await s.anim.addPicture({ x: 0, y: 0 });
      const id = s.last().id;
      ids.push(id);
      expect(s.anim.followPath(id, out)).toBeNull();
      expect(s.anim.setMotion(id, 0, { from: s0, to: s0 + 24 })).toBeNull();
      expect(s.anim.followPath(id, back)).toBeNull();
      expect(s.anim.setMotion(id, 1, { from: s0 + 48, to: s0 + 72 })).toBeNull();
      // From nothing to full size on the way in; back to nothing on the way out.
      s.anim.setFrame(s0);
      s.anim.insertKeyframe(id, 'width');
      s.anim.insertKeyframe(id, 'height');
      s.type(id, s0, { width: 0, height: 0 });
      s.type(id, s0 + 24, { width: 240, height: 180 });
      s.anim.setFrame(s0 + 48);
      s.anim.insertKeyframe(id, 'width');
      s.anim.insertKeyframe(id, 'height');
      s.type(id, s0 + 72, { width: 0, height: 0 });
    }
    // THE END moves in from the left to the centre over the last two seconds.
    s.anim.addText({ x: -300, y: 260 }, 'THE END');
    const end = s.last().id;
    s.type(end, 0, { size: 64, bold: true } as Partial<TextObject>);
    s.anim.setFrame(744);
    s.anim.insertKeyframe(end, 'x');
    s.type(end, 792, { x: (800 - s.at(end, 0).width) / 2 });
    return { s, heading, intro, ids, end };
  }

  it('the heading is centred; the introduction scrolls up over 7 s and gets smaller', async () => {
    const { s, heading, intro } = await task6();
    const h = s.at(heading, 0);
    expect(h.x + h.width / 2).toBeCloseTo(400, 6);
    expect(s.at(intro, 0).y).toBe(600);
    expect(s.at(intro, 84).y).toBeLessThan(600);
    // At 7 s the whole text has scrolled off the top of the stage.
    expect(s.at(intro, 168).y + s.at(intro, 168).height).toBeLessThan(0);
    expect((s.at(intro, 168) as TextObject).size).toBe(14);
    expect((s.at(intro, 0) as TextObject).text.split('\n')).toHaveLength(9);
  });

  it('each computer grows in along one path to the centre, stays 1 s, and shrinks away along another; one after another', async () => {
    const { s, ids } = await task6();
    for (const [i, id] of ids.entries()) {
      const s0 = 168 + 72 * i;
      const [outPath, backPath] = paths(s, id) as [MotionPath, MotionPath];
      expect(s.at(id, s0 - 1)).toMatchObject({ width: 0, height: 0 });
      const going = s.at(id, s0 + 12);
      expect(going.width).toBe(120);
      expect(offPath(outPath, centreOf(going))).toBeLessThan(0.5);
      expect(centreOf(s.at(id, s0 + 36))).toEqual(CENTRE);
      expect(s.at(id, s0 + 36)).toMatchObject({ width: 240, height: 180 });
      const leaving = s.at(id, s0 + 60);
      expect(offPath(backPath, centreOf(leaving))).toBeLessThan(0.5);
      expect(offPath(outPath, centreOf(leaving))).toBeGreaterThan(5);
      expect(s.at(id, s0 + 72)).toMatchObject({ width: 0, height: 0 });
      expect(centreOf(s.at(id, s0 + 72))).toEqual(START);
    }
  });

  it('THE END moves in from the left to the centre over 2 s; exported as a 33 s MP4', async () => {
    const { s, end } = await task6();
    expect(s.at(end, 744).x).toBe(-300);
    const done = s.at(end, 792);
    expect(done.x + done.width / 2).toBeCloseTo(400, 6);
    await s.saveAndReopen('/work/Chapter07_Task6.mvea');
    await s.exportAndCheck('mp4', '/work/Chapter07_Task6.mp4', {
      name: 'Workbook Task 6',
      container: 'mp4',
      width: 800,
      height: 600,
      duration: 33,
      tolerance: 0.1,
    });
  });
});

// ---------------------------------------------------------------------------------------------

describe('Coursebook Practical Activity 19.04 — paths (CB p.456)', () => {
  it('1–2: two red balls, each following a path drawn for it', () => {
    const s = studio();
    const first = wavy(s, [
      { x: 100, y: 600 },
      { x: 400, y: 200 },
      { x: 800, y: 500 },
      { x: 1100, y: 150 },
    ]);
    const second = wavy(s, [
      { x: 1100, y: 650 },
      { x: 640, y: 360 },
      { x: 150, y: 100 },
    ]);
    for (const path of [first, second]) {
      s.anim.addShape('ellipse', { x: 0, y: 0, width: 60, height: 60 });
      const ball = s.last().id;
      s.type(ball, 0, { fill: { kind: 'solid', colour: '#ff0000' } });
      expect(s.anim.followPath(ball, path)).toBeNull();
      const m = paths(s, ball)[0]!;
      for (let f = 0; f <= 120; f += 10)
        expect(offPath(m, centreOf(s.at(ball, f)))).toBeLessThan(0.5);
      expect(centreOf(s.at(ball, 0))).toEqual(m.points[0]!);
    }
  });

  it('3: the car goes round a track with bends, turning with it', () => {
    const s = studio();
    s.anim.addPath(
      [
        { x: 200, y: 150 },
        { x: 1080, y: 150 },
        { x: 1080, y: 570 },
        { x: 200, y: 570 },
      ],
      true,
    );
    const track = s.last().id;
    [0, 1, 2, 3].forEach((i) =>
      s.anim.editPath(track, 'Curve point', (p) => {
        const a = p.points[i]!;
        return pullHandles(p, i, {
          x: p.x + a.x + (i < 2 ? 80 : -80),
          y: p.y + a.y + (i % 3 === 0 ? -40 : 40),
        });
      }),
    );
    s.anim.addShape('rect', { x: 0, y: 0, width: 80, height: 30 });
    const carId = s.last().id;
    s.anim.followPath(carId, track);
    s.anim.setMotion(carId, 0, { orient: true });
    const m = paths(s, carId)[0]!;
    expect(m.closed).toBe(true);
    // Round the track and back to the start, having turned all the way round.
    expect(centreOf(s.at(carId, 120)).x).toBeCloseTo(centreOf(s.at(carId, 0)).x, 6);
    const turns = Array.from({ length: 13 }, (_, k) => s.at(carId, k * 10).rotation);
    expect(Math.max(...turns) - Math.min(...turns)).toBeGreaterThan(180);
  });
});

describe('Coursebook Practical Activity 19.05 — shape tweens (CB p.458)', () => {
  it('1: a red circle into a blue square', () => {
    const s = studio();
    s.anim.addShape('ellipse', { x: 100, y: 100, width: 120, height: 120 });
    const circle = s.last().id;
    s.type(circle, 0, { fill: { kind: 'solid', colour: '#ff0000' } });
    s.anim.addShape('rect', { x: 600, y: 100, width: 120, height: 120 });
    const square = s.last().id;
    s.type(square, 0, { fill: { kind: 'solid', colour: '#0000ff' } });
    s.anim.setFrame(48);
    expect(s.anim.morphInto(circle, square)).toBeNull();
    expect(colourOf(s.at(circle, 24))).toBe('#800080');
    expect(s.at(circle, 24).x).toBe(350);
    expect((s.at(circle, 48) as AnimObject as PathObject).points).toHaveLength(4);
    expect(colourOf(s.at(circle, 48))).toBe('#0000ff');
  });

  it('2: a rain cloud into a sun', () => {
    const s = studio();
    const bumps = Array.from({ length: 16 }, (_, k) => {
      const a = (2 * Math.PI * k) / 16;
      const r = k % 2 === 0 ? 1 : 0.8;
      return { x: 300 + 160 * r * Math.cos(a), y: 200 + 80 * r * Math.sin(a) };
    });
    s.anim.addPath(bumps, true);
    const cloud = s.last().id;
    s.type(cloud, 0, { name: 'Rain cloud', fill: { kind: 'solid', colour: '#6b7280' } });
    s.anim.addShape('star', { x: 220, y: 120, width: 160, height: 160 });
    const sun = s.last().id;
    s.type(sun, 0, {
      name: 'Sun',
      points: 12,
      fill: { kind: 'solid', colour: '#facc15' },
    } as Partial<AnimObject>);
    s.anim.setFrame(72);
    s.anim.morphInto(cloud, sun);
    const end = s.at(cloud, 72) as AnimObject as PathObject;
    expect(end.points).toHaveLength(24);
    expect(colourOf(end)).toBe('#facc15');
    expect((s.at(cloud, 36) as AnimObject as PathObject).closed).toBe(true);
  });

  it('4: the bubbles get smaller as they rise to the surface', () => {
    const s = studio();
    s.anim.addShape('ellipse', { x: 600, y: 650, width: 40, height: 40 });
    const bubble = s.last().id;
    s.type(bubble, 96, { y: 0, width: 10, height: 10 });
    expect(s.at(bubble, 48)).toMatchObject({ y: 325, width: 25 });
    expect(s.at(bubble, 96)).toMatchObject({ y: 0, width: 10, height: 10 });
  });
});

describe('Coursebook Practical Activity 19.06 — a continuous, repeating underwater scene (CB p.463)', () => {
  it('2: the weed sways again and again and the fish swim through; the end leads straight back to the start', () => {
    const s = studio();
    s.stage({ length: 96, background: '#0e7490' });
    s.anim.addShape('rect', { x: 300, y: 400, width: 30, height: 320 });
    const weed = s.last().id;
    for (const [f, r] of [
      [24, 10],
      [48, 0],
      [72, -10],
      [96, 0],
    ] as const)
      s.type(weed, f, { rotation: r });
    s.anim.setRepeat(weed, 'rotation', 'end');
    s.anim.addShape('ellipse', { x: -120, y: 200, width: 100, height: 50 });
    const fish = s.last().id;
    s.type(fish, 96, { x: 1300 });
    expect(s.at(weed, 0).rotation).toBe(s.at(weed, 96).rotation);
    expect(s.at(weed, 24).rotation).toBe(10);
    expect(s.at(fish, 0).x + s.at(fish, 0).width).toBeLessThanOrEqual(0);
    expect(s.at(fish, 96).x).toBeGreaterThanOrEqual(1280);
    s.anim.setLoop({ on: true });
    expect(s.anim.store.get().loop.on).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------

describe("Coursebook exam-style question 1 — Saif's Comics (CB p.465)", () => {
  function saif() {
    const s = studio();
    const size = presetSize('2.35:1', { height: 400 });
    s.stage({ ...size, background: '#000000', length: 360 });
    const word = (text: string) => {
      s.anim.addText({ x: 40, y: 0 }, text);
      s.type(s.last().id, 0, {
        size: 400 / 1.2,
        fill: { kind: 'solid', colour: '#ffffff' },
      } as Partial<TextObject>);
      s.anim.splitText();
      return [...s.anim.store.get().selection];
    };
    // "Saif's" is there at the start; its letters fade out one at a time, a second each.
    const saifs = word("Saif's");
    saifs.forEach((id, i) => {
      s.anim.setFrame(24 * i);
      s.anim.insertKeyframe(id, 'opacity');
      s.type(id, 24 * i + 24, { opacity: 0 });
    });
    // "Comics" fades in as a whole word over 1 s, stays 2 s, then fades out a letter at a time.
    const comics = word('Comics');
    comics.forEach((id, i) => {
      s.type(id, 0, { opacity: 0 });
      s.anim.setFrame(144);
      s.anim.insertKeyframe(id, 'opacity');
      s.type(id, 168, { opacity: 100 });
      s.anim.setFrame(216 + 24 * i);
      s.anim.insertKeyframe(id, 'opacity');
      s.type(id, 240 + 24 * i, { opacity: 0 });
    });
    s.anim.setLoop({ on: true });
    return { s, saifs, comics };
  }

  it('2.35:1, black throughout; large white letters the full height of the banner', () => {
    const { s, saifs } = saif();
    expect(s.doc().stage).toMatchObject({ width: 940, height: 400, background: '#000000' });
    for (const id of saifs) {
      expect(s.at(id, 0).height).toBeCloseTo(400, 6);
      expect(colourOf(s.at(id, 0))).toBe('#ffffff');
    }
  });

  it("Saif's fades a letter a second; Comics fades in whole, stays 2 s, then a letter a second", () => {
    const { s, saifs, comics } = saif();
    expect(saifs).toHaveLength(6);
    expect(s.at(saifs[0]!, 12).opacity).toBe(50);
    expect(s.at(saifs[1]!, 12).opacity).toBe(100);
    expect(s.at(saifs[5]!, 132).opacity).toBe(50);
    for (const id of comics) {
      expect(s.at(id, 140).opacity).toBe(0);
      expect(s.at(id, 156).opacity).toBe(50);
      expect(s.at(id, 200).opacity).toBe(100);
    }
    expect(s.at(comics[0]!, 228).opacity).toBe(50);
    expect(s.at(comics[1]!, 228).opacity).toBe(100);
    expect(comics.every((id) => s.at(id, 360).opacity === 0)).toBe(true);
  });

  it('loops, and is exported as an animated GIF for the website', async () => {
    const { s } = saif();
    expect(s.anim.store.get().loop.on).toBe(true);
    await s.exportAndCheck('gif', "/work/Saif's Comics.gif", {
      name: "Saif's Comics",
      container: 'gif',
      width: 940,
      height: 400,
      duration: 15,
      tolerance: 0.2,
    });
  });
});

describe("Coursebook exam-style question 2 — Henry's Homes (CB p.465–466)", () => {
  async function henry() {
    const s = studio({ '/henry/Henry logo.jpg': picture(240, 120) });
    s.stage({ width: 1280, height: 720, background: '#cfe8ff', length: 240 });
    // The logo on the left pulses: bigger, then back, again and again.
    s.dialogs.openMedia.mockResolvedValueOnce(['/henry/Henry logo.jpg']);
    await s.anim.addPicture({ x: 40, y: 300 });
    const logo = s.last().id;
    s.type(logo, 12, { x: 16, y: 288, width: 288, height: 144 });
    s.type(logo, 24, { x: 40, y: 300, width: 240, height: 120 });
    for (const p of ['x', 'y', 'width', 'height'] as const) s.anim.setRepeat(logo, p, 'end');
    // The sentence, revealed where the ball has passed (a mask that grows behind the ball).
    layer(s, 'Words 1');
    s.anim.addText({ x: 320, y: 300 }, 'We take pride in selling your property');
    const sentence = s.last().id;
    s.type(sentence, 0, { size: 40 } as Partial<TextObject>);
    const reveal = layer(s, 'Reveal');
    s.anim.addShape('rect', { x: 0, y: 0, width: 1280, height: 720 });
    const wipe = s.last().id;
    s.anim.setFrame(72);
    s.anim.insertKeyframe(wipe, 'width');
    s.type(wipe, 0, { width: 0 });
    s.anim.toggleLayer(reveal, 'mask');
    // "No sale, no fee", seen only through the ball as it passes the second time (the mask).
    layer(s, 'Words 2');
    s.anim.addText({ x: 420, y: 420 }, 'No sale, no fee');
    const offer = s.last().id;
    s.type(offer, 0, { size: 48 } as Partial<TextObject>);
    const spot = layer(s, 'Spotlight');
    s.anim.addShape('ellipse', { x: -160, y: 380, width: 160, height: 160 });
    const spotlight = s.last().id;
    s.anim.setFrame(156);
    s.anim.insertKeyframe(spotlight, 'x');
    s.type(spotlight, 228, { x: 1280 });
    s.anim.toggleLayer(spot, 'mask');
    // The white ball: in from the left to the right, back off the left, off for 1.5 s, across again.
    layer(s, 'Ball');
    s.anim.addShape('ellipse', { x: -100, y: 290, width: 100, height: 100 });
    const ball = s.last().id;
    s.type(ball, 0, { fill: { kind: 'solid', colour: '#ffffff' } });
    s.type(ball, 72, { x: 1280 });
    s.type(ball, 120, { x: -100 });
    s.anim.setFrame(156);
    s.anim.insertKeyframe(ball, 'x');
    s.type(ball, 228, { x: 1280 });
    s.anim.setLoop({ on: true });
    return { s, logo, sentence, offer, ball, spotlight };
  }

  it('16:9 and pale blue; the logo on the left pulses all the way through', async () => {
    const { s, logo } = await henry();
    expect(s.doc().stage).toMatchObject({ width: 1280, height: 720, background: '#cfe8ff' });
    expect(s.at(logo, 12).width).toBe(288);
    expect(s.at(logo, 24).width).toBe(240);
    expect(s.at(logo, 36).width).toBe(288);
    expect(s.at(logo, 228).width).toBe(288);
    expect(centreOf(s.at(logo, 12))).toEqual(centreOf(s.at(logo, 0)));
  });

  it('the ball crosses, goes back off the left, stays off for 1.5 s, then crosses again', async () => {
    const { s, ball } = await henry();
    expect(s.at(ball, 36).x).toBe(590);
    expect(s.at(ball, 120).x).toBe(-100);
    for (const f of [121, 140, 156]) expect(s.at(ball, f).x).toBe(-100);
    expect((156 - 120) / 24).toBe(1.5);
    expect(s.at(ball, 192).x).toBe(590);
  });

  it('the sentence shows only where the ball has passed; "No sale, no fee" only through the ball', async () => {
    const { s } = await henry();
    const halfway = recorder();
    drawStage(halfway.ctx, s.doc(), { frame: 36 });
    const clip = halfway.calls.indexOf('clip()');
    expect(clip).toBeGreaterThan(-1);
    const wipe = halfway.calls.slice(0, clip).filter((c) => /^(moveTo|lineTo)\(/.test(c));
    expect(Math.max(...wipe.map((c) => Number(c.slice(c.indexOf('(') + 1).split(',')[0])))).toBe(
      640,
    );
    expect(halfway.calls.findIndex((c) => c.startsWith('fillText(We take pride'))).toBeGreaterThan(
      clip,
    );
    // On the second pass the clip is the ball, round "sale".
    const second = recorder();
    drawStage(second.ctx, s.doc(), { frame: 192 });
    const clips = second.calls.reduce<number[]>(
      (all, c, i) => (c === 'clip()' ? [...all, i] : all),
      [],
    );
    expect(clips).toHaveLength(2);
    const ring = second.calls
      .slice(clips[0]! + 1, clips[1]!)
      .filter((c) => /^(moveTo|lineTo)\(/.test(c))
      .map(
        (c) =>
          c
            .slice(c.indexOf('(') + 1, -1)
            .split(',')
            .map(Number) as [number, number],
      );
    const xs = ring.slice(-64).map(([x]) => x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(640, -1);
    expect(
      second.calls.findIndex((c, i) => i > clips[1]! && c.startsWith('fillText(No sale, no fee')),
    ).toBeGreaterThan(clips[1]!);
  });

  it('loops; exported as an MP4 to view on a computer', async () => {
    const { s } = await henry();
    await s.saveAndReopen("/work/Henry's Homes.mvea");
    expect(
      s
        .doc()
        .layers.filter((l) => l.mask)
        .map((l) => l.name),
    ).toEqual(['Reveal', 'Spotlight']);
    await s.exportAndCheck('mp4', "/work/Henry's Homes.mp4", {
      name: "Henry's Homes",
      container: 'mp4',
      width: 1280,
      height: 720,
      duration: 10,
      tolerance: 0.1,
    });
  });
});

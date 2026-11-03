// M16 exit gate (phase 2): the workbook's worked example (Star Designs, MP4 and HTML), Task 7
// (flowchart iteration) and Task 8 (bubble sort) built as frame-by-frame layers plus tweens, a stop
// motion made with Import frames, and the coursebook's Practical Activity 19.07 (every export
// format) — built through Animation mode's use cases, checked frame by frame, saved and opened
// again, exported and passed by the task checker (T6). Task 3 and Task 6 with real picture files
// are run in the real app (tests/e2e/acceptance-m16.spec.ts).
import { describe, expect, it } from 'vitest';
import { centreOf } from '../../src/core/animation/geometry.ts';
import { findObject } from '../../src/core/animation/layers.ts';
import { stateAt } from '../../src/core/animation/state.ts';
import type { Id, TextObject } from '../../src/core/animation/types.ts';
import { sequenceInfo, checkFile } from '../../src/core/teaching/task-check.ts';
import { picture, studio, type Studio } from '../helpers/animation-studio.ts';

/** A new layer with a name; it becomes the layer new objects go on. */
function layer(s: Studio, name: string): Id {
  s.anim.addLayer();
  const id = s.anim.store.get().layerId;
  s.anim.renameLayer(id, name);
  return id;
}

/** Words on the stage, `size` px, in a colour. */
function words(
  s: Studio,
  at: { x: number; y: number },
  text: string,
  size = 28,
  colour = '#000000',
) {
  s.anim.addText(at, text);
  // The new words are selected (s.last() is the front object of the top layer, maybe another).
  const id = s.anim.store.get().selection[0]!;
  s.type(id, s.anim.store.get().frame, {
    size,
    fill: { kind: 'solid', colour },
  } as Partial<TextObject>);
  return id;
}

/** The words shown on a layer at a frame (a frame-by-frame layer shows one drawing). */
const shownWords = (s: Studio, layerId: Id, frame: number): string[] =>
  stateAt(s.doc(), frame)
    .layers.find((l) => l.id === layerId)!
    .objects.filter((o): o is TextObject => o.kind === 'text')
    .map((o) => o.text);

/** Exports the web page and checks it with the task checker, as a student would in Learn mode. */
async function checkWebPage(s: Studio, output: string, spec: Parameters<typeof checkFile>[0]) {
  s.dialogs.exportAnimation.mockResolvedValueOnce(output);
  await s.anim.exportAnimation('html');
  expect(s.disk.get(output)).toBeTruthy();
  s.app.learn.setTask(spec);
  s.dialogs.openExport.mockResolvedValueOnce([output]);
  await s.app.learn.checkExport();
  const checked = s.app.learn.store.get().task.checked!;
  expect(checked.rows.filter((r) => !r.pass)).toEqual([]);
  expect(checked.pass).toBe(true);
}

// ---------------------------------------------------------------------------------------------

describe('Workbook worked example — Star Designs (WB p.95–97)', () => {
  const GREY = '#a0a0a0';
  const COLOURS = ['#e8364f', '#3f6fd8', '#c86fd6', '#5cd65c'];

  function starDesigns() {
    const s = studio();
    s.stage({ width: 600, height: 400, background: GREY, length: 144 });
    // Two stars with gradient fills enter from the top over two seconds.
    const starsLayer = layer(s, 'Stars');
    const star = (x: number, from: string, to: string) => {
      s.anim.setFrame(0);
      s.anim.addShape('star', { x, y: -140, width: 135, height: 135 });
      const id = s.last().id;
      s.type(id, 0, { fill: { kind: 'linear', from, to, angle: 45 } });
      s.type(id, 48, { y: 60 });
      return id;
    };
    const left = star(40, '#e83a3a', '#3a6fe8');
    const right = star(425, '#f0c060', '#e060c0');
    // Then they turn, the left one clockwise and the right one anticlockwise, a turn a second,
    // and stop at the end: from 2 s, four turns (the first, then three more).
    for (const [id, turn] of [
      [left, 360],
      [right, -360],
    ] as const) {
      s.anim.setFrame(48);
      s.anim.insertKeyframe(id, 'rotation');
      s.type(id, 72, { rotation: turn });
      s.anim.setRepeat(id, 'rotation', 3);
    }
    // The coloured letters of "Star" fly in, each from its own side, until they are between the stars.
    const textLayer = layer(s, 'Words');
    s.anim.setFrame(0);
    const starWord = words(s, { x: 210, y: 70 }, 'Star', 72);
    s.anim.select([starWord]);
    s.anim.splitText();
    const letters = s.anim.store.get().selection;
    const from = [
      { x: -80, y: 70 },
      { x: 250, y: -90 },
      { x: 300, y: 420 },
      { x: 640, y: 70 },
    ];
    letters.forEach((id, i) => {
      const home = s.at(id, 0);
      // Off the stage until 2 s, then in to its place by 4 s.
      s.type(id, 0, { fill: { kind: 'solid', colour: COLOURS[i]! }, x: from[i]!.x, y: from[i]!.y });
      s.anim.setFrame(48);
      s.anim.insertKeyframe(id, 'x');
      s.anim.insertKeyframe(id, 'y');
      s.type(id, 96, { x: home.x, y: home.y });
    });
    // "Designs", also in coloured letters, grows from nothing to the same size in the last two seconds.
    s.anim.setFrame(0);
    const designs = words(s, { x: 160, y: 200 }, 'Designs', 72);
    s.anim.select([designs]);
    s.anim.splitText();
    const parts = s.anim.store.get().selection;
    parts.forEach((id, i) =>
      s.type(id, 0, { fill: { kind: 'solid', colour: COLOURS[i % COLOURS.length]! } }),
    );
    s.anim.select(parts);
    s.anim.group();
    const group = s.anim.store.get().selection[0]!;
    const full = s.at(group, 0);
    const middle = centreOf(full);
    // Nothing until 4 s (a keyframe fixes that), then it grows to full size by 6 s.
    s.type(group, 0, { x: middle.x, y: middle.y, width: 0, height: 0, opacity: 0 });
    s.anim.setFrame(96);
    s.anim.insertKeyframe(group, 'all');
    s.type(group, 144, {
      x: full.x,
      y: full.y,
      width: full.width,
      height: full.height,
      opacity: 100,
    });
    s.anim.setFrame(0);
    return { s, left, right, letters, group, full, starsLayer, textLayer };
  }

  it('the stars come down from above the stage over 2 s', () => {
    const { s, left, right } = starDesigns();
    expect(s.at(left, 0).y + s.at(left, 0).height).toBeLessThanOrEqual(0);
    expect(s.at(left, 48).y).toBe(60);
    expect(s.at(right, 24).y).toBe(-40);
    expect(s.at(left, 0).fill).toMatchObject({ kind: 'linear' });
  });

  it('then turn once a second, the left clockwise and the right anticlockwise, and stop at the end', () => {
    const { s, left, right } = starDesigns();
    expect(s.at(left, 48).rotation).toBe(0);
    expect(s.at(left, 60).rotation).toBe(180);
    expect(s.at(right, 60).rotation).toBe(-180);
    // Still turning in the last second, a whole number of turns at the end.
    expect(s.at(left, 132).rotation).toBe(180);
    expect(s.at(left, 144).rotation % 360).toBe(0);
    expect(s.at(left, 143).rotation).toBeGreaterThan(s.at(left, 132).rotation);
  });

  it('the letters of "Star" fly in from four sides between 2 s and 4 s and end between the stars', () => {
    const { s, letters, left, right } = starDesigns();
    expect(letters).toHaveLength(4);
    const sides = letters.map((id) => s.at(id, 48));
    expect(sides[0]!.x).toBeLessThan(0);
    expect(sides[1]!.y).toBeLessThan(0);
    expect(sides[2]!.y).toBeGreaterThan(400);
    expect(sides[3]!.x).toBeGreaterThan(600);
    for (const id of letters) {
      const o = s.at(id, 96);
      expect(o.x).toBeGreaterThan(s.at(left, 96).x + 135);
      expect(o.x + o.width).toBeLessThan(s.at(right, 96).x);
    }
    expect(
      new Set(letters.map((id) => (s.at(id, 96).fill as { colour: string }).colour)).size,
    ).toBe(4);
  });

  it('"Designs" grows from nothing, about its centre, to the size of "Star" over the last 2 s', () => {
    const { s, group, full, letters } = starDesigns();
    expect(s.at(group, 96)).toMatchObject({ width: 0, height: 0, opacity: 0 });
    const half = s.at(group, 120);
    expect(half.width).toBeCloseTo(full.width / 2, 6);
    expect(centreOf(half).x).toBeCloseTo(centreOf(full).x, 6);
    expect(s.at(group, 144)).toMatchObject({
      width: full.width,
      height: full.height,
      opacity: 100,
    });
    const g = findObject(s.doc(), group)!.object;
    expect(g.kind === 'group' && (g.children[0] as TextObject).size).toBe(
      (s.at(letters[0]!, 0) as TextObject).size,
    );
  });

  it('is saved, opened again, and exported as a 6 s MP4 and a web page that loops', async () => {
    const { s } = starDesigns();
    await s.saveAndReopen('/work/WorkedExample.mvea');
    const spec = {
      name: 'Star Designs',
      width: 600,
      height: 400,
      fps: 24,
      duration: 6,
      tolerance: 0.1,
    };
    await s.exportAndCheck('mp4', '/work/WorkedExample.mp4', { ...spec, container: 'mp4' });
    await checkWebPage(s, '/work/WorkedExample.html', { ...spec, container: 'html', loop: true });
  });
});

// ---------------------------------------------------------------------------------------------

describe('Workbook Task 7 — flowchart iteration as frame-by-frame plus tweens (WB p.107–109)', () => {
  const PINK = '#f2a7d0';

  function task7() {
    const s = studio();
    s.stage({ width: 800, height: 600, background: '#ffffff', length: 240 });
    // The flowchart stays still on its own layer.
    const chart = s.doc().layers[0]!.id;
    s.anim.renameLayer(chart, 'Flowchart');
    words(s, { x: 340, y: 20 }, 'Iteration', 32, '#e03c3c');
    words(
      s,
      { x: 40, y: 70 },
      'Iteration means repeating a series of instructions until a condition is met.',
      18,
    );
    s.anim.addShape('rect', { x: 300, y: 130, width: 200, height: 50 });
    words(s, { x: 320, y: 145 }, 'Generate random number', 16);
    s.anim.addShape('polygon', { x: 300, y: 250, width: 200, height: 140 });
    words(s, { x: 335, y: 310 }, 'Random number = 3?', 16);
    s.anim.addShape('rect', { x: 300, y: 470, width: 200, height: 50 });
    words(s, { x: 380, y: 485 }, 'End', 16);
    s.anim.addLine({ x: 400, y: 180 }, { x: 400, y: 250 });
    s.anim.addLine({ x: 400, y: 390 }, { x: 400, y: 470 });
    s.anim.addPath(
      [
        { x: 500, y: 320 },
        { x: 600, y: 320 },
        { x: 600, y: 155 },
        { x: 500, y: 155 },
      ],
      false,
    );
    const loopPath = s.last().id;
    s.anim.toggleLayer(chart, 'locked');

    // Each step is a drawing of its own: a frame-by-frame layer.
    const steps = layer(s, 'Steps');
    expect(s.anim.makeFrameByFrame()).toBeNull();
    const step = (frame: number, at: { x: number; y: number }, text: string) => {
      s.anim.setFrame(frame);
      expect(s.anim.insertDrawing('blank')).toBeNull();
      s.anim.addShape('rect', { x: at.x - 10, y: at.y - 10, width: 220, height: 46 });
      s.type(s.last().id, frame, { fill: { kind: 'solid', colour: PINK } });
      words(s, at, text, 18, '#000000');
    };
    // First time round: different numbers, so it loops back.
    step(24, { x: 300, y: 140 }, 'Random number = 6');
    s.anim.setFrame(48);
    expect(s.anim.insertDrawing('copy')).toBeNull(); // the number stays; the question is added
    words(s, { x: 320, y: 305 }, 'Does random number = 3?', 16);
    step(72, { x: 610, y: 300 }, 'False');
    step(96, { x: 610, y: 200 }, 'Loop round and do it all again.');
    // Second time round: the same numbers, so it goes on to the end.
    step(120, { x: 300, y: 140 }, 'Random number = 3');
    s.anim.setFrame(144);
    s.anim.insertDrawing('copy');
    words(s, { x: 320, y: 305 }, 'Does random number = 3?', 16);
    step(168, { x: 410, y: 420 }, 'True');
    step(192, { x: 300, y: 480 }, 'The numbers are equal: End');

    // A dot follows the flow: back round the loop (a motion path), then down to the end (a tween).
    layer(s, 'Dot');
    s.anim.setFrame(0);
    s.anim.addShape('ellipse', { x: 392, y: 142, width: 16, height: 16 });
    const dot = s.last().id;
    s.type(dot, 0, { fill: { kind: 'solid', colour: '#e03c3c' } });
    expect(s.anim.followPath(dot, loopPath)).toBeNull();
    expect(s.anim.setMotion(dot, 0, { from: 96, to: 120 })).toBeNull();
    return { s, steps, dot, loopPath };
  }

  it('shows each step as its own drawing: the number, the question, False, then the loop', () => {
    const { s, steps } = task7();
    expect(shownWords(s, steps, 0)).toEqual([]);
    expect(shownWords(s, steps, 30)).toEqual(['Random number = 6']);
    expect(shownWords(s, steps, 50)).toEqual(['Random number = 6', 'Does random number = 3?']);
    expect(shownWords(s, steps, 80)).toEqual(['False']);
    expect(shownWords(s, steps, 100)).toEqual(['Loop round and do it all again.']);
  });

  it('cycles twice: the second time the numbers are equal and the flowchart moves to the end', () => {
    const { s, steps } = task7();
    expect(shownWords(s, steps, 125)).toEqual(['Random number = 3']);
    expect(shownWords(s, steps, 150)).toEqual(['Random number = 3', 'Does random number = 3?']);
    expect(shownWords(s, steps, 170)).toEqual(['True']);
    expect(shownWords(s, steps, 239)).toEqual(['The numbers are equal: End']);
    const fbf = s.doc().layers.find((l) => l.id === steps)!;
    expect(fbf.drawings).toEqual([0, 24, 48, 72, 96, 120, 144, 168, 192]);
  });

  it('the dot goes round the loop arrow, from the question back to the number, while it loops', () => {
    const { s, dot } = task7();
    expect(centreOf(s.at(dot, 96))).toEqual({ x: 500, y: 320 });
    const half = centreOf(s.at(dot, 108));
    expect(half.x).toBeCloseTo(600, 0);
    expect(centreOf(s.at(dot, 120))).toEqual({ x: 500, y: 155 });
  });

  it('is saved, opened again and exported as Chapter07_Task7.mp4 and a web page', async () => {
    const { s, steps } = task7();
    await s.saveAndReopen('/work/Chapter07_Task7.mvea');
    expect(shownWords(s, steps, 80)).toEqual(['False']);
    const spec = {
      name: 'Workbook Task 7',
      width: 800,
      height: 600,
      fps: 24,
      duration: 10,
      tolerance: 0.1,
    };
    await s.exportAndCheck('mp4', '/work/Chapter07_Task7.mp4', { ...spec, container: 'mp4' });
    await checkWebPage(s, '/work/Chapter07_Task7.html', { ...spec, container: 'html' });
  });
});

// ---------------------------------------------------------------------------------------------

describe('Workbook Task 8 — bubble sort as frame-by-frame plus tweens (WB p.110)', () => {
  const NUMBERS = [4, 5, 3, 2, 7, 1, 6];
  const X = (i: number) => 120 + 80 * i;
  const COMPARE = 12; // half a second for each pair
  const INTRO = 24; // a second to name each pass

  /** The passes of a bubble sort: each pair compared, and whether it is swapped. */
  function passes(list: number[]) {
    const a = [...list];
    const out: { pairs: { j: number; swap: boolean }[] }[] = [];
    for (let p = 0; p < a.length - 1; p++) {
      const pairs: { j: number; swap: boolean }[] = [];
      for (let j = 0; j < a.length - 1 - p; j++) {
        const swap = a[j]! > a[j + 1]!;
        if (swap) [a[j], a[j + 1]] = [a[j + 1]!, a[j]!];
        pairs.push({ j, swap });
      }
      out.push({ pairs });
    }
    return out;
  }

  function task8() {
    const s = studio();
    const plan = passes(NUMBERS);
    const length = plan.reduce((n, p) => n + INTRO + p.pairs.length * COMPARE, 0) + 2 * INTRO;
    s.stage({ width: 800, height: 450, background: '#ffffff', length });
    // The numbers, which tween to swap places.
    const numbers = s.doc().layers[0]!.id;
    s.anim.renameLayer(numbers, 'Numbers');
    const ids = NUMBERS.map((n, i) => words(s, { x: X(i), y: 200 }, String(n), 48));
    // The pass's name and the explanation, a drawing per pass.
    const titles = layer(s, 'Passes');
    s.anim.makeFrameByFrame();
    // The pair being compared: a box with held keyframes, one per comparison.
    layer(s, 'Pair');
    s.anim.setFrame(0);
    s.anim.addShape('rect', { x: X(0) - 10, y: 190, width: 150, height: 80 });
    const box = s.last().id;
    s.type(box, 0, { fill: { kind: 'none' }, opacity: 0 });

    let order = [...ids];
    let frame = 0;
    const starts: number[] = [];
    plan.forEach(({ pairs }, p) => {
      starts.push(frame);
      s.anim.select([]);
      s.anim.store.update((st) => ({ ...st, layerId: titles }));
      s.anim.setFrame(frame);
      if (frame > 0) s.anim.insertDrawing('blank');
      words(s, { x: 40, y: 40 }, `Pass ${p + 1}`, 36, '#1f5fbf');
      words(
        s,
        { x: 40, y: 330 },
        'Compare each pair from the left; swap them if the left one is bigger.',
        20,
      );
      frame += INTRO;
      for (const { j, swap } of pairs) {
        // A held keyframe at each comparison (even where the box already is), so it jumps.
        s.anim.setFrame(frame);
        s.anim.insertKeyframe(box, 'x');
        s.type(box, frame, { x: X(j) - 10, opacity: 100 });
        s.anim.setHold(box, 'x', frame, true);
        if (swap) {
          const [a, b] = [order[j]!, order[j + 1]!];
          for (const id of [a, b]) {
            s.anim.setFrame(frame);
            s.anim.insertKeyframe(id, 'x');
          }
          s.type(a, frame + COMPARE, { x: X(j + 1) });
          s.type(b, frame + COMPARE, { x: X(j) });
          order = order.toSpliced(j, 2, b, a);
        }
        frame += COMPARE;
      }
    });
    s.anim.store.update((st) => ({ ...st, layerId: titles }));
    s.anim.setFrame(frame);
    s.anim.insertDrawing('blank');
    words(s, { x: 40, y: 40 }, 'Sorted: in ascending order', 36, '#1f9f3f');
    s.type(box, frame, { opacity: 0 });
    s.anim.setFrame(0);
    return { s, ids, titles, starts, end: frame, plan, box };
  }

  it('sorts 4 5 3 2 7 1 6 into ascending order in six passes', () => {
    const { s, ids, end, plan } = task8();
    expect(plan).toHaveLength(6);
    const xs = ids.map((id) => s.at(id, end).x);
    const byPlace = NUMBERS.map((n, i) => ({ n, x: xs[i]! })).sort((a, b) => a.x - b.x);
    expect(byPlace.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(byPlace.map((p) => p.x)).toEqual(NUMBERS.map((_, i) => X(i)));
  });

  it('the first pass gives 4 3 2 5 1 6 7, as the workbook works out by hand', () => {
    const { s, ids, starts } = task8();
    const after = starts[1]!;
    const order = NUMBERS.map((n, i) => ({ n, x: s.at(ids[i]!, after).x }))
      .sort((a, b) => a.x - b.x)
      .map((p) => p.n);
    expect(order).toEqual([4, 3, 2, 5, 1, 6, 7]);
  });

  it('names each pass and explains it; a swap is a tween, so halfway the two numbers pass each other', () => {
    const { s, ids, titles, starts, end } = task8();
    starts.forEach((f, p) =>
      expect(shownWords(s, titles, f + 1)).toEqual([
        `Pass ${p + 1}`,
        'Compare each pair from the left; swap them if the left one is bigger.',
      ]),
    );
    expect(shownWords(s, titles, end)).toEqual(['Sorted: in ascending order']);
    // The first swap: 5 and 3, the second pair of the first pass.
    const swapAt = starts[0]! + INTRO + COMPARE;
    const five = ids[1]!;
    const three = ids[2]!;
    expect(s.at(five, swapAt).x).toBe(X(1));
    expect(s.at(five, swapAt + COMPARE / 2).x).toBe((X(1) + X(2)) / 2);
    expect(s.at(three, swapAt + COMPARE / 2).x).toBe((X(1) + X(2)) / 2);
    expect(s.at(five, swapAt + COMPARE).x).toBe(X(2));
    // Before its swap 5 stays still (a keyframe, not a drift from frame 0).
    expect(s.at(five, swapAt - 1).x).toBe(X(1));
  });

  it('the box jumps to each pair as it is compared (held keyframes)', () => {
    const { s, box, starts } = task8();
    const first = starts[0]! + INTRO;
    expect(s.at(box, first).x).toBe(X(0) - 10);
    expect(s.at(box, first + COMPARE - 1).x).toBe(X(0) - 10);
    expect(s.at(box, first + COMPARE).x).toBe(X(1) - 10);
  });

  it('is saved, opened again and exported as an MP4', async () => {
    const { s, end } = task8();
    await s.saveAndReopen('/work/Chapter07_Task8.mvea');
    await s.exportAndCheck('mp4', '/work/Chapter07_Task8.mp4', {
      name: 'Workbook Task 8',
      container: 'mp4',
      width: 800,
      height: 450,
      fps: 24,
      duration: s.doc().stage.length / 24,
      tolerance: 0.1,
    });
    expect(end).toBeLessThan(s.doc().stage.length);
  });
});

// ---------------------------------------------------------------------------------------------

describe('Stop motion (coursebook 19.1): photographs imported as frames', () => {
  it('24 photographs at 12 a second make a 2 s clip, each held for two frames, exported as an MP4', async () => {
    const shots = Array.from(
      { length: 24 },
      (_, i) => `/clay/IMG_${String(i + 1).padStart(3, '0')}.jpg`,
    );
    const s = studio(Object.fromEntries(shots.map((p) => [p, picture(640, 480)])));
    s.stage({ width: 640, height: 480, length: 48 });
    s.dialogs.openFrames.mockResolvedValueOnce([...shots].reverse());
    await s.anim.importFrames(12);
    const clip = s.last();
    const shown = (frame: number) =>
      s
        .doc()
        .pictures.find((p) => p.id === (s.at(clip.id, frame) as { pictureId: string }).pictureId)!
        .path;
    expect(shown(0)).toBe(shots[0]);
    expect(shown(1)).toBe(shots[0]);
    expect(shown(2)).toBe(shots[1]);
    expect(shown(47)).toBe(shots[23]);
    await s.saveAndReopen('/work/Clay.mvea');
    expect(shown(47)).toBe(shots[23]);
    await s.exportAndCheck('mp4', '/work/Clay.mp4', {
      name: 'Stop motion',
      container: 'mp4',
      width: 640,
      height: 480,
      fps: 24,
      duration: 2,
      tolerance: 0.05,
    });
  });
});

// ---------------------------------------------------------------------------------------------

describe('Coursebook Practical Activity 19.07 — export in every format (CB p.463)', () => {
  function ball() {
    const s = studio();
    s.stage({ width: 640, height: 480, length: 60 });
    s.anim.addShape('ellipse', { x: 0, y: 0, width: 60, height: 60 });
    const id = s.last().id;
    s.type(id, 0, { fill: { kind: 'solid', colour: '#ff0000' } });
    s.type(id, 15, { x: 580 });
    s.type(id, 30, { y: 420 });
    s.type(id, 45, { x: 0 });
    s.type(id, 60, { y: 0 });
    return s;
  }
  const spec = { name: '19.07', width: 640, height: 480, fps: 24, duration: 2.5, tolerance: 0.05 };

  it('an MP4 video for a computer or a video site', async () => {
    await ball().exportAndCheck('mp4', '/work/ball.mp4', { ...spec, container: 'mp4' });
  });

  it('an animated GIF for a web page, which loops', async () => {
    await ball().exportAndCheck('gif', '/work/ball.gif', { ...spec, container: 'gif', loop: true });
  });

  it('an HTML web animation, which loops in any browser', async () => {
    await checkWebPage(ball(), '/work/ball.html', { ...spec, container: 'html', loop: true });
  });

  it('a PNG sequence: one picture per frame, 60 for 2.5 s at 24 fps', async () => {
    const s = ball();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/ball.png');
    await s.anim.exportAnimation('png-sequence');
    const frames = [...s.bytes.keys()].filter((k) => k.startsWith('/work/ball_')).sort();
    expect(frames).toHaveLength(60);
    expect(frames[0]).toBe('/work/ball_0001.png');
    const result = checkFile(
      { ...spec, container: 'png' },
      sequenceInfo(picture(640, 480) as never, frames.length),
    );
    expect(result.rows.find((r) => r.label === 'Frames')).toMatchObject({ pass: true });
  });

  it('a PNG picture of one frame, for further editing', async () => {
    const s = ball();
    s.anim.setFrame(15);
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/ball-frame.png');
    await s.anim.exportAnimation('png');
    expect(s.bytes.has('/work/ball-frame.png')).toBe(true);
    expect(s.stageRenderer.renderPng).toHaveBeenLastCalledWith(expect.anything(), 15);
  });
});

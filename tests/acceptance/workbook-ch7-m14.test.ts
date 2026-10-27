// M14 exit gate (phase 2): the moving parts of the workbook's Chapter 7 tasks, the coursebook's
// Practical Activities 19.02 and 19.03 and exam-style question 3, built through Animation mode's
// own use cases (what the student's clicks and typed numbers reach), checked frame by frame,
// saved and opened again, exported, and the export checked by the task checker (T6).
// Motion paths (Task 2's letters "along individual motion paths") and the morph (Task 1.2) are
// M15: here the letters enter along straight moves and the circle keeps its shape.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findObject } from '../../src/core/animation/layers.ts';
import { presetSize } from '../../src/core/animation/rules.ts';
import { placementOf } from '../../src/core/animation/state.ts';
import { objectAt } from '../../src/core/animation/tween.ts';
import type { AnimObject, Id, TextObject } from '../../src/core/animation/types.ts';
import type { ProbeInfo } from '../../src/core/ports.ts';
import { checkFile, type TaskSpec } from '../../src/core/teaching/task-check.ts';
import { testApp } from '../helpers/test-app.ts';

afterEach(() => vi.useRealTimers());

const colourOf = (o: AnimObject) =>
  o.fill.kind === 'solid' ? o.fill.colour.toLowerCase() : o.fill.kind;

const picture = (width: number, height: number): ProbeInfo => ({
  kind: 'image',
  container: 'jpg',
  sizeBytes: 300_000,
  video: { codec: 'mjpeg', width, height },
});

/** Animation mode on its own, with the steps a student takes. */
function studio(media: Record<string, ProbeInfo> = {}) {
  const t = testApp(media);
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  const last = (): AnimObject =>
    doc()
      .layers.flatMap((l) => l.objects)
      .at(-1)!;
  /** The object as it is shown at a frame (top-level objects). */
  const at = (id: Id, frame: number) => objectAt(findObject(doc(), id)!.object, frame);
  /** Selects an object and types values with the playhead on `frame`. */
  const type = (id: Id, frame: number, values: Partial<AnimObject>) => {
    anim.select([id]);
    anim.setFrame(frame);
    expect(anim.setProperties(values)).toBeNull();
  };
  const stage = (change: Partial<ReturnType<typeof doc>['stage']>) =>
    expect(anim.setStage({ ...doc().stage, ...change })).toBeNull();
  /** Saves to `path`, starts a new animation, and opens the file again. */
  async function saveAndReopen(path: string) {
    t.dialogs.saveAnimation.mockResolvedValueOnce(path);
    await anim.saveAs();
    expect(anim.isDirty()).toBe(false);
    await anim.newAnimation();
    t.dialogs.openAnimation.mockResolvedValueOnce(path);
    await anim.open();
    expect(anim.store.get().path).toBe(path);
  }
  /** Exports and runs the result through the task checker. */
  async function exportAndCheck(format: 'mp4' | 'gif', output: string, spec: TaskSpec) {
    t.dialogs.exportAnimation.mockResolvedValueOnce(output);
    await anim.exportAnimation(format);
    const result = checkFile(spec, await t.engine.probe(output));
    expect(result.rows.filter((r) => !r.pass)).toEqual([]);
    expect(result.pass).toBe(true);
  }
  return { ...t, anim, doc, last, at, type, stage, saveAndReopen, exportAndCheck };
}

type Studio = ReturnType<typeof studio>;

// ---------------------------------------------------------------------------------------------

/** Workbook Task 1.1 (WB p.98): 600 × 400; all four changes run together over 3 s. */
function task1(s: Studio) {
  s.stage({ width: 600, height: 400, background: '#ffffff', fps: 24, length: 72 });
  s.anim.addShape('star', { x: 128, y: 102, width: 135, height: 135 });
  const star = s.last().id;
  s.type(star, 0, {
    name: 'Star',
    fill: { kind: 'linear', from: '#ffffff', to: '#555555', angle: 135 },
  });
  s.anim.addShape('ellipse', { x: 0, y: 0, width: 204, height: 204 });
  const circle = s.last().id;
  s.type(circle, 0, {
    name: 'Circle',
    fill: { kind: 'linear', from: '#0000ff', to: '#ff0000', angle: 90 },
  });
  // The rectangle is in front of the star and the circle; the text in front of it.
  s.anim.addShape('rect', { x: 0, y: 0, width: 0, height: 0 });
  const rect = s.last().id;
  s.type(rect, 0, { name: 'Rectangle', fill: { kind: 'solid', colour: '#FF1CC8' } });
  s.anim.addText({ x: 193, y: 73 }, 'Task 1');
  const text = s.last().id;
  s.type(text, 0, { size: 0 } as Partial<TextObject>);
  // Frame 72 (3 s): every end value typed in the Properties panel.
  s.type(circle, 72, { x: 396, y: 196 });
  s.type(rect, 72, {
    width: 600,
    height: 400,
    fill: { kind: 'solid', colour: '#F0DB82' },
    opacity: 57,
  });
  s.type(text, 72, { size: 64 } as Partial<TextObject>);
  s.type(star, 72, { rotation: 360 });
  return { star, circle, rect, text };
}

describe('Workbook Task 1.1 — circle, rectangle, text and star over three seconds', () => {
  it('halfway (1.50 s, frame 36) every value is halfway; at 3 s the end values', async () => {
    const s = studio();
    const { star, circle, rect, text } = task1(s);
    expect(s.at(circle, 36)).toMatchObject({ x: 198, y: 98, width: 204 });
    expect(s.at(rect, 36)).toMatchObject({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      opacity: 78.5,
      fill: { kind: 'solid', colour: '#f87ca5' },
    });
    expect(s.at(text, 36)).toMatchObject({ x: 193, y: 73, size: 32 });
    expect(s.at(star, 36)).toMatchObject({ x: 128, y: 102, rotation: 180 });
    // The end: the circle flush in the bottom-right corner, the rectangle over the whole stage.
    const end = s.at(circle, 72);
    expect([end.x + end.width, end.y + end.height]).toEqual([600, 400]);
    expect(s.at(rect, 72)).toMatchObject({ width: 600, height: 400, opacity: 57 });
    // At a keyframe the colour is as typed; in between it is worked out (lower-case hex).
    expect(colourOf(s.at(rect, 72))).toBe('#f0db82');
    expect(s.at(text, 72)).toMatchObject({ size: 64 });
    expect(s.at(star, 72).rotation).toBe(360);
    // Clockwise all the way: the angle only grows.
    const turns = Array.from({ length: 73 }, (_, f) => s.at(star, f).rotation);
    expect(turns.every((r, i) => i === 0 || r >= turns[i - 1]!)).toBe(true);
  });

  it('saved as Chapter07_Task1_1, opened again unchanged; exported as Chapter07_Task1_1.mp4 and checked', async () => {
    const s = studio();
    const { circle, rect } = task1(s);
    await s.saveAndReopen('/work/Chapter07_Task1_1.mvea');
    expect(s.at(circle, 36)).toMatchObject({ x: 198, y: 98 });
    expect(s.at(rect, 36).fill).toEqual({ kind: 'solid', colour: '#f87ca5' });
    await s.exportAndCheck('mp4', '/work/Chapter07_Task1_1.mp4', {
      name: 'Workbook Task 1.1',
      container: 'mp4',
      width: 600,
      height: 400,
      duration: 3,
      tolerance: 0.1,
    });
  });
});

describe('Workbook Task 1.2 — the same in reverse, looping, while the star keeps turning (no morph yet)', () => {
  function task12() {
    const s = studio();
    const ids = task1(s);
    expect(s.anim.setLength('6 s')).toBeNull();
    for (const id of [ids.circle, ids.rect, ids.text]) s.anim.reverse(id, 'all');
    s.anim.setRepeat(ids.star, 'rotation', 'end');
    return { s, ...ids };
  }

  it('back to every starting value at 6 s; halfway back at 4.50 s', () => {
    const { s, star, circle, rect, text } = task12();
    expect(s.doc().stage.length).toBe(144);
    expect(s.at(circle, 108)).toMatchObject({ x: 198, y: 98 });
    expect(s.at(rect, 108)).toMatchObject({ width: 300, opacity: 78.5 });
    expect(s.at(rect, 108).fill).toEqual({ kind: 'solid', colour: '#f87ca5' });
    expect(s.at(text, 108)).toMatchObject({ size: 32 });
    expect(s.at(circle, 144)).toMatchObject({ x: 0, y: 0 });
    expect(s.at(rect, 144)).toMatchObject({ width: 0, height: 0, opacity: 100 });
    expect(colourOf(s.at(rect, 144))).toBe('#ff1cc8');
    expect(s.at(text, 144)).toMatchObject({ size: 0 });
    // The star keeps turning clockwise while the rest runs backwards: one turn per 3 s.
    expect(s.at(star, 90).rotation).toBe(90);
    expect(s.at(star, 108).rotation).toBe(180);
    const back = Array.from({ length: 71 }, (_, i) => s.at(star, 73 + i).rotation);
    expect(back.every((r, i) => i === 0 || r > back[i - 1]!)).toBe(true);
  });

  it('repeats indefinitely when played with Loop on', () => {
    vi.useFakeTimers();
    const { s } = task12();
    s.anim.setFrame(0);
    s.anim.setLoop({ on: true });
    s.anim.play();
    vi.advanceTimersByTime(7000);
    expect(s.anim.store.get()).toMatchObject({ playing: true, frame: 168 - 144 });
    s.anim.dispose();
  });

  it('saved as Chapter07_Task1_2 and exported as a 6 s MP4', async () => {
    const { s } = task12();
    await s.saveAndReopen('/work/Chapter07_Task1_2.mvea');
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

const BRIGHT = [
  '#ff1f1f',
  '#ff8c00',
  '#ffd700',
  '#22c55e',
  '#4338ca',
  '#d946ef',
  '#ff1f1f',
  '#ff8c00',
  '#ffd700',
  '#22c55e',
];

describe('Workbook Task 2 — Happy Smile play centre (letters on straight moves; paths in M15)', () => {
  function task2() {
    const s = studio();
    s.stage({ width: 1024, height: 768, background: '#F4C8EE', length: 168 });
    s.anim.addText({ x: 112, y: 200 }, 'Happy Smile');
    s.type(s.last().id, 0, { size: 96 } as Partial<TextObject>);
    s.anim.splitText();
    const letters = [...s.anim.store.get().selection];
    const homes = letters.map((id) => ({ x: s.at(id, 0).x, y: s.at(id, 0).y }));
    // Each letter in its own bright colour, entering from above or below over six seconds.
    letters.forEach((id, i) => {
      const from = { x: homes[i]!.x + (i - 5) * 40, y: i % 2 === 0 ? -150 : 900 };
      s.type(id, 0, { fill: { kind: 'solid', colour: BRIGHT[i]! }, ...from });
      s.type(id, 144, homes[i]!);
    });
    s.anim.addText({ x: 330, y: 380 }, 'playcentre');
    const play = s.last().id;
    s.type(play, 0, { size: 0, fill: { kind: 'solid', colour: '#e0115f' } } as Partial<TextObject>);
    s.anim.setFrame(144);
    s.anim.insertKeyframe(play, 'size');
    s.type(play, 168, { size: 64 } as Partial<TextObject>);
    // The smile: a thick red arc under both lines, appearing over the seven seconds.
    const arc = Array.from({ length: 13 }, (_, k) => {
      const a = (Math.PI * k) / 12;
      return { x: 512 - 380 * Math.cos(a), y: 520 + 160 * Math.sin(a) };
    });
    s.anim.addPath(arc, false);
    const smile = s.last().id;
    s.type(smile, 0, {
      name: 'Smile',
      stroke: { colour: '#e0115f', width: 28, dash: 'solid' },
      opacity: 0,
    });
    s.type(smile, 168, { opacity: 100 });
    return { s, letters, homes, play, smile };
  }

  it('the ten letters, each its own colour, are halfway in at 3 s and in place at 6 s', () => {
    const { s, letters, homes } = task2();
    expect(letters.map((id) => (s.at(id, 0) as TextObject).text).join('')).toBe('HappySmile');
    expect(new Set(letters.map((id, i) => i < 6 && s.at(id, 0).fill)).size).toBeGreaterThan(5);
    letters.forEach((id, i) => {
      const start = s.at(id, 0);
      const half = s.at(id, 72);
      expect(half.y).toBeCloseTo((start.y + homes[i]!.y) / 2, 6);
      expect(s.at(id, 144)).toMatchObject(homes[i]!);
      expect(s.at(id, 168)).toMatchObject(homes[i]!);
      expect(s.at(id, 0).y < 0 || s.at(id, 0).y > 768).toBe(true);
      expect((s.at(id, 0) as TextObject).size).toBe(96);
    });
  });

  it('"playcentre" grows from 0 to 64 px in the seventh second; the smile appears over all seven', () => {
    const { s, play, smile } = task2();
    expect(s.at(play, 100)).toMatchObject({ size: 0 });
    expect(s.at(play, 150)).toMatchObject({ size: 16 });
    expect(s.at(play, 168)).toMatchObject({ size: 64 });
    expect(s.at(play, 168).fill).toEqual({ kind: 'solid', colour: '#e0115f' });
    expect(s.at(smile, 84).opacity).toBe(50);
    expect(s.at(smile, 168).opacity).toBe(100);
  });

  it('saved as Chapter07_Task2, exported as a 7 s MP4 at 1024 × 768', async () => {
    const { s } = task2();
    await s.saveAndReopen('/work/Chapter07_Task2.mvea');
    expect(s.doc().stage).toMatchObject({ background: '#F4C8EE', length: 168 });
    await s.exportAndCheck('mp4', '/work/Chapter07_Task2.mp4', {
      name: 'Workbook Task 2',
      container: 'mp4',
      width: 1024,
      height: 768,
      duration: 7,
      tolerance: 0.1,
    });
  });
});

// ---------------------------------------------------------------------------------------------

describe('Workbook Task 3 — the Paris slide show', () => {
  const PARIS = {
    '/paris/Paris1.jpg': picture(800, 600),
    '/paris/Paris2.jpg': picture(450, 600),
    '/paris/Paris3.jpg': picture(800, 600),
  };
  /** Every slide ends at the same place, found with the grid: (110, 80). */
  const AT = { x: 110, y: 80 };

  async function task3() {
    const s = studio(PARIS);
    s.stage({ width: 1024, height: 768, background: '#CBCDF0', length: 432 });
    s.anim.setView({ rulers: true, grid: { show: true, size: 10, over: false } });
    s.anim.addText({ x: 380, y: 320 }, 'Paris');
    const paris = s.last().id;
    s.type(paris, 0, {
      size: 96,
      fill: { kind: 'solid', colour: '#cc0000' },
    } as Partial<TextObject>);
    s.type(paris, 48, { opacity: 0 });
    const slides: Id[] = [];
    const add = async (path: string, from: 'left' | 'right', enter: number) => {
      s.dialogs.openMedia.mockResolvedValueOnce([path]);
      await s.anim.addPicture({ x: 0, y: AT.y });
      const id = s.last().id;
      const w = s.at(id, 0).width;
      s.type(id, 0, { x: from === 'left' ? -w : 1024 });
      s.anim.setFrame(enter);
      s.anim.insertKeyframe(id, 'x');
      s.type(id, enter + 72, { x: AT.x });
      slides.push(id);
      return id;
    };
    // Slide 1 moves in over 3 s after "Paris" has faded, and stays for 2 s.
    const one = await add('/paris/Paris1.jpg', 'left', 48);
    // Slide 2 moves in from the left while slide 1 fades over the same 3 s.
    const two = await add('/paris/Paris2.jpg', 'left', 168);
    s.anim.setFrame(168);
    s.anim.insertKeyframe(one, 'opacity');
    s.type(one, 240, { opacity: 0 });
    // The last slide appears from the right as slide 2 fades.
    await add('/paris/Paris3.jpg', 'right', 288);
    s.anim.setFrame(288);
    s.anim.insertKeyframe(two, 'opacity');
    s.type(two, 360, { opacity: 0 });
    // "Au revoir" in red appears over 3 s on the last slide.
    s.anim.addText({ x: 380, y: 100 }, 'Au revoir');
    const bye = s.last().id;
    s.type(bye, 0, {
      size: 80,
      opacity: 0,
      fill: { kind: 'solid', colour: '#cc0000' },
    } as Partial<TextObject>);
    s.anim.setFrame(360);
    s.anim.insertKeyframe(bye, 'opacity');
    s.type(bye, 432, { opacity: 100 });
    return { s, paris, slides, bye };
  }

  it('"Paris" fades over 2 s; each slide moves in over 3 s and stays 2 s; the next comes in as it fades', async () => {
    const { s, paris, slides } = await task3();
    const [one, two, three] = slides as [Id, Id, Id];
    expect(s.at(paris, 24).opacity).toBe(50);
    expect(s.at(paris, 48).opacity).toBe(0);
    expect(s.at(one, 30).x).toBe(-800);
    expect(s.at(one, 84).x).toBe(-800 + (110 + 800) / 2);
    expect(s.at(one, 150)).toMatchObject({ ...AT, opacity: 100 });
    expect(s.at(two, 204).x).toBe(-450 + (110 + 450) / 2);
    expect(s.at(one, 204).opacity).toBe(50);
    expect(s.at(three, 300).x).toBeGreaterThan(110);
    expect(s.at(three, 324).x).toBe(1024 - (1024 - 110) / 2);
    expect(s.at(two, 324).opacity).toBe(50);
  });

  it('landscape and portrait slides end at the same coordinates; "Au revoir" appears on the last', async () => {
    const { s, slides, bye } = await task3();
    for (const id of slides) expect(s.at(id, 432)).toMatchObject(AT);
    expect(s.at(slides[1]!, 432).width).toBeLessThan(s.at(slides[0]!, 432).width);
    expect(s.at(bye, 359).opacity).toBe(0);
    expect(s.at(bye, 396).opacity).toBe(50);
    expect(s.at(bye, 432)).toMatchObject({
      opacity: 100,
      fill: { kind: 'solid', colour: '#cc0000' },
    });
    const order = s.doc().layers[0]!.objects.map((o) => o.id);
    expect(order.indexOf(bye)).toBeGreaterThan(order.indexOf(slides[2]!));
  });

  it('rulers and grid shown; saved as Chapter07_Task3 with its pictures; exported as an 18 s MP4', async () => {
    const { s } = await task3();
    await s.saveAndReopen('/work/Chapter07_Task3.mvea');
    expect(s.doc().view).toMatchObject({ rulers: true, grid: { show: true } });
    expect(s.doc().pictures.map((p) => p.path)).toEqual([
      '/paris/Paris1.jpg',
      '/paris/Paris2.jpg',
      '/paris/Paris3.jpg',
    ]);
    await s.exportAndCheck('mp4', '/work/Chapter07_Task3.mp4', {
      name: 'Workbook Task 3',
      container: 'mp4',
      width: 1024,
      height: 768,
      duration: 18,
      tolerance: 0.1,
    });
  });
});

// ---------------------------------------------------------------------------------------------

describe('Coursebook Practical Activity 19.02', () => {
  it('1: the stick person walks across the screen; the legs swing while the person moves (groups, AN13)', () => {
    const s = studio();
    s.stage({ length: 240 });
    s.anim.addShape('ellipse', { x: 20, y: 300, width: 60, height: 60 });
    s.anim.addLine({ x: 50, y: 360 }, { x: 50, y: 480 });
    s.anim.addLine({ x: 50, y: 480 }, { x: 20, y: 600 });
    const leg = s.last().id;
    s.anim.addLine({ x: 50, y: 480 }, { x: 80, y: 600 });
    // The leg swings 20° each way every second, again and again.
    for (const [frame, rotation] of [
      [6, 20],
      [12, 0],
      [18, -20],
      [24, 0],
    ] as const)
      s.type(leg, frame, { rotation });
    s.anim.setRepeat(leg, 'rotation', 'end');
    s.anim.setFrame(0);
    s.anim.selectAll();
    s.anim.group();
    const person = s.anim.store.get().selection[0]!;
    s.type(person, 0, { name: 'stick person' });
    s.type(person, 240, { x: 1180 });
    expect(placementOf(s.doc(), leg, 6).rotation).toBe(20);
    expect(placementOf(s.doc(), leg, 30).rotation).toBe(20);
    expect(placementOf(s.doc(), leg, 120).x).toBeCloseTo(20 + 1160 / 2, 6);
    expect(placementOf(s.doc(), leg, 240).x).toBeCloseTo(1180, 6);
  });

  it('3: my name appears letter by letter with frames and keyframes (10 fps, each letter on its own layer)', () => {
    const s = studio();
    expect(s.anim.setFps(10, 'frames')).toBeNull();
    s.stage({ length: 60 });
    const ids: Id[] = [];
    [...'Ying'].forEach((letter, i) => {
      s.anim.addLayer();
      s.anim.renameLayer(s.anim.store.get().layerId, letter);
      s.anim.addText({ x: 200 + i * 120, y: 300 }, letter);
      const id = s.last().id;
      ids.push(id);
      s.type(id, 0, { opacity: 0 });
      s.type(id, 10 * (i + 1), { opacity: 100 });
      s.anim.setHold(id, 'opacity', 0, true);
    });
    expect(
      s
        .doc()
        .layers.slice(1)
        .map((l) => l.name),
    ).toEqual(['Y', 'i', 'n', 'g']);
    ids.forEach((id, i) => {
      expect(s.at(id, 10 * (i + 1) - 1).opacity).toBe(0);
      expect(s.at(id, 10 * (i + 1)).opacity).toBe(100);
    });
    // "10 fps means that ten frames will be run each second": the last letter is in at 4 s.
    expect((10 * ids.length) / s.doc().stage.fps).toBe(4);
  });
});

describe('Coursebook Practical Activity 19.03 (and Worked Example 19.01)', () => {
  it('1: a red ball moves to each corner of the screen with motion tweens every 15 frames', () => {
    const s = studio();
    s.anim.addShape('ellipse', { x: 0, y: 0, width: 100, height: 100 });
    const ball = s.last().id;
    s.type(ball, 0, {
      name: 'redcircle',
      fill: { kind: 'solid', colour: '#ff0000' },
      stroke: { colour: '#ff0000', width: 2, dash: 'solid' },
    });
    const corners = [
      [15, 1180, 0],
      [30, 1180, 620],
      [45, 0, 620],
      [60, 0, 0],
    ] as const;
    for (const [frame, x, y] of corners) s.type(ball, frame, { x, y });
    for (const [frame, x, y] of corners) expect(s.at(ball, frame)).toMatchObject({ x, y });
    expect(s.at(ball, 22)).toMatchObject({ x: 1180 });
    expect(s.at(ball, 22).y).toBeCloseTo((620 * 7) / 15, 6);
    expect(s.at(ball, 60).fill).toEqual({ kind: 'solid', colour: '#ff0000' });
  });

  it('3: each letter of my name flies onto the screen one by one, until the full name shows', () => {
    const s = studio();
    s.anim.addText({ x: 400, y: 300 }, 'Ying');
    s.anim.splitText();
    const letters = [...s.anim.store.get().selection];
    const homes = letters.map((id) => s.at(id, 0).x);
    letters.forEach((id, i) => {
      s.type(id, 0, { x: -200 });
      s.anim.setFrame(12 * i);
      if (i > 0) s.anim.insertKeyframe(id, 'x');
      s.type(id, 12 * i + 12, { x: homes[i]! });
    });
    letters.forEach((id, i) => {
      expect(s.at(id, 12 * i + 6).x).toBeCloseTo((-200 + homes[i]!) / 2, 6);
      if (i + 1 < letters.length) expect(s.at(letters[i + 1]!, 12 * i + 6).x).toBe(-200);
    });
    expect(letters.map((id, i) => s.at(id, 48).x === homes[i])).toEqual([true, true, true, true]);
  });
});

// ---------------------------------------------------------------------------------------------

describe('Coursebook exam-style question 3 — Films by Ying', () => {
  async function filmsByYing() {
    const s = studio();
    s.stage({ ...presetSize('16:10', { width: 1280 }), background: '#ffffff', length: 144 });
    // The green outline is there from the first frame and never changes.
    s.anim.addShape('rect', { x: 240, y: 200, width: 800, height: 400 });
    const outline = s.last().id;
    s.type(outline, 0, {
      name: 'Outline',
      radius: 48,
      fill: { kind: 'none' },
      stroke: { colour: '#2e9e44', width: 16, dash: 'solid' },
    } as Partial<AnimObject>);
    s.anim.addText({ x: 390, y: 250 }, 'FBY');
    s.type(s.last().id, 0, {
      size: 240,
      bold: true,
      fill: { kind: 'solid', colour: '#000000' },
    } as Partial<TextObject>);
    s.anim.splitText();
    const [f, b, y] = s.anim.store.get().selection as [Id, Id, Id];
    const homes = new Map([f, b, y].map((id) => [id, s.at(id, 0).x]));
    // They bounce in from the left: Y first, then B, then F, a second each.
    [y, b, f].forEach((id, i) => {
      s.type(id, 0, { x: -300 });
      s.anim.setFrame(24 * i);
      if (i > 0) s.anim.insertKeyframe(id, 'x');
      s.type(id, 24 * i + 24, { x: homes.get(id)! });
      s.anim.setEasing(id, 'x', 24 * i, 'bounce');
    });
    // All on screen for 2 s (frames 72–120), then they fade out over a second.
    for (const id of [f, b, y]) {
      s.anim.setFrame(120);
      s.anim.insertKeyframe(id, 'opacity');
      s.type(id, 144, { opacity: 0 });
    }
    s.anim.setLoop({ on: true });
    return { s, outline, f, b, y, homes };
  }

  it('16:10, white, the green outline shown throughout', async () => {
    const { s, outline } = await filmsByYing();
    expect(s.doc().stage).toMatchObject({ width: 1280, height: 800, background: '#ffffff' });
    expect(findObject(s.doc(), outline)!.object.tracks).toBeUndefined();
    for (const frame of [0, 60, 130, 143]) expect(s.at(outline, frame).opacity).toBe(100);
  });

  it('Y, then B, then F bounce in from the left; they stay for 2 s, then fade out', async () => {
    const { s, f, b, y, homes } = await filmsByYing();
    expect(s.at(y, 12).x).toBeGreaterThan(-300);
    expect([s.at(b, 12).x, s.at(f, 12).x]).toEqual([-300, -300]);
    expect(s.at(y, 24).x).toBe(homes.get(y));
    expect(s.at(f, 47).x).toBe(-300);
    expect(s.at(f, 72).x).toBe(homes.get(f));
    // A bounce: on the way in the letter lands, goes back a little and lands again.
    const xs = Array.from({ length: 25 }, (_, k) => s.at(y, k).x);
    expect(xs.some((x, k) => k > 0 && x < xs[k - 1]!)).toBe(true);
    for (const id of [f, b, y]) {
      expect(s.at(id, 96)).toMatchObject({ x: homes.get(id), opacity: 100 });
      expect(s.at(id, 132).opacity).toBe(50);
      expect(s.at(id, 144).opacity).toBe(0);
    }
  });

  it('loops, and is exported as an animated GIF that the task checker passes', async () => {
    const { s } = await filmsByYing();
    expect(s.anim.store.get().loop).toEqual({ on: true });
    await s.exportAndCheck('gif', '/work/FilmsByYing.gif', {
      name: 'Films by Ying',
      container: 'gif',
      width: 1280,
      height: 800,
      duration: 6,
      tolerance: 0.2,
    });
  });
});

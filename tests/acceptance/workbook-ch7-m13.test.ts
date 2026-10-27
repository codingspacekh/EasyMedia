// M13 exit gate (phase 2): the static parts of the workbook's Chapter 7 tasks and the
// coursebook's Practical Activity 19.01, built through Animation mode's own commands, saved as
// .mvea text and read back. The moving parts follow in M14 and M15.
import { describe, expect, it } from 'vitest';
import * as cmd from '../../src/app/animation-commands.ts';
import { createHistory, execute, type Command } from '../../src/app/history.ts';
import {
  createAnimation,
  createEllipse,
  createLine,
  createRect,
  createStar,
  createText,
} from '../../src/core/animation/factory.ts';
import { boundsOf, centreOf, hitTest } from '../../src/core/animation/geometry.ts';
import { drawOrder } from '../../src/core/animation/layers.ts';
import { aspectOf } from '../../src/core/animation/rules.ts';
import { drawStage, type StageCanvas } from '../../src/core/animation/draw.ts';
import {
  animationFromDisk,
  animationToDisk,
  deserializeAnimation,
  serializeAnimation,
} from '../../src/core/animation/serialize.ts';
import type { AnimationDoc, Layer } from '../../src/core/animation/types.ts';

/** Builds an animation by running the same commands the app uses. */
function build(name: string, steps: (doc: AnimationDoc) => Command<AnimationDoc>[]): AnimationDoc {
  const start = createAnimation({ name });
  return steps(start).reduce(execute, createHistory(start)).present;
}

/** Saves to text (paths relative to the folder) and opens it again, as the app does. */
function roundTrip(doc: AnimationDoc, folder: string): AnimationDoc {
  const text = serializeAnimation(animationToDisk(doc, folder));
  return animationFromDisk(deserializeAnimation(text), folder);
}

const layerOf = (doc: AnimationDoc, name: string): Layer =>
  doc.layers.find((l) => l.name === name)!;

describe('Workbook Chapter 7, Task 1 — the set-up (static part, M13)', () => {
  const task1 = () =>
    build('Chapter07_Task1_1', (start) => {
      const layer = start.layers[0]!.id;
      return [
        cmd.setStage({ ...start.stage, width: 600, height: 400, background: '#ffffff' }),
        cmd.addObject(layer, {
          ...createStar({ x: 128, y: 102, width: 135, height: 135 }),
          name: 'Star',
          fill: { kind: 'linear', from: '#ffffff', to: '#555555', angle: 0 },
        }),
        cmd.addObject(layer, {
          ...createEllipse({ x: 0, y: 0, width: 204, height: 204 }),
          name: 'Circle',
          fill: { kind: 'linear', from: '#0000ff', to: '#ff0000', angle: 90 },
        }),
        cmd.addObject(layer, {
          ...createText('Task 1', { x: 193, y: 73, size: 64 }),
          name: 'Task 1',
        }),
      ];
    });

  it('the stage is 600 × 400 (3:2)', () => {
    const doc = task1();
    expect(doc.stage).toMatchObject({ width: 600, height: 400 });
    expect(aspectOf(doc.stage.width, doc.stage.height)).toBe('3:2');
  });

  it('the star is 135 × 135 at left 128, top 102 with a greyscale gradient fill', () => {
    const star = drawOrder(task1()).find((d) => d.object.name === 'Star')!.object;
    expect(star).toMatchObject({ x: 128, y: 102, width: 135, height: 135 });
    expect(star.fill).toMatchObject({ kind: 'linear', from: '#ffffff', to: '#555555' });
    expect(centreOf(star)).toEqual({ x: 195.5, y: 169.5 });
  });

  it('the circle has a radius of 102 at left and top 0 with a blue-to-red gradient', () => {
    const circle = drawOrder(task1()).find((d) => d.object.name === 'Circle')!.object;
    expect(boundsOf(circle)).toEqual({ x: 0, y: 0, width: 204, height: 204 });
    expect(circle.fill).toMatchObject({ kind: 'linear', from: '#0000ff', to: '#ff0000' });
    expect(hitTest(circle, { x: 102, y: 102 })).toBe(true);
  });

  it('the text "Task 1" sits at left 193, top 73; its size will grow 0 → 64 px in M14', () => {
    const text = drawOrder(task1()).find((d) => d.object.name === 'Task 1')!.object;
    expect(text).toMatchObject({ kind: 'text', x: 193, y: 73, size: 64 });
  });

  it('saved as Chapter07_Task1_1.mvea and opened again, nothing changes', () => {
    const doc = task1();
    expect(roundTrip(doc, '/Users/student/Chapter 7')).toEqual(doc);
  });

  it('the stage is drawn: background first, then the star, the circle and the text in order', () => {
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get:
          (_t, key: string) =>
          (...args: unknown[]) => {
            calls.push(`${key}(${args.filter((a) => typeof a !== 'object').join(',')})`);
            return { addColorStop: () => {} };
          },
        set: (_t, key: string, value: unknown) => {
          calls.push(`${key}=${typeof value === 'object' ? 'gradient' : String(value)}`);
          return true;
        },
      },
    ) as unknown as StageCanvas;
    drawStage(ctx, task1());
    expect(calls.slice(0, 2)).toEqual(['fillStyle=#ffffff', 'fillRect(0,0,600,400)']);
    const star = calls.indexOf('translate(195.5,169.5)');
    const circle = calls.indexOf('translate(102,102)');
    const text = calls.findIndex((c) => c.startsWith('fillText(Task 1'));
    expect(star).toBeGreaterThan(1);
    expect(circle).toBeGreaterThan(star);
    expect(text).toBeGreaterThan(circle);
  });
});

describe('Workbook Task 3 — the stage (M13 part)', () => {
  it('1024 × 768 (4:3) with background #CBCDF0, rulers and grid shown', () => {
    const doc = build('Chapter07_Task3', (start) => [
      cmd.setStage({ ...start.stage, width: 1024, height: 768, background: '#CBCDF0' }),
    ]);
    const shown: AnimationDoc = {
      ...doc,
      view: { ...doc.view, rulers: true, grid: { ...doc.view.grid, show: true } },
    };
    expect(aspectOf(shown.stage.width, shown.stage.height)).toBe('4:3');
    expect(shown.stage.background).toBe('#CBCDF0');
    const back = roundTrip(shown, '/a');
    expect(back.view.rulers).toBe(true);
    expect(back.view.grid.show).toBe(true);
  });
});

describe('Workbook Task 5 — the road (M13 part)', () => {
  it('a black 19 px line at y = 500 on a 1240 × 800 stage', () => {
    const doc = build('Chapter07_Task5', (start) => [
      cmd.setStage({ ...start.stage, width: 1240, height: 800 }),
      cmd.addObject(start.layers[0]!.id, {
        ...createLine({ x: 0, y: 500 }, { x: 1240, y: 500 }),
        name: 'Road',
        stroke: { colour: '#000000', width: 19, dash: 'solid' },
      }),
    ]);
    const road = drawOrder(doc)[0]!.object;
    expect(road).toMatchObject({ kind: 'path', x: 0, y: 500, width: 1240, height: 0 });
    expect(road.stroke).toEqual({ colour: '#000000', width: 19, dash: 'solid' });
    expect(hitTest(road, { x: 600, y: 505 })).toBe(true);
  });
});

describe('Coursebook Practical Activity 19.01 — layers', () => {
  it('1 a stick person with each part in its own layer, in a folder; saved as stickperson', () => {
    let folderId = '';
    const parts = ['head', 'body', 'left-arm', 'right-arm', 'left-leg', 'right-leg'];
    const doc = build('stickperson', (start) => {
      const steps: Command<AnimationDoc>[] = [
        cmd.addFolder('stick_person', (id) => (folderId = id)),
      ];
      const made: Layer[] = [];
      parts.forEach(() => steps.push(cmd.addLayer((layer) => made.push(layer))));
      steps.push({
        label: 'name and file the layers',
        apply: (doc) => {
          let next = doc;
          made.forEach((layer, i) => {
            next = execute(createHistory(next), cmd.renameLayer(layer.id, parts[i]!)).present;
            next = execute(createHistory(next), cmd.moveLayerToFolder(layer.id, folderId)).present;
          });
          return next;
        },
      });
      // Each part is one object on its own layer.
      steps.push({
        label: 'draw the parts',
        apply: (doc) => {
          let next = doc;
          for (const part of parts) {
            const layer = next.layers.find((l) => l.name === part)!;
            const shape =
              part === 'head'
                ? createEllipse({ x: 280, y: 60, width: 40, height: 40 })
                : part === 'body'
                  ? createLine({ x: 300, y: 100 }, { x: 300, y: 180 })
                  : createLine(
                      { x: 300, y: part.includes('arm') ? 120 : 180 },
                      {
                        x: part.startsWith('left') ? 260 : 340,
                        y: part.includes('arm') ? 150 : 230,
                      },
                    );
            next = execute(createHistory(next), cmd.addObject(layer.id, shape)).present;
          }
          return next;
        },
      });
      void start;
      return steps;
    });
    expect(doc.folders.map((f) => f.name)).toEqual(['stick_person']);
    for (const part of parts) {
      const layer = layerOf(doc, part);
      expect(layer.folderId).toBe(folderId);
      expect(layer.objects).toHaveLength(1);
    }
    expect(roundTrip(doc, '/a')).toEqual(doc);
  });

  it('2 an underwater scene with rocks, seaweed and background fish, each on its own layer', () => {
    const names = ['water', 'rocks', 'seaweed', 'background_fish'];
    const doc = build('underwaterScene', (start) => {
      const steps: Command<AnimationDoc>[] = [
        cmd.setStage({ ...start.stage, width: 1280, height: 720, background: '#1b6fa8' }),
        cmd.renameLayer(start.layers[0]!.id, names[0]!),
      ];
      const made: Layer[] = [];
      names.slice(1).forEach(() => steps.push(cmd.addLayer((layer) => made.push(layer))));
      steps.push({
        label: 'name the layers',
        apply: (doc) =>
          made.reduce(
            (d, layer, i) =>
              execute(createHistory(d), cmd.renameLayer(layer.id, names[i + 1]!)).present,
            doc,
          ),
      });
      return steps;
    });
    expect(doc.layers.map((l) => l.name)).toEqual(names);
    // The top layer draws last: the fish swim in front of the rocks.
    const withFish = execute(
      createHistory(
        execute(
          createHistory(doc),
          cmd.addObject(
            layerOf(doc, 'rocks').id,
            createRect({ x: 0, y: 600, width: 300, height: 120 }),
          ),
        ).present,
      ),
      cmd.addObject(
        layerOf(doc, 'background_fish').id,
        createEllipse({ x: 100, y: 620, width: 60, height: 30 }),
      ),
    ).present;
    expect(drawOrder(withFish).map((d) => d.object.kind)).toEqual(['rect', 'ellipse']);
  });

  it('3 a name with each letter in its own layer, saved as myName', () => {
    const letters = ['S', 'a', 'i', 'f'];
    const doc = build('myName', (start) => {
      const steps: Command<AnimationDoc>[] = [cmd.renameLayer(start.layers[0]!.id, 'S')];
      const made: Layer[] = [];
      letters.slice(1).forEach(() => steps.push(cmd.addLayer((layer) => made.push(layer))));
      steps.push({
        label: 'letters',
        apply: (doc) => {
          let next = made.reduce(
            (d, layer, i) =>
              execute(createHistory(d), cmd.renameLayer(layer.id, letters[i + 1]!)).present,
            doc,
          );
          letters.forEach((letter, i) => {
            const layer = next.layers.find((l) => l.name === letter)!;
            next = execute(
              createHistory(next),
              cmd.addObject(layer.id, createText(letter, { x: 100 + i * 80, y: 200, size: 96 })),
            ).present;
          });
          return next;
        },
      });
      return steps;
    });
    expect(doc.layers.map((l) => l.name)).toEqual(letters);
    expect(drawOrder(doc).map((d) => d.object.kind === 'text' && d.object.text)).toEqual(letters);
    expect(roundTrip(doc, 'C:\\Users\\student')).toEqual(doc);
  });
});

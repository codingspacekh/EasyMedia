// AN18: buttons in Animation mode (workbook Task 4: Pause and Continue on the slideshow) — placed
// with the Button tool, changed in the Properties panel, each one undo step; and Test, which
// opens the animation as its web page in a window of its own, where the buttons work.
import { describe, expect, it } from 'vitest';
import type { ButtonObject } from '../../../src/core/animation/types.ts';
import { testApp } from '../../helpers/test-app.ts';

function setup() {
  const t = testApp();
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  const buttons = () =>
    doc()
      .layers.flatMap((l) => l.objects)
      .filter((o): o is ButtonObject => o.kind === 'button');
  return { ...t, anim, doc, buttons, state: () => anim.store.get() };
}

describe('buttons (AN18)', () => {
  it('the Button tool places a Pause button where clicked, selected, as one undo step', () => {
    const s = setup();
    s.anim.setTool('button');
    s.anim.addButton({ x: 10, y: 10 });
    expect(s.buttons()).toMatchObject([{ label: 'Pause', action: 'pause', x: 10, y: 10 }]);
    expect(s.state()).toMatchObject({ selection: [s.buttons()[0]!.id], tool: 'select' });
    s.anim.undo();
    expect(s.buttons()).toEqual([]);
  });

  it('Task 4: the second button becomes Continue; its words follow the action until typed', () => {
    const s = setup();
    s.anim.addButton({ x: 10, y: 10 });
    s.anim.addButton({ x: 10, y: 40 });
    s.anim.setButtonAction('continue');
    expect(s.buttons().map((b) => [b.action, b.label, b.name])).toEqual([
      ['pause', 'Pause', 'Pause'],
      ['continue', 'Continue', 'Continue'],
    ]);
    s.anim.setProperties({ label: 'Play on', name: 'My button' });
    s.anim.setButtonAction('restart');
    expect(s.buttons()[1]).toMatchObject({
      action: 'restart',
      label: 'Play on',
      name: 'My button',
    });
  });

  it('Go to frame keeps a frame to go to; other actions do not', () => {
    const s = setup();
    s.anim.addButton({ x: 0, y: 0 });
    s.anim.setButtonAction('goto');
    expect(s.buttons()[0]).toMatchObject({ action: 'goto', label: 'Go to frame', frame: 0 });
    s.anim.setProperties({ frame: 48 });
    expect(s.buttons()[0]!.frame).toBe(48);
    s.anim.setButtonAction('pause');
    expect(s.buttons()[0]!.frame).toBeUndefined();
  });

  it('a button without words is refused, with a message, and nothing changes', () => {
    const s = setup();
    s.anim.addButton({ x: 0, y: 0 });
    expect(s.anim.setProperties({ label: ' ' })).toMatch(/needs words/);
    expect(s.buttons()[0]!.label).toBe('Pause');
  });

  it('a button is saved and opened again', async () => {
    const s = setup();
    s.anim.addButton({ x: 10, y: 10 });
    s.dialogs.saveAnimation.mockResolvedValueOnce('/work/Chapter07_Task4.mvea');
    await s.anim.save();
    s.dialogs.openAnimation.mockResolvedValueOnce('/work/Chapter07_Task4.mvea');
    await s.anim.newAnimation();
    await s.anim.open();
    expect(s.buttons()).toMatchObject([{ label: 'Pause', action: 'pause' }]);
  });
});

describe('Test (AN18)', () => {
  it('opens the animation’s web page in a window of its own, at the stage size', async () => {
    const s = setup();
    const stage = s.doc().stage;
    s.anim.setStage({ ...stage, width: 1024, height: 768 });
    s.anim.addButton({ x: 10, y: 10 });
    await s.anim.testAnimation();
    expect(s.pageAssets.openTest).toHaveBeenCalledTimes(1);
    const [html, title, width, height] = s.pageAssets.openTest.mock.calls[0]!;
    expect(html).toContain('<canvas id="stage" width="1024" height="768"');
    expect(html).toContain('/* player */');
    expect(html).toContain('"action":"pause"');
    expect([title, width, height]).toEqual(['Untitled', 1024, 768]);
    expect(s.state().busy).toBeNull();
    expect(s.disk.size).toBe(0); // nothing saved where the student keeps files
  });

  it('an error is shown as a message', async () => {
    const s = setup();
    s.pageAssets.openTest.mockRejectedValueOnce(new Error('no window'));
    await s.anim.testAnimation();
    expect(s.state().message?.kind).toBe('error');
    expect(s.state().busy).toBeNull();
  });
});

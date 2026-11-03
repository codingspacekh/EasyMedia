// Native menu items act on the mode that is showing (Video or Audio).
import { describe, expect, it, vi } from 'vitest';
import { menuActions } from '../../../src/ui/menu-actions.ts';
import { leaveLearn, ui } from '../../../src/ui/ui-state.svelte.ts';
import { testApp } from '../../helpers/test-app.ts';

describe('menu actions follow the mode', () => {
  it('Undo / Redo / Import act on the video project in Video mode', async () => {
    const { app } = testApp();
    const undo = vi.spyOn(app, 'undo');
    const audioUndo = vi.spyOn(app.audio, 'undo');
    menuActions(app).undo();
    expect([undo.mock.calls.length, audioUndo.mock.calls.length]).toEqual([1, 0]);
  });

  it('… and on the sound in Audio mode', async () => {
    const { app } = testApp();
    ui.mode = 'Audio';
    const spies = {
      undo: vi.spyOn(app.audio, 'undo'),
      redo: vi.spyOn(app.audio, 'redo'),
      importAudio: vi.spyOn(app.audio, 'importAudio'),
      selectAll: vi.spyOn(app.audio, 'selectAll'),
    };
    const actions = menuActions(app);
    actions.undo();
    actions.redo();
    await actions.import();
    actions.selectAll();
    expect(Object.values(spies).map((s) => s.mock.calls.length)).toEqual([1, 1, 1, 1]);
  });

  it('Export Audio… switches to Audio mode and opens its export dialog', () => {
    const { app } = testApp();
    menuActions(app).exportAudio();
    expect([ui.mode, ui.audioExport]).toEqual(['Audio', true]);
  });

  it('Select All in a text box selects its text, not the sound', () => {
    const { app } = testApp();
    ui.mode = 'Audio';
    const input = document.createElement('input');
    input.value = 'Task_11j';
    document.body.append(input);
    input.focus();
    const selectAll = vi.spyOn(app.audio, 'selectAll');
    menuActions(app).selectAll();
    expect(selectAll).not.toHaveBeenCalled();
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 8]);
    input.remove();
  });

  it('N15 a Learn menu item shows that Learn page; Back returns to the editor it came from', () => {
    const { app } = testApp();
    ui.mode = 'Animation';
    const actions = menuActions(app);
    actions.learnFormats();
    expect([ui.mode, ui.learnTab, ui.learnFrom]).toEqual(['Learn', 'formats', 'Animation']);
    // Another Learn page keeps where it came from.
    actions.learnTask();
    expect([ui.learnTab, ui.learnFrom]).toEqual(['task', 'Animation']);
    actions.learnInspect();
    actions.learnAnimation();
    expect(ui.learnTab).toBe('animation');
    leaveLearn();
    expect(ui.mode).toBe('Animation');
  });

  it('N15 Glossary opens over any mode, without leaving it', () => {
    const { app } = testApp();
    ui.mode = 'Audio';
    menuActions(app).glossary();
    expect([ui.mode, ui.glossary]).toEqual(['Audio', true]);
    ui.glossary = false;
  });
});

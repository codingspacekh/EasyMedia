// Native menu items act on the mode that is showing (Video or Audio).
import { describe, expect, it, vi } from 'vitest';
import { menuActions } from '../../../src/ui/menu-actions.ts';
import { ui } from '../../../src/ui/ui-state.svelte.ts';
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
});

import { describe, expect, it } from 'vitest';
import {
  canRedo,
  canUndo,
  createHistory,
  execute,
  redo,
  redoLabel,
  undo,
  undoLabel,
  type Command,
} from '../../../src/app/history.ts';
import { createProject } from '../../../src/core/model/factory.ts';
import { EditError } from '../../../src/core/model/errors.ts';
import type { Project } from '../../../src/core/model/types.ts';

const rename = (name: string): Command => ({ label: 'Rename', apply: (p) => ({ ...p, name }) });
const failing: Command = {
  label: 'Broken',
  apply: () => {
    throw new EditError('Not allowed');
  },
};
const start = () => createHistory(createProject({ name: 'v0' }));
const names = (p: Project) => p.name;

describe('A18 / P4 undo and redo', () => {
  it('a new history has nothing to undo or redo', () => {
    const h = start();
    expect([canUndo(h), canRedo(h), undoLabel(h), redoLabel(h)]).toEqual([
      false,
      false,
      null,
      null,
    ]);
  });

  it('execute changes the project and remembers how to undo it', () => {
    const h = execute(start(), rename('v1'));
    expect(names(h.present)).toBe('v1');
    expect(undoLabel(h)).toBe('Rename');
  });

  it('undo goes back, redo goes forward again', () => {
    const h1 = execute(start(), rename('v1'));
    const back = undo(h1);
    expect(names(back.present)).toBe('v0');
    expect(redoLabel(back)).toBe('Rename');
    expect(names(redo(back).present)).toBe('v1');
  });

  it('undo restores exactly the same project object as before', () => {
    const h0 = start();
    expect(undo(execute(h0, rename('v1'))).present).toBe(h0.present);
  });

  it('a new edit after undo clears the redo list', () => {
    const h = execute(undo(execute(start(), rename('v1'))), rename('v2'));
    expect([names(h.present), canRedo(h)]).toEqual(['v2', false]);
  });

  it('undo and redo do nothing when there is nothing to undo or redo', () => {
    const h = start();
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('a failed edit throws and leaves the history unchanged', () => {
    const h = execute(start(), rename('v1'));
    expect(() => execute(h, failing)).toThrow(EditError);
    expect(names(h.present)).toBe('v1');
  });

  it('an edit that changes nothing is not added to the history', () => {
    const h = start();
    expect(execute(h, { label: 'Nothing', apply: (p) => p })).toBe(h);
  });

  it('has no limit: 1000 edits can all be undone', () => {
    let h = start();
    for (let i = 1; i <= 1000; i++) h = execute(h, rename(`v${i}`));
    for (let i = 0; i < 1000; i++) h = undo(h);
    expect([names(h.present), canUndo(h)]).toEqual(['v0', false]);
  });
});

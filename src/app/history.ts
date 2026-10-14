// Undo / redo (A18, P4). Projects are immutable, so undo restores the previous project
// exactly; commands only need to know how to apply themselves.
import type { Project } from '../core/model/types.ts';

/** One edit. `apply` returns a new project and must never change the one it is given. */
export interface Command {
  label: string;
  apply(project: Project): Project;
}

interface Entry {
  label: string;
  project: Project;
}

export interface History {
  readonly past: readonly Entry[];
  readonly present: Project;
  readonly future: readonly Entry[];
}

export function createHistory(project: Project): History {
  return { past: [], present: project, future: [] };
}

/** Applies the command. If it throws (e.g. EditError), the history is unchanged. */
export function execute(history: History, command: Command): History {
  const next = command.apply(history.present);
  if (next === history.present) return history;
  return {
    past: [...history.past, { label: command.label, project: history.present }],
    present: next,
    future: [],
  };
}

export function undo(history: History): History {
  const last = history.past.at(-1);
  if (!last) return history;
  return {
    past: history.past.slice(0, -1),
    present: last.project,
    future: [{ label: last.label, project: history.present }, ...history.future],
  };
}

export function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return {
    past: [...history.past, { label: next.label, project: history.present }],
    present: next.project,
    future: rest,
  };
}

export const canUndo = (h: History): boolean => h.past.length > 0;
export const canRedo = (h: History): boolean => h.future.length > 0;
export const undoLabel = (h: History): string | null => h.past.at(-1)?.label ?? null;
export const redoLabel = (h: History): string | null => h.future[0]?.label ?? null;

// Undo / redo (A18, P4). Projects are immutable, so undo restores the previous project
// exactly; commands only need to know how to apply themselves.
import type { Project } from '../core/model/types.ts';

/**
 * One edit. `apply` returns a new document and must never change the one it is given. The
 * document is the video project unless said otherwise (Animation mode's history holds an
 * AnimationDoc, M13).
 */
export interface Command<T = Project> {
  label: string;
  apply(project: T): T;
}

interface Entry<T> {
  label: string;
  project: T;
}

export interface History<T = Project> {
  readonly past: readonly Entry<T>[];
  readonly present: T;
  readonly future: readonly Entry<T>[];
}

export function createHistory<T = Project>(project: T): History<T> {
  return { past: [], present: project, future: [] };
}

/** Applies the command. If it throws (e.g. EditError), the history is unchanged. */
export function execute<T>(history: History<T>, command: Command<T>): History<T> {
  const next = command.apply(history.present);
  if (next === history.present) return history;
  return {
    past: [...history.past, { label: command.label, project: history.present }],
    present: next,
    future: [],
  };
}

export function undo<T>(history: History<T>): History<T> {
  const last = history.past.at(-1);
  if (!last) return history;
  return {
    past: history.past.slice(0, -1),
    present: last.project,
    future: [{ label: last.label, project: history.present }, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return {
    past: [...history.past, { label: next.label, project: history.present }],
    present: next.project,
    future: rest,
  };
}

export const canUndo = (h: History<unknown>): boolean => h.past.length > 0;
export const canRedo = (h: History<unknown>): boolean => h.future.length > 0;
export const undoLabel = (h: History<unknown>): string | null => h.past.at(-1)?.label ?? null;
export const redoLabel = (h: History<unknown>): string | null => h.future[0]?.label ?? null;

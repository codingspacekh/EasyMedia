// Animation mode's state: what the store holds, what the app needs from outside, and the
// derived facts the UI shows (unsaved work, the window title).
import type { History } from '../history.ts';
import type { AnimationFormat } from '../../core/animation/export.ts';
import type { AnimationDoc, Id } from '../../core/animation/types.ts';
import type {
  AppPaths,
  Dialogs,
  MediaEngine,
  PageAssets,
  ProjectFiles,
  StageRenderer,
} from '../../core/ports.ts';
import { fileNameOf } from '../../core/project/relocate.ts';

export type Tool =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'star'
  | 'polygon'
  | 'line'
  | 'pen'
  | 'brush'
  | 'text'
  | 'picture'
  | 'button';

export type ShapeKind = 'rect' | 'ellipse' | 'star' | 'polygon';

export interface AnimationState {
  history: History<AnimationDoc>;
  /** The .mvea file, or null for an animation that was never saved. */
  path: string | null;
  /** The document as last saved or opened: anything else is unsaved work. */
  saved: AnimationDoc;
  /** Selected objects (top-level ones). */
  selection: Id[];
  /** The layer new objects go on. */
  layerId: Id;
  tool: Tool;
  /** 1 = 100 %; 'fit' fills the window. */
  zoom: number | 'fit';
  /** AN8: the playhead, 0 to the stage's length (the end shows the last pose). */
  frame: number;
  playing: boolean;
  /** AN8: loop the whole animation, or the frames from `from` to `to` (both shown). */
  loop: Loop;
  /** AN14: the drawings before and after drawn faintly on frame-by-frame layers (not saved). */
  onionSkin: boolean;
  /** AN15: an export of the frames under way (N12: progress and Cancel). */
  exporting: AnimationExporting | null;
  /** What Animation mode is doing, e.g. "Exporting…". */
  busy: string | null;
  message: { kind: 'error' | 'info'; text: string } | null;
}

export interface AnimationExporting {
  format: AnimationFormat;
  /** Drawing the frames, then FFmpeg making the file (MP4 and GIF only). */
  phase: 'drawing' | 'encoding';
  /** 0–1 within the phase. */
  progress: number;
  output: string;
}

export interface Loop {
  on: boolean;
  from?: number;
  to?: number;
}

export interface AnimationDeps {
  dialogs: Dialogs;
  files: ProjectFiles;
  paths: AppPaths;
  engine: MediaEngine;
  renderer?: StageRenderer;
  /** AN15: what an HTML web animation carries inside it (read by the main process in the app). */
  pageAssets?: PageAssets;
  autosaveMs?: number;
}

/**
 * Unsaved work: anything but the view settings (rulers, grid, snapping, open folders), which are
 * saved with the animation but are not edits. The document is immutable, so the other parts are
 * the same objects until an edit replaces them.
 */
export const isAnimationDirty = (s: AnimationState): boolean => {
  const a = s.history.present;
  const b = s.saved;
  if (a === b) return false;
  return (
    a.name !== b.name ||
    a.stage !== b.stage ||
    a.layers !== b.layers ||
    a.folders !== b.folders ||
    a.pictures !== b.pictures ||
    a.guides !== b.guides
  );
};

/** For the window title: "Chapter07_Task1_1 •" or "Untitled animation". */
export const animationTitle = (s: AnimationState): string =>
  `${s.path ? fileNameOf(s.path).replace(/\.mvea$/i, '') : 'Untitled animation'}${
    isAnimationDirty(s) ? ' •' : ''
  }`;

// UI-only state of Audio mode shared by its panels (not part of the sound, not undoable).
export type AudioTool = 'clip' | 'select';
export type AudioDialog = { kind: 'effect'; id: string } | { kind: 'silence' } | null;

export const DEFAULT_ZOOM = 24; // px per second, as screen 13
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6000;

export const audioUi = $state({
  /**
   * Clip tool (as on the video timeline: click a clip to select it, drag it to move it, drag
   * its edges to trim it) or Selection tool (drag across the sound to select part of it).
   */
  tool: 'clip' as AudioTool,
  /** Zoom: pixels per second. */
  pxPerSecond: DEFAULT_ZOOM,
  /** The effect or Insert silence dialog that is open. */
  dialog: null as AudioDialog,
});

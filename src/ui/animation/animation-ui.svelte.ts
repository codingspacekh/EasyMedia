// UI-only state of Animation mode shared by its panels (not part of the animation, not undoable).
export type AnimDialog = 'stage' | null;

export const animUi = $state({
  /** The pointer's stage coordinates, for the status bar (null when off the stage). */
  pointer: null as { x: number; y: number } | null,
  /** What the last move snapped to ("grid", "edge of Star"…), for the status bar. */
  snapped: null as string | null,
  /** The dialog that is open. */
  dialog: null as AnimDialog,
  /** The Properties panel's W / H lock. */
  lockRatio: false,
  /** A text object was just made: the Properties panel focuses its words. */
  focusText: 0,
});

/** How close (screen px) a drag must come to a snap target. */
export const SNAP_PX = 8;
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

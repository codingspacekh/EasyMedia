// Small UI-only state shared by panels (not part of the project, not undoable).
export type InspectorTab = 'clip' | 'audio' | 'effects' | 'text';

export const ui = $state({
  /** The inspector tab the student last chose; kept when another clip is selected. */
  inspectorTab: 'clip' as InspectorTab,
  /** Timeline snapping (trim handles, dragging captions). */
  snap: true,
  /** Show the 5 % safe area on the preview. */
  safeArea: false,
});

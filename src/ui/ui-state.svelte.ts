// Small UI-only state shared by panels (not part of the project, not undoable).
export type InspectorTab = 'clip' | 'audio' | 'effects' | 'text';
export type Mode = 'Video' | 'Audio' | 'Learn' | 'Animation';
export type LearnTab = 'inspect' | 'formats' | 'task';

export const ui = $state({
  /** Video, Audio, Learn or Animation mode (the native menus act on the mode that is showing). */
  mode: 'Video' as Mode,
  /** Audio mode's export dialog is open (also opened by File ▸ Export Audio…). */
  audioExport: false,
  /** The inspector tab the student last chose; kept when another clip is selected. */
  inspectorTab: 'clip' as InspectorTab,
  /** Timeline snapping (trim handles, dragging captions). */
  snap: true,
  /** Show the 5 % safe area on the preview. */
  safeArea: false,
  /** Learn mode's tab: screen 21, screen 22 or the task checker. */
  learnTab: 'inspect' as LearnTab,
  /** Learn mode's glossary is open. */
  glossary: false,
});

/** How long the mouse rests on a button before its tooltip shows (the built-in one is slower). */
export const TOOLTIP_DELAY = 400;

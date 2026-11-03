// Small UI-only state shared by panels (not part of the project, not undoable).
export type InspectorTab = 'clip' | 'audio' | 'effects' | 'text';
export type Mode = 'Video' | 'Audio' | 'Learn' | 'Animation';
/** The editors chosen in the mode switch; Learn is opened from the menu bar (N15). */
export type Editor = Exclude<Mode, 'Learn'>;
export const EDITORS: readonly Editor[] = ['Video', 'Audio', 'Animation'];
export type LearnTab = 'inspect' | 'formats' | 'animation' | 'task';

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
  /** Learn mode's tab: screen 21, screen 22, animation theory or the task checker. */
  learnTab: 'inspect' as LearnTab,
  /** N15: the editor Learn was opened from; Back returns to it. */
  learnFrom: 'Video' as Editor,
  /** Learn mode's glossary is open. */
  glossary: false,
});

/** How long the mouse rests on a button before its tooltip shows (the built-in one is slower). */
export const TOOLTIP_DELAY = 400;

/** N15: shows a Learn page in place of the editor, remembering the editor to go back to. */
export function openLearn(tab: LearnTab): void {
  if (ui.mode !== 'Learn') ui.learnFrom = ui.mode;
  ui.learnTab = tab;
  ui.mode = 'Learn';
}

/** N15: Back — the editor Learn was opened from. */
export function leaveLearn(): void {
  ui.mode = ui.learnFrom;
}

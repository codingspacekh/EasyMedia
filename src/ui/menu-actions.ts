// What each native menu item does (X3). New, Open, Save, Export, Undo, Redo, Import and Select
// All act on the mode that is showing: the video project in Video mode, the sound in Audio
// mode, the animation in Animation mode. The Learn menu shows a Learn page (N15).
import type { App } from '../app/app.ts';
import type { MenuAction } from '../preload/api.ts';
import { animUi } from './animation/animation-ui.svelte.ts';
import { openLearn, ui } from './ui-state.svelte.ts';

const inTextBox = () => {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
};

export function menuActions(app: App): Record<MenuAction, () => unknown> {
  const audio = () => ui.mode === 'Audio';
  const anim = () => ui.mode === 'Animation';
  const a = app.animation;
  /** N16: the panel on that edge of the editor that is showing (none in Learn). */
  const toggleEdge = (edge: 'left' | 'right' | 'bottom') =>
    ui.mode === 'Learn' ? Promise.resolve() : app.layout.toggleEdge(ui.mode, edge);
  return {
    new: () => (anim() ? a.newAnimation() : app.newProject()),
    open: () => (anim() ? a.open() : app.open()),
    save: () => (anim() ? a.save() : app.save()),
    saveAs: () => (anim() ? a.saveAs() : app.saveAs()),
    import: () =>
      anim()
        ? a.addPicture({ x: 20, y: 20 })
        : audio()
          ? app.audio.importAudio()
          : app.importMedia(),
    export: () => (anim() ? void (animUi.dialog = 'export') : app.exportVideo()),
    newAnimation: () => {
      ui.mode = 'Animation';
      return a.newAnimation();
    },
    openAnimation: () => {
      ui.mode = 'Animation';
      return a.open();
    },
    exportAnimation: () => {
      ui.mode = 'Animation';
      animUi.dialog = 'export';
    },
    exportAudio: () => {
      ui.mode = 'Audio';
      ui.audioExport = true;
    },
    package: () => (anim() ? a.packageAnimation() : app.packageProject()),
    undo: () => (anim() ? a.undo() : audio() ? app.audio.undo() : app.undo()),
    redo: () => (anim() ? a.redo() : audio() ? app.audio.redo() : app.redo()),
    learnInspect: () => openLearn('inspect'),
    learnFormats: () => openLearn('formats'),
    learnAnimation: () => openLearn('animation'),
    learnTask: () => openLearn('task'),
    glossary: () => {
      ui.glossary = true;
    },
    toggleLeft: () => toggleEdge('left'),
    toggleRight: () => toggleEdge('right'),
    toggleBottom: () => toggleEdge('bottom'),
    resetLayout: () => app.layout.reset(),
    welcome: app.showWelcome,
    licences: app.showLicences,
    updates: () => app.updates.openDialog(),
    selectAll: () => {
      const box = inTextBox();
      if (box) box.select();
      else if (audio()) app.audio.selectAll();
      else if (anim()) a.selectAll();
    },
  };
}

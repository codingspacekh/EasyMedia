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
  /** M18: Graphics mode is Animation mode's app on an image: the same actions on its own file. */
  const graphics = () => ui.mode === 'Graphics';
  const a = app.animation;
  const g = app.graphics;
  /** The Animation-mode app the menus act on: Graphics mode's when it is showing. */
  const drawing = () => (graphics() ? g : a);
  const inDrawing = () => anim() || graphics();
  /** N16: the panel on that edge of the editor that is showing (none in Learn). */
  const toggleEdge = (edge: 'left' | 'right' | 'bottom') =>
    ui.mode === 'Learn' ? Promise.resolve() : app.layout.toggleEdge(ui.mode, edge);
  return {
    new: () =>
      graphics() ? void (animUi.dialog = 'newImage') : anim() ? a.newAnimation() : app.newProject(),
    open: () => (inDrawing() ? drawing().open() : app.open()),
    save: () => (inDrawing() ? drawing().save() : app.save()),
    saveAs: () => (inDrawing() ? drawing().saveAs() : app.saveAs()),
    import: () =>
      inDrawing()
        ? drawing().addPicture({ x: 20, y: 20 })
        : audio()
          ? app.audio.importAudio()
          : app.importMedia(),
    export: () => (inDrawing() ? void (animUi.dialog = 'export') : app.exportVideo()),
    newImage: () => {
      ui.mode = 'Graphics';
      animUi.dialog = 'newImage';
    },
    openImage: () => {
      ui.mode = 'Graphics';
      return g.open();
    },
    exportImage: () => {
      ui.mode = 'Graphics';
      animUi.dialog = 'export';
    },
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
    package: () => (inDrawing() ? drawing().packageAnimation() : app.packageProject()),
    undo: () => (inDrawing() ? drawing().undo() : audio() ? app.audio.undo() : app.undo()),
    redo: () => (inDrawing() ? drawing().redo() : audio() ? app.audio.redo() : app.redo()),
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
    about: app.showAbout,
    updates: () => app.updates.openDialog(),
    candidate: () => app.candidate.openDialog(),
    selectAll: () => {
      const box = inTextBox();
      if (box) box.select();
      else if (audio()) app.audio.selectAll();
      else if (inDrawing()) drawing().selectAll();
    },
  };
}

// What each native menu item does (X3). New, Open, Save, Export, Undo, Redo, Import and Select
// All act on the mode that is showing: the video project in Video mode, the sound in Audio
// mode, the animation in Animation mode.
import type { App } from '../app/app.ts';
import type { MenuAction } from '../preload/api.ts';
import { ui } from './ui-state.svelte.ts';

const inTextBox = () => {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
};

export function menuActions(app: App): Record<MenuAction, () => unknown> {
  const audio = () => ui.mode === 'Audio';
  const anim = () => ui.mode === 'Animation';
  const a = app.animation;
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
    export: () => (anim() ? a.exportPng() : app.exportVideo()),
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
      return a.exportPng();
    },
    exportAudio: () => {
      ui.mode = 'Audio';
      ui.audioExport = true;
    },
    package: app.packageProject,
    undo: () => (anim() ? a.undo() : audio() ? app.audio.undo() : app.undo()),
    redo: () => (anim() ? a.redo() : audio() ? app.audio.redo() : app.redo()),
    welcome: app.showWelcome,
    licences: app.showLicences,
    selectAll: () => {
      const box = inTextBox();
      if (box) box.select();
      else if (audio()) app.audio.selectAll();
      else if (anim()) a.selectAll();
    },
  };
}

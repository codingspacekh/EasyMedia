// What each native menu item does (X3). Undo, Redo, Import and Select All act on the mode that
// is showing: the video project in Video mode, the sound in Audio mode.
import type { App } from '../app/app.ts';
import type { MenuAction } from '../preload/api.ts';
import { ui } from './ui-state.svelte.ts';

const inTextBox = () => {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
};

export function menuActions(app: App): Record<MenuAction, () => unknown> {
  const audio = () => ui.mode === 'Audio';
  return {
    new: app.newProject,
    open: app.open,
    save: app.save,
    saveAs: app.saveAs,
    import: () => (audio() ? app.audio.importAudio() : app.importMedia()),
    export: app.exportVideo,
    exportAudio: () => {
      ui.mode = 'Audio';
      ui.audioExport = true;
    },
    package: app.packageProject,
    undo: () => (audio() ? app.audio.undo() : app.undo()),
    redo: () => (audio() ? app.audio.redo() : app.redo()),
    selectAll: () => {
      const box = inTextBox();
      if (box) box.select();
      else if (audio()) app.audio.selectAll();
    },
  };
}

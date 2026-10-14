import { mount } from 'svelte';
import { createApp } from '../app/app.ts';
import { createElectronMediaEngine } from '../adapters/electron/media-engine.ts';
import {
  createElectronDialogs,
  createElectronProjectFiles,
  getAppPaths,
} from '../adapters/electron/services.ts';
import type { MenuAction } from '../preload/api.ts';
import App from './App.svelte';
import './theme.css';

const target = document.getElementById('app')!;

if (!window.mve) {
  target.textContent = 'EasyMedia runs as a desktop app: start it with "npm run app".';
} else {
  const api = window.mve;
  const app = createApp({
    engine: createElectronMediaEngine(api),
    dialogs: createElectronDialogs(api),
    files: createElectronProjectFiles(api),
    paths: await getAppPaths(api),
  });
  const actions: Record<MenuAction, () => unknown> = {
    new: app.newProject,
    open: app.open,
    save: app.save,
    saveAs: app.saveAs,
    import: app.importMedia,
    export: app.exportVideo,
    undo: app.undo,
    redo: app.redo,
  };
  api.on('menu:action', (action) => void actions[action]());
  mount(App, { target, props: { app } });
  void app.start();
}

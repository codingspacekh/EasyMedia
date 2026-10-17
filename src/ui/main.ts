import { mount } from 'svelte';
import { createApp } from '../app/app.ts';
import { createCanvasTextRenderer } from '../adapters/canvas/text-renderer.ts';
import { createElectronMediaEngine } from '../adapters/electron/media-engine.ts';
import {
  createElectronDialogs,
  createElectronProjectFiles,
  getAppPaths,
} from '../adapters/electron/services.ts';
import { createWebAudioOutput } from '../adapters/webaudio/output.ts';
import { createIndexedDbUndoStore } from '../adapters/indexeddb/undo-store.ts';
import { menuActions } from './menu-actions.ts';
import App from './App.svelte';
import './fonts.css';
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
    text: createCanvasTextRenderer(),
    paths: await getAppPaths(api),
    audioOutput: createWebAudioOutput(),
    audioUndoStore: createIndexedDbUndoStore(),
  });
  const actions = menuActions(app);
  api.on('menu:action', (action) => void actions[action]());
  mount(App, { target, props: { app } });
  void app.start();
}

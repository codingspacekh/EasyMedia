// jsdom has no canvas: the preview's text canvas simply draws nothing in component tests
// (text drawing is tested in core, and for real in the E2E tests).
import { beforeEach } from 'vitest';
import { ui } from '../../src/ui/ui-state.svelte.ts';
import { audioUi, DEFAULT_ZOOM } from '../../src/ui/audio/audio-ui.svelte.ts';
import { animUi } from '../../src/ui/animation/animation-ui.svelte.ts';

HTMLCanvasElement.prototype.getContext = () => null;

// jsdom has no ResizeObserver (Svelte's bind:clientWidth needs one): the stage keeps its size.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Panels share a little UI state (the inspector tab…): every test starts from the defaults.
beforeEach(() => {
  ui.mode = 'Video';
  ui.audioExport = false;
  ui.inspectorTab = 'clip';
  ui.snap = true;
  ui.safeArea = false;
  audioUi.tool = 'clip';
  audioUi.pxPerSecond = DEFAULT_ZOOM;
  audioUi.dialog = null;
  animUi.pointer = null;
  animUi.snapped = null;
  animUi.dialog = null;
  animUi.lockRatio = false;
});

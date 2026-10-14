// jsdom has no canvas: the preview's text canvas simply draws nothing in component tests
// (text drawing is tested in core, and for real in the E2E tests).
import { beforeEach } from 'vitest';
import { ui } from '../../src/ui/ui-state.svelte.ts';

HTMLCanvasElement.prototype.getContext = () => null;

// Panels share a little UI state (the inspector tab…): every test starts from the defaults.
beforeEach(() => {
  ui.inspectorTab = 'clip';
  ui.snap = true;
  ui.safeArea = false;
});

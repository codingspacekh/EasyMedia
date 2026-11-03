// AN15: the exported web page's script (bundled by vite.electron.config.ts --mode player). It
// starts the animation in the page with the browser's own canvas, clock and fonts.
import type { StageCanvas } from '../core/animation/draw.ts';
import { boot } from './boot.ts';

void boot({
  document,
  now: () => performance.now(),
  requestFrame: (callback) => void requestAnimationFrame(callback),
  context: (canvas) => canvas.getContext('2d') as unknown as StageCanvas | null,
  async loadImage(url) {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  },
  loadFont: async (font) => document.fonts?.load(font),
}).then((started) => {
  // For a test (or a curious student's console): the player's state.
  (window as unknown as { oneeditor?: unknown }).oneeditor = started;
});

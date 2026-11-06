// AN15: the exported web page's script (bundled by vite.electron.config.ts --mode player). It
// starts the animation in the page with the browser's own canvas, clock and fonts.
import type { StageCanvas } from '../core/animation/draw.ts';
import { boot, type PageAudio } from './boot.ts';
import { withLayers } from '../adapters/canvas/layers.ts';

/**
 * AN28: the page's sounds through Web Audio. A browser starts the sound "suspended" until the
 * page is clicked (unless it already allows sound, as Test does); each sound goes through a gain
 * that follows its volume and fades.
 */
function webAudio(): PageAudio | undefined {
  if (typeof AudioContext === 'undefined') return undefined;
  const ctx = new AudioContext();
  const playing = new Set<AudioBufferSourceNode>();
  return {
    allowed: () => ctx.state === 'running',
    unlock: () => ctx.resume(),
    async load(url) {
      const response = await fetch(url);
      return ctx.decodeAudioData(await response.arrayBuffer());
    },
    play(sound, { wait, from, duration, gains }) {
      const source = ctx.createBufferSource();
      source.buffer = sound as AudioBuffer;
      const gain = ctx.createGain();
      source.connect(gain).connect(ctx.destination);
      const at = ctx.currentTime + wait;
      gains.forEach((g, i) =>
        i === 0
          ? gain.gain.setValueAtTime(g.gain, at)
          : gain.gain.linearRampToValueAtTime(g.gain, at + g.t),
      );
      source.onended = () => playing.delete(source);
      playing.add(source);
      source.start(at, from, duration);
    },
    stopAll() {
      for (const source of playing) {
        source.onended = null;
        source.stop();
      }
      playing.clear();
    },
  };
}

void boot({
  document,
  now: () => performance.now(),
  requestFrame: (callback) => void requestAnimationFrame(callback),
  context: (canvas) => {
    const ctx = canvas.getContext('2d');
    return ctx ? (withLayers(ctx) as unknown as StageCanvas) : null;
  },
  async loadImage(url) {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  },
  loadFont: async (font) => document.fonts?.load(font),
  audio: webAudio(),
}).then((started) => {
  // For a test (or a curious student's console): the player's state.
  (window as unknown as { oneeditor?: unknown }).oneeditor = started;
});

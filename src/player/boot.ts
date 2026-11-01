// AN15: the HTML web animation's page. The page's script reads the animation from the page, waits
// for its pictures and fonts, then on every screen refresh draws the frame for the time with the
// same drawing as the app (core/animation/draw.ts), looping. Built into one script by Vite
// (vite.electron.config.ts --mode player) and put inside every exported .html file.
import { drawStage, fontOf, type StageCanvas } from '../core/animation/draw.ts';
import { PAGE_DATA_ID, type PageData } from '../core/animation/html.ts';
import { createPlayer, type Player } from '../core/animation/player.ts';
import type { AnimObject } from '../core/animation/types.ts';

export interface BootDeps {
  document: Document;
  /** The page's clock in ms (performance.now). */
  now(): number;
  /** Calls back on the next screen refresh with the clock's time (requestAnimationFrame). */
  requestFrame(callback: (time: number) => void): void;
  context(canvas: HTMLCanvasElement): StageCanvas | null;
  /** A picture from its data: URL, decoded, as something drawImage accepts. */
  loadImage(url: string): Promise<unknown>;
  /** Waits for a font (document.fonts.load). */
  loadFont(font: string): Promise<unknown>;
}

export interface Started {
  player: Player;
  /** Draws the frame shown now (after a button changed it). */
  draw(): void;
}

const fontsOf = (objects: readonly AnimObject[]): string[] =>
  objects.flatMap((o) =>
    o.kind === 'text' ? [fontOf(o)] : o.kind === 'group' ? fontsOf(o.children) : [],
  );

/** Starts the page's animation; null on a page without one (or without a canvas to draw on). */
export async function boot(d: BootDeps): Promise<Started | null> {
  const script = d.document.getElementById(PAGE_DATA_ID);
  const canvas = d.document.getElementById('stage') as HTMLCanvasElement | null;
  if (!script?.textContent || !canvas) return null;
  const ctx = d.context(canvas);
  if (!ctx) return null;
  const { doc, pictures } = JSON.parse(script.textContent) as PageData;

  const images = new Map<string, unknown>();
  await Promise.all([
    ...Object.entries(pictures).map(async ([id, url]) => {
      // A picture that cannot be decoded is left out; the rest still plays.
      const image = await d.loadImage(url).catch(() => null);
      if (image) images.set(id, image);
    }),
    ...[...new Set(fontsOf(doc.layers.flatMap((l) => l.objects)))].map((font) =>
      d.loadFont(font).catch(() => null),
    ),
  ]);

  const player = createPlayer(doc, d.now());
  const drawFrame = (frame: number) =>
    drawStage(ctx, doc, { frame, image: (id) => images.get(id) ?? null });
  let shown = -1;
  const refresh = (time: number) => {
    const frame = player.frameAt(time);
    if (frame !== shown) drawFrame(frame);
    shown = frame;
    d.requestFrame(refresh);
  };
  drawFrame(player.frameAt(d.now()));
  shown = player.state().frame;
  d.requestFrame(refresh);
  return {
    player,
    draw() {
      shown = player.frameAt(d.now());
      drawFrame(shown);
    },
  };
}

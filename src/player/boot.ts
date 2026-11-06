// AN15, AN18: the HTML web animation's page. The page's script reads the animation from the page,
// waits for its pictures and fonts, then on every screen refresh draws the frame for the time with
// the same drawing as the app (core/animation/draw.ts), looping or stopping at the end. A click on a button does what it
// says (core/animation/buttons.ts); the pointer is a hand over one. Built into one script by Vite
// (vite.electron.config.ts --mode player) and put inside every exported .html file. AN15: a page
// of a part plays only its frames, and one exported at another width draws the stage scaled to
// its canvas. AN28: its sounds play in time with the frames (Web Audio), stopped by Pause and
// started again by Continue, Restart, Go to frame and each loop; a browser that blocks sound
// until the page is clicked gets a "Click to play with sound" button over the page first.
import { buttonAt } from '../core/animation/buttons.ts';
import { drawStage, fontsUsed, type StageCanvas } from '../core/animation/draw.ts';
import type { Point } from '../core/animation/geometry.ts';
import { PAGE_DATA_ID, type PageData } from '../core/animation/html.ts';
import { createPlayer, type Player } from '../core/animation/player.ts';
import { pageSounds, type PageSound } from '../core/animation/sound.ts';

/** AN28: the page's speakers (Web Audio in a browser). */
export interface PageAudio {
  /** False while the browser blocks sound until the page is clicked. */
  allowed(): boolean;
  /** After a click: lets sound play. */
  unlock(): Promise<void>;
  /** A sound's file (a data: URL), decoded. */
  load(url: string): Promise<unknown>;
  /** Plays a decoded sound: `wait` s from now, from `from` s into it, for `duration` s. */
  play(sound: unknown, part: Pick<PageSound, 'wait' | 'from' | 'duration' | 'gains'>): void;
  /** Stops every sound playing or waiting to play. */
  stopAll(): void;
}

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
  /** AN28: the speakers; none: the page plays without sound. */
  audio?: PageAudio;
}

export interface Started {
  player: Player;
  /** Draws the frame shown now (after a button changed it). */
  draw(): void;
}

/** Starts the page's animation; null on a page without one (or without a canvas to draw on). */
export async function boot(d: BootDeps): Promise<Started | null> {
  const script = d.document.getElementById(PAGE_DATA_ID);
  const canvas = d.document.getElementById('stage') as HTMLCanvasElement | null;
  if (!script?.textContent || !canvas) return null;
  const ctx = d.context(canvas);
  if (!ctx) return null;
  const { doc, pictures, sounds = {}, size, range } = JSON.parse(script.textContent) as PageData;

  const images = new Map<string, unknown>();
  const decoded = new Map<string, unknown>();
  const { audio } = d;
  await Promise.all([
    ...Object.entries(pictures).map(async ([id, url]) => {
      // A picture that cannot be decoded is left out; the rest still plays.
      const image = await d.loadImage(url).catch(() => null);
      if (image) images.set(id, image);
    }),
    ...fontsUsed(doc.layers.flatMap((l) => l.objects)).map((font) =>
      d.loadFont(font).catch(() => null),
    ),
    // AN28: so is a sound that cannot be decoded.
    ...Object.entries(audio ? sounds : {}).map(async ([id, url]) => {
      const sound = await audio!.load(url).catch(() => null);
      if (sound) decoded.set(id, sound);
    }),
  ]);

  const player = createPlayer(doc, d.now(), range);
  const end = range ? range.last + 1 : doc.stage.length;
  // AN15: the stage drawn at the canvas's size (another width keeps the proportions).
  const scale = size
    ? { x: size.width / doc.stage.width, y: size.height / doc.stage.height }
    : null;
  const drawFrame = (frame: number) => {
    const options = { frame, image: (id: string) => images.get(id) ?? null };
    if (!scale) return drawStage(ctx, doc, options);
    ctx.save();
    ctx.scale(scale.x, scale.y);
    drawStage(ctx, doc, options);
    ctx.restore();
  };

  // ---- AN28: the sounds ----
  const withSound = audio !== undefined && decoded.size > 0;
  /** Starts the sounds heard from the frame shown (each stopped first), if it is playing. */
  const startSounds = () => {
    if (!withSound || !audio.allowed()) return;
    audio.stopAll();
    const { frame, playing } = player.state();
    if (!playing) return;
    for (const part of pageSounds(doc, frame, end)) {
      const sound = decoded.get(part.id);
      if (sound) audio.play(sound, part);
    }
  };

  let shown = -1;
  const refresh = (time: number) => {
    const frame = player.frameAt(time);
    // Round to the start again (a loop): its sounds start again too.
    if (frame < shown && player.state().playing) startSounds();
    if (frame !== shown) drawFrame(frame);
    shown = frame;
    d.requestFrame(refresh);
  };
  const redraw = () => {
    shown = player.frameAt(d.now());
    drawFrame(shown);
  };

  // A browser that blocks sound until a click: the page waits on its first frame under a button.
  if (withSound && !audio.allowed()) {
    player.pause(d.now());
    const start = d.document.createElement('button');
    start.id = 'sound-start';
    start.textContent = '▶ Click to play with sound';
    start.addEventListener('click', () => {
      start.remove();
      void audio.unlock().then(() => {
        player.restart(d.now());
        redraw();
        startSounds();
      });
    });
    d.document.body.append(start);
  }
  redraw();
  startSounds();
  d.requestFrame(refresh);

  // AN18: the page may show the stage smaller or larger than its size: back to stage pixels.
  const stagePoint = (e: MouseEvent): Point => {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) * doc.stage.width) / (box.width || 1),
      y: ((e.clientY - box.top) * doc.stage.height) / (box.height || 1),
    };
  };
  const buttonUnder = (e: MouseEvent) => buttonAt(doc, player.state().frame, stagePoint(e));
  canvas.addEventListener('click', (e) => {
    const button = buttonUnder(e);
    if (!button) return;
    player.press(button, d.now());
    redraw();
    // AN28: Pause stops the sounds; Continue, Restart and Go to frame play them from the frame.
    if (player.state().playing) startSounds();
    else if (withSound) audio.stopAll();
  });
  canvas.addEventListener('mousemove', (e) => {
    canvas.style.cursor = buttonUnder(e) ? 'pointer' : '';
  });
  return { player, draw: redraw };
}

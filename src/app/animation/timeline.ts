// The timeline (AN8, AN9, AN13, AN14): the playhead and playback, loops, keyframes, the length
// and frame rate, and frame-by-frame layers with onion skin.
import * as cmd from '../animation-commands.ts';
import { drawingAt } from '../../core/animation/frames.ts';
import { parseFrame } from '../../core/animation/time.ts';
import type { Easing, Id, TweenProperty } from '../../core/animation/types.ts';
import type { AnimationContext } from './context.ts';
import type { Loop } from './state.ts';

const TYPE_TIME = 'Type a frame number, or a time such as 3 s or 0:03.00.';

export function timelineActions(ctx: AnimationContext) {
  const { store, patch, present, run, edit, play, pause, currentLayer, clampFrame } = ctx;
  return {
    // ---- the playhead and playback (AN8) ----

    setFrame(frame: number): void {
      patch({ frame: clampFrame(frame) });
    },
    step(by: number): void {
      pause();
      patch({ frame: clampFrame(store.get().frame + by) });
    },
    /** A frame, seconds or a clock time typed in the playhead box; returns why not. */
    goTo(text: string): string | null {
      const frame = parseFrame(text, present().stage.fps);
      if (frame === null) return TYPE_TIME;
      patch({ frame: clampFrame(frame) });
      return null;
    },
    play,
    pause,
    togglePlay(): void {
      if (store.get().playing) pause();
      else play();
    },
    stop(): void {
      pause();
      patch({ frame: 0 });
    },
    setLoop(loop: Loop): string | null {
      if (loop.from !== undefined && loop.to !== undefined) {
        if (loop.from > loop.to) return 'The loop must start before it ends.';
        if (loop.from < 0 || loop.to > present().stage.length)
          return 'The loop must be inside the animation.';
      }
      const playing = store.get().playing;
      patch({ loop });
      if (playing) play();
      return null;
    },

    // ---- keyframes (AN9, AN13) ----

    insertKeyframe: (id: Id, property: cmd.PropertyChoice) =>
      void run(cmd.insertKeyframe(id, property, store.get().frame)),
    removeKeyframe: (id: Id, property: TweenProperty, frame: number) =>
      void run(cmd.removeKeyframe(id, property, frame)),
    moveKeyframe: (id: Id, property: TweenProperty, frame: number, to: number) =>
      void run(cmd.moveKeyframe(id, property, frame, to)),
    copyKeyframe: (id: Id, property: TweenProperty, frame: number, to: number) =>
      void run(cmd.copyKeyframe(id, property, frame, to)),
    setEasing: (id: Id, property: TweenProperty, frame: number, easing: Easing) =>
      void run(cmd.setEasing(id, property, frame, easing)),
    setHold: (id: Id, property: TweenProperty, frame: number, hold: boolean) =>
      void run(cmd.setHold(id, property, frame, hold)),
    setRepeat: (id: Id, property: TweenProperty, repeat: 'end' | number | undefined) =>
      void run(cmd.setRepeat(id, property, repeat)),
    reverse: (id: Id, property: cmd.PropertyChoice) => void run(cmd.reverse(id, property)),

    /** AN8: the length, typed as frames or a time; the playhead stays inside it. */
    setLength(text: string): string | null {
      const length = parseFrame(text, present().stage.fps);
      if (length === null) return TYPE_TIME;
      const refused = edit(cmd.setLength(length));
      if (!refused) patch({ frame: clampFrame(store.get().frame) });
      return refused;
    },

    /** AN8: a new frame rate; with 'times' the playhead keeps its time too. */
    setFps(fps: number, keep: 'times' | 'frames'): string | null {
      const before = present().stage.fps;
      const refused = edit(cmd.setFps(fps, keep));
      if (!refused && keep === 'times')
        patch({ frame: clampFrame((store.get().frame * fps) / before) });
      return refused;
    },

    /** AN14: the current layer becomes frame-by-frame; what is on it is the first drawing. */
    makeFrameByFrame(): string | null {
      return edit(cmd.makeFrameByFrame(store.get().layerId));
    },

    /**
     * AN14: a keyframe at the playhead on the frame-by-frame layer: blank (*Insert blank
     * keyframe*) or a copy of the drawing shown (*Duplicate frame*), which is then selected.
     */
    insertDrawing(how: 'blank' | 'copy'): string | null {
      let made: Id[] = [];
      const { layerId, frame } = store.get();
      const error = edit(cmd.addDrawing(layerId, frame, how, (ids) => (made = ids)));
      if (error === null) patch({ selection: made });
      return error;
    },

    /** AN14: removes the keyframe at the playhead and its drawing. */
    removeDrawing(): string | null {
      const { layerId, frame } = store.get();
      return edit(cmd.removeDrawing(layerId, frame));
    },

    /** AN14: shows the drawings before and after faintly, to draw the next one in step. */
    setOnionSkin: (on: boolean) => patch({ onionSkin: on }),

    /** AN14: the keyframe of the drawing shown on the current layer; undefined if not frame-by-frame. */
    drawingShown(): number | undefined {
      const layer = currentLayer();
      return layer ? drawingAt(layer, store.get().frame) : undefined;
    },
  };
}

// AN15, AN18: the HTML web animation's player. The frame shown is worked out from the page's
// clock (ms) at the stage's frame rate and loops at the end; Pause keeps the frame, Continue goes
// on from it, Restart plays from frame 0 and Go to frame jumps. Pure: the page passes the time in,
// so a test can ask for the frame at any moment. Drawing stays in draw.ts (the same as the app).
import type { AnimationDoc, ButtonObject } from './types.ts';

export interface PlayerState {
  frame: number;
  playing: boolean;
}

export type Player = ReturnType<typeof createPlayer>;

/** A player of the document, playing from frame 0 at `now` (ms on the page's clock). */
export function createPlayer(doc: AnimationDoc, now: number) {
  const { fps } = doc.stage;
  const length = Math.max(1, doc.stage.length);
  const clamp = (frame: number) => Math.min(length - 1, Math.max(0, Math.round(frame)));
  let playing = true;
  /** While playing: the clock time at which frame 0 was (or would have been) shown. */
  let origin = now;
  let frame = 0;

  const startFrom = (f: number, time: number) => {
    frame = f;
    origin = time - (f * 1000) / fps;
  };

  function frameAt(time: number): number {
    if (playing) {
      const elapsed = Math.max(0, time - origin);
      frame = Math.floor((elapsed * fps) / 1000 + 1e-9) % length;
    }
    return frame;
  }

  function pause(time: number): void {
    if (!playing) return;
    frameAt(time);
    playing = false;
  }
  function resume(time: number): void {
    if (playing) return;
    startFrom(frame, time);
    playing = true;
  }
  function restart(time: number): void {
    startFrom(0, time);
    playing = true;
  }
  function goTo(target: number, time: number): void {
    startFrom(clamp(target), time);
  }

  return {
    frameAt,
    state: (): PlayerState => ({ frame, playing }),
    pause,
    resume,
    restart,
    goTo,
    /** AN18: does what a clicked button says. */
    press(button: Pick<ButtonObject, 'action' | 'frame'>, time: number): void {
      if (button.action === 'pause') pause(time);
      else if (button.action === 'continue') resume(time);
      else if (button.action === 'restart') restart(time);
      else goTo(button.frame ?? 0, time);
    },
  };
}

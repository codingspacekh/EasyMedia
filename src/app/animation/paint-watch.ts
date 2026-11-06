// M17 step 2, N1 on a real laptop: while the stage plays, the frame on it is read at each screen
// refresh (core/animation/paint-meter.ts); when it stops, the play's measurement is reported.
// Started only when the performance report is on (ui/main.ts).
import { createPaintMeter, type PlaybackSample } from '../../core/animation/paint-meter.ts';
import type { Store } from '../store.ts';
import type { AnimationState } from './state.ts';

export function watchPlayback(
  store: Store<AnimationState>,
  report: (sample: PlaybackSample) => void,
  /** The next screen refresh: requestAnimationFrame in the page. */
  nextRefresh: (callback: (now: number) => void) => void,
): () => void {
  let meter: ReturnType<typeof createPaintMeter> | null = null;
  const tick = (forMeter: typeof meter) => (now: number) => {
    if (meter !== forMeter || !meter) return;
    meter.refresh(now, store.get().frame);
    nextRefresh(tick(forMeter));
  };
  const unsubscribe = store.subscribe((s) => {
    if (s.playing && !meter) {
      meter = createPaintMeter(s.history.present.stage.fps);
      nextRefresh(tick(meter));
    } else if (!s.playing && meter) {
      const sample = meter.finish();
      meter = null;
      if (sample) report(sample);
    }
  });
  return () => {
    unsubscribe();
    meter = null;
  };
}

// Optional performance report for checking a real laptop (M4 gate, README N1, N4, N5).
// Enabled by ONEEDITOR_PERF_REPORT=<file>: written when the app quits. N1: while it is on, the
// page measures the animation stage at each play (app/animation/paint-watch.ts) and sends it here.
import { app, type BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
import { cpus, totalmem, type, release } from 'node:os';
import { summarisePlayback, type PlaybackSample } from '../core/animation/paint-meter.ts';

export function createPerformanceReport(reportPath: string) {
  let startupMs = 0;
  let peakRamMB = 0;
  const plays: PlaybackSample[] = [];
  const sample = () => {
    const mb =
      app.getAppMetrics().reduce((sum, p) => sum + (p.memory.workingSetSize ?? 0), 0) / 1024;
    peakRamMB = Math.max(peakRamMB, Math.round(mb));
  };
  const timer = setInterval(sample, 500);
  app.once('will-quit', () => {
    clearInterval(timer);
    sample();
    const stage = summarisePlayback(plays);
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          date: new Date().toISOString(),
          platform: `${process.platform}-${process.arch}`,
          os: `${type()} ${release()}`,
          cpu: cpus()[0]?.model,
          ramGB: Math.round(totalmem() / 2 ** 30),
          startupMs,
          peakRamMB,
          // N1: the slowest play of the animation stage; null when it was never played.
          stage,
          budget: {
            'N5 start ≤ 5 s': startupMs > 0 && startupMs <= 5000,
            'N4 RAM ≤ 600 MB': peakRamMB <= 600,
            'N1 stage shows ≥ 95 % of its frames': stage?.meetsBudget ?? null,
          },
        },
        null,
        2,
      ),
    );
  });
  return {
    /** Start-up is timed to the window's first paint. */
    watch(window: BrowserWindow): void {
      window.once(
        'ready-to-show',
        () => (startupMs = Math.round(Date.now() - performance.timeOrigin)),
      );
    },
    playback(play: PlaybackSample): void {
      plays.push(play);
    },
  };
}

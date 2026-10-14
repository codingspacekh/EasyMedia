// Optional performance report for checking a real laptop (M4 gate, README N4/N5).
// Enabled by EASYMEDIA_PERF_REPORT=<file>: written when the app quits.
import { app, type BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
import { cpus, totalmem, type, release } from 'node:os';

export function recordPerformance(reportPath: string, window: BrowserWindow): void {
  let startupMs = 0;
  let peakRamMB = 0;
  window.once('ready-to-show', () => (startupMs = Math.round(Date.now() - performance.timeOrigin)));
  const sample = () => {
    const mb =
      app.getAppMetrics().reduce((sum, p) => sum + (p.memory.workingSetSize ?? 0), 0) / 1024;
    peakRamMB = Math.max(peakRamMB, Math.round(mb));
  };
  const timer = setInterval(sample, 500);
  app.once('will-quit', () => {
    clearInterval(timer);
    sample();
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
          budget: {
            'N5 start ≤ 5 s': startupMs > 0 && startupMs <= 5000,
            'N4 RAM ≤ 600 MB': peakRamMB <= 600,
          },
        },
        null,
        2,
      ),
    );
  });
}

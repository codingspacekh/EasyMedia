// Reads `ffmpeg -progress pipe:1` output (key=value lines) and reports progress 0–1 (N12).
import type { Seconds } from '../../core/model/time.ts';

/** Returns a function to feed raw stdout chunks into. Progress only ever goes up. */
export function createProgressParser(duration: Seconds, onProgress: (ratio: number) => void) {
  let buffer = '';
  let last = 0;
  const report = (ratio: number) => {
    if (ratio > last) {
      last = ratio;
      onProgress(ratio);
    }
  };
  return (chunk: string): void => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const [key, value] = line.trim().split('=');
      if (key === 'progress' && value === 'end') report(1);
      else if (key === 'out_time_us' && duration > 0) {
        const micros = Number(value);
        // Hold back at 99 % until ffmpeg says it has really finished.
        if (Number.isFinite(micros)) report(Math.min(0.99, micros / 1e6 / duration));
      }
    }
  };
}

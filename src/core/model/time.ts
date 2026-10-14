/** Time values are seconds. Students type and read them to 0.01 s (N8). */
export type Seconds = number;

export function roundTime(seconds: Seconds): Seconds {
  return Math.round(seconds * 100) / 100;
}

/** 12.5 → "00:12.50", 3725 → "1:02:05.00". */
export function formatTime(seconds: Seconds): string {
  const centis = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(centis / 360_000);
  const m = Math.floor((centis % 360_000) / 6000);
  const s = Math.floor((centis % 6000) / 100);
  const cs = centis % 100;
  const mmss = `${pad(m)}:${pad(s)}.${pad(cs)}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/**
 * Accepts "12.5", "00:12.50", "1:15.26", "1:02:05" and a decimal comma ("6,3").
 * Returns null for anything that is not a valid, non-negative time.
 */
export function parseTime(text: string): Seconds | null {
  const parts = text.trim().replace(',', '.').split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const numbers = parts.map(Number);
  // Minutes and seconds after the first field must be below 60.
  if (numbers.slice(1).some((n) => n >= 60)) return null;
  const seconds = numbers.reduce((total, n) => total * 60 + n, 0);
  return roundTime(seconds);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

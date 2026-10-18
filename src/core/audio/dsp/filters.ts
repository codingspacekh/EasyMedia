// A12 Equalisation and filters, built from biquads (two-pole filters, R. Bristow-Johnson's
// "Audio EQ Cookbook"). High-pass and low-pass are Butterworth filters (as flat as possible where
// they let sound through), 6 dB per octave for each order, as in Audacity. The graphic EQ is one
// peaking filter per band; the bands overlap, so their gains are corrected until the level at
// each band's frequency is what its slider says.
import type { Channels } from '../pcm.ts';

/** Band centres of the graphic EQ (design screen 20). */
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
const EQ_Q = 1.41; // one octave wide
const HIGHEST = 0.45; // bands above this fraction of the sample rate are left out

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function normalised(
  b0: number,
  b1: number,
  b2: number,
  a0: number,
  a1: number,
  a2: number,
): Biquad {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function secondOrder(kind: 'low' | 'high', freq: number, rate: number, q: number): Biquad {
  const w = (2 * Math.PI * freq) / rate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const b = kind === 'low' ? (1 - cos) / 2 : (1 + cos) / 2;
  return normalised(b, kind === 'low' ? 1 - cos : -(1 + cos), b, 1 + alpha, -2 * cos, 1 - alpha);
}

function firstOrder(kind: 'low' | 'high', freq: number, rate: number): Biquad {
  const k = Math.tan((Math.PI * freq) / rate);
  const a1 = (k - 1) / (k + 1);
  return kind === 'low'
    ? { b0: k / (1 + k), b1: k / (1 + k), b2: 0, a1, a2: 0 }
    : { b0: 1 / (1 + k), b1: -1 / (1 + k), b2: 0, a1, a2: 0 };
}

function peaking(freq: number, rate: number, db: number): Biquad {
  const w = (2 * Math.PI * freq) / rate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * EQ_Q);
  const a = 10 ** (db / 40);
  return normalised(1 + alpha * a, -2 * cos, 1 - alpha * a, 1 + alpha / a, -2 * cos, 1 - alpha / a);
}

/** Butterworth sections for a roll-off of `rolloff` dB per octave (order = rolloff ÷ 6). */
function butterworth(kind: 'low' | 'high', freq: number, rate: number, rolloff: number): Biquad[] {
  const order = Math.max(1, Math.round(rolloff / 6));
  const sections: Biquad[] = [];
  if (order % 2 === 1) sections.push(firstOrder(kind, freq, rate));
  for (let k = 1; k <= Math.floor(order / 2); k++) {
    const angle = order % 2 === 1 ? (k * Math.PI) / order : ((2 * k - 1) * Math.PI) / (2 * order);
    sections.push(secondOrder(kind, freq, rate, 1 / (2 * Math.cos(angle))));
  }
  return sections;
}

/** Level change (dB) of a chain of sections for a tone at `freq`. */
export function responseDb(sections: readonly Biquad[], freq: number, rate: number): number {
  const w = (2 * Math.PI * freq) / rate;
  const [c1, s1, c2, s2] = [Math.cos(w), Math.sin(w), Math.cos(2 * w), Math.sin(2 * w)];
  let db = 0;
  for (const { b0, b1, b2, a1, a2 } of sections) {
    const nr = b0 + b1 * c1 + b2 * c2;
    const ni = -(b1 * s1 + b2 * s2);
    const dr = 1 + a1 * c1 + a2 * c2;
    const di = -(a1 * s1 + a2 * s2);
    db += 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  }
  return db;
}

function run(channels: Channels, sections: readonly Biquad[]): Float32Array[] {
  return channels.map((input) => {
    const out = Float32Array.from(input);
    for (const { b0, b1, b2, a1, a2 } of sections) {
      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;
      for (let i = 0; i < out.length; i++) {
        const x = out[i]!;
        const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        out[i] = y;
      }
    }
    return out;
  });
}

/** Keeps the tones above `cutoff` Hz; lower ones lose `rolloff` dB for each octave down. */
export function highPass(channels: Channels, rate: number, cutoff: number, rolloff: number) {
  return run(channels, butterworth('high', cutoff, rate, rolloff));
}

/** Keeps the tones below `cutoff` Hz; higher ones lose `rolloff` dB for each octave up. */
export function lowPass(channels: Channels, rate: number, cutoff: number, rolloff: number) {
  return run(channels, butterworth('low', cutoff, rate, rolloff));
}

export function filterResponseDb(
  kind: 'low' | 'high',
  cutoff: number,
  rolloff: number,
  freq: number,
  rate: number,
): number {
  return responseDb(butterworth(kind, cutoff, rate, rolloff), freq, rate);
}

/** The peaking filters whose combined level at each band's frequency is `gains` (dB). */
function eqSections(rate: number, gains: readonly number[]): Biquad[] {
  const bands = EQ_BANDS.map((freq, i) => ({ freq, target: gains[i] ?? 0 })).filter(
    (b) => b.freq < HIGHEST * rate,
  );
  const set = bands.map((b) => b.target);
  for (let pass = 0; pass < 12; pass++) {
    const sections = bands.map((b, i) => peaking(b.freq, rate, set[i]!));
    bands.forEach((b, i) => {
      const error = b.target - responseDb(sections, b.freq, rate);
      set[i] = Math.max(-40, Math.min(40, set[i]! + error));
    });
  }
  return bands.map((b, i) => peaking(b.freq, rate, set[i]!)).filter((_, i) => set[i] !== 0);
}

/** `gains`: dB for each of EQ_BANDS (−20 to +20). All zero leaves the sound as it was. */
export function graphicEq(channels: Channels, rate: number, gains: readonly number[]) {
  if (gains.every((g) => g === 0)) return channels.map((c) => c.slice());
  return run(channels, eqSections(rate, gains));
}

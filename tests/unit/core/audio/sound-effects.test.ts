import { describe, expect, it } from 'vitest';
import {
  SOUND_EFFECTS,
  SOUND_GROUPS,
  makeSoundEffect,
  soundEffect,
} from '../../../../src/core/audio/sound-effects.ts';
import { encodeWav } from '../../../../src/core/audio/wav.ts';

const peakOf = (c: Float32Array) => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('X8 built-in sound effects: made by the app itself, the same on every computer', () => {
  it('has at least 20 sounds, every group used, with names and hints for students', () => {
    expect(SOUND_EFFECTS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SOUND_EFFECTS.map((s) => s.id)).size).toBe(SOUND_EFFECTS.length);
    for (const group of SOUND_GROUPS) {
      expect(
        SOUND_EFFECTS.some((s) => s.group === group),
        group,
      ).toBe(true);
    }
    for (const s of SOUND_EFFECTS) {
      expect(SOUND_GROUPS).toContain(s.group);
      expect(s.id).toMatch(/^[a-z][a-z-]*$/);
      expect(s.name.length).toBeGreaterThan(1);
      expect(s.hint.length).toBeGreaterThan(5);
    }
  });

  it.each(SOUND_EFFECTS.map((s) => [s.id]))(
    '%s: a short, loud-enough sound that never clips and starts and ends quietly',
    (id) => {
      for (const rate of [44100, 48000]) {
        const channels = makeSoundEffect(id, rate);
        expect(channels.length === 1 || channels.length === 2).toBe(true);
        const length = channels[0]!.length;
        expect(length / rate).toBeGreaterThanOrEqual(0.05);
        expect(length / rate).toBeLessThanOrEqual(4);
        for (const c of channels) {
          expect(c.length).toBe(length);
          expect(c.every(Number.isFinite)).toBe(true);
          const peak = peakOf(c);
          expect(peak).toBeGreaterThan(0.3);
          expect(peak).toBeLessThanOrEqual(0.9);
          // no click at either end
          expect(Math.abs(c[0]!)).toBeLessThan(0.02);
          expect(Math.abs(c[length - 1]!)).toBeLessThan(0.02);
        }
      }
    },
  );

  it('is the same each time (no randomness between runs)', () => {
    for (const s of SOUND_EFFECTS) {
      const a = makeSoundEffect(s.id, 48000);
      const b = makeSoundEffect(s.id, 48000);
      expect(a.map((c) => [...c.subarray(0, 2000)])).toEqual(
        b.map((c) => [...c.subarray(0, 2000)]),
      );
    }
  });

  it('lasts about as long at any sample rate', () => {
    for (const s of SOUND_EFFECTS) {
      const a = makeSoundEffect(s.id, 44100)[0]!.length / 44100;
      const b = makeSoundEffect(s.id, 48000)[0]!.length / 48000;
      expect(Math.abs(a - b)).toBeLessThan(0.001);
    }
  });

  it('an unknown sound is refused with a clear message', () => {
    expect(soundEffect('whoosh')?.name).toBe('Whoosh');
    expect(soundEffect('nope')).toBeUndefined();
    expect(() => makeSoundEffect('nope', 48000)).toThrow(/no sound effect called/i);
  });
});

describe('X8 a sound effect saved as a WAV file (16-bit PCM)', () => {
  it('writes a correct header and the samples, clipped to ±1', () => {
    const left = Float32Array.from([0, 0.5, -0.5, 2]);
    const right = Float32Array.from([0, -1, 1, -2]);
    const bytes = encodeWav([left, right], 48000);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const text = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
    expect(text(0)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
    expect(text(8)).toBe('WAVE');
    expect(text(12)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(28, true)).toBe(48000 * 2 * 2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36)).toBe('data');
    expect(view.getUint32(40, true)).toBe(4 * 2 * 2);
    expect(bytes.length).toBe(44 + 16);
    const sample = (i: number, ch: number) => view.getInt16(44 + (i * 2 + ch) * 2, true);
    expect([sample(1, 0), sample(1, 1)]).toEqual([16384, -32767]);
    expect([sample(3, 0), sample(3, 1)]).toEqual([32767, -32767]);
  });
});

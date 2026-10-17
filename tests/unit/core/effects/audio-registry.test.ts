import { describe, expect, it } from 'vitest';
import {
  AUDIO_EFFECTS,
  audioEffectById,
  defaultParams,
  validateParams,
} from '../../../../src/core/effects/registry.ts';
import { peak } from '../../../../src/core/audio/dsp/volume.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

const RATE = 44100;
const sine = (amp: number, seconds = 0.1) =>
  Float32Array.from({ length: Math.round(seconds * RATE) }, (_, i) => amp * Math.sin(i / 7));
const fx = (id: string) => {
  const def = audioEffectById(id);
  if (!def) throw new Error(`missing ${id}`);
  return def;
};

describe('audio effects in the registry (P6, P7, T5)', () => {
  it.each(AUDIO_EFFECTS.map((e) => [e.id, e] as const))(
    '%s has a label, a 11.2 syllabus point, a menu group and a "why"',
    (_, e) => {
      expect(e.id).toMatch(/^audio\./);
      expect(e.label.length).toBeGreaterThan(2);
      expect(e.syllabus).toMatch(/^11\.2 /);
      expect(e.why.length).toBeGreaterThan(40);
      expect(['Volume', 'Time & pitch', 'Space', 'Frequency', 'Repair & channels']).toContain(
        e.group,
      );
    },
  );

  it.each(AUDIO_EFFECTS.map((e) => [e.id, e] as const))(
    '%s works with its default settings',
    (_, e) => {
      const params = defaultParams(e);
      validateParams(e, params);
      const out = e.process([sine(0.5)], RATE, params);
      expect(out).toHaveLength(1);
    },
  );

  it('has the M9 effects', () => {
    expect(AUDIO_EFFECTS.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        'audio.amplify',
        'audio.normalise',
        'audio.fadein',
        'audio.fadeout',
        'audio.speed',
      ]),
    );
  });

  it('has the M10 effects so far', () => {
    expect(AUDIO_EFFECTS.map((e) => e.id)).toEqual(expect.arrayContaining(['audio.pitch']));
  });

  it('a checkbox setting is a toggle with the values 0 and 1', () => {
    const allow = fx('audio.amplify').params.allowClipping!;
    expect([allow.toggle, allow.min, allow.max, allow.step]).toEqual([true, 0, 1, 1]);
  });

  describe('A4 Amplify', () => {
    const amplify = fx('audio.amplify');

    it('suggests the largest gain that does not clip (peak 0.5 → 6.02 dB)', () => {
      expect(amplify.suggest!([sine(0.5)], defaultParams(amplify)).gain).toBeCloseTo(6.02, 2);
    });

    it('−6 dB halves the level', () => {
      const out = amplify.process([sine(1)], RATE, { gain: -6, allowClipping: 0 });
      expect(peak(out)).toBeCloseTo(0.501, 2);
    });

    it('refuses to clip unless Allow clipping is ticked', () => {
      expect(() => amplify.check!([sine(0.5)], { gain: 10, allowClipping: 0 })).toThrow(EditError);
      expect(() => amplify.check!([sine(0.5)], { gain: 10, allowClipping: 0 })).toThrow(
        /at most 6\.0\d dB/,
      );
      expect(() => amplify.check!([sine(0.5)], { gain: 10, allowClipping: 1 })).not.toThrow();
      expect(() => amplify.check!([sine(0.5)], { gain: 6, allowClipping: 0 })).not.toThrow();
    });

    it('says what the new peak will be', () => {
      expect(amplify.note!([sine(0.5)], RATE, { gain: 0, allowClipping: 0 })).toMatch(
        /new peak.*−6\.0\d dB/i,
      );
    });
  });

  describe('A3 Normalise', () => {
    const normalise = fx('audio.normalise');

    it('removes the DC offset and sets the peak to −1 dB by default', () => {
      const offset = sine(0.3, 1).map((v) => v + 0.2);
      const [out] = normalise.process([offset], RATE, defaultParams(normalise));
      const mean = out!.reduce((s, v) => s + v, 0) / out!.length;
      expect(Math.abs(mean)).toBeLessThan(1e-3);
      expect(peak([out!])).toBeCloseTo(0.891, 2);
    });

    it('can only remove the DC offset', () => {
      const [out] = normalise.process([sine(0.3)], RATE, {
        ...defaultParams(normalise),
        normalisePeak: 0,
      });
      expect(peak([out!])).toBeCloseTo(0.3, 2);
    });

    it('Book A 11.26: a maximum above 0 dB is allowed but warns about clipping', () => {
      expect(normalise.params.peak!.max).toBeGreaterThanOrEqual(2);
      expect(normalise.note!([sine(0.3)], RATE, { ...defaultParams(normalise), peak: 2 })).toMatch(
        /clipped|distort/i,
      );
      expect(normalise.note!([sine(0.3)], RATE, defaultParams(normalise))).toBeNull();
    });
  });

  describe('A8 Change speed', () => {
    const speed = fx('audio.speed');

    it('multiplier and percent change stay in step', () => {
      expect(speed.link!({ speed: 1.4, percent: 0 }, 'speed').percent).toBeCloseTo(40);
      expect(speed.link!({ speed: 1, percent: -10 }, 'percent').speed).toBeCloseTo(0.9);
    });

    it('shows the new length (Book B: about 45 s → about 32 s at 1.4×)', () => {
      const note = speed.note!([new Float32Array(45 * 100)], 100, { speed: 1.4, percent: 40 });
      expect(note).toMatch(/45\.00 s → 32\.14 s/);
    });

    it('changes the length of the selection', () => {
      const [out] = speed.process([new Float32Array(1000)], RATE, { speed: 2, percent: 100 });
      expect(out!.length).toBe(500);
    });
  });

  describe('A9 Change pitch', () => {
    const pitch = fx('audio.pitch');
    const start = defaultParams(pitch);
    const keys = pitch.params.fromKey!.choices!;

    it('offers the 12 keys and the two directions as drop-downs', () => {
      expect(keys).toHaveLength(12);
      expect([keys[0], keys[1], keys[5], keys[6]]).toEqual(['C', 'C♯ / D♭', 'F', 'F♯ / G♭']);
      expect(pitch.params.toKey!.choices).toEqual(keys);
      expect(pitch.params.direction!.choices).toEqual(['Up', 'Down']);
      expect([pitch.params.fromKey!.min, pitch.params.fromKey!.max]).toEqual([0, 11]);
    });

    it('Book B Task 11k: from C to F, up, is +5 semitones (+33.48 %)', () => {
      const p = pitch.link!({ ...start, fromKey: 0, toKey: 5 }, 'toKey');
      expect(p.semitones).toBe(5);
      expect(p.percent).toBeCloseTo(33.48, 2);
    });

    it('Activity 11f: from C♯ to F♯, up, is also +5 semitones', () => {
      const p = pitch.link!({ ...start, fromKey: 1, toKey: 6 }, 'toKey');
      expect(p.semitones).toBe(5);
    });

    it('from C to F, down, is −7 semitones', () => {
      const up = pitch.link!({ ...start, fromKey: 0, toKey: 5 }, 'toKey');
      const p = pitch.link!({ ...up, direction: 1 }, 'direction');
      expect(p.semitones).toBe(-7);
      expect(p.percent).toBeCloseTo(-33.26, 2);
    });

    it('Book A 11.20: lower by 5 % gives −0.89 semitones and keeps the keys in step', () => {
      const p = pitch.link!({ ...start, percent: -5 }, 'percent');
      expect(p.semitones).toBeCloseTo(-0.89, 2);
      expect(p.direction).toBe(1);
      expect(p.toKey).toBe(11); // C, down by about one semitone, is near B
    });

    it('semitones move the "to" key and the direction', () => {
      const p = pitch.link!({ ...start, fromKey: 9, semitones: 3 }, 'semitones');
      expect([p.toKey, p.direction]).toEqual([0, 0]); // A + 3 = C, up
      expect(p.percent).toBeCloseTo(18.92, 2);
    });

    it('shows the frequencies, and that the length stays the same', () => {
      const note = pitch.note!([sine(0.5)], RATE, { ...start, fromKey: 0, toKey: 5, semitones: 5 });
      expect(note).toMatch(/261\.6 Hz → 349\.2 Hz/);
      expect(note).toMatch(/length stays the same/i);
    });

    it('keeps the length of the selection', () => {
      const [out] = pitch.process([sine(0.5, 0.2)], RATE, { ...start, semitones: 5 });
      expect(out!.length).toBe(Math.round(0.2 * RATE));
    });
  });

  it('A7 fades have no settings', () => {
    expect(Object.keys(fx('audio.fadein').params)).toEqual([]);
    expect(Object.keys(fx('audio.fadeout').params)).toEqual([]);
  });
});

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
    expect(AUDIO_EFFECTS.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        'audio.pitch',
        'audio.echo',
        'audio.delay',
        'audio.reverb',
        'audio.eq',
        'audio.highpass',
        'audio.lowpass',
      ]),
    );
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

  describe('A10 Echo', () => {
    const echo = fx('audio.echo');

    it('has a delay time and a decay factor (Audacity: 1 s and 0.5)', () => {
      expect(defaultParams(echo)).toEqual({ delay: 1, decay: 0.5 });
      expect([echo.params.decay!.min, echo.params.decay!.max]).toEqual([0, 1]);
      expect(echo.group).toBe('Space');
    });

    it('Book B Task 11o: 0.5 s and 0.8 — says when the echoes come and how loud', () => {
      const note = echo.note!([sine(0.1, 2)], RATE, { delay: 0.5, decay: 0.8 });
      expect(note).toMatch(/0\.50 s \(×0\.80\), 1\.00 s \(×0\.64\), 1\.50 s \(×0\.51\)/);
    });

    it('warns when the echoes add up to more than full level (clipping)', () => {
      expect(echo.note!([sine(0.9, 2)], RATE, { delay: 0.01, decay: 0.8 })).toMatch(/clipped/);
      expect(echo.note!([sine(0.1, 2)], RATE, { delay: 0.5, decay: 0.5 })).not.toMatch(/clipped/);
    });

    it('keeps the length of the selection', () => {
      const [out] = echo.process([sine(0.5, 1)], RATE, { delay: 0.5, decay: 0.8 });
      expect(out!.length).toBe(RATE);
    });
  });

  describe('A10 Delay', () => {
    const delay = fx('audio.delay');

    it('offers the three types as buttons, and the design screen 19 settings', () => {
      expect(delay.params.type!.choices).toEqual([
        'Regular',
        'Bouncing ball',
        'Reverse bouncing ball',
      ]);
      expect(defaultParams(delay)).toEqual({
        type: 0,
        delay: 0.5,
        echoes: 5,
        decayDb: 6,
        longer: 1,
      });
      expect(delay.params.longer!.toggle).toBe(true);
    });

    it('says what the type does and when the echoes come', () => {
      const note = (type: number) =>
        delay.note!([sine(0.1, 1)], RATE, { ...defaultParams(delay), delay: 1, echoes: 4, type });
      expect(note(0)).toMatch(/equal gaps.*1\.00, 2\.00, 3\.00, 4\.00 s/i);
      expect(note(1)).toMatch(/closer.*1\.00, 1\.75, 2\.25, 2\.50 s/i);
      expect(note(2)).toMatch(/further apart.*0\.25, 0\.75, 1\.50, 2\.50 s/i);
    });

    it('makes the sound longer for the last echo, unless told not to', () => {
      const params = { ...defaultParams(delay), delay: 0.5, echoes: 2 };
      expect(delay.process([sine(0.1, 1)], RATE, params)[0]!.length).toBe(2 * RATE);
      expect(delay.process([sine(0.1, 1)], RATE, { ...params, longer: 0 })[0]!.length).toBe(RATE);
      expect(delay.note!([sine(0.1, 1)], RATE, params)).toMatch(/1\.00 s → 2\.00 s/);
    });
  });

  describe('A11 Reverb', () => {
    const reverb = fx('audio.reverb');
    const start = defaultParams(reverb);

    it('starts as the Vocal preset: room size 60 %, reverberance 40 % (Book B 11.2.13)', () => {
      expect(reverb.params.preset!.choices).toEqual([
        'Custom',
        'Small room',
        'Vocal',
        'Hall',
        'Cathedral',
      ]);
      expect(start).toEqual({
        preset: 2,
        roomSize: 60,
        reverberance: 40,
        damping: 50,
        wet: 30,
        tail: 0,
      });
      expect(reverb.group).toBe('Space');
    });

    it('a preset sets the room; changing a setting makes it Custom', () => {
      const hall = reverb.link!({ ...start, preset: 3 }, 'preset');
      expect(hall.roomSize).toBeGreaterThan(start.roomSize!);
      expect(hall.reverberance).toBeGreaterThan(start.reverberance!);
      const more = reverb.link!({ ...start, reverberance: 50 }, 'reverberance'); // Book A 11.21
      expect(more).toEqual({ ...start, reverberance: 50, preset: 0 });
      expect(reverb.link!({ ...start, tail: 1 }, 'tail').preset).toBe(2);
    });

    it('says how long it rings on, and the new length when the tail is added', () => {
      const one = [sine(0.1, 1)];
      expect(reverb.note!(one, RATE, start)).toMatch(/rings on for about \d\.\d s/i);
      expect(reverb.note!(one, RATE, { ...start, tail: 1 })).toMatch(/1\.00 s → \d\.\d\d s/);
    });

    it('keeps the length unless the tail is added (as Audacity)', () => {
      expect(reverb.process([sine(0.1, 1)], RATE, start)[0]!.length).toBe(RATE);
      expect(
        reverb.process([sine(0.1, 1)], RATE, { ...start, tail: 1 })[0]!.length,
      ).toBeGreaterThan(RATE);
    });
  });

  describe('A12 Graphic EQ', () => {
    const eq = fx('audio.eq');
    const start = defaultParams(eq);
    const bands = Object.keys(eq.params).filter((k) => eq.params[k]!.band);

    it('has 10 band sliders, 31 Hz to 16 kHz, ±20 dB, starting flat', () => {
      expect(bands.map((k) => eq.params[k]!.label)).toEqual([
        '31 Hz',
        '62 Hz',
        '125 Hz',
        '250 Hz',
        '500 Hz',
        '1 kHz',
        '2 kHz',
        '4 kHz',
        '8 kHz',
        '16 kHz',
      ]);
      expect(bands.every((k) => eq.params[k]!.min === -20 && eq.params[k]!.max === 20)).toBe(true);
      expect(bands.every((k) => start[k] === 0)).toBe(true);
      expect(eq.params.preset!.choices![start.preset!]).toBe('Flat');
      expect(eq.group).toBe('Frequency');
    });

    it('has the presets of design screen 20', () => {
      expect(eq.params.preset!.choices).toEqual([
        'Custom',
        'Flat',
        'Bass boost',
        'Bass cut',
        'Treble boost',
        'Treble cut',
        'Telephone',
        'Walkie-talkie',
      ]);
    });

    it('Treble boost is Book B 11.2.14: +2, +4, +7, +10, +10 from 1 kHz up', () => {
      const p = eq.link!({ ...start, preset: 4 }, 'preset');
      expect(bands.map((k) => p[k])).toEqual([0, 0, 0, 0, 0, 2, 4, 7, 10, 10]);
    });

    it('Bass boost raises the low bands; Telephone cuts the lows and highs', () => {
      const bass = eq.link!({ ...start, preset: 2 }, 'preset');
      expect(bass[bands[0]!]!).toBeGreaterThan(5);
      expect(bass[bands[9]!]).toBe(0);
      const phone = eq.link!({ ...start, preset: 6 }, 'preset');
      expect(phone[bands[0]!]!).toBeLessThan(-10);
      expect(phone[bands[9]!]!).toBeLessThan(-10);
      expect(phone[bands[5]!]!).toBeGreaterThanOrEqual(0);
    });

    it('moving a slider makes it Custom', () => {
      expect(eq.link!({ ...start, [bands[3]!]: 5 }, bands[3]!).preset).toBe(0);
    });

    it('says which frequencies get louder or quieter', () => {
      expect(eq.note!([sine(0.1)], RATE, start)).toMatch(/flat/i);
      const p = eq.link!({ ...start, preset: 4 }, 'preset');
      expect(eq.note!([sine(0.1)], RATE, p)).toMatch(
        /louder: 1 kHz \+2, 2 kHz \+4, 4 kHz \+7, 8 kHz \+10, 16 kHz \+10 dB/i,
      );
    });
  });

  describe('A12 High-pass and Low-pass filters', () => {
    const hp = fx('audio.highpass');
    const lp = fx('audio.lowpass');

    it('cut-off 1000 Hz and a roll-off of 6 dB per octave to start (design screen 17)', () => {
      expect(defaultParams(hp)).toEqual({ cutoff: 1000, rolloff: 0 });
      expect(hp.params.rolloff!.choices).toEqual(['6 dB', '12 dB', '24 dB', '36 dB', '48 dB']);
      expect(defaultParams(lp)).toEqual({ cutoff: 1000, rolloff: 0 });
      expect([hp.group, lp.group]).toEqual(['Frequency', 'Frequency']);
    });

    it('say how much quieter the tones they cut become', () => {
      expect(hp.note!([sine(0.1)], RATE, defaultParams(hp))).toMatch(
        /below 1000 Hz.*500 Hz −7 dB, 250 Hz −12 dB/,
      );
      expect(lp.note!([sine(0.1)], RATE, defaultParams(lp))).toMatch(
        /above 1000 Hz.*2000 Hz −7 dB, 4000 Hz −13 dB/,
      );
    });

    it('a cut-off at or above half the sample rate is brought down to what the rate can hold', () => {
      const [out] = lp.process([sine(0.5)], 8000, { cutoff: 6000, rolloff: 1 });
      expect(out!.every(Number.isFinite)).toBe(true);
    });
  });

  it('A7 fades have no settings', () => {
    expect(Object.keys(fx('audio.fadein').params)).toEqual([]);
    expect(Object.keys(fx('audio.fadeout').params)).toEqual([]);
  });
});

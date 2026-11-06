// AN28: sounds in an animation — the rules for a sound, the mix the app plays, the pieces an
// export puts in its video and what the web page starts when it plays from a frame.
import { describe, expect, it } from 'vitest';
import { createAnimation } from '../../../../src/core/animation/factory.ts';
import {
  endFrame,
  gainAt,
  heardSeconds,
  mixSounds,
  pageSounds,
  soundFileBytes,
  soundPieces,
  validateSound,
} from '../../../../src/core/animation/sound.ts';
import type { AnimSound, AnimationDoc } from '../../../../src/core/animation/types.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

const alarm = (over: Partial<AnimSound> = {}): AnimSound => ({
  id: 's1',
  name: 'alarm.mp3',
  path: '/m/alarm.mp3',
  duration: 2,
  start: 24,
  volume: 100,
  ...over,
});

/** 4 s at 24 fps with the sounds given. */
function withSounds(...sounds: AnimSound[]): AnimationDoc {
  const doc = createAnimation({ name: 'Alarm' });
  return { ...doc, stage: { ...doc.stage, fps: 24, length: 96 }, sounds };
}

describe('a sound in an animation (AN28)', () => {
  it('AN28 is heard from its frame for its file’s length, or its trimmed part', () => {
    expect(heardSeconds(alarm())).toBe(2);
    expect(heardSeconds(alarm({ offset: 0.5 }))).toBe(1.5);
    expect(heardSeconds(alarm({ offset: 0.5, length: 1 }))).toBe(1);
    expect(endFrame(alarm(), 24)).toBe(72);
  });

  it('AN28 the rules: a frame, a volume of 0–200 %, a trim inside the file, fades that fit', () => {
    expect(() => validateSound(alarm())).not.toThrow();
    expect(() => validateSound(alarm({ start: -1 }))).toThrow(EditError);
    expect(() => validateSound(alarm({ volume: 250 }))).toThrow(/between 0 and 200 %/);
    expect(() => validateSound(alarm({ offset: 2 }))).toThrow(/before its end/);
    expect(() => validateSound(alarm({ offset: 1, length: 1.5 }))).toThrow(
      /between 0.01 s and 1 s/,
    );
    expect(() => validateSound(alarm({ fadeIn: 1.5, fadeOut: 1 }))).toThrow(/fades together/);
    expect(() => validateSound(alarm({ fadeIn: 1, fadeOut: 1 }))).not.toThrow();
  });

  it('AN28 its fades: from silent to its volume, and back down at its end', () => {
    const s = alarm({ volume: 50, fadeIn: 0.5, fadeOut: 1 });
    expect(gainAt(s, 0)).toBe(0);
    expect(gainAt(s, 0.25)).toBeCloseTo(0.25);
    expect(gainAt(s, 0.75)).toBe(0.5);
    expect(gainAt(s, 1.5)).toBeCloseTo(0.25);
    expect(gainAt(s, 2)).toBe(0);
  });

  it('AN28 the app’s mix: each sound at its time, overlapping sounds added, a muted one silent', () => {
    const one = { sampleRate: 10, channels: [new Float32Array(20).fill(0.5)] };
    const doc = withSounds(
      alarm({ start: 24 }),
      alarm({ id: 's2', start: 48, volume: 50 }),
      alarm({ id: 's3', start: 0, muted: true }),
    );
    const [left, right] = mixSounds(doc, () => one, 10, 0, 96);
    expect(left).toHaveLength(40);
    expect(left![5]).toBe(0); // 0.5 s: nothing yet (the muted sound is not heard)
    expect(left![15]).toBe(0.5); // 1.5 s: the first sound
    expect(left![25]).toBeCloseTo(0.75); // 2.5 s: both, the second at 50 %
    expect(left![35]).toBe(0.25); // 3.5 s: the second only
    expect(right).toEqual(left); // a mono sound on both sides
  });

  it('AN28 the mix from a later frame starts part-way into a sound', () => {
    const ramp = { sampleRate: 10, channels: [Float32Array.from({ length: 20 }, (_, i) => i)] };
    const [left] = mixSounds(withSounds(alarm()), () => ramp, 10, 36, 96);
    expect(left![0]).toBe(5); // frame 36 is 1.5 s, half a second into the sound
  });

  it('AN15 AN28 export pieces: placed in the export’s time; a range cuts the sounds at its ends', () => {
    const doc = withSounds(alarm({ offset: 0.25, length: 1.5, volume: 80, fadeIn: 0.5 }));
    expect(soundPieces(doc)).toEqual([
      {
        path: '/m/alarm.mp3',
        offset: 0.25,
        heard: 1.5,
        volume: 0.8,
        fadeIn: 0.5,
        fadeOut: 0,
        cut: 0,
        duration: 1.5,
        at: 1,
      },
    ]);
    // Frames 36–47 (1.5 s to 2 s): half a second into the sound, half a second kept, at 0 s.
    expect(soundPieces(doc, 36, 47)).toMatchObject([{ cut: 0.5, duration: 0.5, at: 0 }]);
    // A range that ends before it starts has no sound.
    expect(soundPieces(doc, 0, 23)).toEqual([]);
    expect(soundPieces(withSounds(alarm({ muted: true })))).toEqual([]);
  });

  it('AN28 the web page: what plays from a frame, when, from where in the file, with its fades', () => {
    const doc = withSounds(alarm({ offset: 0.5, fadeOut: 0.5 }));
    // From frame 0: it waits 1 s, plays 1.5 s from 0.5 s into the file, fading over its last 0.5 s.
    expect(pageSounds(doc, 0, 96)).toEqual([
      {
        id: 's1',
        wait: 1,
        into: 0,
        from: 0.5,
        duration: 1.5,
        gains: [
          { t: 0, gain: 1 },
          { t: 1, gain: 1 },
          { t: 1.5, gain: 0 },
        ],
      },
    ]);
    // From frame 36 (1.5 s): at once, half a second in; a play-once end at frame 48 cuts it.
    expect(pageSounds(doc, 36, 48)).toMatchObject([{ wait: 0, into: 0.5, from: 1, duration: 0.5 }]);
    expect(pageSounds(doc, 72, 96)).toEqual([]);
  });

  it('T7 AN28 the sound files’ size for the web page, by their type and length', () => {
    expect(soundFileBytes(withSounds(alarm()))).toBe(32_000);
    expect(soundFileBytes(withSounds(alarm({ path: '/cache/sounds/ding.wav' })))).toBe(384_000);
    expect(soundFileBytes(withSounds(alarm({ muted: true })))).toBe(0);
  });
});

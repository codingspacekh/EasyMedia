// X8 built-in sound effects (M17a step 13). Each sound is made by this code (oscillators, filtered
// noise and envelopes), so there are no sound files to ship, no licence to check, and every
// computer makes exactly the same samples. Video mode saves one as a WAV and puts it on a sound
// effects track; Audio mode adds it as a new track.
import type { Channels } from './pcm.ts';

export const SOUND_GROUPS = [
  'Buttons & alerts',
  'Movement',
  'Hits',
  'Games',
  'Time & tension',
  'Celebration',
] as const;
export type SoundGroup = (typeof SOUND_GROUPS)[number];

export interface SoundEffect {
  /** Kept in saved projects (MediaAsset.soundEffect): never change one. */
  id: string;
  name: string;
  group: SoundGroup;
  /** When to use it, shown when choosing. */
  hint: string;
}

interface Recipe extends SoundEffect {
  seconds: number;
  /** Mono, or [left, right]; `t` is in seconds. */
  make(k: Kit): Float32Array[];
}

const TAU = 2 * Math.PI;
/** The loudest sample of a finished sound. */
const LEVEL = 0.8;
/** Every sound fades in and out this fast, so it never starts or ends with a click. */
const EDGE_SECONDS = 0.005;

/** The tools a recipe draws with, for one sample rate. */
class Kit {
  readonly rate: number;
  readonly length: number;
  private seed = 0x9e3779b9;
  constructor(rate: number, seconds: number) {
    this.rate = rate;
    this.length = Math.round(seconds * rate);
  }

  buffer(): Float32Array {
    return new Float32Array(this.length);
  }

  /** The same "random" numbers every time (mulberry32), between −1 and 1. */
  random(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }

  /** Adds a tone whose pitch (Hz) and loudness change over time, from `from` to `to` seconds. */
  tone(
    out: Float32Array,
    pitch: (t: number) => number,
    loudness: (t: number) => number,
    wave: Wave = 'sine',
    from = 0,
    to = this.length / this.rate,
  ): Float32Array {
    let phase = 0;
    const end = Math.min(out.length, Math.round(to * this.rate));
    for (let i = Math.round(from * this.rate); i < end; i++) {
      const t = i / this.rate - from;
      out[i]! += shape(wave, phase) * loudness(t);
      phase = (phase + pitch(t) / this.rate) % 1;
    }
    return out;
  }

  /**
   * Adds noise through a band-pass filter (a state-variable filter) whose centre (Hz) moves;
   * a high `q` keeps a narrower band.
   */
  noise(
    out: Float32Array,
    centre: (t: number) => number,
    loudness: (t: number) => number,
    q = 1,
    from = 0,
    to = this.length / this.rate,
    kind: 'band' | 'low' | 'high' = 'band',
  ): Float32Array {
    let low = 0;
    let band = 0;
    const damp = Math.min(1.5, 1 / q);
    // the filter stays stable only below this (Chamberlin state-variable filter)
    const highest = Math.min(0.9, 0.9 * (2 - damp));
    const end = Math.min(out.length, Math.round(to * this.rate));
    for (let i = Math.round(from * this.rate); i < end; i++) {
      const t = i / this.rate - from;
      const f = Math.min(
        highest,
        2 * Math.sin((Math.PI * Math.min(centre(t), this.rate / 6)) / this.rate),
      );
      const input = this.random();
      low += f * band;
      const high = input - low - damp * band;
      band += f * high;
      const picked = kind === 'band' ? band : kind === 'low' ? low : high;
      out[i]! += picked * loudness(t);
    }
    return out;
  }
}

type Wave = 'sine' | 'square' | 'saw' | 'triangle';

function shape(wave: Wave, phase: number): number {
  switch (wave) {
    case 'sine':
      return Math.sin(TAU * phase);
    case 'square':
      return phase < 0.5 ? 0.6 : -0.6;
    case 'saw':
      return (2 * phase - 1) * 0.7;
    case 'triangle':
      return 1 - 4 * Math.abs(phase - 0.5);
  }
}

// ---- envelopes (t in seconds since the part began) ----
/** Dies away: halves about every `half` seconds after a quick start. */
const decay =
  (half: number, attack = 0.002) =>
  (t: number) =>
    t < attack ? t / attack : 0.5 ** ((t - attack) / half);
/** Grows and fades like a bell curve, loudest at `peak` seconds. */
const swell = (peak: number, width: number) => (t: number) =>
  Math.exp(-(((t - peak) / width) ** 2));
/** Even, with short ramps in and out over `length` seconds. */
const held =
  (length: number, ramp = 0.01) =>
  (t: number) =>
    t < 0 || t > length ? 0 : Math.min(1, t / ramp, (length - t) / ramp);
/** A glide from `a` to `b` Hz over `length` seconds, even in pitch (exponential). */
const glide = (a: number, b: number, length: number) => (t: number) =>
  a * (b / a) ** Math.min(1, t / length);
const steady = (hz: number) => () => hz;

/** Equal-power pan: `at(t)` −1 (left) … 1 (right). */
function pan(k: Kit, mono: Float32Array, at: (t: number) => number): Float32Array[] {
  const left = k.buffer();
  const right = k.buffer();
  for (let i = 0; i < mono.length; i++) {
    const angle = ((at(i / k.rate) + 1) * Math.PI) / 4;
    left[i] = mono[i]! * Math.cos(angle);
    right[i] = mono[i]! * Math.sin(angle);
  }
  return [left, right];
}

/** Notes one after another: [Hz, start s, length s]. */
function notes(
  k: Kit,
  out: Float32Array,
  list: readonly [number, number, number][],
  wave: Wave,
  half = 0.15,
): Float32Array {
  for (const [hz, at, length] of list) {
    k.tone(out, steady(hz), (t) => decay(half)(t) * held(length, 0.005)(t), wave, at, at + length);
  }
  return out;
}

/** A drum: a falling low tone with a burst of noise. */
function drum(k: Kit, out: Float32Array, at: number, body: number, snap: number, gain = 1) {
  k.tone(out, glide(body * 2, body, 0.05), (t) => gain * decay(0.06)(t), 'sine', at, at + 0.5);
  k.noise(out, steady(snap), (t) => gain * 0.8 * decay(0.03)(t), 0.7, at, at + 0.3, 'high');
}

const r = (
  id: string,
  name: string,
  group: SoundGroup,
  hint: string,
  seconds: number,
  make: Recipe['make'],
): Recipe => ({ id, name, group, hint, seconds, make });

const RECIPES: readonly Recipe[] = [
  // ---- Buttons & alerts ----
  r(
    'click',
    'Click',
    'Buttons & alerts',
    'A mouse or button click: menus, typing, a choice made',
    0.06,
    (k) => {
      const out = k.noise(k.buffer(), steady(4000), decay(0.006), 2, 0, 0.06, 'high');
      return [k.tone(out, steady(2200), (t) => 0.5 * decay(0.004)(t))];
    },
  ),
  r(
    'pop',
    'Pop',
    'Buttons & alerts',
    'Something appears: a bubble, a picture or a word pops up',
    0.15,
    (k) => [k.tone(k.buffer(), glide(900, 160, 0.07), decay(0.025))],
  ),
  r(
    'ding',
    'Ding',
    'Buttons & alerts',
    'A bright bell: a right answer, a new point, the end of a step',
    1.6,
    (k) => {
      const out = k.buffer();
      for (const [ratio, gain, half] of [
        [1, 1, 0.35],
        [2.76, 0.45, 0.18],
        [5.4, 0.25, 0.08],
      ] as const) {
        k.tone(out, steady(880 * ratio), (t) => gain * decay(half)(t));
      }
      return [out];
    },
  ),
  r(
    'beep',
    'Beep',
    'Buttons & alerts',
    'A plain electronic beep: a timer, a warning, censoring a word',
    0.3,
    (k) => [k.tone(k.buffer(), steady(1000), held(0.3))],
  ),
  r(
    'chime',
    'Chime',
    'Buttons & alerts',
    'A friendly two-note alert, like a message arriving',
    0.8,
    (k) => [
      notes(
        k,
        k.buffer(),
        [
          [659, 0, 0.8],
          [988, 0.16, 0.64],
        ],
        'sine',
        0.18,
      ),
    ],
  ),
  r(
    'correct',
    'Correct',
    'Buttons & alerts',
    'Two rising notes: well done, the right answer',
    0.6,
    (k) => [
      notes(
        k,
        k.buffer(),
        [
          [523, 0, 0.6],
          [784, 0.12, 0.48],
        ],
        'triangle',
        0.12,
      ),
    ],
  ),
  r(
    'buzzer',
    'Wrong buzzer',
    'Buttons & alerts',
    'A low buzz: a wrong answer or a mistake',
    0.6,
    (k) => {
      const out = k.tone(k.buffer(), steady(110), held(0.6), 'square');
      return [k.tone(out, steady(117), held(0.6), 'square')];
    },
  ),

  // ---- Movement ----
  r('whoosh', 'Whoosh', 'Movement', 'Air rushing past: something flies across the screen', 1, (k) =>
    pan(
      k,
      k.noise(k.buffer(), (t) => 300 + 2600 * swell(0.5, 0.3)(t), swell(0.5, 0.22), 1.6),
      (t) => 1.6 * t - 0.8,
    ),
  ),
  r(
    'swoosh',
    'Swoosh',
    'Movement',
    'A quick swipe: a page turn, a fast slide or a transition',
    0.45,
    (k) =>
      pan(
        k,
        k.noise(k.buffer(), (t) => 1200 + 3800 * swell(0.2, 0.1)(t), swell(0.2, 0.08), 2),
        (t) => 0.8 - 3.5 * t,
      ),
  ),
  r('riser', 'Riser', 'Movement', 'Builds up and up: just before a big reveal', 2.2, (k) => {
    const loud = (t: number) => (t / 2.2) ** 2 * held(2.2, 0.05)(t);
    const out = k.tone(k.buffer(), glide(200, 1400, 2.2), (t) => 0.5 * loud(t), 'saw');
    return [k.noise(out, glide(400, 6000, 2.2), loud, 1.2)];
  }),
  r('drop', 'Drop', 'Movement', 'A falling note: something falls or a mood goes down', 1, (k) => [
    k.tone(k.buffer(), glide(1400, 70, 1), (t) => held(1, 0.01)(t) * (1 - t / 1.1)),
  ]),
  r('boing', 'Boing', 'Movement', 'A spring: a bounce, a jump, a cartoon surprise', 0.9, (k) => [
    k.tone(
      k.buffer(),
      (t) => 260 * (1 + 0.45 * Math.sin(TAU * 11 * t) * Math.exp(-3 * t)) * (1 + 0.6 * t),
      decay(0.25, 0.005),
      'triangle',
    ),
  ]),
  r(
    'slide-up',
    'Slide whistle',
    'Movement',
    'A cartoon whistle sliding up: something rises or flies up',
    0.7,
    (k) => [
      k.tone(
        k.buffer(),
        (t) => glide(450, 1700, 0.65)(t) * (1 + 0.02 * Math.sin(TAU * 7 * t)),
        held(0.7, 0.03),
      ),
    ],
  ),

  // ---- Hits ----
  r('thud', 'Thud', 'Hits', 'Something heavy lands: a box, a stamp, a big word', 0.5, (k) => {
    const out = k.tone(k.buffer(), glide(110, 45, 0.2), decay(0.08));
    return [k.noise(out, steady(500), (t) => 0.6 * decay(0.015)(t), 0.7, 0, 0.5, 'low')];
  }),
  r('boom', 'Boom', 'Hits', 'A deep explosion or a dramatic moment', 2.2, (k) => {
    const out = k.noise(k.buffer(), glide(900, 120, 1.5), decay(0.35, 0.005), 0.7, 0, 2.2, 'low');
    return [k.tone(out, glide(70, 38, 1.5), (t) => 0.8 * decay(0.3, 0.005)(t))];
  }),
  r('punch', 'Punch', 'Hits', 'A cartoon hit: action, a comic strip, a sudden stop', 0.35, (k) => {
    const out = k.noise(k.buffer(), steady(1100), decay(0.03), 1);
    return [k.tone(out, glide(180, 60, 0.12), (t) => 0.9 * decay(0.05)(t))];
  }),
  r('drum', 'Drum hit', 'Hits', 'One snare drum hit: to mark a point or a beat', 0.4, (k) => {
    const out = k.buffer();
    drum(k, out, 0, 190, 3500);
    return [out];
  }),
  r(
    'cymbal',
    'Cymbal crash',
    'Hits',
    'A crash that rings on: the end of a drum roll, a big finish',
    2,
    (k) => [k.noise(k.buffer(), steady(7000), decay(0.4, 0.002), 0.5, 0, 2, 'high')],
  ),

  // ---- Games ----
  r(
    'laser',
    'Laser',
    'Games',
    'A space laser: science fiction, shooting stars, games',
    0.35,
    (k) => [
      k.tone(
        k.buffer(),
        glide(1800, 180, 0.3),
        (t) => held(0.35, 0.005)(t) * (1 - t / 0.4),
        'square',
      ),
    ],
  ),
  r('coin', 'Coin', 'Games', 'Collecting a coin: a score, money, a reward', 0.55, (k) => [
    notes(
      k,
      k.buffer(),
      [
        [988, 0, 0.09],
        [1319, 0.09, 0.46],
      ],
      'square',
      0.12,
    ),
  ]),
  r(
    'power-up',
    'Power up',
    'Games',
    'Notes climbing fast: getting stronger, levelling up',
    0.7,
    (k) => [
      notes(
        k,
        k.buffer(),
        [523, 659, 784, 1047, 1319, 1568].map(
          (hz, i) => [hz, i * 0.07, i === 5 ? 0.35 : 0.08] as [number, number, number],
        ),
        'square',
        0.3,
      ),
    ],
  ),
  r('jump', 'Jump', 'Games', 'A quick upward blip: a character jumps', 0.25, (k) => [
    k.tone(k.buffer(), glide(280, 760, 0.2), held(0.25, 0.005), 'square'),
  ]),
  r('game-over', 'Game over', 'Games', 'Sad falling notes: losing, failing, the end', 1.5, (k) => [
    notes(
      k,
      k.buffer(),
      [
        [392, 0, 0.3],
        [330, 0.3, 0.3],
        [262, 0.6, 0.9],
      ],
      'triangle',
      0.35,
    ),
  ]),

  // ---- Time & tension ----
  r(
    'tick-tock',
    'Tick-tock',
    'Time & tension',
    'A clock ticking: time passing, waiting, a countdown',
    2,
    (k) => {
      const out = k.buffer();
      for (let n = 0; n < 4; n++) {
        const at = n * 0.5;
        k.noise(out, steady(n % 2 ? 1800 : 3200), decay(0.008), 6, at, at + 0.08);
      }
      return [out];
    },
  ),
  r(
    'heartbeat',
    'Heartbeat',
    'Time & tension',
    'A beating heart: fear, suspense, health topics',
    2,
    (k) => {
      const out = k.buffer();
      for (const at of [0, 0.25, 1, 1.25]) {
        const gain = at % 1 ? 0.7 : 1;
        k.tone(out, glide(70, 45, 0.1), (t) => gain * decay(0.05, 0.01)(t), 'sine', at, at + 0.4);
      }
      return [out];
    },
  ),
  r(
    'drum-roll',
    'Drum roll',
    'Time & tension',
    'A drum roll getting louder: before a result or an answer',
    2.2,
    (k) => {
      const out = k.buffer();
      for (let at = 0, n = 0; at < 2; n++, at += 0.055) {
        drum(k, out, at, 200, 3800, 0.25 + 0.45 * (at / 2) + (n % 2 ? 0 : 0.05));
      }
      k.noise(out, steady(7000), (t) => 0.9 * decay(0.12, 0.002)(t), 0.5, 2, 2.2, 'high');
      return [out];
    },
  ),

  // ---- Celebration ----
  r(
    'ta-da',
    'Ta-da!',
    'Celebration',
    'A big chord: a reveal, a finished task, a winner',
    1.7,
    (k) => {
      const out = k.buffer();
      const chord = [523, 659, 784, 1047];
      for (const [at, length] of [
        [0, 0.18],
        [0.22, 1.48],
      ] as const) {
        for (const hz of chord) {
          k.tone(
            out,
            steady(hz),
            (t) => decay(length > 1 ? 0.45 : 0.1, 0.01)(t) * held(length, 0.02)(t),
            'saw',
            at,
            at + length,
          );
        }
      }
      return [out];
    },
  ),
  r(
    'sparkle',
    'Sparkle',
    'Celebration',
    'Twinkling: magic, stars, something new and shiny',
    1.4,
    (k) => {
      const out = k.buffer();
      for (let n = 0; n < 14; n++) {
        const at = n * 0.075 + 0.02 * (k.random() + 1);
        const hz = 2500 + 1800 * (k.random() + 1);
        k.tone(out, steady(hz), (t) => (1 - n / 18) * decay(0.07)(t), 'sine', at, at + 0.35);
      }
      return [out];
    },
  ),
];

export const SOUND_EFFECTS: readonly SoundEffect[] = RECIPES.map(({ id, name, group, hint }) => ({
  id,
  name,
  group,
  hint,
}));

export const soundEffect = (id: string): SoundEffect | undefined =>
  SOUND_EFFECTS.find((s) => s.id === id);

/** What a media file is called on screen: a built-in sound by its name ("Drum roll"), else `file`. */
export const mediaName = (asset: { soundEffect?: string }, file: string): string =>
  (asset.soundEffect && soundEffect(asset.soundEffect)?.name) || file;

/** The sound's samples at `rate`: peaks at LEVEL, with a short fade at both ends. */
export function makeSoundEffect(id: string, rate: number): Channels {
  const recipe = RECIPES.find((s) => s.id === id);
  if (!recipe) throw new Error(`There is no sound effect called "${id}".`);
  const channels = recipe.make(new Kit(rate, recipe.seconds));
  const peak = channels.reduce((m, c) => c.reduce((n, v) => Math.max(n, Math.abs(v)), m), 0);
  const gain = peak > 0 ? LEVEL / peak : 0;
  const edge = Math.max(1, Math.round(EDGE_SECONDS * rate));
  for (const c of channels) {
    for (let i = 0; i < c.length; i++) {
      const ramp = Math.min(1, i / edge, (c.length - 1 - i) / edge);
      c[i] = c[i]! * gain * ramp;
    }
  }
  return channels;
}

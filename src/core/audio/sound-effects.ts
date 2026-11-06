// X8 built-in sound effects (M17a step 13). Each sound is made by this code (oscillators, filtered
// noise and envelopes), so there are no sound files to ship, no licence to check, and every
// computer makes exactly the same samples. Video mode saves one as a WAV and puts it on a sound
// effects track; Audio mode adds it as a new track.
import type { Channels } from './pcm.ts';

// Only the ids are saved in projects, so a group can be renamed or a sound moved to another one.
export const SOUND_GROUPS = [
  'Buttons & alerts',
  'Whooshes & transitions',
  'Hits',
  'Everyday sounds',
  'Comedy',
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

  /** A "random" number from `a` to `b`. */
  between(a: number, b: number): number {
    return a + ((b - a) * (this.random() + 1)) / 2;
  }

  /**
   * A loudness that wanders smoothly at random by up to `depth` (0–1), changing about every `step`
   * seconds: the crackle of paper, static or a crowd.
   */
  jitter(step: number, depth: number): (t: number) => number {
    const values = Array.from(
      { length: Math.ceil(this.length / this.rate / step) + 2 },
      () => (this.random() + 1) / 2,
    );
    return (t) => {
      const x = Math.max(0, t / step);
      const i = Math.min(values.length - 2, Math.floor(x));
      const f = Math.min(1, x - i);
      return 1 - depth + depth * (values[i]! * (1 - f) + values[i + 1]! * f);
    };
  }

  /**
   * Passes `out` (from `from` to `to` seconds) through the same kind of filter as `noise`, its
   * cutoff (Hz) moving over time: 'low' makes a sound duller, 'high' thinner.
   */
  filter(
    out: Float32Array,
    cutoff: (t: number) => number,
    q = 1,
    kind: 'band' | 'low' | 'high' = 'low',
    from = 0,
    to = this.length / this.rate,
  ): Float32Array {
    let low = 0;
    let band = 0;
    const damp = Math.min(1.5, 1 / q);
    const highest = Math.min(0.9, 0.9 * (2 - damp));
    const end = Math.min(out.length, Math.round(to * this.rate));
    for (let i = Math.round(from * this.rate); i < end; i++) {
      const t = i / this.rate - from;
      const f = Math.min(
        highest,
        2 * Math.sin((Math.PI * Math.min(cutoff(t), this.rate / 6)) / this.rate),
      );
      low += f * band;
      const high = out[i]! - low - damp * band;
      band += f * high;
      out[i] = kind === 'band' ? band : kind === 'low' ? low : high;
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

/** Adds `part` × `gain` into `out`. */
function mix(out: Float32Array, part: Float32Array, gain = 1): Float32Array {
  for (let i = 0; i < out.length; i++) out[i]! += part[i]! * gain;
  return out;
}

/** Rounds off the loudest parts (soft clipping), which makes a sound fuller and grittier. */
function saturate(out: Float32Array, drive: number): Float32Array {
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const top = Math.tanh(drive);
  for (let i = 0; i < out.length; i++) out[i] = (Math.tanh((drive * out[i]!) / peak) * peak) / top;
  return out;
}

/** Fades the last `seconds` away smoothly, so an echo dies out instead of stopping. */
function fadeOut(k: Kit, channels: Float32Array[], seconds: number): Float32Array[] {
  const n = Math.round(seconds * k.rate);
  for (const c of channels) {
    for (let i = 0; i < n && i < c.length; i++) {
      c[c.length - 1 - i]! *= 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
    }
  }
  return channels;
}

/**
 * The sound in a room: four echoes that feed back on themselves and grow duller (a Schroeder
 * reverb), a little different on each side. `seconds` is how long the echo takes to die away;
 * `wet` how loud it is next to the sound itself.
 */
function reverb(k: Kit, dry: Float32Array, wet: number, seconds = 1.2): Float32Array[] {
  return [0, 1].map((side) => {
    const room = new Float32Array(dry.length);
    for (const ms of [29.7, 37.1, 41.1, 43.7]) {
      const d = Math.round(((ms + side * 1.7) / 1000) * k.rate);
      const g = 0.001 ** (d / k.rate / seconds);
      const line = new Float32Array(dry.length);
      let dull = 0;
      for (let i = 0; i < dry.length; i++) {
        if (i >= d) dull = 0.7 * line[i - d]! + 0.3 * dull;
        line[i] = dry[i]! + g * dull;
        room[i]! += line[i]! / 4;
      }
    }
    for (const ms of [5, 1.7]) {
      const d = Math.round(((ms + side * 0.3) / 1000) * k.rate);
      const input = Float32Array.from(room);
      for (let i = 0; i < room.length; i++) {
        room[i] = -0.7 * input[i]! + (i >= d ? input[i - d]! + 0.7 * room[i - d]! : 0);
      }
    }
    return mix(Float32Array.from(dry), room, wet);
  });
}

/** A struck bar or bell: `partials` are [ratio to `hz`, loudness, half-life s]. */
function struck(
  k: Kit,
  out: Float32Array,
  hz: number,
  partials: readonly (readonly [number, number, number])[],
  at: number,
  gain = 1,
): Float32Array {
  for (const [ratio, loud, half] of partials) {
    k.tone(out, steady(hz * ratio), (t) => gain * loud * decay(half, 0.001)(t), 'sine', at);
  }
  return out;
}

/** A soft wooden note, like a marimba: phone alerts and friendly pings. */
const MALLET = [
  [1, 1, 0.09],
  [3.93, 0.25, 0.015],
] as const;

/**
 * A brass note (trumpet, trombone): a buzzy wave through a filter that opens as it gets louder.
 * `wah` (t → 0…1) opens and closes the filter on top, like a hand or a mute in the bell.
 */
function brass(
  k: Kit,
  out: Float32Array,
  pitch: (t: number) => number,
  at: number,
  length: number,
  gain = 1,
  wah: (t: number) => number = () => 1,
): void {
  const loud = (t: number) =>
    held(length, 0.04)(t) *
    (0.75 + 0.25 * decay(0.15, 0.03)(t)) *
    Math.min(1, (length - t) / Math.min(0.5, length / 2));
  const part = k.tone(k.buffer(), pitch, loud, 'saw', at, at + length);
  k.filter(part, (t) => pitch(t) * (1.2 + 5 * loud(t) * wah(t)), 1.2, 'low', at, at + length);
  mix(out, part, gain);
}

/** A smooth hump from 0 up to 1 and back, from `at` for `length` seconds. */
const bump = (t: number, at: number, length: number) =>
  t < at || t > at + length ? 0 : Math.sin((Math.PI * (t - at)) / length);

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

  // ---- Whooshes & transitions ----
  r(
    'whoosh',
    'Whoosh',
    'Whooshes & transitions',
    'Air rushing past: something flies across the screen',
    1,
    (k) =>
      pan(
        k,
        k.noise(k.buffer(), (t) => 300 + 2600 * swell(0.5, 0.3)(t), swell(0.5, 0.22), 1.6),
        (t) => 1.6 * t - 0.8,
      ),
  ),
  r(
    'swoosh',
    'Swoosh',
    'Whooshes & transitions',
    'A quick swipe: a page turn, a fast slide or a transition',
    0.45,
    (k) =>
      pan(
        k,
        k.noise(k.buffer(), (t) => 1200 + 3800 * swell(0.2, 0.1)(t), swell(0.2, 0.08), 2),
        (t) => 0.8 - 3.5 * t,
      ),
  ),
  r(
    'riser',
    'Riser',
    'Whooshes & transitions',
    'Builds up and up: just before a big reveal',
    2.2,
    (k) => {
      const loud = (t: number) => (t / 2.2) ** 2 * held(2.2, 0.05)(t);
      const out = k.tone(k.buffer(), glide(200, 1400, 2.2), (t) => 0.5 * loud(t), 'saw');
      return [k.noise(out, glide(400, 6000, 2.2), loud, 1.2)];
    },
  ),
  r(
    'drop',
    'Drop',
    'Whooshes & transitions',
    'A falling note: something falls or a mood goes down',
    1,
    (k) => [k.tone(k.buffer(), glide(1400, 70, 1), (t) => held(1, 0.01)(t) * (1 - t / 1.1))],
  ),
  r('boing', 'Boing', 'Comedy', 'A spring: a bounce, a jump, a cartoon surprise', 0.9, (k) => [
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
    'Comedy',
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
  // ---- more Buttons & alerts ----
  r(
    'notification',
    'Notification',
    'Buttons & alerts',
    'A phone notification: a new message, a like, a reminder pops up',
    0.8,
    (k) => {
      const out = struck(k, k.buffer(), 1175, MALLET, 0);
      return [struck(k, out, 1760, MALLET, 0.11)];
    },
  ),
  r(
    'message-sent',
    'Message sent',
    'Buttons & alerts',
    'A message flies away: sending a text or an email',
    0.4,
    (k) => {
      const out = k.tone(
        k.buffer(),
        glide(500, 1600, 0.1),
        (t) => decay(0.05, 0.005)(t) * held(0.38, 0.005)(t),
      );
      k.noise(out, glide(1500, 6000, 0.2), (t) => 0.3 * swell(0.1, 0.06)(t), 2);
      return pan(k, out, (t) => Math.min(0.7, 3 * t));
    },
  ),
  r(
    'error',
    'Error',
    'Buttons & alerts',
    'A computer error: something went wrong, the wrong button, access denied',
    0.55,
    (k) => {
      const out = notes(
        k,
        k.buffer(),
        [
          [392, 0, 0.15],
          [262, 0.17, 0.36],
        ],
        'square',
        0.15,
      );
      return [k.filter(out, steady(1500), 0.8)];
    },
  ),
  r(
    'success',
    'Success',
    'Buttons & alerts',
    'Task complete: saved, sent, uploaded, a level finished',
    1,
    (k) => {
      const out = k.buffer();
      [784, 988, 1175, 1568].forEach((hz, i) => struck(k, out, hz, MALLET, i * 0.08, 0.8));
      return [struck(k, out, 1568 * 2, [[1, 0.25, 0.12]], 0.24)];
    },
  ),
  r(
    'switch',
    'Switch',
    'Buttons & alerts',
    'A switch flicked: a light goes on or off, a setting changes',
    0.15,
    (k) => {
      const out = k.buffer();
      for (const [at, gain, hz] of [
        [0.005, 1, 2600],
        [0.035, 0.6, 1700],
      ] as const) {
        k.noise(out, steady(hz), (t) => gain * decay(0.003, 0.0003)(t), 2, at, at + 0.04);
        k.tone(out, steady(hz * 0.45), (t) => gain * 0.3 * decay(0.006)(t), 'sine', at, at + 0.05);
      }
      return [out];
    },
  ),
  r(
    'bubbles',
    'Bubbles',
    'Buttons & alerts',
    'Bubbles popping one by one: underwater, a fizzy drink, things appearing in turn',
    1.2,
    (k) => {
      const out = k.buffer();
      for (let n = 0; n < 7; n++) {
        const at = 0.02 + n * 0.15 + 0.03 * (k.random() + 1);
        const hz = k.between(450, 800) * (1 + n * 0.08);
        k.tone(
          out,
          glide(hz, hz * 2.4, 0.05),
          (t) => decay(0.02, 0.003)(t) * held(0.09, 0.003)(t),
          'sine',
          at,
          at + 0.1,
        );
      }
      return [out];
    },
  ),

  // ---- more Whooshes & transitions ----
  r(
    'whoosh-deep',
    'Deep whoosh',
    'Whooshes & transitions',
    'A big, slow rush of air: a scene change, something huge goes past',
    1.8,
    (k) => {
      const out = k.noise(
        k.buffer(),
        (t) => 150 + 1100 * swell(0.85, 0.45)(t),
        swell(0.85, 0.38),
        1.3,
      );
      k.noise(
        out,
        (t) => 80 + 260 * swell(0.85, 0.5)(t),
        (t) => 2 * swell(0.85, 0.42)(t),
        1,
        0,
        1.8,
        'low',
      );
      return pan(k, out, (t) => Math.max(-0.9, Math.min(0.9, 1.1 * (t - 0.85))));
    },
  ),
  r(
    'downlifter',
    'Downlifter',
    'Whooshes & transitions',
    'The opposite of a riser: falls away after a big moment',
    2.4,
    (k) => {
      const fade = (t: number) => decay(0.8, 0.01)(t) * held(2.4, 0.05)(t);
      const out = k.noise(k.buffer(), glide(7000, 250, 2.2), fade, 1.2);
      const tone = k.tone(k.buffer(), glide(900, 60, 2.2), (t) => 0.5 * fade(t), 'saw');
      mix(out, k.filter(tone, glide(3000, 200, 2.2)));
      k.tone(out, glide(80, 35, 0.8), (t) => 0.3 * decay(0.25, 0.005)(t));
      return [out];
    },
  ),
  r(
    'reverse-cymbal',
    'Reverse cymbal',
    'Whooshes & transitions',
    'A cymbal played backwards, swelling up: leads into the next scene',
    2,
    (k) => {
      const grow = (t: number) => 0.5 ** ((1.95 - t) / 0.32) * held(1.95, 0.03)(t);
      const side = () => {
        const out = k.noise(k.buffer(), steady(7000), grow, 0.5, 0, 2, 'high');
        return k.noise(out, steady(3500), (t) => 0.3 * grow(t), 1);
      };
      return [side(), side()];
    },
  ),
  r(
    'glitch',
    'Glitch',
    'Whooshes & transitions',
    'A digital stutter: a computer breaks down, a hacker, a fast cut',
    0.8,
    (k) => {
      const left = k.buffer();
      const right = k.buffer();
      for (let at = 0.005, n = 0; at < 0.75; n++) {
        const length = Math.min(k.between(0.015, 0.07), 0.78 - at);
        const kind = n % 5 === 4 ? 3 : Math.floor(k.between(0, 2.999));
        const where = n % 3;
        const hz = k.between(150, 2500);
        const gate = held(length, 0.002);
        for (const out of where === 0 ? [left] : where === 1 ? [right] : [left, right]) {
          if (kind === 0) k.tone(out, steady(hz), gate, 'square', at, at + length);
          else if (kind === 1)
            k.noise(out, steady(hz * 2), (t) => 1.5 * gate(t), 0.8, at, at + length, 'high');
          else if (kind === 2)
            k.tone(out, glide(hz, hz * 0.3, length), gate, 'saw', at, at + length);
          // kind 3: a gap
        }
        at += length;
      }
      return [left, right];
    },
  ),
  r(
    'static',
    'TV static',
    'Whooshes & transitions',
    'The hiss of an old TV with no signal: a lost signal, a channel change, a flashback',
    1.2,
    (k) => {
      const crackle = k.jitter(0.012, 0.5);
      const side = () => {
        const loud = (t: number) => held(1.2, 0.03)(t) * crackle(t);
        const out = k.noise(k.buffer(), steady(5000), loud, 0.4);
        return k.noise(out, steady(1500), (t) => 0.4 * loud(t), 0.7, 0, 1.2, 'high');
      };
      return [side(), side()];
    },
  ),
  r(
    'tape-stop',
    'Tape stop',
    'Whooshes & transitions',
    'Music slowing down to a stop: a sudden halt, the action freezes, "wait, what?"',
    1.2,
    (k) => {
      const speed = (t: number) => (t < 0.2 ? 1 : Math.max(0, 1 - (t - 0.2) / 0.9) ** 1.6);
      // how far the tape has moved (the integral of speed), for the beat
      const moved = (t: number) =>
        t < 0.2 ? t : 0.2 + (0.9 / 2.6) * (1 - Math.max(0, 1 - (t - 0.2) / 0.9) ** 2.6);
      const beat = (t: number) => 0.55 + 0.45 * Math.cos(TAU * 4 * moved(t)) ** 2;
      const out = k.buffer();
      for (const [hz, gain] of [
        [110, 1],
        [220, 0.5],
        [277, 0.4],
        [330, 0.4],
        [440, 0.3],
      ] as const) {
        k.tone(
          out,
          (t) => hz * speed(t),
          (t) => gain * held(1.1, 0.01)(t) * (0.3 + 0.7 * speed(t)) * beat(t),
          'saw',
        );
      }
      return [k.filter(out, (t) => 250 + 4000 * speed(t))];
    },
  ),
  r(
    'record-scratch',
    'Record scratch',
    'Whooshes & transitions',
    'A record scratched to a stop: "hold on", an awkward moment, a surprise',
    0.5,
    (k) => {
      // the record is pushed forward fast, then pulled back more slowly
      const speed = (t: number) => bump(t, 0.01, 0.14) + 0.85 * bump(t, 0.17, 0.25);
      const out = k.noise(
        k.buffer(),
        (t) => 300 + 3500 * speed(t),
        (t) => 1.2 * speed(t),
        2.5,
      );
      const buzz = k.tone(k.buffer(), (t) => 90 + 900 * speed(t), speed, 'saw');
      return [
        mix(
          out,
          k.filter(buzz, (t) => 500 + 3000 * speed(t)),
          0.8,
        ),
      ];
    },
  ),
  r(
    'zip',
    'Zip',
    'Whooshes & transitions',
    'A very fast zip: zooming in, a quick move, something shoots past',
    0.35,
    (k) => {
      const out = k.noise(k.buffer(), glide(600, 9000, 0.28), swell(0.2, 0.08), 3);
      k.tone(out, glide(300, 2600, 0.28), (t) => 0.25 * swell(0.2, 0.08)(t));
      return pan(k, out, (t) => Math.min(0.8, -0.6 + 4 * t));
    },
  ),
  r(
    'page-turn',
    'Page turn',
    'Whooshes & transitions',
    'Paper turning over: a new page, a new chapter, reading a book',
    0.7,
    (k) => {
      const rustle = k.jitter(0.008, 0.85);
      const out = k.noise(
        k.buffer(),
        (t) => 2500 + 1500 * swell(0.3, 0.15)(t),
        (t) => swell(0.3, 0.14)(t) * rustle(t),
        0.8,
      );
      k.noise(
        out,
        steady(3500),
        (t) => 0.5 * swell(0.35, 0.12)(t) * rustle(t),
        0.7,
        0,
        0.7,
        'high',
      );
      k.noise(out, steady(500), (t) => 0.8 * decay(0.03, 0.01)(t), 0.8, 0.45, 0.7, 'low');
      return pan(k, out, (t) => 0.5 - 1.4 * t);
    },
  ),

  // ---- more Hits ----
  r(
    'impact',
    'Big impact',
    'Hits',
    'A huge cinematic hit: a title slams in, a trailer moment',
    3,
    (k) => {
      const dry = k.tone(k.buffer(), glide(90, 32, 0.8), decay(0.45, 0.003));
      k.noise(dry, glide(3000, 150, 0.4), (t) => 1.5 * decay(0.08, 0.001)(t), 0.8, 0, 3, 'low');
      k.noise(dry, steady(3000), (t) => 0.8 * decay(0.012, 0.001)(t), 0.7, 0, 0.3, 'high');
      saturate(dry, 1.5);
      return fadeOut(k, reverb(k, dry, 0.35, 1.8), 0.6);
    },
  ),
  r(
    'bass-drop',
    'Bass drop',
    'Hits',
    'A deep bass falling a long way: a beat drops, a big change, a dramatic turn',
    2.5,
    (k) => {
      const loud = (t: number) => held(2.5, 0.01)(t) * decay(0.9, 0.01)(t);
      const out = k.tone(k.buffer(), glide(220, 35, 2), loud);
      const buzz = k.tone(k.buffer(), glide(220, 35, 2), (t) => 0.6 * loud(t), 'saw');
      mix(out, k.filter(buzz, glide(2000, 200, 1.5)));
      return [saturate(out, 1.5)];
    },
  ),
  r(
    'metal-clang',
    'Metal clang',
    'Hits',
    'Metal hitting metal: a gate shuts, a sword, an anvil, a heavy tool',
    2,
    (k) => {
      const partials = [
        [1, 1, 0.5],
        [1.004, 0.5, 0.45],
        [2.41, 0.7, 0.35],
        [3.93, 0.5, 0.25],
        [5.37, 0.45, 0.18],
        [6.85, 0.3, 0.12],
        [8.21, 0.25, 0.08],
      ] as const;
      const out = struck(k, k.buffer(), 520, partials, 0);
      k.noise(out, steady(4000), (t) => 1.5 * decay(0.01, 0.001)(t), 1, 0, 0.2, 'high');
      return fadeOut(k, reverb(k, out, 0.2), 0.3);
    },
  ),
  r(
    'glass-clink',
    'Glass clink',
    'Hits',
    'Two glasses touching: cheers, a toast, a small delicate moment',
    1.2,
    (k) => {
      const out = k.buffer();
      for (const [at, gain, hz] of [
        [0.005, 1, 2600],
        [0.16, 0.7, 2700],
      ] as const) {
        const partials = [
          [1, 1, 0.12],
          [1.003, 0.6, 0.15],
          [2.32, 0.5, 0.07],
          [4.25, 0.3, 0.04],
        ] as const;
        struck(k, out, hz, partials, at, gain);
      }
      return fadeOut(k, reverb(k, out, 0.15), 0.2);
    },
  ),

  // ---- Everyday sounds ----
  r(
    'camera-shutter',
    'Camera shutter',
    'Everyday sounds',
    'A photo is taken: a snapshot, a picture appears on screen',
    0.3,
    (k) => {
      const out = k.buffer();
      const clack = (at: number, gain: number) => {
        k.noise(out, steady(3000), (t) => gain * decay(0.004, 0.0005)(t), 1.5, at, at + 0.05);
        k.noise(out, steady(800), (t) => gain * 0.8 * decay(0.008, 0.0005)(t), 1.2, at, at + 0.06);
        k.tone(out, steady(1400), (t) => gain * 0.2 * decay(0.01)(t), 'sine', at, at + 0.06);
      };
      clack(0.01, 1);
      k.noise(out, steady(2200), (t) => 0.15 * held(0.07, 0.01)(t), 4, 0.03, 0.11);
      clack(0.11, 0.8);
      return [out];
    },
  ),
  r(
    'door-knock',
    'Door knock',
    'Everyday sounds',
    'Knocking on a door: someone arrives, "who is it?", a new scene',
    1,
    (k) => {
      const out = k.buffer();
      for (const [at, gain] of [
        [0.01, 1],
        [0.21, 0.85],
        [0.41, 0.95],
      ] as const) {
        k.tone(
          out,
          glide(230, 170, 0.04),
          (t) => gain * decay(0.025, 0.001)(t),
          'sine',
          at,
          at + 0.3,
        );
        k.tone(out, steady(410), (t) => gain * 0.4 * decay(0.015, 0.001)(t), 'sine', at, at + 0.2);
        k.noise(out, steady(1000), (t) => gain * 0.8 * decay(0.006, 0.0005)(t), 1.5, at, at + 0.08);
      }
      return fadeOut(k, reverb(k, out, 0.12, 0.5), 0.1);
    },
  ),
  r(
    'footsteps',
    'Footsteps',
    'Everyday sounds',
    'Someone walking: arriving, leaving, creeping up quietly',
    2.2,
    (k) => {
      const out = k.buffer();
      for (let n = 0; n < 4; n++) {
        const at = 0.05 + n * 0.5 + 0.02 * k.random();
        const gain = n % 2 ? 0.8 : 1;
        k.noise(out, steady(700), (t) => gain * decay(0.02, 0.002)(t), 0.8, at, at + 0.25);
        k.tone(
          out,
          glide(130, 70, 0.05),
          (t) => gain * 0.5 * decay(0.02, 0.002)(t),
          'sine',
          at,
          at + 0.2,
        );
        k.noise(
          out,
          steady(2200),
          (t) => gain * 0.4 * decay(0.03, 0.004)(t),
          1,
          at + 0.06,
          at + 0.3,
        );
      }
      return fadeOut(k, reverb(k, out, 0.1, 0.6), 0.1);
    },
  ),
  r(
    'typewriter',
    'Typewriter',
    'Everyday sounds',
    'An old typewriter, then its bell: a title typed letter by letter, a news story',
    2.4,
    (k) => {
      const out = k.buffer();
      const key = (at: number, gain: number) => {
        k.noise(out, steady(2500), (t) => gain * decay(0.005, 0.0005)(t), 1.2, at, at + 0.06);
        k.noise(out, steady(600), (t) => gain * 0.8 * decay(0.012, 0.001)(t), 1, at, at + 0.08);
        k.tone(out, steady(190), (t) => gain * 0.3 * decay(0.015)(t), 'sine', at, at + 0.08);
      };
      for (let at = 0.02; at < 1.35; at += k.between(0.09, 0.2)) key(at, k.between(0.6, 1));
      struck(
        k,
        out,
        2400,
        [
          [1, 0.7, 0.3],
          [2.76, 0.25, 0.1],
        ],
        1.45,
        0.3,
      );
      // the carriage goes back: a quick ratchet, then a clunk
      for (let n = 0; n < 16; n++) key(1.7 + n * 0.022, 0.45);
      key(2.06, 1);
      return [out];
    },
  ),
  r(
    'keyboard',
    'Keyboard typing',
    'Everyday sounds',
    'Fast typing on a computer: coding, writing a message, a hacker at work',
    2,
    (k) => {
      const out = k.buffer();
      for (let at = 0.02, n = 0; at < 1.9; n++) {
        const gain = k.between(0.5, 1);
        const space = n % 7 === 6;
        const hz = space ? 1300 : k.between(1800, 3200);
        k.noise(out, steady(hz), (t) => gain * decay(0.008, 0.0005)(t), 1.5, at, at + 0.06);
        k.noise(
          out,
          steady(space ? 400 : 900),
          (t) => gain * 0.8 * decay(space ? 0.025 : 0.015, 0.0008)(t),
          1,
          at,
          at + 0.1,
        );
        k.noise(
          out,
          steady(hz * 0.8),
          (t) => gain * 0.4 * decay(0.005, 0.0005)(t),
          1.5,
          at + 0.06,
          at + 0.09,
        );
        at += k.between(0.07, 0.15) * (n % 5 === 4 ? 2.2 : 1);
      }
      return [out];
    },
  ),
  r(
    'cash-register',
    'Cash register',
    'Everyday sounds',
    '"Ka-ching!": money, a sale, a price, a good business idea',
    1.6,
    (k) => {
      const out = k.buffer();
      // ka: the lever
      k.noise(out, steady(1200), (t) => 0.8 * decay(0.02, 0.001)(t), 1, 0, 0.15);
      k.tone(out, glide(300, 150, 0.05), (t) => 0.4 * decay(0.02)(t), 'sine', 0, 0.15);
      // coins in the drawer
      for (let n = 0; n < 8; n++) {
        const at = 0.12 + 0.035 * n + 0.01 * k.random();
        const hz = k.between(3500, 6000);
        k.tone(out, steady(hz), (t) => 0.15 * decay(0.03)(t), 'sine', at, at + 0.2);
      }
      // ching: two bells, shaking
      for (const [hz, gain] of [
        [2093, 1],
        [2637, 0.8],
      ] as const) {
        for (const [ratio, loud, half] of [
          [1, 1, 0.3],
          [2.76, 0.35, 0.12],
          [5.4, 0.2, 0.05],
        ] as const) {
          k.tone(
            out,
            steady(hz * ratio),
            (t) => gain * loud * decay(half, 0.002)(t) * (1 + 0.3 * Math.sin(TAU * 28 * t)),
            'sine',
            0.12,
          );
        }
      }
      return [out];
    },
  ),

  // ---- more Comedy ----
  r(
    'slide-down',
    'Slide whistle down',
    'Comedy',
    'A cartoon whistle sliding down: something falls, sinks or flops',
    0.8,
    (k) => [
      k.tone(
        k.buffer(),
        (t) => glide(1700, 380, 0.75)(t) * (1 + 0.02 * Math.sin(TAU * 7 * t)),
        held(0.8, 0.03),
      ),
    ],
  ),
  r(
    'sad-trombone',
    'Sad trombone',
    'Comedy',
    '"Wah wah wah waaah": a fail, a let-down, a joke that falls flat',
    3.4,
    (k) => {
      const out = k.buffer();
      const wah = (length: number) => (t: number) =>
        0.15 + 0.85 * bump(t, 0, Math.min(length, 0.5));
      for (const [hz, at] of [
        [293.7, 0],
        [277.2, 0.5],
        [261.6, 1],
      ] as const) {
        brass(k, out, steady(hz), at, 0.46, 1, wah(0.46));
      }
      // the last note wobbles and dies away
      brass(
        k,
        out,
        (t) => 246.9 * (1 + 0.025 * Math.sin(TAU * 5.5 * t) * Math.min(1, t / 0.4)),
        1.5,
        1.6,
        1,
        (t) =>
          (0.25 + 0.75 * bump(t, 0, 0.4)) *
          (t < 0.4 ? 1 : 0.6 + 0.4 * Math.cos(TAU * 2.75 * (t - 0.4))) *
          (1 - t / 2),
      );
      return fadeOut(k, reverb(k, out, 0.15), 0.2);
    },
  ),
  r(
    'rimshot',
    'Ba-dum-tss',
    'Comedy',
    'A drum joke ending: right after a bad joke or a pun',
    1.6,
    (k) => {
      const out = k.buffer();
      drum(k, out, 0, 190, 3500, 0.8);
      drum(k, out, 0.16, 110, 2500, 0.9);
      k.tone(out, glide(120, 50, 0.05), decay(0.06), 'sine', 0.42, 0.9);
      k.noise(out, steady(8000), (t) => 0.8 * decay(0.25, 0.002)(t), 0.5, 0.42, 1.6, 'high');
      return [out];
    },
  ),
  r(
    'wobble',
    'Cartoon wobble',
    'Comedy',
    'A wobbly, dizzy sound: jelly, a confused character, something shaking',
    1.2,
    (k) => [
      k.tone(
        k.buffer(),
        (t) =>
          330 * (1 + 0.25 * Math.sin(TAU * 9 * t) * Math.exp(-1.2 * t)) * (1 - (0.25 * t) / 1.2),
        (t) => held(1.2, 0.02)(t) * (1 - (0.5 * t) / 1.2) * (0.8 + 0.2 * Math.sin(TAU * 9 * t)),
        'triangle',
      ),
    ],
  ),
  r(
    'crickets',
    'Crickets',
    'Comedy',
    'Crickets in the dark: an awkward silence, no one laughs, nothing happens',
    3,
    (k) => {
      const cricket = (hz: number, start: number, every: number) => {
        const out = k.buffer();
        for (let at = start; at < 2.8; at += every) {
          for (let p = 0; p < 4; p++) {
            const s = at + p * 0.033;
            k.tone(
              out,
              steady(hz),
              (t) => Math.sin((Math.PI * Math.min(t, 0.025)) / 0.025) ** 2,
              'sine',
              s,
              s + 0.025,
            );
          }
        }
        return out;
      };
      const a = cricket(4500, 0.05, 0.62);
      const b = cricket(4150, 0.33, 0.74);
      return [mix(Float32Array.from(a), b, 0.25), mix(b, a, 0.25)];
    },
  ),

  // ---- more Time & tension ----
  r(
    'countdown',
    'Countdown',
    'Time & tension',
    'Three beeps and a higher one: 3, 2, 1, go! A race or a quiz starts',
    3.8,
    (k) => {
      const out = k.buffer();
      for (const at of [0.02, 1.02, 2.02]) {
        k.tone(out, steady(880), held(0.18, 0.005), 'triangle', at, at + 0.2);
      }
      return [k.tone(out, steady(1760), held(0.7, 0.005), 'triangle', 3.02, 3.75)];
    },
  ),
  r(
    'stopwatch',
    'Stopwatch',
    'Time & tension',
    'Fast ticking: a time limit, hurry up, the clock is running out',
    2,
    (k) => {
      const out = k.buffer();
      for (let n = 0; n < 16; n++) {
        const at = 0.01 + n * 0.125;
        k.noise(out, steady(n % 2 ? 3000 : 4200), decay(0.004), 6, at, at + 0.04);
        k.tone(
          out,
          steady(n % 2 ? 2000 : 2500),
          (t) => 0.3 * decay(0.005)(t),
          'sine',
          at,
          at + 0.04,
        );
      }
      return [out];
    },
  ),
  r(
    'alarm-clock',
    'Alarm clock',
    'Time & tension',
    'An alarm clock ringing: waking up, a deadline, time is up',
    2.6,
    (k) => {
      const out = k.buffer();
      const bell = [
        [1, 1, 0.08],
        [2.4, 0.5, 0.05],
        [3.9, 0.3, 0.03],
      ] as const;
      for (const [from, to] of [
        [0.01, 0.7],
        [0.9, 1.6],
        [1.8, 2.45],
      ] as const) {
        for (let n = 0, at = from; at < to; n++, at += 1 / 24) {
          for (const [ratio, loud, half] of bell) {
            k.tone(
              out,
              steady((n % 2 ? 2350 : 2200) * ratio),
              (t) => loud * decay(half, 0.001)(t),
              'sine',
              at,
              at + 0.15,
            );
          }
        }
      }
      return [out];
    },
  ),
  r(
    'suspense-sting',
    'Dramatic sting',
    'Time & tension',
    'A sudden scary chord: a shock, a twist, a villain appears',
    3,
    (k) => {
      const dry = k.tone(k.buffer(), glide(90, 45, 0.3), (t) => 1.2 * decay(0.3, 0.003)(t));
      const chord = k.buffer();
      for (const hz of [65.4, 130.8, 155.6, 185, 246.9]) {
        for (const detune of [1, 1.006]) {
          k.tone(chord, steady(hz * detune), (t) => decay(0.8, 0.01)(t) * held(2.6, 0.2)(t), 'saw');
        }
      }
      mix(dry, k.filter(chord, glide(3500, 300, 1.5)), 1);
      return fadeOut(k, reverb(k, dry, 0.3, 2), 0.5);
    },
  ),
  r(
    'dun-dun-dun',
    'Dun dun dunnn',
    'Time & tension',
    'Three dramatic notes: a shocking reveal, “oh no!”, a plot twist',
    3,
    (k) => {
      const out = k.buffer();
      for (const [hz, at, length] of [
        [146.8, 0, 0.26],
        [174.6, 0.3, 0.26],
        [138.6, 0.6, 1.9],
      ] as const) {
        brass(k, out, steady(hz), at, length);
        brass(k, out, steady(hz / 2), at, length, 0.8);
      }
      k.tone(out, glide(100, 45, 0.3), (t) => 0.6 * decay(0.3, 0.003)(t), 'sine', 0.6);
      return fadeOut(k, reverb(k, out, 0.25, 1.8), 0.4);
    },
  ),
  r(
    'heartbeat-fast',
    'Fast heartbeat',
    'Time & tension',
    'A racing heart: panic, running, a scary moment',
    2.6,
    (k) => {
      const out = k.buffer();
      for (let at = 0.01; at < 2.3; at += 0.43) {
        k.tone(out, glide(75, 45, 0.08), (t) => decay(0.04, 0.008)(t), 'sine', at, at + 0.3);
        k.tone(
          out,
          glide(70, 45, 0.08),
          (t) => 0.7 * decay(0.04, 0.008)(t),
          'sine',
          at + 0.15,
          at + 0.42,
        );
      }
      return [out];
    },
  ),

  // ---- more Celebration ----
  r(
    'applause',
    'Applause',
    'Celebration',
    'A crowd clapping: a great answer, the end of a show, well done everyone',
    3.5,
    (k) => {
      const left = k.buffer();
      const right = k.buffer();
      const crowd = (t: number) => Math.min(1, t / 0.25) * (t < 2.3 ? 1 : 0.5 ** ((t - 2.3) / 0.3));
      // a thousand claps, each from somewhere in the crowd, over a soft rush of the rest
      for (const out of [left, right]) {
        k.noise(out, steady(1500), (t) => 0.2 * crowd(t), 0.7, 0, 3.5);
      }
      for (let n = 0; n < 1000; n++) {
        const at = k.between(0, 3.2);
        const gain = crowd(at) * k.between(0.3, 1);
        const hz = k.between(900, 2400);
        const angle = (k.between(0, 1) * Math.PI) / 2;
        for (const [out, side] of [
          [left, Math.cos(angle)],
          [right, Math.sin(angle)],
        ] as const) {
          k.noise(
            out,
            steady(hz),
            (t) => gain * side * decay(0.008, 0.0008)(t),
            1.2,
            at,
            at + 0.05,
          );
        }
      }
      return [left, right];
    },
  ),
  r(
    'fanfare',
    'Fanfare',
    'Celebration',
    'Trumpets: an announcement, a winner, the start of something grand',
    2.4,
    (k) => {
      const out = k.buffer();
      for (const [hz, at, length] of [
        [392, 0, 0.12],
        [392, 0.15, 0.12],
        [392, 0.3, 0.12],
        [523.3, 0.45, 1.5],
      ] as const) {
        const vibrato = (t: number) =>
          hz * (1 + (length > 1 ? 0.006 * Math.sin(TAU * 5 * t) * Math.min(1, t / 0.5) : 0));
        brass(k, out, vibrato, at, length);
        if (length > 1) {
          brass(k, out, steady(329.6), at, length, 0.6);
          brass(k, out, steady(392), at, length, 0.6);
        }
      }
      return fadeOut(k, reverb(k, out, 0.2, 1.5), 0.3);
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

// The effect registry (P6): every filter and transition the app offers. Adding an effect is one
// definition plus one line here — the inspector settings, preview, export and help follow.
import { EditError } from '../model/errors.ts';
import type { EffectInstance } from '../model/types.ts';
import { delay, echo } from './audio/echo.ts';
import { graphicEqualiser, highPassFilter, lowPassFilter } from './audio/filters.ts';
import { noiseReduction } from './audio/noise.ts';
import { pitch } from './audio/pitch.ts';
import { reverb } from './audio/reverb.ts';
import { speed } from './audio/speed.ts';
import { amplify, fadeIn, fadeOut, normalise } from './audio/volume.ts';
import { TRANSITION_LIST } from './transitions/transitions.ts';
import type { AudioEffectDef, Described, EffectDef, Params, TransitionDef } from './types.ts';
import { blur, invert, sharpen } from './video/blur.ts';
import { colour } from './video/colour.ts';
import { blackWhite, cyan, sepia } from './video/tones.ts';

export const EFFECTS: readonly EffectDef[] = [
  colour,
  blackWhite,
  sepia,
  cyan,
  blur,
  sharpen,
  invert,
];
export const TRANSITIONS: readonly TransitionDef[] = TRANSITION_LIST;
/** Audio mode's Effect menu (A3, A4, A7–A13), in menu order. */
export const AUDIO_EFFECTS: readonly AudioEffectDef[] = [
  amplify,
  normalise,
  fadeIn,
  fadeOut,
  speed,
  pitch,
  echo,
  delay,
  reverb,
  graphicEqualiser,
  highPassFilter,
  lowPassFilter,
  noiseReduction,
];

export const effectById = (id: string): EffectDef | undefined => EFFECTS.find((e) => e.id === id);
export const transitionById = (id: string): TransitionDef | undefined =>
  TRANSITIONS.find((t) => t.id === id);
export const audioEffectById = (id: string): AudioEffectDef | undefined =>
  AUDIO_EFFECTS.find((e) => e.id === id);

export function defaultParams(def: Pick<Described, 'params'>): Params {
  return Object.fromEntries(Object.entries(def.params).map(([k, p]) => [k, p.default]));
}

/** Checks every value against its limits, with a message the student understands. */
export function validateParams(def: Pick<Described, 'params'>, params: Params): void {
  for (const [key, spec] of Object.entries(def.params)) {
    const value = params[key];
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < spec.min ||
      value > spec.max
    ) {
      throw new EditError(`${spec.label} must be between ${spec.min} and ${spec.max}.`);
    }
  }
}

function requireEffect(id: string): EffectDef {
  const def = effectById(id);
  if (!def) throw new EditError('This effect is not available in this version of EasyMedia.');
  return def;
}

/** The FFmpeg filter chain for a list of effects ('' when none changes anything). */
export function filtersFor(effects: readonly EffectInstance[]): string {
  return effects
    .map((e) =>
      requireEffect(e.effectId).render({
        ...defaultParams(requireEffect(e.effectId)),
        ...e.params,
      }),
    )
    .filter((f) => f !== '')
    .join(',');
}

/** The CSS filter for the preview of a list of effects. */
export function previewFilter(effects: readonly EffectInstance[]): string {
  return effects
    .map((e) => {
      const def = effectById(e.effectId);
      return def ? def.preview({ ...defaultParams(def), ...e.params }) : '';
    })
    .filter(Boolean)
    .join(' ');
}

// What every effect and transition says about itself (P6). The registry drives the menus, the
// generated settings (P7), the preview, the export and the "Why use this?" help (T5).
import type { NoiseProfile } from '../audio/dsp/noise.ts';
import type { Channels } from '../audio/pcm.ts';

/** One number the student can set; the settings are generated from these. */
export interface ParamSpec {
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** A checkbox: the value is 1 (ticked) or 0. */
  toggle?: boolean;
  /** A drop-down: the value is the position of the chosen item (min 0, max length − 1). */
  choices?: readonly string[];
  /** One band of a graphic EQ: shown as a vertical slider beside the other bands. */
  band?: boolean;
}

export type Params = Record<string, number>;

export interface Described {
  id: string;
  label: string;
  /** The syllabus point it teaches, e.g. "11.1 filters". */
  syllabus: string;
  /** Why it is used, in the syllabus's words (T5). */
  why: string;
  params: Record<string, ParamSpec>;
}

/** A filter on a clip, picture or title (V15). */
export interface EffectDef extends Described {
  /** FFmpeg filter(s) for the export; '' when the settings change nothing. */
  render(params: Params): string;
  /** CSS filter for the live preview (approximate preview, ARCHITECTURE §7.3). */
  preview(params: Params): string;
}

/** A transition between two clips (V9), made with FFmpeg's xfade. */
export interface TransitionDef extends Described {
  xfade: string;
}

/** Where an audio effect sits in the Effect menu (screen 13). */
export type AudioEffectGroup =
  'Volume' | 'Time & pitch' | 'Space' | 'Frequency' | 'Repair & channels';

/** What an effect may need besides the selected sound. */
export interface EffectContext {
  /** A13: measured in step 1 (Get noise profile), used in step 2. */
  noiseProfile?: NoiseProfile | null;
}

/** An effect on the selected sound in Audio mode (Audacity model, ARCHITECTURE §7.5). */
export interface AudioEffectDef extends Described {
  group: AudioEffectGroup;
  /** Two steps (as Audacity's Noise Reduction): a noise profile must be taken first. */
  needsNoiseProfile?: boolean;
  /** The new samples of the selection; may be a different length (Change speed). */
  process(channels: Channels, rate: number, params: Params, context?: EffectContext): Channels;
  /** Settings worked out from the selected sound, e.g. Amplify's largest gain without clipping. */
  suggest?(channels: Channels, params: Params): Params;
  /** Throws an EditError when these settings cannot be used on this sound. */
  check?(channels: Channels, params: Params): void;
  /** A warning or fact shown under the settings (clipping, the new length), or null. */
  note?(channels: Channels, rate: number, params: Params): string | null;
  /** Keeps settings that say the same thing in step (speed multiplier ↔ percent change). */
  link?(params: Params, changed: string): Params;
  /** A19: the output level (dB) for each steady input level (dB), drawn as a curve. */
  curve?(params: Params): (inputDb: number) => number;
  /** A19: the levels (dB) of the selection's blocks after the effect, for a before / after picture. */
  shape?(params: Params, levelsDb: readonly number[]): number[];
}

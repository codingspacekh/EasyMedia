// What every effect and transition says about itself (P6). The registry drives the menus, the
// generated settings (P7), the preview, the export and the "Why use this?" help (T5).

/** One number the student can set; the settings are generated from these. */
export interface ParamSpec {
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export type Params = Record<string, number>;

interface Described {
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

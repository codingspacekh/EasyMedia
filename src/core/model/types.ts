// Project data model (ARCHITECTURE §5). Plain, immutable, JSON-serialisable data.
import type { Seconds } from './time.ts';

export type Id = string;

export interface ProjectSettings {
  aspect: '16:9' | '4:3' | 'custom';
  width: number;
  height: number;
  fps: 24 | 25 | 30;
  /** Colour of the bars when a clip has a different shape (letterbox). */
  background: string;
  /** How a clip of a different shape fills the frame (V1). Missing in M1 files = 'letterbox'. */
  fit?: 'letterbox' | 'crop' | 'stretch';
}

export interface MediaAsset {
  id: Id;
  kind: 'video' | 'image' | 'audio';
  /** Relative to the project file, with "/" separators (X1). */
  path: string;
  /** Length of the source; absent for still images. */
  duration?: Seconds;
  /** Whether the file has a sound track, from the probe at import. Missing = treated as no sound. */
  hasAudio?: boolean;
}

/** One filter from the effect registry with its settings (V15). */
export interface EffectInstance {
  effectId: string;
  params: Record<string, number>;
}

/** A video clip plays the source from `in` to `out` at `speed`. */
export interface VideoClip {
  type: 'video';
  id: Id;
  assetId: Id;
  in: Seconds;
  out: Seconds;
  speed: number;
  muted: boolean;
  volume: number;
}

export interface ImageClip {
  type: 'image';
  id: Id;
  assetId: Id;
  duration: Seconds;
}

export type TextPosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'centre'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export interface TextStyle {
  font: string;
  size: number;
  colour: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'centre' | 'right';
  position: TextPosition;
  /** Readability (V6). */
  shadow?: boolean;
  outline?: boolean;
  /** A dark box behind the text. */
  box?: boolean;
}

/** How text arrives on screen (Book B: "an appropriate animation effect"). Lasts 1 s. */
export type Entrance = 'none' | 'fly-left' | 'fly-right' | 'fly-up' | 'fly-down';

/** Fades and entrance shared by title slides and text items (V7 for text). */
export interface TextEffects {
  fadeIn?: Seconds;
  fadeOut?: Seconds;
  entrance?: Entrance;
}

export type TitleBackground =
  | { kind: 'colour'; colour: string }
  | { kind: 'image'; assetId: Id }
  | { kind: 'video'; assetId: Id };

/** A text-based slide on the main track (V4). */
export interface TitleSlide extends TextEffects {
  type: 'title';
  id: Id;
  text: string;
  duration: Seconds;
  background: TitleBackground;
  style: TextStyle;
}

export type MainItem = VideoClip | ImageClip | TitleSlide;

/** Captions, subtitles and credits sit on the text track at an absolute time (V4, V5). */
export interface TextItem extends TextEffects {
  kind: 'caption' | 'subtitle' | 'credits';
  id: Id;
  text: string;
  start: Seconds;
  duration: Seconds;
  style: TextStyle;
  /** Credits scroll up from the bottom (V5). */
  scroll?: boolean;
}

export interface AudioItem {
  id: Id;
  assetId: Id;
  start: Seconds;
  in: Seconds;
  out: Seconds;
  volume: number;
  fadeIn: Seconds;
  fadeOut: Seconds;
}

export interface Project {
  schemaVersion: 1;
  name: string;
  settings: ProjectSettings;
  media: MediaAsset[];
  timeline: {
    /** Magnetic: items play one after another with no gaps. */
    main: MainItem[];
    text: TextItem[];
    /** Track 0 = music, track 1 = voiceover. */
    audio: [AudioItem[], AudioItem[]];
  };
}

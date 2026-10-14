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
}

export interface MediaAsset {
  id: Id;
  kind: 'video' | 'image' | 'audio';
  /** Relative to the project file, with "/" separators (X1). */
  path: string;
  /** Length of the source; absent for still images. */
  duration?: Seconds;
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
}

export type TitleBackground =
  | { kind: 'colour'; colour: string }
  | { kind: 'image'; assetId: Id }
  | { kind: 'video'; assetId: Id };

/** A text-based slide on the main track (V4). */
export interface TitleSlide {
  type: 'title';
  id: Id;
  text: string;
  duration: Seconds;
  background: TitleBackground;
  style: TextStyle;
}

export type MainItem = VideoClip | ImageClip | TitleSlide;

/** Captions, subtitles and credits sit on the text track at an absolute time (V4, V5). */
export interface TextItem {
  kind: 'caption' | 'subtitle' | 'credits';
  id: Id;
  text: string;
  start: Seconds;
  duration: Seconds;
  style: TextStyle;
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

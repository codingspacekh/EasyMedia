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
  /** X8: a built-in sound effect's id; the app makes the file again if it is missing. */
  soundEffect?: string;
}

/** One filter from the effect registry with its settings (V15). */
export interface EffectInstance {
  effectId: string;
  params: Record<string, number>;
}

/** V7: the whole picture fades in from / out to a colour. */
export interface ClipFade {
  in: Seconds;
  out: Seconds;
  colour: 'black' | 'white';
}

/** One frame of a pan & zoom: how far in, and where the centre of the view is (0–1 across / down). */
export interface PanZoomFrame {
  zoom: number;
  x: number;
  y: number;
}

/** V8: the view moves from one frame to another, between `start` and `end` seconds of the item. */
export interface PanZoom {
  from: PanZoomFrame;
  to: PanZoomFrame;
  /** Default 0 (the start of the item). */
  start?: Seconds;
  /** Default: the end of the item. */
  end?: Seconds;
  /** The preset it was made from, shown in the inspector. */
  preset?: string;
}

/** V9: how this item takes over from the one before it; the two overlap for `duration`. */
export interface Transition {
  effectId: string;
  duration: Seconds;
}

/** How a clip, picture or title slide looks (V7, V8, V9, V15). */
export interface ClipLook {
  fade?: ClipFade;
  /** Filters from the effect registry, applied in order. */
  effects?: EffectInstance[];
  panZoom?: PanZoom;
  transitionIn?: Transition;
}

/**
 * V19: a video clip or picture turned and flipped, e.g. phone footage filmed sideways. The turn
 * comes first, then the flips (across the screen as it is seen). Absent = as filmed, so a
 * project without turns still opens in versions before 1.5.
 */
export interface ClipTurn {
  /** Degrees clockwise. */
  turn?: 90 | 180 | 270;
  /** Mirrored left to right. */
  flipH?: boolean;
  /** Mirrored top to bottom. */
  flipV?: boolean;
}

/** A video clip plays the source from `in` to `out` at `speed`. */
export interface VideoClip extends ClipLook, ClipTurn {
  type: 'video';
  id: Id;
  assetId: Id;
  in: Seconds;
  out: Seconds;
  speed: number;
  muted: boolean;
  volume: number;
}

export interface ImageClip extends ClipLook, ClipTurn {
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
  /** The outline's colour (default black). */
  outlineColour?: string;
  /** The box's colour (default see-through black). */
  boxColour?: string;
  /** The words light up the space around them (in `accent`, or their own colour). */
  glow?: boolean;
  /** The colour runs from `colour` at the top of each line to `accent` at the bottom. */
  gradient?: boolean;
  /** 3D: the words stand out, with sides in `accent` (default dark grey). */
  depth?: boolean;
  /** The second colour, for glow, gradient and 3D. */
  accent?: string;
}

/** How text arrives on screen (Book B: "an appropriate animation effect"). Lasts 1 s. */
export type Entrance =
  | 'none'
  | 'fly-left'
  | 'fly-right'
  | 'fly-up'
  | 'fly-down'
  | 'rise'
  | 'drop'
  | 'zoom'
  | 'pop'
  | 'slam'
  | 'type-on'
  | 'spin'
  | 'whip';

/** How text leaves the screen, in its last second. */
export type Exit =
  | 'none'
  | 'fly-left'
  | 'fly-right'
  | 'fly-up'
  | 'fly-down'
  | 'sink'
  | 'zoom'
  | 'pop'
  | 'spin'
  | 'whip';

/** Fades, entrance and exit shared by title slides and text items (V7 for text). */
export interface TextEffects {
  fadeIn?: Seconds;
  fadeOut?: Seconds;
  entrance?: Entrance;
  exit?: Exit;
}

export type TitleBackground =
  | { kind: 'colour'; colour: string }
  | { kind: 'image'; assetId: Id }
  | { kind: 'video'; assetId: Id };

/** A text-based slide on the main track (V4). */
export interface TitleSlide extends TextEffects, ClipLook {
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

/** A sound file on the music or voiceover track: plays the source from `in` to `out` from `start` (V13). */
export interface AudioItem {
  id: Id;
  assetId: Id;
  start: Seconds;
  in: Seconds;
  out: Seconds;
  volume: number;
  fadeIn: Seconds;
  fadeOut: Seconds;
  /** Music only: 6 dB quieter while the voiceover plays. */
  duck?: boolean;
  /** 0.25–4, pitch kept; missing = 1 (V13 like V14). */
  speed?: number;
  /** V13: quieter or louder between two times; absent (not saved) when there are none. */
  volumeChanges?: VolumeChange[];
}

/**
 * V13: the sound plays at `volume` from `from` to `to`, timeline time (the times a task gives).
 * It glides there over `ramp` seconds before `from` and back over `ramp` after `to`, so it never
 * clicks. The volume replaces the item's own volume meanwhile (0.3 = 30 %).
 */
export interface VolumeChange {
  from: Seconds;
  to: Seconds;
  volume: number;
  /** Absent: 0.25 s. */
  ramp?: Seconds;
}

/** V20: where a picture or video over the video goes and how big it is (as V18 and text). */
export interface OverlayPlacement {
  /** One of the nine places, as for text. */
  position: TextPosition;
  /** Its width as a part of the frame's width, 1–100 %; it keeps its shape. */
  widthPercent: number;
  /** Pixels (of the project's frame) between it and the edges it is placed against. */
  margin: number;
}

interface OverlayBase extends OverlayPlacement {
  id: Id;
  assetId: Id;
  /** When it appears (timeline time). */
  start: Seconds;
  /** 1 = solid, 0.5 = half see-through. */
  opacity: number;
  /** Absent: no fade. */
  fadeIn?: Seconds;
  fadeOut?: Seconds;
}

/** V20: a picture over the video, e.g. a logo in a corner. */
export interface OverlayPicture extends OverlayBase {
  type: 'image';
  duration: Seconds;
}

/** V20: a video over the video (picture-in-picture), playing the source from `in` to `out`. */
export interface OverlayVideo extends OverlayBase {
  type: 'video';
  in: Seconds;
  out: Seconds;
  /** Its own sound: off unless the student turns it on. */
  muted: boolean;
  volume: number;
}

export type OverlayItem = OverlayPicture | OverlayVideo;

/** Video mode's audio tracks: music, voiceover and, when used, two sound effects tracks. */
export type AudioTracks = [AudioItem[], AudioItem[], ...AudioItem[][]];
export type AudioTrackIndex = 0 | 1 | 2 | 3;

export interface Project {
  schemaVersion: 2;
  name: string;
  settings: ProjectSettings;
  media: MediaAsset[];
  timeline: {
    /** Magnetic: items play one after another with no gaps. */
    main: MainItem[];
    text: TextItem[];
    /**
     * Track 0 = music, 1 = voiceover, 2 and 3 = sound effects (V13). The effects tracks are left
     * out while empty, so a project without effects opens in versions before 1.5.
     */
    audio: AudioTracks;
    /**
     * V20: pictures and videos over the video, one after another. Left out while empty, so a
     * project without them opens in versions before 1.5.
     */
    overlay?: OverlayItem[];
  };
  /** Audio mode's work, saved with the project (P1); absent when there is none. */
  audioMode?: AudioModeSession;
}

/** P1 for Audio mode: its tracks and their clips; the sound is in exact 32-bit WAV files. */
export interface AudioModeSession {
  /** The project rate: every track's sample rate. */
  rate: number;
  tracks: SavedAudioTrack[];
}

export interface SavedAudioTrack {
  id: Id;
  name: string;
  /** 1 = mono, 2 = stereo (absent in files of version 1: taken from the sound). */
  channels?: number;
  clips: SavedAudioClip[];
  gain: number;
  pan: number;
  bits?: number;
}

export interface SavedAudioClip {
  id: Id;
  /** The WAV file with the clip's samples (relative to the project file on disk, X1). */
  file: string;
  offset: number;
  /** The heard samples [in, out) of the file; absent: all of them. */
  in?: number;
  out?: number;
}

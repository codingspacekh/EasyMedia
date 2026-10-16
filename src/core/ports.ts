// Ports (ARCHITECTURE §8): what the core and app need from the outside world.
// Interfaces only. Adapters implement them: Node/FFmpeg in src/main, a fake in src/adapters/mock.
import type { Seconds } from './model/time.ts';
import type { Project, TextStyle } from './model/types.ts';
import type { TextImage } from './render/compile.ts';
import type { Container, ExportSettings } from './render/formats.ts';
import type { AudioExportSettings, AudioFormat } from './render/audio-formats.ts';
import type { Size, TextImageMode } from './text/draw.ts';
import type { ResizeCrop } from './image/crop.ts';

/** What a media file contains (T1 shows this to students). */
export interface ProbeInfo {
  kind: 'video' | 'image' | 'audio';
  /** Friendly container / file type: mp4, mov, avi, wmv, jpg, png, mp3, wav, m4a… */
  container: string;
  /** Absent for still images. */
  duration?: Seconds;
  sizeBytes: number;
  /** Overall bit rate in bits per second. */
  bitRate?: number;
  video?: { codec: string; width: number; height: number; fps?: number };
  audio?: {
    codec: string;
    sampleRate: number;
    channels: number;
    bitDepth?: number;
    bitRate?: number;
  };
}

export interface JobHandle {
  id: string;
  /** Resolves when the job has finished; rejects with JobCancelledError or MediaError. */
  done: Promise<void>;
  cancel(): void;
}

export type JobEvent =
  | { type: 'queued' | 'started' | 'done' | 'cancelled'; jobId: string; label: string }
  | { type: 'progress'; jobId: string; label: string; ratio: number }
  | { type: 'error'; jobId: string; label: string; message: string };

export interface RenderVideoOptions {
  projectDir: string;
  /** Container, codecs, size and quality (V16, V17); default: the project as a high-quality MP4. */
  format?: ExportSettings;
  /** The pictures of the project's text, by title / text item id (see TextRenderer). */
  textImages?: Record<string, TextImage>;
}

/** A1: a sound decoded for editing — one array of samples (−1…1) per channel. */
export interface DecodedAudio {
  sampleRate: number;
  channels: Float32Array[];
  /** Sample resolution of the file, when it has one (WAV, FLAC). */
  bits?: number;
}

export interface MediaEngine {
  probe(path: string): Promise<ProbeInfo>;
  /** 360 px tall preview copy used for smooth playback (ARCHITECTURE §10.2). `duration` is the source length. */
  makeProxy(input: string, output: string, duration: Seconds): JobHandle;
  /** One image strip of `count` thumbnails side by side, each `height` px tall. */
  makeThumbnails(
    input: string,
    output: string,
    options: { count: number; height: number; duration: Seconds },
  ): JobHandle;
  /** Loudness peaks (0–1) of the sound, in `buckets` equal slices, for drawing waveforms. */
  waveformPeaks(input: string, buckets: number): Promise<number[]>;
  /** Saves one frame as an image; the format follows the output's extension (V10). */
  extractFrame(input: string, time: Seconds, output: string): Promise<void>;
  /**
   * V11: saves a resized and cropped copy beside the picture, as the first free numbered name
   * (Fish_Eagle.jpg → Fish_Eagle1.jpg, then Fish_Eagle2.jpg…). Never overwrites. Resolves with its path.
   */
  resizeCropImage(input: string, plan: ResizeCrop): Promise<string>;
  /** Exports the project in the chosen format (V16, V17). Media paths are resolved against `projectDir` (X1). */
  renderVideo(project: Project, output: string, options: RenderVideoOptions): JobHandle;
  /**
   * V10: one frame of the project as it will be exported (with its looks), saved as a picture.
   * The format follows the output's extension: png, jpg, bmp or tiff. The folder is created if
   * needed; an existing file is never overwritten (Snapshot.png → Snapshot2.png). Resolves with
   * the path actually written.
   */
  renderFrame(
    project: Project,
    time: Seconds,
    output: string,
    options: RenderVideoOptions,
  ): Promise<string>;
  /**
   * A1: the sound of an audio or video file as samples, mono or stereo (more channels are mixed
   * to stereo), at the file's own sample rate or at `sampleRate`.
   */
  decodeAudio(path: string, sampleRate?: number): Promise<DecodedAudio>;
  /** A16, A17: saves samples as an audio file in the chosen format, in the background. */
  encodeAudio(
    audio: { sampleRate: number; channels: readonly Float32Array[] },
    output: string,
    settings: AudioExportSettings,
  ): JobHandle;
  onJobEvent(listener: (event: JobEvent) => void): () => void;
}

/** Native file dialogs (P1). `null` / `[]` means the student cancelled. */
export interface Dialogs {
  openMedia(): Promise<string[]>;
  openProject(): Promise<string | null>;
  saveProject(suggestedName: string): Promise<string | null>;
  /** Where to save the exported video; the file type follows the chosen container (V16). */
  exportVideo(suggestedName: string, container: Container): Promise<string | null>;
  /** Where to save exported sound; the file type follows the chosen format (A17). */
  exportAudio(suggestedName: string, format: AudioFormat): Promise<string | null>;
  /** A yes / no question, e.g. "Discard unsaved changes?". */
  confirm(message: string): Promise<boolean>;
  /** A folder (it can be created in the dialog), e.g. to package a project into. */
  chooseFolder(title: string): Promise<string | null>;
}

/** Reading and writing project (.mve) files. Writes are atomic. */
export interface ProjectFiles {
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  remove(path: string): Promise<void>;
  /** Copies a media file (P2). Only files the app has opened may be copied. */
  copy(from: string, to: string): Promise<void>;
  /** Saves a PNG in the app's own folder (not the student's) and returns its path. */
  saveImage(name: string, png: Uint8Array): Promise<string>;
}

/** Draws text as a transparent PNG with the bundled fonts (ARCHITECTURE §7.3). */
export interface TextRenderer {
  draw(text: string, style: TextStyle, frame: Size, mode: TextImageMode): Promise<RenderedText>;
}

export interface RenderedText {
  png: Uint8Array;
  width: number;
  height: number;
}

export interface AppPaths {
  /** Folder for preview proxies. */
  proxies: string;
  /** Where unsaved work is autosaved (P3). */
  recovery: string;
  /** Snapshots of a project that has not been saved yet (V10). */
  snapshots: string;
}

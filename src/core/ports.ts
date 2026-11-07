// Ports (ARCHITECTURE §8): what the core and app need from the outside world.
// Interfaces only. Adapters implement them: Node/FFmpeg in src/main, a fake in src/adapters/mock.
import type { Seconds } from './model/time.ts';
import type { Project, TextStyle } from './model/types.ts';
import type { AnimationDoc } from './animation/types.ts';
import type { Pixels } from './animation/trace.ts';
import type { SoundPiece } from './animation/sound.ts';
import type { TextImage } from './render/compile.ts';
import type { Container, ExportSettings } from './render/formats.ts';
import type { AudioExportSettings, AudioFormat } from './render/audio-formats.ts';
import type { Size, TextImageMode } from './text/draw.ts';
import type { CombinePlan } from './image/combine.ts';
import type { UpdateState } from './updates.ts';
import type { ResizeCrop } from './image/crop.ts';
import type { ColourKey } from './image/colour-key.ts';

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
  video?: {
    codec: string;
    width: number;
    height: number;
    fps?: number;
    /** The video stream's own bit rate in bits per second (T1). */
    bitRate?: number;
    /** The shape it is shown at, when the file says so, e.g. "16:9" for a 720 × 576 DVD (T1). */
    displayAspect?: string;
  };
  audio?: {
    codec: string;
    sampleRate: number;
    channels: number;
    bitDepth?: number;
    bitRate?: number;
  };
  /** AN17: an animated GIF or web page that plays again and again (true) or once (false). */
  loop?: boolean;
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

/**
 * Decoded sound written to a temporary file of 32-bit float samples side by side (L R L R…),
 * so the samples can go straight to the page without passing through the main process memory.
 */
export interface DecodedAudioFile {
  sampleRate: number;
  /** Number of channels: 1 or 2. */
  count: number;
  bits?: number;
  raw: string;
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
   * V11: saves a resized and cropped copy beside the picture, named `name` if given (taken: name2,
   * name3…), else the first free numbered name (Fish_Eagle.jpg → Fish_Eagle1.jpg, then
   * Fish_Eagle2.jpg…). Never overwrites. Resolves with its path (core/project/paths madePicturePath).
   */
  resizeCropImage(input: string, plan: ResizeCrop, name?: string): Promise<string>;
  /**
   * V18: saves `base` with `top` placed on it, beside `base`, named as resizeCropImage does
   * (credits.png → credits1.png). Never overwrites. Resolves with its path.
   */
  combineImages(base: string, top: string, plan: CombinePlan, name?: string): Promise<string>;
  /**
   * AN5 Make a colour see-through: saves a PNG of the picture with the colour (and the colours
   * near it) see-through, beside it, named as resizeCropImage does but ending .png (pearl.jpg →
   * pearl1.png). Never overwrites. Resolves with its path.
   */
  colourKeyImage(input: string, key: ColourKey, name?: string): Promise<string>;
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
  /** Like decodeAudio, but leaves the samples in a temporary file (see DecodedAudioFile). */
  decodeAudioToFile(path: string, sampleRate?: number): Promise<DecodedAudioFile>;
  /** Deletes a file made by decodeAudioToFile. */
  releaseDecoded(raw: string): Promise<void>;
  /** A16, A17: saves samples as an audio file in the chosen format, in the background. */
  encodeAudio(
    audio: { sampleRate: number; channels: readonly Float32Array[] },
    output: string,
    settings: AudioExportSettings,
  ): JobHandle;
  /**
   * AN15: makes an MP4, AVI, MOV or animated GIF from a folder of PNG frames (frame-00000.png
   * onwards, drawn by the app), with the animation's sounds in a video (AN28). The frames are
   * removed when the job ends, however it ends.
   */
  encodeFrames(folder: string, output: string, options: EncodeFramesOptions): JobHandle;
  onJobEvent(listener: (event: JobEvent) => void): () => void;
}

/** AN15: how the frames become a file; an odd width or height is padded to even for a video. */
export interface EncodeFramesOptions {
  format: 'mp4' | 'avi' | 'mov' | 'gif';
  fps: number;
  frames: number;
  width: number;
  height: number;
  /** AN8: a GIF that plays once and stops on its last frame. Absent: it loops for ever. */
  once?: boolean;
  /** AN28: the sounds mixed into a video, each placed in its time (none: a silent video). */
  sounds?: SoundPiece[];
}

/**
 * A18 + N4: where Audio mode keeps the samples of its undo steps — on disk, as Audacity, so
 * memory does not grow with the history (IndexedDB in the app).
 */
export interface UndoStore {
  save(channels: readonly Float32Array[]): Promise<string>;
  load(key: string): Promise<Float32Array[]>;
  /** Deletes every step except `keep` (steps that can no longer be undone or redone). */
  keepOnly(keep: readonly string[]): Promise<void>;
}

/** A14: a microphone the student can choose. */
export interface Microphone {
  id: string;
  label: string;
}

/** A14: an open microphone. Its sound keeps arriving in blocks until it is closed. */
export interface MicrophoneInput {
  readonly sampleRate: number;
  /** The microphone's name, e.g. "Headset Microphone (USB)". */
  readonly label: string;
  close(): void;
}

/**
 * A14 + X4: the microphone (MediaStream in the app). Opening it asks the system for permission
 * first; when it cannot be used it throws a MicrophoneError the student can act on.
 */
export interface Recorder {
  microphones(): Promise<Microphone[]>;
  /** `null`: the system's default microphone. Every block of mono samples goes to `onBlock`. */
  open(
    microphoneId: string | null,
    onBlock: (samples: Float32Array) => void,
  ): Promise<MicrophoneInput>;
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
  /** P7: closing with unsaved work — Save, Don't save, or Cancel (keep working). */
  unsavedChanges(): Promise<'save' | 'discard' | 'cancel'>;
  /** T6: a task check file (.mvetask) to open. */
  openTaskCheck(): Promise<string | null>;
  /**
   * T6: the exported file to check — a video, sound, GIF or web page — or every picture of a PNG
   * sequence (AN17); [] when cancelled.
   */
  openExport(): Promise<string[]>;
  /** T6: where to save a task check for the students. */
  saveTaskCheck(suggestedName: string): Promise<string | null>;
  /** AN16: an animation (.mvea) to open. */
  openAnimation(): Promise<string | null>;
  /** AN5: a picture for the stage (PNG, JPG, GIF, BMP or SVG). */
  openPicture(): Promise<string | null>;
  /** AN28: a sound for the animation (MP3, WAV, M4A, AAC, OGG or FLAC). */
  openSound(): Promise<string | null>;
  /** AN14: *Import frames…* — a folder of pictures for a stop motion; the pictures in it ([] if none). */
  openFrames(): Promise<string[]>;
  /** AN16: where to save an animation. */
  saveAnimation(suggestedName: string): Promise<string | null>;
  /** AN15: where to save an exported animation; the file type follows the format. */
  exportAnimation(suggestedName: string, format: AnimationExportFormat): Promise<string | null>;
  /** G1 (M18): a Graphics mode image (.mveg) to open. */
  openGraphic(): Promise<string | null>;
  /** G1 (M18): where to save an image. */
  saveGraphic(suggestedName: string): Promise<string | null>;
  /** G11 (M18): where to save an exported image; the file type follows the format. */
  exportGraphic(suggestedName: string, format: GraphicExportFormat): Promise<string | null>;
}

/** G11 (M18): the formats an image is exported in (BMP, GIF, TIFF and PDF come in M23). */
export type GraphicExportFormat = 'png' | 'jpg' | 'svg';

/** AN15: the animation export formats (M13: a picture of the stage; M14: mp4, gif, a PNG sequence; M16 html). */
export type AnimationExportFormat =
  'png' | 'mp4' | 'avi' | 'mov' | 'gif' | 'png-sequence' | 'html' | 'svg';

/** Reading and writing project (.mve) files. Writes are atomic. */
export interface ProjectFiles {
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  remove(path: string): Promise<void>;
  /** Copies a media file (P2). Only files the app has opened may be copied. */
  copy(from: string, to: string): Promise<void>;
  /** Saves a PNG in the app's own folder (not the student's) and returns its path. */
  saveImage(name: string, png: Uint8Array): Promise<string>;
  /** X8: saves a built-in sound effect's WAV in the app's own folder and returns its path. */
  saveSound(name: string, wav: Uint8Array): Promise<string>;
  /** Writes a file the student named (an exported picture, AN15). */
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
}

/**
 * AN15: what an HTML web animation carries inside it, so it plays without the internet. The page
 * cannot read files itself (ARCHITECTURE §2): the main process reads them.
 */
export interface PageAssets {
  /** The player's script (core/animation/player.ts and draw.ts, bundled at build time). */
  playerScript(): Promise<string>;
  /** A picture the app has opened, as a data: URL. */
  pictureDataUrl(path: string): Promise<string>;
  /** AN28: a sound file the app has opened (or a sound effect it made), as a data: URL. */
  soundDataUrl(path: string): Promise<string>;
  /** A bundled font file, by its name in resources/fonts (e.g. "Inter.ttf"), as a data: URL. */
  fontDataUrl(file: string): Promise<string>;
  /**
   * AN18: Test — shows a web page in a window of its own, sized for the stage, where it plays and
   * its buttons work, as the exported file will in a browser.
   */
  openTest(html: string, title: string, width: number, height: number): Promise<void>;
}

/** AN15: draws an animation's stage at a frame as a picture (an OffscreenCanvas in the app). */
export interface StageRenderer {
  /** AN15: drawn at the stage's size, or scaled to `size` (another width, in proportion). */
  renderPng(
    doc: AnimationDoc,
    frame?: number,
    size?: { width: number; height: number },
  ): Promise<Uint8Array>;
  /**
   * AN22: for each canvas font ('700 48px "Inter"'), how far below the top the stage draws text
   * from its alphabetic baseline sits, in em, keyed without the size ('700 "Inter"'). An SVG puts
   * its words on that baseline, so they sit where the stage shows them in every font.
   */
  textTops(fonts: string[]): Promise<Record<string, number>>;
  /**
   * AN26: how wide words are in a canvas font ('700 48px "Inter"'), in px, as the stage measures
   * them, once the fonts are loaded. An SVG places curved text's letters with it, where the stage
   * puts them.
   */
  textWidths(fonts: string[]): Promise<(font: string, text: string) => number>;
  /**
   * G11 (M18): the stage as a JPEG: see-through parts on `background` (a JPEG has no
   * transparency), at `quality` 1–100, at the stage's size or `size`.
   */
  renderJpeg(
    doc: AnimationDoc,
    options: { quality: number; background: string; size?: { width: number; height: number } },
  ): Promise<Uint8Array>;
  /** AN5: a picture's pixels, scaled down to at most `maxSide` px on its longer side. */
  pixels(path: string, maxSide: number): Promise<Pixels>;
}

/** Draws text as a transparent PNG with the bundled fonts (ARCHITECTURE §7.3). */
export interface TextRenderer {
  draw(text: string, style: TextStyle, frame: Size, mode: TextImageMode): Promise<RenderedText>;
}

export interface RenderedText {
  png: Uint8Array;
  width: number;
  height: number;
  /** For a frame image: the middle of the words (zoom entrances and exits grow around it). */
  anchor?: { x: number; y: number };
  /** For a frame image: the words' box (spinning words are cut out, typing on runs across it). */
  box?: { x: number; y: number; width: number; height: number };
}

export interface AppPaths {
  /** Folder for preview proxies. */
  proxies: string;
  /** Where unsaved work is autosaved (P3). */
  recovery: string;
  /** Snapshots of a project that has not been saved yet (V10). */
  snapshots: string;
  /** Learn mode's compression comparison files (T3), replaced each time. */
  learn: string;
  /** X7: the app's own small settings (the Welcome was seen); none: no Welcome. */
  preferences?: string;
  /** README §17: THIRD_PARTY_LICENSES.txt, for Help ▸ Licences. */
  licences?: string;
  /** Where unsaved animation work is autosaved (P3, AN16); default: beside `recovery`. */
  animationRecovery?: string;
  /** Where an unsaved Graphics mode image is autosaved (P3, M18); default: beside `recovery`. */
  graphicRecovery?: string;
  /** AN15: the frames of an animation export wait here for FFmpeg; default: in `proxies`. */
  animationFrames?: string;
}

/**
 * M17a U1–U5: the main process's updates (electron-updater). Every request answers with the
 * state as it is then; `onState` hears each change (progress, a version found…).
 */
export interface UpdatesPort {
  get(): Promise<UpdateState>;
  check(): Promise<UpdateState>;
  download(): Promise<UpdateState>;
  install(): Promise<UpdateState>;
  setAuto(on: boolean): Promise<UpdateState>;
  seen(): Promise<UpdateState>;
  showDmg(): Promise<UpdateState>;
  openDmg(): Promise<UpdateState>;
  onState(listener: (state: UpdateState) => void): () => void;
}

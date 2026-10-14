// Ports (ARCHITECTURE §8): what the core and app need from the outside world.
// Interfaces only. Adapters implement them: Node/FFmpeg in src/main, a fake in src/adapters/mock.
import type { Seconds } from './model/time.ts';
import type { Project } from './model/types.ts';
import type { Quality } from './render/compile.ts';

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
  /** Exports the project as an MP4 (V16). Media paths are resolved against `projectDir` (X1). */
  renderVideo(
    project: Project,
    output: string,
    options: { projectDir: string; quality?: Quality },
  ): JobHandle;
  onJobEvent(listener: (event: JobEvent) => void): () => void;
}

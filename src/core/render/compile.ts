// Render compiler (P8, ARCHITECTURE §7.4): project → FFmpeg arguments. Pure: no files, no
// processes. The job queue adds progress flags and the output path.
import { EditError } from '../model/errors.ts';
import type { Seconds } from '../model/time.ts';
import { itemDuration, mainTrackDuration } from '../model/timeline.ts';
import type { MainItem, MediaAsset, Project, ProjectSettings } from '../model/types.ts';
import { atempoChain, fitFilter, num } from './filters.ts';

export type Quality = 'high' | 'medium' | 'low';

export interface RenderOptions {
  /** Absolute path of a media file (the caller resolves project-relative paths). */
  mediaPath(asset: MediaAsset): string;
  /** libx264 (default) or a detected hardware encoder. */
  videoEncoder?: string;
  quality?: Quality;
}

export interface RenderPlan {
  /** FFmpeg inputs, filter graph and output options; no output path. */
  args: string[];
  duration: Seconds;
  /** False when no clip contributes sound: the file then has no audio stream. */
  hasAudio: boolean;
}

const CRF: Record<Quality, string> = { high: '18', medium: '23', low: '28' };
const BITS_PER_PIXEL: Record<Quality, number> = { high: 0.1, medium: 0.06, low: 0.035 };
const AUDIO_RATE: Record<Quality, string> = { high: '192k', medium: '160k', low: '128k' };
const SILENCE = 'anullsrc=r=48000:cl=stereo';
const AUDIO_FORMAT = 'aformat=sample_rates=48000:channel_layouts=stereo';

export function compileProject(project: Project, options: RenderOptions): RenderPlan {
  assertExportable(project);
  const { settings } = project;
  const assetOf = (id: string) => {
    const asset = project.media.find((m) => m.id === id);
    if (!asset)
      throw new EditError(
        'A clip on the timeline uses a file that could not be found in this project.',
      );
    return asset;
  };
  const soundOf = (item: MainItem) =>
    item.type === 'video' && !item.muted && assetOf(item.assetId).hasAudio === true;
  const hasAudio = project.timeline.main.some(soundOf);

  const inputs: string[] = [];
  const filters: string[] = [];
  let inputIndex = 0;

  project.timeline.main.forEach((item, i) => {
    const d = num(itemDuration(item));
    const audioOut = `[a${i}]`;
    if (item.type === 'video') {
      const k = inputIndex++;
      inputs.push(
        '-ss',
        num(item.in),
        '-t',
        num(item.out - item.in),
        '-i',
        options.mediaPath(assetOf(item.assetId)),
      );
      const setpts =
        item.speed === 1 ? 'setpts=PTS-STARTPTS' : `setpts=(PTS-STARTPTS)/${num(item.speed)}`;
      filters.push(`[${k}:v]${setpts},${fitFilter(settings)},trim=duration=${d}[v${i}]`);
      if (hasAudio) {
        if (soundOf(item)) {
          const tempo = atempoChain(item.speed)
            .map((s) => `,atempo=${num(s)}`)
            .join('');
          const volume = item.volume === 1 ? '' : `,volume=${num(item.volume)}`;
          filters.push(
            `[${k}:a]asetpts=PTS-STARTPTS${tempo}${volume},${AUDIO_FORMAT},apad,atrim=duration=${d}${audioOut}`,
          );
        } else {
          filters.push(`${SILENCE},atrim=duration=${d}${audioOut}`);
        }
      }
    } else {
      if (item.type === 'image') {
        const k = inputIndex++;
        inputs.push(
          '-loop',
          '1',
          '-framerate',
          String(settings.fps),
          '-t',
          d,
          '-i',
          options.mediaPath(assetOf(item.assetId)),
        );
        filters.push(`[${k}:v]${fitFilter(settings)},trim=duration=${d}[v${i}]`);
      } else {
        filters.push(`${colourFrame(settings, titleColour(item), d)}[v${i}]`);
      }
      if (hasAudio) filters.push(`${SILENCE},atrim=duration=${d}${audioOut}`);
    }
  });

  const n = project.timeline.main.length;
  const segments = project.timeline.main
    .map((_, i) => `[v${i}]${hasAudio ? `[a${i}]` : ''}`)
    .join('');
  filters.push(
    `${segments}concat=n=${n}:v=1:a=${hasAudio ? 1 : 0}[vout]${hasAudio ? '[aout]' : ''}`,
  );

  const quality = options.quality ?? 'high';
  return {
    args: [
      ...inputs,
      '-filter_complex',
      filters.join(';'),
      '-map',
      '[vout]',
      ...(hasAudio ? ['-map', '[aout]'] : []),
      ...videoCodec(options.videoEncoder ?? 'libx264', quality, settings),
      ...(hasAudio ? ['-c:a', 'aac', '-b:a', AUDIO_RATE[quality]] : ['-an']),
      '-movflags',
      '+faststart',
    ],
    duration: mainTrackDuration(project.timeline.main),
    hasAudio,
  };
}

function assertExportable(project: Project): void {
  const { main, text, audio } = project.timeline;
  if (main.length === 0) throw new EditError('Add a clip to the timeline before exporting.');
  if (text.length > 0) {
    throw new EditError('Exporting captions, subtitles and credits is not available yet.');
  }
  if (audio[0].length > 0 || audio[1].length > 0) {
    throw new EditError('Exporting music and voiceover tracks is not available yet.');
  }
  for (const item of main) {
    if (item.type === 'title' && (item.text.trim() !== '' || item.background.kind !== 'colour')) {
      throw new EditError('Exporting title text and title pictures is not available yet.');
    }
  }
}

function titleColour(item: Extract<MainItem, { type: 'title' }>): string {
  return item.background.kind === 'colour' ? item.background.colour : '#000000';
}

function colourFrame(s: ProjectSettings, colour: string, duration: string): string {
  return `color=c=${colour}:s=${s.width}x${s.height}:r=${s.fps}:d=${duration},setsar=1,format=yuv420p`;
}

function videoCodec(encoder: string, quality: Quality, s: ProjectSettings): string[] {
  if (encoder === 'libx264') {
    return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', CRF[quality], '-pix_fmt', 'yuv420p'];
  }
  // Hardware encoders do not support crf: give a bit rate that suits the frame size.
  const kbps = Math.round((s.width * s.height * s.fps * BITS_PER_PIXEL[quality]) / 1000);
  return ['-c:v', encoder, '-b:v', `${kbps}k`, '-pix_fmt', 'yuv420p'];
}

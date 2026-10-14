// Render compiler (P8, ARCHITECTURE §7.4): project → FFmpeg arguments. Pure: no files, no
// processes. The job queue adds progress flags and the output path.
import { EditError } from '../model/errors.ts';
import type { Seconds } from '../model/time.ts';
import { itemDuration, mainTrackDuration, transitionOverlap } from '../model/timeline.ts';
import { filtersFor, transitionById } from '../effects/registry.ts';
import type {
  Entrance,
  MainItem,
  MediaAsset,
  Project,
  ProjectSettings,
  TextEffects,
} from '../model/types.ts';
import { atempoChain, fitFilter, num } from './filters.ts';

export type Quality = 'high' | 'medium' | 'low';

export interface RenderOptions {
  /** Absolute path of a media file (the caller resolves project-relative paths). */
  mediaPath(asset: MediaAsset): string;
  /** libx264 (default) or a detected hardware encoder. */
  videoEncoder?: string;
  quality?: Quality;
  /**
   * Text drawn by the app's canvas (ARCHITECTURE §7.3), one PNG per title slide with words and
   * per caption / subtitle / credits item. Full-frame PNGs, except scrolling credits (text block only).
   */
  textImages?: Record<string, TextImage>;
  /** V10: render only the frame at this time (a snapshot) instead of the whole video. */
  frameAt?: Seconds;
}

export interface TextImage {
  path: string;
  width: number;
  height: number;
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
  const frameAt = options.frameAt;
  const total = mainTrackDuration(project.timeline.main);
  if (frameAt !== undefined && !(frameAt >= 0 && frameAt < total)) {
    throw new EditError('Move the playhead onto the video to take a snapshot.');
  }
  const hasAudio = frameAt === undefined && project.timeline.main.some(soundOf);

  const inputs: string[] = [];
  const filters: string[] = [];
  let inputIndex = 0;
  const textImage = (id: string): TextImage => {
    const image = options.textImages?.[id];
    if (!image) throw new EditError('The text was not prepared for export. Please try again.');
    return image;
  };
  const loopImage = (seconds: string, path: string) => {
    inputs.push('-loop', '1', '-framerate', String(settings.fps), '-t', seconds, '-i', path);
    return inputIndex++;
  };

  project.timeline.main.forEach((item, i) => {
    const d = num(itemDuration(item));
    const audioOut = `[a${i}]`;
    // With a look (pan & zoom, filters, fade) the item is made as [p<i>] and finished as [v<i>].
    const look = lookChain(item, settings);
    const vOut = look ? `[p${i}]` : `[v${i}]`;
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
      filters.push(`[${k}:v]${setpts},${fitFilter(settings)},trim=duration=${d}${vOut}`);
      if (hasAudio) {
        if (soundOf(item)) {
          const tempo = atempoChain(item.speed)
            .map((s) => `,atempo=${num(s)}`)
            .join('');
          const volume = item.volume === 1 ? '' : `,volume=${num(item.volume)}`;
          filters.push(
            `[${k}:a]asetpts=PTS-STARTPTS${tempo}${volume},${AUDIO_FORMAT},apad,atrim=duration=${d}${audioFades(item)}${audioOut}`,
          );
        } else {
          filters.push(`${SILENCE},atrim=duration=${d}${audioOut}`);
        }
      }
    } else {
      if (item.type === 'image') {
        const k = loopImage(d, options.mediaPath(assetOf(item.assetId)));
        filters.push(`[${k}:v]${fitFilter(settings)},trim=duration=${d}${vOut}`);
      } else {
        // Title slide: background (colour, picture or video), then its words on top.
        const words = item.text.trim() !== '';
        const bgOut = words ? `[bg${i}]` : vOut;
        const bg = item.background;
        if (bg.kind === 'colour') {
          filters.push(`${colourFrame(settings, bg.colour, d)}${bgOut}`);
        } else if (bg.kind === 'image') {
          const k = loopImage(d, options.mediaPath(assetOf(bg.assetId)));
          filters.push(`[${k}:v]${fitFilter(settings)},trim=duration=${d}${bgOut}`);
        } else {
          const k = inputIndex++;
          inputs.push('-ss', '0', '-t', d, '-i', options.mediaPath(assetOf(bg.assetId)));
          filters.push(
            `[${k}:v]setpts=PTS-STARTPTS,${fitFilter(settings)},tpad=stop_mode=clone:stop_duration=${d},trim=duration=${d}${bgOut}`,
          );
        }
        if (words) {
          const k = loopImage(d, textImage(item.id).path);
          filters.push(`[${k}:v]format=rgba${fades(0, itemDuration(item), item)}[t${i}x]`);
          filters.push(
            `[bg${i}][t${i}x]overlay=${overlayPosition(item.entrance, 0, settings)}${vOut}`,
          );
        }
      }
      if (hasAudio) filters.push(`${SILENCE},atrim=duration=${d}${audioOut}`);
    }
    if (look) filters.push(`${vOut}${look}[v${i}]`);
  });

  const main = project.timeline.main;
  const n = main.length;
  const texts = project.timeline.text;
  const videoEnd = texts.length ? '[vbase]' : '[vout]';
  if (main.every((_, i) => transitionOverlap(main, i) === 0)) {
    const segments = main.map((_, i) => `[v${i}]${hasAudio ? `[a${i}]` : ''}`).join('');
    filters.push(
      `${segments}concat=n=${n}:v=1:a=${hasAudio ? 1 : 0}${videoEnd}${hasAudio ? '[aout]' : ''}`,
    );
  } else {
    // V9: join the items one by one — a cut is a concat of two, a transition is an xfade.
    let video = '[v0]';
    let audio = '[a0]';
    let length = itemDuration(main[0]!);
    for (let i = 1; i < n; i++) {
      const last = i === n - 1;
      const vNext = last ? videoEnd : `[x${i}]`;
      const aNext = last ? '[aout]' : `[xa${i}]`;
      const overlap = transitionOverlap(main, i);
      if (overlap > 0) {
        const kind = transitionById(main[i]!.transitionIn!.effectId);
        if (!kind)
          throw new EditError('This transition is not available in this version of EasyMedia.');
        filters.push(
          `${video}[v${i}]xfade=transition=${kind.xfade}:duration=${num(overlap)}:offset=${num(length - overlap)}${vNext}`,
        );
        if (hasAudio) filters.push(`${audio}[a${i}]acrossfade=d=${num(overlap)}${aNext}`);
      } else if (hasAudio) {
        filters.push(`${video}${audio}[v${i}][a${i}]concat=n=2:v=1:a=1${vNext}${aNext}`);
      } else {
        filters.push(`${video}[v${i}]concat=n=2:v=1:a=0${vNext}`);
      }
      video = vNext;
      audio = aNext;
      length += itemDuration(main[i]!) - overlap;
    }
  }

  // Captions, subtitles and credits are laid over the joined video at their own times.
  texts.forEach((item, j) => {
    const image = textImage(item.id);
    const start = item.start;
    const end = item.start + item.duration;
    const k = loopImage(num(end), image.path);
    filters.push(`[${k}:v]format=rgba${fades(start, end, item)}[t${j}]`);
    const position =
      item.kind === 'credits' && item.scroll !== false
        ? `x=(main_w-overlay_w)/2:y='main_h-(t-${num(start)})/${num(item.duration)}*(main_h+overlay_h)'`
        : overlayPosition(item.entrance, start, settings);
    const from = j === 0 ? '[vbase]' : `[o${j - 1}]`;
    const to = j === texts.length - 1 ? '[vout]' : `[o${j}]`;
    filters.push(
      `${from}[t${j}]overlay=${position}:enable='between(t,${num(start)},${num(end)})'${to}`,
    );
  });

  if (frameAt !== undefined) {
    return {
      args: [
        ...inputs,
        '-filter_complex',
        filters.join(';'),
        ...['-map', '[vout]', '-ss', num(frameAt), '-frames:v', '1', '-update', '1', '-an'],
      ],
      duration: total,
      hasAudio: false,
    };
  }
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
    duration: total,
    hasAudio,
  };
}

function assertExportable(project: Project): void {
  const { main, audio } = project.timeline;
  if (main.length === 0) throw new EditError('Add a clip to the timeline before exporting.');
  if (audio[0].length > 0 || audio[1].length > 0) {
    throw new EditError('Exporting music and voiceover tracks is not available yet.');
  }
}

/** Pan & zoom, filters and fade of one item, or '' when it has none (V7, V8, V15). */
function lookChain(item: MainItem, s: ProjectSettings): string {
  const length = itemDuration(item);
  const parts: string[] = [];
  if (item.panZoom) parts.push(panZoomFilter(item.panZoom, length, s));
  const effects = filtersFor(item.effects ?? []);
  if (effects) parts.push(effects);
  const fade = item.fade;
  if (fade) {
    const colour = `color=${fade.colour}`;
    if (fade.in > 0) parts.push(`fade=t=in:st=0:d=${num(fade.in)}:${colour}`);
    if (fade.out > 0)
      parts.push(`fade=t=out:st=${num(length - fade.out)}:d=${num(fade.out)}:${colour}`);
  }
  return parts.join(',');
}

/** The sound fades with the picture (V7). */
function audioFades(item: MainItem): string {
  const fade = item.fade;
  if (!fade) return '';
  const length = itemDuration(item);
  return (
    (fade.in > 0 ? `,afade=t=in:st=0:d=${num(fade.in)}` : '') +
    (fade.out > 0 ? `,afade=t=out:st=${num(length - fade.out)}:d=${num(fade.out)}` : '')
  );
}

/**
 * V8: zoompan, one output frame per input frame. The view moves linearly from `from` to `to`
 * between `start` and `end`, and is held before and after; it never leaves the picture.
 */
function panZoomFilter(
  pz: NonNullable<MainItem['panZoom']>,
  length: Seconds,
  s: ProjectSettings,
): string {
  const start = pz.start ?? 0;
  const end = pz.end ?? length;
  const p = `min(max((on/${s.fps}-${num(start)})/${num(end - start)},0),1)`;
  const lerp = (a: number, b: number) => `${num(a)}+${num(b - a)}*${p}`;
  const centre = (axis: 'x' | 'y', size: 'iw' | 'ih') =>
    `'max(0,min(${size}-${size}/zoom,(${lerp(pz.from[axis], pz.to[axis])})*${size}-${size}/zoom/2))'`;
  return `zoompan=z='${lerp(pz.from.zoom, pz.to.zoom)}':x=${centre('x', 'iw')}:y=${centre('y', 'ih')}:d=1:s=${s.width}x${s.height}:fps=${s.fps}`;
}

/** Fades the transparency of a text layer (V7 for text). */
function fades(start: Seconds, end: Seconds, effects: TextEffects): string {
  const fadeIn = effects.fadeIn ?? 0;
  const fadeOut = effects.fadeOut ?? 0;
  return (
    (fadeIn > 0 ? `,fade=t=in:st=${num(start)}:d=${num(fadeIn)}:alpha=1` : '') +
    (fadeOut > 0 ? `,fade=t=out:st=${num(end - fadeOut)}:d=${num(fadeOut)}:alpha=1` : '')
  );
}

/** Where a full-frame text layer sits; an entrance slides it in over the first second. */
function overlayPosition(
  entrance: Entrance | undefined,
  start: Seconds,
  s: ProjectSettings,
): string {
  const t = `t-${num(start)}`;
  const slide = (from: number) => `'if(lt(${t},1),${from}+(${t})*${-from},0)'`;
  switch (entrance) {
    case 'fly-left':
      return `x=${slide(-s.width)}:y=0`;
    case 'fly-right':
      return `x='if(lt(${t},1),${s.width}-(${t})*${s.width},0)':y=0`;
    case 'fly-up':
      return `x=0:y='if(lt(${t},1),${s.height}-(${t})*${s.height},0)'`;
    case 'fly-down':
      return `x=0:y=${slide(-s.height)}`;
    default:
      return 'x=0:y=0';
  }
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

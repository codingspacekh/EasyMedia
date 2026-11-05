// Render compiler (P8, ARCHITECTURE §7.4): project → FFmpeg arguments. Pure: no files, no
// processes. The job queue adds progress flags and the output path.
import { EditError } from '../model/errors.ts';
import type { Seconds } from '../model/time.ts';
import {
  audioDuration,
  itemDuration,
  mainTrackDuration,
  transitionOverlap,
} from '../model/timeline.ts';
import { filtersFor, transitionById } from '../effects/registry.ts';
import type {
  AudioItem,
  AudioTrackIndex,
  MainItem,
  MediaAsset,
  Project,
  ProjectSettings,
  TextEffects,
} from '../model/types.ts';
import { motionExpressions } from '../text/motion.ts';
import { atempoChain, fitFilter, num } from './filters.ts';
import {
  codecArgs,
  defaultExport,
  fpsValue,
  isDvd,
  validateExport,
  type ExportSettings,
} from './formats.ts';

export interface RenderOptions {
  /** Absolute path of a media file (the caller resolves project-relative paths). */
  mediaPath(asset: MediaAsset): string;
  /** libx264 (default) or a detected hardware encoder, for H.264 in MP4 and MOV. */
  videoEncoder?: string;
  /** Container, codecs, size, frame rate and quality (V16, V17). Default: the project as MP4. */
  format?: ExportSettings;
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
  /** The middle of the words in the frame: zooms grow around it (default: the frame's middle). */
  anchor?: { x: number; y: number };
  /** The words' box in the frame: spins and typing on need it (default: the whole frame). */
  box?: { x: number; y: number; width: number; height: number };
}

export interface RenderPlan {
  /** FFmpeg inputs, filter graph and output options; no output path. */
  args: string[];
  duration: Seconds;
  /** False when no clip contributes sound: the file then has no audio stream. */
  hasAudio: boolean;
}

const SAMPLE_RATE = 48000;
/** Seconds of the last picture a video clip may be padded with (the trim keeps only what it needs). */
const HOLD = 1;
const SILENCE = 'anullsrc=r=48000:cl=stereo';
const AUDIO_FORMAT = 'aformat=sample_rates=48000:channel_layouts=stereo';

/**
 * V10: the stretch of the finished video a snapshot keeps, [start, end): it ends one frame after
 * the time, and its last frame is written. That is the first frame at or after the time, as the
 * preview shows it; past the video's last picture it is that last picture. (A seek to the frame
 * at or after the time found nothing there: the finished video can have a frame fewer than the
 * timeline's length suggests, as each clip rounds its own frame count — M17 exam trial,
 * 9626/02 M/J/18 186MCP.wmv.)
 */
const SNAPSHOT_LOOK_BACK = 0.25;
function snapshotStretch(time: Seconds, fps: number): [Seconds, Seconds] {
  return [Math.max(0, time - SNAPSHOT_LOOK_BACK), time + 1 / fps];
}

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
  // V13: music and voiceover heard before the video ends (a snapshot has no sound).
  const tracks = frameAt === undefined ? heardAudio(project.timeline.audio, total) : [];
  const hasAudio = frameAt === undefined && projectHasSound(project);
  const mainAudio = tracks.length ? '[amain]' : '[aout]';

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
      // The last picture is held for any moment the file's pictures stop short of the clip's
      // length (a file's stated length can run a frame or two past its last picture: 9626/02
      // M/J/18 186MCP.wmv), so the clip is never shorter than planned and its last frame exists.
      filters.push(
        `[${k}:v]${setpts},${fitFilter(settings)},tpad=stop_mode=clone:stop_duration=${HOLD},trim=duration=${d}${vOut}`,
      );
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
          const image = textImage(item.id);
          const k = loopImage(d, image.path);
          const m = motion(item, 0, itemDuration(item), image);
          filters.push(`[${k}:v]format=rgba${m.filters}[t${i}x]`);
          filters.push(`[bg${i}][t${i}x]overlay=${m.position}${vOut}`);
        }
      }
      if (hasAudio) filters.push(`${SILENCE},atrim=duration=${d}${audioOut}`);
    }
    if (look) filters.push(`${vOut}${look}[v${i}]`);
  });

  const main = project.timeline.main;
  const n = main.length;
  // Text shown after the video has ended is left out; it must never make the video longer.
  const texts = project.timeline.text.filter((t) => t.start < total - 1e-6);
  const videoEnd = texts.length ? '[vbase]' : '[vout]';
  if (main.every((_, i) => transitionOverlap(main, i) === 0)) {
    const segments = main.map((_, i) => `[v${i}]${hasAudio ? `[a${i}]` : ''}`).join('');
    filters.push(
      `${segments}concat=n=${n}:v=1:a=${hasAudio ? 1 : 0}${videoEnd}${hasAudio ? mainAudio : ''}`,
    );
  } else {
    // V9: join the items one by one — a cut is a concat of two, a transition is an xfade.
    let video = '[v0]';
    let audio = '[a0]';
    let length = itemDuration(main[0]!);
    for (let i = 1; i < n; i++) {
      const last = i === n - 1;
      const vNext = last ? videoEnd : `[x${i}]`;
      const aNext = last ? mainAudio : `[xa${i}]`;
      const overlap = transitionOverlap(main, i);
      if (overlap > 0) {
        const kind = transitionById(main[i]!.transitionIn!.effectId);
        if (!kind)
          throw new EditError('This transition is not available in this version of OneEditor.');
        filters.push(
          `${video}[v${i}]xfade=transition=${kind.xfade}:duration=${num(overlap)}:offset=${num(length - overlap)}${vNext}`,
        );
        if (hasAudio) filters.push(`${audio}[a${i}]acrossfade=d=${num(overlap)}${aNext}`);
      } else {
        // concat gives its output a fine timebase; xfade needs the frame timebase, so set it back.
        filters.push(
          hasAudio
            ? `${video}${audio}[v${i}][a${i}]concat=n=2:v=1:a=1[c${i}]${aNext}`
            : `${video}[v${i}]concat=n=2:v=1:a=0[c${i}]`,
        );
        filters.push(`[c${i}]settb=1/${settings.fps}${vNext}`);
      }
      video = vNext;
      audio = aNext;
      length += itemDuration(main[i]!) - overlap;
    }
  }

  // V13: each music / voiceover / sound effect clip is read, shaped in its own time, moved to its start
  // (exact to the sample) and mixed over the clips' sound, which sets the length.
  const voiceover = tracks.filter((t) => t.track === 1);
  tracks.forEach(({ item, track, heard }, j) => {
    const k = inputIndex++;
    const speed = item.speed ?? 1;
    inputs.push(
      '-ss',
      num(item.in),
      '-t',
      num(heard * speed),
      '-i',
      options.mediaPath(assetOf(item.assetId)),
    );
    const tempo = atempoChain(speed)
      .map((t) => `,atempo=${num(t)}`)
      .join('');
    const volume = item.volume === 1 ? '' : `,volume=${num(item.volume)}`;
    const fadeIn = item.fadeIn > 0 ? `,afade=t=in:st=0:d=${num(item.fadeIn)}` : '';
    const fadeOut =
      item.fadeOut > 0 ? `,afade=t=out:st=${num(heard - item.fadeOut)}:d=${num(item.fadeOut)}` : '';
    const ducking = track === 0 && item.duck && voiceover.length ? `,${duckFilter(voiceover)}` : '';
    filters.push(
      `[${k}:a]asetpts=PTS-STARTPTS,${AUDIO_FORMAT}${tempo}${volume}${fadeIn}${fadeOut},adelay=${Math.round(item.start * SAMPLE_RATE)}S:all=1${ducking}[m${j}]`,
    );
  });
  if (tracks.length) {
    const mixed = tracks.map((_, j) => `[m${j}]`).join('');
    filters.push(
      `[amain]${mixed}amix=inputs=${tracks.length + 1}:duration=first:normalize=0[aout]`,
    );
  }

  // Captions, subtitles and credits are laid over the joined video at their own times.
  texts.forEach((item, j) => {
    const image = textImage(item.id);
    const start = item.start;
    const end = item.start + item.duration;
    const k = loopImage(num(Math.min(end, total)), image.path);
    const scrolls = item.kind === 'credits' && item.scroll !== false;
    const m = scrolls
      ? {
          filters: fades(start, end, item),
          position: `x=(main_w-overlay_w)/2:y='main_h-(t-${num(start)})/${num(item.duration)}*(main_h+overlay_h)'`,
        }
      : motion(item, start, item.duration, image);
    filters.push(`[${k}:v]format=rgba${m.filters}[t${j}]`);
    const position = m.position;
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
        [
          ...filters,
          `[vout]trim=start=${num(snapshotStretch(frameAt, settings.fps)[0])}:end=${num(snapshotStretch(frameAt, settings.fps)[1])}[snap]`,
        ].join(';'),
        ...['-map', '[snap]', '-update', '1', '-an'],
      ],
      duration: total,
      hasAudio: false,
    };
  }
  const format = options.format ?? defaultExport(settings);
  validateExport(format);
  const resize = outputFilter(format, settings);
  if (resize) filters.push(`[vout]${resize}[vexp]`);
  return {
    args: [
      ...inputs,
      '-filter_complex',
      filters.join(';'),
      '-map',
      resize ? '[vexp]' : '[vout]',
      ...(hasAudio ? ['-map', '[aout]'] : []),
      ...codecArgs(format, {
        hasAudio,
        ...(options.videoEncoder ? { videoEncoder: options.videoEncoder } : {}),
      }),
    ],
    duration: total,
    hasAudio,
  };
}

/**
 * V17: the finished picture at the export size and frame rate, or '' when they are the
 * project's. A DVD stores 720 × 576 (or × 480) pixels shown at the project's shape; any other
 * size of a different shape is letterboxed.
 */
function outputFilter(e: ExportSettings, s: ProjectSettings): string {
  const parts: string[] = [];
  if (e.width !== s.width || e.height !== s.height) {
    const sameShape = Math.abs(e.width / e.height - s.width / s.height) < 0.01;
    const g = gcd(s.width, s.height);
    if (isDvd(e)) parts.push(`scale=${e.width}:${e.height},setdar=${s.width / g}/${s.height / g}`);
    else if (sameShape) parts.push(`scale=${e.width}:${e.height},setsar=1`);
    else
      parts.push(
        `scale=${e.width}:${e.height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${e.width}:${e.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`,
      );
  }
  if (e.fps !== s.fps) parts.push(`fps=${fpsValue(e.fps)}`);
  return parts.join(',');
}

/** Whether the exported file will have a sound track: a clip with sound, or music / voiceover heard. */
export function projectHasSound(project: Project): boolean {
  const { main, audio } = project.timeline;
  const clipSound = main.some(
    (item) =>
      item.type === 'video' &&
      !item.muted &&
      project.media.find((m) => m.id === item.assetId)?.hasAudio === true,
  );
  return clipSound || heardAudio(audio, mainTrackDuration(main)).length > 0;
}

function assertExportable(project: Project): void {
  if (project.timeline.main.length === 0)
    throw new EditError('Add a clip to the timeline before exporting.');
}

interface HeardAudio {
  item: AudioItem;
  track: AudioTrackIndex;
  /** How long it plays on the timeline: its own length, or until the video ends. */
  heard: Seconds;
}

/** Music, voiceover and sound effects in mixing order; anything starting after the video ends is left out. */
function heardAudio(audio: Project['timeline']['audio'], total: Seconds): HeardAudio[] {
  return audio.flatMap((items, track) =>
    items
      .map((item) => ({
        item,
        track: track as AudioTrackIndex,
        heard: Math.min(audioDuration(item), total - item.start),
      }))
      .filter((a) => a.heard > 1e-6),
  );
}

/** V13: −6 dB while any voiceover clip plays (timeline time). */
function duckFilter(voiceover: HeardAudio[]): string {
  const when = voiceover
    .map(({ item, heard }) => `between(t,${num(item.start)},${num(item.start + heard)})`)
    .join('+');
  return `volume=-6dB:enable='${when}'`;
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

/**
 * A full-frame text layer's fades, entrance and exit (core/text/motion.ts, the same rules as
 * the preview): filters for its stream and where the overlay puts it.
 */
function motion(
  effects: TextEffects,
  start: Seconds,
  duration: Seconds,
  image: TextImage,
): { filters: string; position: string } {
  const anchor = image.anchor ?? { x: image.width / 2, y: image.height / 2 };
  const m = motionExpressions(effects, start, duration, image, anchor, image.box);
  const end = start + duration;
  const extra =
    (m.fadeIn ? `,fade=t=in:st=${num(start)}:d=${num(m.fadeIn)}:alpha=1` : '') +
    (m.fadeOut ? `,fade=t=out:st=${num(end - m.fadeOut)}:d=${num(m.fadeOut)}:alpha=1` : '');
  // Spinning words are cut out first; typing on keeps what is left of the edge (padded on the
  // left by the picture's width, cropped at the edge, so the kept part stays where it was).
  const w = m.window;
  const cutW = w?.width ?? image.width;
  const cutH = w?.height ?? image.height;
  const cut = w ? `,crop=w=${w.width}:h=${w.height}:x=${w.x}:y=${w.y}` : '';
  const reveal = m.edge
    ? `,pad=w=${2 * cutW}:h=${cutH}:x=${cutW}:y=0:color=black@0,` +
      `crop=w=${cutW}:h=${cutH}:x='${w ? `${m.edge}-${w.x}` : m.edge}':y=0`
    : '';
  const turn = m.angle ? `,rotate=a='${m.angle}':ow=${m.size}:oh=${m.size}:c=none` : '';
  const scale = m.scale
    ? `,scale=w='max(1,iw*(${m.scale}))':h='max(1,ih*(${m.scale}))':eval=frame`
    : '';
  return {
    filters: `${fades(start, end, effects)}${extra}${cut}${reveal}${turn}${scale}`,
    position: `x=${m.x}:y=${m.y}`,
  };
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

function colourFrame(s: ProjectSettings, colour: string, duration: string): string {
  return `color=c=${colour}:s=${s.width}x${s.height}:r=${s.fps}:d=${duration},setsar=1,format=yuv420p`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

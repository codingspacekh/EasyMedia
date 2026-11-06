// V20: a picture or video over the video. Its size and place in the frame, worked out the way
// FFmpeg's scale and overlay filters do it, so the preview puts it on the same pixels as the
// export. Pure: strings and numbers only.
import { overlayDuration } from '../model/overlay.ts';
import type { OverlayItem, OverlayPlacement } from '../model/types.ts';
import { num } from './filters.ts';

interface Size {
  width: number;
  height: number;
}

/** Where it sits in the frame, in the project's pixels. */
export interface OverlayBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The widest and tallest it may be: its width % of the frame, and the frame's (even) height. */
function limits(frame: Size, widthPercent: number): Size {
  return {
    width: Math.max(1, Math.round((frame.width * widthPercent) / 100)),
    height: frame.height - (frame.height % 2),
  };
}

/** The across (x) or down (y) place: against the start edge, the end edge, or in the middle. */
function along(
  position: OverlayPlacement['position'],
  axis: 'x' | 'y',
): 'start' | 'end' | 'middle' {
  const [startWord, endWord] = axis === 'x' ? ['left', 'right'] : ['top', 'bottom'];
  const words = position.split('-');
  return words.includes(startWord) ? 'start' : words.includes(endWord) ? 'end' : 'middle';
}

/**
 * The picture at its size (its width % of the frame, keeping its shape, never taller than the
 * frame; even numbers of pixels) and where its top-left corner goes. A margin bigger than the room
 * left keeps it inside the frame. FFmpeg cuts x and y to even pixels on a yuv420 picture.
 */
export function overlayBox(frame: Size, source: Size, placement: OverlayPlacement): OverlayBox {
  const most = limits(frame, placement.widthPercent);
  const width = Math.max(
    2,
    2 * Math.trunc(Math.min(most.width, (most.height * source.width) / source.height) / 2),
  );
  const height = Math.max(
    2,
    Math.min(most.height, 2 * Math.round((width * source.height) / source.width / 2)),
  );
  const place = (axis: 'x' | 'y', room: number) => {
    const side = along(placement.position, axis);
    const at =
      side === 'start'
        ? Math.min(room, placement.margin)
        : side === 'end'
          ? Math.max(0, room - placement.margin)
          : room / 2;
    return Math.trunc(at) & ~1;
  };
  return {
    x: place('x', frame.width - width),
    y: place('y', frame.height - height),
    width,
    height,
  };
}

/** FFmpeg scale filter for overlayBox's size (iw, ih: the picture's own size). */
export function overlayScale(frame: Size, placement: OverlayPlacement): string {
  const most = limits(frame, placement.widthPercent);
  const w = `max(2,2*trunc(min(${most.width},${most.height}*iw/ih)/2))`;
  const h = `max(2,min(${most.height},2*round(ow*ih/iw/2)))`;
  return `scale=w='${w}':h='${h}'`;
}

/** FFmpeg overlay's x and y for overlayBox's place. */
export function overlayPosition(placement: OverlayPlacement): string {
  const expr = (axis: 'x' | 'y') => {
    const room = axis === 'x' ? 'main_w-overlay_w' : 'main_h-overlay_h';
    const margin = num(placement.margin);
    const side = along(placement.position, axis);
    return side === 'start'
      ? `min(${room},${margin})`
      : side === 'end'
        ? `max(0,${room}-${margin})`
        : `(${room})/2`;
  };
  return `x='${expr('x')}':y='${expr('y')}'`;
}

/**
 * The picture's stream, moved to its start, at its size, see-through as set and faded (in
 * timeline time, as text is): what follows `[k:v]`.
 */
export function overlayPicture(item: OverlayItem, frame: Size): string {
  const start = item.start;
  const end = start + overlayDuration(item);
  const fadeIn = item.fadeIn ?? 0;
  const fadeOut = item.fadeOut ?? 0;
  const see = item.opacity < 1 ? `,colorchannelmixer=aa=${num(item.opacity)}` : '';
  const fades =
    (fadeIn > 0 ? `,fade=t=in:st=${num(start)}:d=${num(fadeIn)}:alpha=1` : '') +
    (fadeOut > 0 ? `,fade=t=out:st=${num(end - fadeOut)}:d=${num(fadeOut)}:alpha=1` : '');
  const alpha = see || fades ? `,format=rgba${see}${fades}` : '';
  return `setpts=PTS-STARTPTS+${num(start)}/TB,${overlayScale(frame, item)}${alpha}`;
}

/** A video over the video's own sound, faded with its picture and moved to its start. */
export function overlaySound(item: OverlayItem, sampleRate: number, format: string): string {
  const length = overlayDuration(item);
  const volume = item.type === 'video' && item.volume !== 1 ? `,volume=${num(item.volume)}` : '';
  const fadeIn = item.fadeIn ?? 0;
  const fadeOut = item.fadeOut ?? 0;
  const fades =
    (fadeIn > 0 ? `,afade=t=in:st=0:d=${num(fadeIn)}` : '') +
    (fadeOut > 0 ? `,afade=t=out:st=${num(length - fadeOut)}:d=${num(fadeOut)}` : '');
  return `asetpts=PTS-STARTPTS,${format}${volume}${fades},adelay=${Math.round(item.start * sampleRate)}S:all=1`;
}

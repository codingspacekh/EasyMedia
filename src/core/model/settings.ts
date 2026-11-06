import { EditError } from './errors.ts';
import type { ProjectSettings } from './types.ts';

const RATIOS = { '16:9': [16, 9], '4:3': [4, 3] } as const;

/** V1: resolution, aspect ratio and frame rate must make sense together. */
export function validateSettings(s: ProjectSettings): void {
  for (const size of [s.width, s.height]) {
    if (!Number.isInteger(size) || size < 16 || size > 7680) {
      throw new EditError('Width and height must be between 16 and 7680 pixels.');
    }
    if (size % 2 !== 0) throw new EditError('Width and height must be an even number of pixels.');
  }
  // The exact width, or the nearest even one (854 × 480: 480 × 16 ÷ 9 = 853.3, the papers' size).
  if (s.aspect !== 'custom') {
    if (!matches(s.aspect, s.width, s.height)) {
      throw new EditError(
        `${s.width} × ${s.height} is not ${s.aspect}. Choose a matching size or "Custom".`,
      );
    }
  }
  if (![24, 25, 30].includes(s.fps)) throw new EditError('Frame rate must be 24, 25 or 30 fps.');
  if (s.fit !== undefined && !['letterbox', 'crop', 'stretch'].includes(s.fit)) {
    throw new EditError('Choose how clips fit: black bars, crop to fill or stretch.');
  }
}

const MIN_SIZE = 16;
const MAX_SIZE = 7680;

/**
 * V1 "Use this clip's size": the project's size and shape from a clip's size. Odd sizes are made
 * even, and a clip too large or too small is scaled to fit, keeping its shape; 16:9 or 4:3 is
 * chosen when the size is one, otherwise Custom.
 */
export function sizeFromClip(size: {
  width: number;
  height: number;
}): Pick<ProjectSettings, 'aspect' | 'width' | 'height'> {
  const larger = Math.max(size.width, size.height);
  const smaller = Math.min(size.width, size.height);
  const scale = larger > MAX_SIZE ? MAX_SIZE / larger : smaller < MIN_SIZE ? MIN_SIZE / smaller : 1;
  const even = (n: number) =>
    Math.min(MAX_SIZE, Math.max(MIN_SIZE, 2 * Math.round((n * scale) / 2)));
  const width = even(size.width);
  const height = even(size.height);
  const aspect = (['16:9', '4:3'] as const).find((a) => matches(a, width, height)) ?? 'custom';
  return { aspect, width, height };
}

/** Whether width × height is the ratio, exactly or to the nearest even width (as validateSettings). */
function matches(aspect: '16:9' | '4:3', width: number, height: number): boolean {
  const [w, h] = RATIOS[aspect];
  const exact = (height * w) / h;
  return width === exact || width === 2 * Math.round(exact / 2);
}

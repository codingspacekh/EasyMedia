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
  if (s.aspect !== 'custom') {
    const [w, h] = RATIOS[s.aspect];
    if (s.width * h !== s.height * w) {
      throw new EditError(
        `${s.width} × ${s.height} is not ${s.aspect}. Choose a matching size or "Custom".`,
      );
    }
  }
  if (![24, 25, 30].includes(s.fps)) throw new EditError('Frame rate must be 24, 25 or 30 fps.');
}

// AN5, AN14: the picture files Animation mode takes, and the pictures in a folder for a stop motion.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** AN5: pictures for Animation mode; SVG only here, as FFmpeg cannot draw it for a video. */
export const PICTURE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'];

/** AN14: the pictures in a folder (not in folders inside it, not hidden files), by full path. */
export async function picturesIn(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  return entries
    .filter(
      (e) =>
        e.isFile() &&
        !e.name.startsWith('.') &&
        PICTURE_EXTENSIONS.includes(e.name.split('.').pop()!.toLowerCase()),
    )
    .map((e) => join(folder, e.name));
}

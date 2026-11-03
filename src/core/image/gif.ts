// AN17: whether an animated GIF loops. FFmpeg's -loop 0 writes the NETSCAPE2.0 application
// block (loop count 0: for ever); without it a GIF plays once. ffprobe does not report it, so
// the task checker reads the block from the file's first bytes.

const NETSCAPE = [...'NETSCAPE2.0'].map((c) => c.charCodeAt(0));

/** True when the GIF loops (for ever or a number of times), false when it plays once, null if not a GIF. */
export function gifLoops(bytes: Uint8Array): boolean | null {
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;
  // The block comes before the first picture: 0x21 0xFF 11 "NETSCAPE2.0" 3 1 count(2 bytes) 0.
  for (let i = 6; i + 3 + NETSCAPE.length < bytes.length; i++) {
    if (bytes[i] !== 0x21 || bytes[i + 1] !== 0xff || bytes[i + 2] !== 11) continue;
    if (NETSCAPE.every((c, k) => bytes[i + 3 + k] === c)) return true;
  }
  return false;
}

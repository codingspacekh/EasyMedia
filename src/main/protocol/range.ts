// Parses an HTTP Range header for one byte range (RFC 9110). Video elements need this to seek.
export type ByteRange = { start: number; end: number };

/** null = no Range header (send the whole file); 'unsatisfiable' = reply 416. */
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | null | 'unsatisfiable' {
  if (header === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return 'unsatisfiable';
  if (match[1] === '') {
    const suffix = Number(match[2]);
    return suffix > 0 ? { start: Math.max(0, size - suffix), end: size - 1 } : 'unsatisfiable';
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start < size && start <= end ? { start, end } : 'unsatisfiable';
}

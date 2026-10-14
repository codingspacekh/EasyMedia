// The page plays local files through media://file/<encoded path>, served by the main process
// (it cannot read files itself: ARCHITECTURE §2).
const PREFIX = 'media://file/';

export function toMediaUrl(path: string): string {
  return PREFIX + encodeURIComponent(path);
}

export function fromMediaUrl(url: string): string | null {
  if (!url.startsWith(PREFIX)) return null;
  return decodeURIComponent(url.slice(PREFIX.length));
}

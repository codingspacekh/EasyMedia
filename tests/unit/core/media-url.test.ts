import { describe, expect, it } from 'vitest';
import { fromMediaUrl, toMediaUrl } from '../../../src/core/media-url.ts';

describe('media:// URLs for local files the page may play', () => {
  it.each([
    '/Users/teacher/Proxies/ab12.mp4',
    'C:\\Users\\student\\Videos\\Lake Naivasha (1).mp4',
    '/Volumes/USB/clips/eagle#1?.mov',
  ])('round-trips %s', (path) => {
    const url = toMediaUrl(path);
    expect(url.startsWith('media://file/')).toBe(true);
    expect(() => new URL(url)).not.toThrow();
    expect(fromMediaUrl(url)).toBe(path);
  });

  it('rejects other URLs', () => {
    expect(fromMediaUrl('https://example.com/a.mp4')).toBeNull();
    expect(fromMediaUrl('media://other/x')).toBeNull();
  });
});

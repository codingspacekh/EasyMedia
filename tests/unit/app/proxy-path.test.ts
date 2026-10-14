import { describe, expect, it } from 'vitest';
import { proxyPathFor } from '../../../src/app/proxy-path.ts';

describe('where a preview proxy is stored', () => {
  it('lives in the proxy folder, named after the source, and is an MP4', () => {
    expect(proxyPathFor('/cache/proxies', '/Users/s/Lake Naivasha.mov', 1234)).toMatch(
      /^\/cache\/proxies\/Lake_Naivasha-[0-9a-f]{8}\.mp4$/,
    );
  });

  it('is the same for the same file, and different if the file or its size changes', () => {
    const a = proxyPathFor('/c', '/m/a.mp4', 100);
    expect(proxyPathFor('/c', '/m/a.mp4', 100)).toBe(a);
    expect(proxyPathFor('/c', '/m/a.mp4', 101)).not.toBe(a);
    expect(proxyPathFor('/c', '/other/a.mp4', 100)).not.toBe(a);
  });

  it('works with Windows paths', () => {
    expect(proxyPathFor('C:\\cache', 'C:\\Users\\s\\clip.mp4', 1)).toMatch(
      /^C:\\cache\/clip-[0-9a-f]{8}\.mp4$/,
    );
  });
});

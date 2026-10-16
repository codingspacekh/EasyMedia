import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { createAllowList } from '../../../../src/main/protocol/allowlist.ts';

describe('only files the app imported or created can be served to the page', () => {
  it('allows added files and nothing else', () => {
    const allow = createAllowList();
    allow.add(join('/media', 'clip.mp4'));
    expect(allow.has(join('/media', 'clip.mp4'))).toBe(true);
    expect(allow.has(join('/media', 'other.mp4'))).toBe(false);
  });

  it('is not fooled by ".." in a path', () => {
    const allow = createAllowList();
    allow.add(join('/media', 'clip.mp4'));
    expect(allow.has('/media/x/../clip.mp4')).toBe(true);
    expect(allow.has('/media/clip.mp4/../../etc/passwd')).toBe(false);
  });

  it('a file can be taken off the list again', () => {
    const allow = createAllowList();
    allow.add('/tmp/decoded.f32');
    allow.remove('/tmp/decoded.f32');
    expect(allow.has('/tmp/decoded.f32')).toBe(false);
  });
});

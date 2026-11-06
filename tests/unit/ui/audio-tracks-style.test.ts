// issues/audio-4.png: a dark box with a dashed edge appeared at the start of every clip. The
// empty-project prompt was styled as `.start`, which is also the class of each clip's start trim
// handle, so the handles took the prompt's padding, border and background. The tests do not load
// the components' CSS, so this checks the style rules themselves.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Tests run from the project folder (jsdom's import.meta.url is not a file URL).
const source = readFileSync(join(process.cwd(), 'src/ui/audio/AudioTracks.svelte'), 'utf8');
const style = source.slice(source.indexOf('<style>'));

describe('audio tracks: the clips’ trim handles are not styled as the empty-project prompt', () => {
  it('no rule for a bare .start or .end class (the handles are "handle start" / "handle end")', () => {
    expect(style).not.toMatch(/^\s*\.(start|end)\b[^-]/m);
  });

  it('the prompt has a class of its own', () => {
    expect(source).toContain('<div class="no-tracks">');
    expect(style).toMatch(/^\s*\.no-tracks \{/m);
  });
});

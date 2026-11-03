// @vitest-environment jsdom
// AN15: the player script that goes inside every exported .html file, built with the app's own
// build settings: one script that needs nothing else, and it starts the page's animation.
import { build, type Rolldown } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';
import { playerBuild } from '../../../vite.electron.config.ts';
import { createAnimation, createRect } from '../../../src/core/animation/factory.ts';
import { webPage } from '../../../src/core/animation/html.ts';
import { addObject } from '../../../src/core/animation/layers.ts';
import type { PlayerState } from '../../../src/core/animation/player.ts';

let code = '';

beforeAll(async () => {
  const result = (await build({
    ...playerBuild,
    configFile: false,
    logLevel: 'silent',
    plugins: [],
    build: { ...playerBuild.build, write: false },
  })) as Rolldown.RolldownOutput[] | Rolldown.RolldownOutput;
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((o) => o.output).find((o) => o.type === 'chunk');
  code = chunk && 'code' in chunk ? chunk.code : '';
});

function task1() {
  let doc = createAnimation({ name: 'Task 1' });
  doc = { ...doc, stage: { ...doc.stage, width: 600, height: 400, length: 72 } };
  return addObject(doc, doc.layers[0]!.id, createRect({ x: 10, y: 10 }));
}

describe('the HTML player script (AN15)', () => {
  it('is one small script with no imports and no web addresses', () => {
    expect(code.length).toBeGreaterThan(1000);
    expect(code.length).toBeLessThan(100_000);
    expect(code).not.toMatch(/\brequire\(|^\s*import\b|\bimport\(/m);
    expect(code).not.toMatch(/https?:\/\//);
  });

  it('starts the animation of the page it is in', async () => {
    document.open();
    document.write(webPage(task1(), { player: '', pictures: {}, fonts: [] }));
    document.close();
    // jsdom has no drawing: a context that accepts every call.
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, k: string) => (k in t ? t[k] : () => ({ addColorStop() {} })),
      set: () => true,
    });
    HTMLCanvasElement.prototype.getContext = (() =>
      ctx) as unknown as HTMLCanvasElement['getContext'];
    // The page's script, as the browser runs it.
    new Function(code)();
    const win = window as unknown as { easymedia?: { player: { state(): PlayerState } } };
    await expect.poll(() => win.easymedia?.player.state().playing, { timeout: 5000 }).toBe(true);
  });
});

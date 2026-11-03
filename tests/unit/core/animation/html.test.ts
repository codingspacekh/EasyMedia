// AN15: the HTML web animation — one self-contained .html file: the animation as data, its
// pictures and fonts inside it, and the player; it plays at the stage's size without the internet.
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createGroup,
  createPicture,
  createText,
} from '../../../../src/core/animation/factory.ts';
import {
  fontsNeeded,
  PAGE_DATA_ID,
  picturesUsed,
  webPage,
  webPageInfo,
} from '../../../../src/core/animation/html.ts';
import { stopMotion } from '../../../../src/core/animation/frames.ts';
import { addObject } from '../../../../src/core/animation/layers.ts';
import type { AnimationDoc, Picture } from '../../../../src/core/animation/types.ts';

const PLAYER = 'window.player = true;';

function task1(): AnimationDoc {
  const doc = createAnimation({ name: 'Task 1' });
  return { ...doc, stage: { ...doc.stage, width: 600, height: 400, length: 72 } };
}

const layerOf = (doc: AnimationDoc) => doc.layers[0]!.id;

function withText(
  doc: AnimationDoc,
  text: string,
  style: { bold?: boolean; italic?: boolean } = {},
) {
  return addObject(doc, layerOf(doc), { ...createText(text, { x: 10, y: 10 }), ...style });
}

const paris: Picture = { id: 'p1', path: '/Users/ana/Task 3/Paris1.jpg', width: 800, height: 600 };

function withPicture(doc: AnimationDoc): AnimationDoc {
  const placed = { ...doc, pictures: [paris] };
  return addObject(placed, layerOf(placed), createPicture(paris, { x: 0, y: 0 }));
}

/** The animation data the page carries. */
function dataOf(html: string): { doc: AnimationDoc; pictures: Record<string, string> } {
  const m = new RegExp(
    `<script type="application/json" id="${PAGE_DATA_ID}">([\\s\\S]*?)</script>`,
  ).exec(html);
  return JSON.parse(m![1]!) as { doc: AnimationDoc; pictures: Record<string, string> };
}

const page = (doc: AnimationDoc, extra: Partial<Parameters<typeof webPage>[1]> = {}) =>
  webPage(doc, { player: PLAYER, pictures: {}, fonts: [], ...extra });

describe('HTML web animation (AN15)', () => {
  it('is one page with a canvas of the stage size, named after the animation', () => {
    const html = page(task1());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<canvas id="stage" width="600" height="400"');
    expect(html).toContain('<title>Task 1</title>');
    expect(html).toContain(PLAYER);
  });

  it('carries the animation as data, so the player draws exactly what the app draws', () => {
    const doc = withText(task1(), 'Bonjour');
    expect(dataOf(page(doc)).doc).toEqual(doc);
  });

  it('carries its pictures inside it, and not the path of the student’s folder', () => {
    const doc = withPicture(task1());
    const html = page(doc, { pictures: { p1: 'data:image/jpeg;base64,/9j/AAAA' } });
    const data = dataOf(html);
    expect(data.pictures).toEqual({ p1: 'data:image/jpeg;base64,/9j/AAAA' });
    expect(data.doc.pictures).toEqual([{ ...paris, path: 'Paris1.jpg' }]);
    expect(html).not.toContain('/Users/ana');
  });

  it('has no external references: everything is inside the file', () => {
    const doc = withPicture(withText(task1(), 'Hello'));
    const html = page(doc, {
      pictures: { p1: 'data:image/jpeg;base64,/9j/AAAA' },
      fonts: [
        {
          face: { family: 'Inter', style: 'normal', weight: '100 900', file: 'Inter.ttf' },
          url: 'data:font/ttf;base64,AAEAAA',
        },
      ],
    });
    expect(html).not.toMatch(/https?:/);
    expect(html).not.toMatch(/<link\b/);
    expect(html).not.toMatch(/\b(src|href)\s*=\s*["']?(?!data:)/);
    for (const m of html.matchAll(/url\(([^)]*)\)/g)) expect(m[1]).toMatch(/^["']?data:/);
  });

  it('declares each font it carries for the player’s text', () => {
    const html = page(withText(task1(), 'Hello'), {
      fonts: [
        {
          face: { family: 'Inter', style: 'italic', weight: '100 900', file: 'Inter-Italic.ttf' },
          url: 'data:font/ttf;base64,AAEAAA',
        },
      ],
    });
    expect(html).toMatch(
      /@font-face\s*\{[^}]*font-family:\s*'Inter';[^}]*font-style:\s*italic;[^}]*font-weight:\s*100 900;[^}]*src:\s*url\('data:font\/ttf;base64,AAEAAA'\)/,
    );
  });

  it('words such as </script> in a text do not break the page', () => {
    const doc = withText(task1(), '</script><script>alert(1)</script>');
    const html = page({ ...doc, name: '<b>&' });
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(dataOf(html).doc.layers[0]!.objects[0]).toMatchObject({
      text: '</script><script>alert(1)</script>',
    });
    expect(html).toContain('<title>&lt;b&gt;&amp;</title>');
  });

  it('a </script> inside the player’s own code does not end its script early', () => {
    const html = page(task1(), { player: 'const s = "</script>";' });
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html).toContain('const s = "<\\/script>";');
  });
});

describe('the fonts a web page needs (AN15)', () => {
  it('one file per font and style the text uses, inside groups too, each once', () => {
    let doc = withText(task1(), 'One');
    doc = withText(doc, 'Two');
    doc = withText(doc, 'Three', { italic: true });
    const group = createGroup([
      { ...createText('Four', { x: 0, y: 0 }), font: 'Courier Prime', bold: true },
    ]);
    doc = addObject(doc, layerOf(doc), group);
    expect(fontsNeeded(doc).map((f) => f.file)).toEqual([
      'Inter.ttf',
      'Inter-Italic.ttf',
      'CourierPrime-Bold.ttf',
    ]);
  });

  it('none without text', () => {
    expect(fontsNeeded(withPicture(task1()))).toEqual([]);
  });
});

describe('the pictures a web page carries (AN15)', () => {
  it('only those on the stage, inside groups too — not those deleted from it', () => {
    const unused: Picture = { id: 'p2', path: '/x/Old.jpg', width: 10, height: 10 };
    let doc = withPicture(task1());
    doc = { ...doc, pictures: [...doc.pictures, unused] };
    expect(picturesUsed(doc).map((p) => p.id)).toEqual(['p1']);
    const grouped = {
      ...doc,
      layers: [{ ...doc.layers[0]!, objects: [createGroup(doc.layers[0]!.objects)] }],
    };
    expect(picturesUsed(grouped).map((p) => p.id)).toEqual(['p1']);
  });

  it('AN14: a stop motion carries every picture it shows, not only the first', () => {
    const doc = task1();
    const shots: Picture[] = ['a', 'b', 'c'].map((id) => ({
      id,
      path: `/s/${id}.jpg`,
      width: 60,
      height: 40,
    }));
    const withShots = addObject(
      { ...doc, pictures: shots },
      layerOf(doc),
      stopMotion(shots, 12, doc.stage),
    );
    expect(picturesUsed(withShots).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('AN17 the task checker reads the size, frame rate, length and looping from an exported page', () => {
    const html = page(task1());
    expect(webPageInfo(html, 5000)).toEqual({
      kind: 'video',
      container: 'html',
      duration: 3,
      sizeBytes: 5000,
      video: { codec: 'canvas', width: 600, height: 400, fps: 24 },
      loop: true,
    });
    expect(webPageInfo('<html><body>Hello</body></html>')).toBeNull();
    expect(webPageInfo(html.replace('"fps":24', '"fps":"x"'))).toBeNull();
    expect(webPageInfo(html.replace(/"stage":\{/, '"stage":{]'))).toBeNull();
  });
});

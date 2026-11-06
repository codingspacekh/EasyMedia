// Draws library items to a contact sheet PNG, to look at new clip-art while drawing it:
//   node scripts/dev/library-sheet.ts <out.png> <category | id prefix> [size]
// Each item is drawn by the app's own SVG export, on a white stage, with its name under it.
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createAnimation } from '../../src/core/animation/factory.ts';
import { LIBRARY, placeItem } from '../../src/core/animation/library/index.ts';
import { stageSvg } from '../../src/core/animation/svg-export.ts';

const [out, filter = '', sizeArg = '220'] = process.argv.slice(2);
if (!out) throw new Error('usage: library-sheet.ts <out.png> <category | id prefix> [size]');
const size = Number(sizeArg);
const items = LIBRARY.filter((i) => i.category === filter || i.id.startsWith(filter));
const cells = items.map((item) => {
  const doc = createAnimation({ name: item.id });
  // A background fills a 16:9 stage, as it does in most animations; a picture sits in a square.
  const height = item.category === 'backgrounds' ? Math.round((size * 9) / 16) : size;
  doc.stage = { ...doc.stage, width: size, height };
  doc.layers[0]!.objects = [placeItem(item, doc.stage)];
  const svg = stageSvg(doc);
  // Each picture is an image of its own: SVGs on one page would share their gradients' ids.
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return `<figure><img src="${src}"><figcaption>${item.name}<br><small>${item.id}</small></figcaption></figure>`;
});
const html = `<!doctype html><style>body{margin:8px;font:12px system-ui;background:#ddd;display:flex;flex-wrap:wrap;gap:8px}
figure{margin:0;background:#fff;text-align:center;width:${size}px}img{display:block;width:${size}px}
small{color:#888}</style>${cells.join('')}`;
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Math.min(1800, 8 + 6 * (size + 8)), height: 400 },
});
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
await writeFile(out.replace(/\.png$/, '.html'), html);
console.log(`${items.length} items → ${out}`);

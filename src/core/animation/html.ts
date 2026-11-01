// AN15: the HTML web animation. One self-contained .html file: the animation as JSON, its pictures
// and fonts as data: URLs, and the player (core/animation/player.ts with draw.ts, bundled into one
// script at build time), so it plays at the stage's size, looping, in any browser without the
// internet — and with the Pause / Continue buttons of AN18.
import { faceFor, type FontFile } from '../text/fonts.ts';
import { fileNameOf } from '../project/relocate.ts';
import type { AnimObject, AnimationDoc, Id, Picture, TextObject } from './types.ts';

/** The id of the <script> that holds the animation's data; the player reads it. */
export const PAGE_DATA_ID = 'easymedia-animation';

/** What the page carries besides the document. */
export interface WebPageAssets {
  /** The player's script. */
  player: string;
  /** Each picture's file as a data: URL, by picture id. */
  pictures: Record<Id, string>;
  /** The font files the text needs, as data: URLs. */
  fonts: { face: FontFile; url: string }[];
}

/** What the player reads from the page. */
export interface PageData {
  doc: AnimationDoc;
  pictures: Record<Id, string>;
}

const texts = (objects: readonly AnimObject[]): TextObject[] =>
  objects.flatMap((o) => (o.kind === 'text' ? [o] : o.kind === 'group' ? texts(o.children) : []));

/** The bundled font files the animation's text uses, each once, in drawing order. */
export function fontsNeeded(doc: AnimationDoc): FontFile[] {
  const files = new Map<string, FontFile>();
  for (const t of texts(doc.layers.flatMap((l) => l.objects))) {
    const face = faceFor(t.font, t.bold, t.italic);
    if (face) files.set(face.file, face);
  }
  return [...files.values()];
}

const pictureIds = (objects: readonly AnimObject[]): Id[] =>
  objects.flatMap((o) =>
    o.kind === 'picture' ? [o.pictureId] : o.kind === 'group' ? pictureIds(o.children) : [],
  );

/** The pictures on the stage (a picture deleted from it stays in the list, for undo). */
export function picturesUsed(doc: AnimationDoc): Picture[] {
  const used = new Set(pictureIds(doc.layers.flatMap((l) => l.objects)));
  return doc.pictures.filter((p) => used.has(p.id));
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON that cannot end its <script>: every < is written as < (the same JSON). */
const scriptJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

/** Script text that cannot end its <script> early. */
const scriptCode = (code: string): string => code.replace(/<\/script/gi, '<\\/script');

const fontFace = ({ face, url }: WebPageAssets['fonts'][number]): string =>
  `@font-face { font-family: '${face.family}'; font-style: ${face.style}; ` +
  `font-weight: ${face.weight}; src: url('${url}') format('truetype'); }`;

export function webPage(doc: AnimationDoc, assets: WebPageAssets): string {
  const { width, height } = doc.stage;
  // Only the file name of each picture: the page must not show where the student keeps files.
  const data: PageData = {
    doc: { ...doc, pictures: doc.pictures.map((p) => ({ ...p, path: fileNameOf(p.path) })) },
    pictures: assets.pictures,
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="EasyMedia">
<title>${escapeHtml(doc.name)}</title>
<style>
${assets.fonts.map(fontFace).join('\n')}
html, body { margin: 0; height: 100%; background: #1d2026; }
body { display: flex; align-items: center; justify-content: center; }
#stage { display: block; max-width: 100vw; max-height: 100vh; width: ${width}px; height: auto; }
</style>
</head>
<body>
<canvas id="stage" width="${width}" height="${height}" aria-label="${escapeHtml(doc.name)}"></canvas>
<script type="application/json" id="${PAGE_DATA_ID}">${scriptJson(data)}</script>
<script>${scriptCode(assets.player)}</script>
</body>
</html>
`;
}

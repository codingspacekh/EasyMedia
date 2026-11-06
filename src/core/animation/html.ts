// AN15: the HTML web animation. One self-contained .html file: the animation as JSON, its pictures
// and fonts as data: URLs, and the player (core/animation/player.ts with draw.ts, bundled into one
// script at build time), so it plays at the stage's size, looping or (AN8) once, in any browser
// without the internet — and with the Pause / Continue buttons of AN18. AN15: a page may be of a
// part of the animation (a range of frames) or at another width; AN28: its sounds go inside it.
import { faceFor, fontFaceRule, type FontFile } from '../text/fonts.ts';
import { BUTTON_FONT } from './draw.ts';
import { pictureIdsOf } from './layers.ts';
import { fileNameOf } from '../project/relocate.ts';
import type { ProbeInfo } from '../ports.ts';
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
  /** AN28: each sound's file as a data: URL, by sound id. */
  sounds?: Record<Id, string>;
}

/** AN15: a page of a part of the animation, at another size. Absent: all of it, the stage's size. */
export interface WebPageView {
  size?: { width: number; height: number };
  /** The frames played, both shown. */
  range?: { first: number; last: number };
}

/** What the player reads from the page. */
export interface PageData extends WebPageView {
  doc: AnimationDoc;
  pictures: Record<Id, string>;
  sounds?: Record<Id, string>;
}

/**
 * AN28: a browser plays sound only after the page is clicked, so a page with sounds that is not
 * allowed to play them yet waits under this button; a click starts it, with its sounds.
 */
const SOUND_START_STYLE = `#sound-start { position: fixed; inset: 0; border: 0; background: rgba(0, 0, 0, 0.45); color: #fff; font: 600 20px system-ui, sans-serif; cursor: pointer; }`;

/** The font, weight and style of each text and button label, inside groups too. */
const lettering = (
  objects: readonly AnimObject[],
): Pick<TextObject, 'font' | 'bold' | 'italic'>[] =>
  objects.flatMap((o) =>
    o.kind === 'text'
      ? [o]
      : o.kind === 'button'
        ? [{ font: BUTTON_FONT, bold: false, italic: false }]
        : o.kind === 'group'
          ? lettering(o.children)
          : [],
  );

/** The bundled font files the animation's text and buttons use, each once, in drawing order. */
export function fontsNeeded(doc: AnimationDoc): FontFile[] {
  const files = new Map<string, FontFile>();
  for (const t of lettering(doc.layers.flatMap((l) => l.objects))) {
    const face = faceFor(t.font, t.bold, t.italic);
    if (face) files.set(face.file, face);
  }
  return [...files.values()];
}

/** The pictures on the stage (a picture deleted from it stays in the list, for undo). */
export function picturesUsed(doc: AnimationDoc): Picture[] {
  const used = new Set(pictureIdsOf(doc.layers.flatMap((l) => l.objects)));
  return doc.pictures.filter((p) => used.has(p.id));
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** JSON that cannot end its <script>: every < is written as < (the same JSON). */
const scriptJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

/** Script text that cannot end its <script> early. */
const scriptCode = (code: string): string => code.replace(/<\/script/gi, '<\\/script');

const fontFace = ({ face, url }: WebPageAssets['fonts'][number]): string => fontFaceRule(face, url);

export function webPage(doc: AnimationDoc, assets: WebPageAssets, view: WebPageView = {}): string {
  const { width, height } = view.size ?? doc.stage;
  const sounds = assets.sounds && Object.keys(assets.sounds).length > 0 ? assets.sounds : null;
  // Only the file name of each picture (and sound): the page must not show where the student
  // keeps files.
  const data: PageData = {
    doc: {
      ...doc,
      pictures: doc.pictures.map((p) => ({ ...p, path: fileNameOf(p.path) })),
      ...(doc.sounds
        ? { sounds: doc.sounds.map((s) => ({ ...s, path: fileNameOf(s.path) })) }
        : {}),
    },
    pictures: assets.pictures,
    ...(sounds ? { sounds } : {}),
    ...(view.size ? { size: view.size } : {}),
    ...(view.range ? { range: view.range } : {}),
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="OneEditor">
<title>${escapeHtml(doc.name)}</title>
<style>
${assets.fonts.map(fontFace).join('\n')}
html, body { margin: 0; height: 100%; background: #1d2026; }
body { display: flex; align-items: center; justify-content: center; }
/* The stage's size, or smaller to fit the window, never stretched. */
#stage { display: block; width: min(${width}px, 100vw, calc(100vh * ${width} / ${height})); height: auto; }${sounds ? `\n${SOUND_START_STYLE}` : ''}
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

/**
 * AN17: what the task checker reads from an exported web page: its stage size, frame rate and
 * length, and whether it loops (unless it was set to play once and stop). Null when it is not a
 * OneEditor page.
 */
export function webPageInfo(html: string, sizeBytes = html.length): ProbeInfo | null {
  const start = html.indexOf(`id="${PAGE_DATA_ID}">`);
  if (start < 0) return null;
  const from = start + PAGE_DATA_ID.length + 6;
  const end = html.indexOf('</script>', from);
  let data: PageData;
  try {
    data = JSON.parse(html.slice(from, end)) as PageData;
  } catch {
    return null;
  }
  const stage = data?.doc?.stage;
  if (!stage || !(stage.fps > 0) || !(stage.length > 0)) return null;
  // AN15: a page of a part plays only its frames, at the size it was exported at.
  const frames = data.range ? data.range.last - data.range.first + 1 : stage.length;
  const { width, height } = data.size ?? stage;
  return {
    kind: 'video',
    container: 'html',
    duration: frames / stage.fps,
    sizeBytes,
    video: { codec: 'canvas', width, height, fps: stage.fps },
    loop: stage.playOnce !== true,
  };
}

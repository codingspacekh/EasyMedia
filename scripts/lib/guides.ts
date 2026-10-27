// M12: the guides shipped with the app — the student user guide (docs/guide/user-guide.md) and
// the teacher notes, made from the syllabus map and the tools themselves so they stay true.
import { marked } from 'marked';
import { AUDIO_EFFECTS, EFFECTS, TRANSITIONS } from '../../src/core/effects/registry.ts';
import { TOOLS } from '../../src/core/effects/help.ts';
import type { SyllabusPoint } from '../../src/core/teaching/syllabus.ts';

/** The names students see for each syllabus label (menu items, effects, tools). */
function labelsBySyllabus(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const t of [...EFFECTS, ...AUDIO_EFFECTS, ...TRANSITIONS, ...TOOLS]) {
    const names = map.get(t.syllabus) ?? [];
    const label = t.label.replace('…', '');
    if (!names.includes(label)) names.push(label);
    map.set(t.syllabus, names);
  }
  return map;
}

const cell = (text: string) => text.replace(/\|/g, '\\|');

export function teacherNotes(points: readonly SyllabusPoint[]): string {
  const labels = labelsBySyllabus();
  const out: string[] = [
    '# EasyMedia — teacher notes',
    '',
    'Where each point of the Cambridge International AS & A Level IT (9626) syllabus, Chapters 11 and 20, is done in EasyMedia, and the tools for it. Every tool also has a "Why use this?" text in the app, and Learn mode has a glossary of the coursebooks\' key words.',
    '',
    "_Made by `npm run guides` from `src/core/teaching/syllabus.ts` and the app's tools: do not edit by hand._",
  ];
  for (const [section, title] of [
    ['11.1', '11.1 Video editing'],
    ['11.2', '11.2 Audio editing'],
    ['20.1', '20.1 Animation'],
  ] as const) {
    out.push('', `## ${title}`);
    let group = '';
    for (const p of points.filter((x) => x.section === section)) {
      if (p.group !== group) {
        group = p.group;
        out.push(
          '',
          `### ${group}`,
          '',
          '| Syllabus point | Where in EasyMedia | Tools |',
          '|---|---|---|',
        );
      }
      const tools = p.tools.flatMap((t) => labels.get(t) ?? []);
      out.push(`| ${cell(p.point)} | ${cell(p.where)} | ${cell(tools.join(', ') || '—')} |`);
    }
  }
  return `${out.join('\n')}\n`;
}

const STYLE = `
  body { font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d2433; background: #fff; max-width: 860px; margin: 0 auto; padding: 32px 24px 64px; }
  h1 { font-size: 30px; margin-top: 0; } h2 { margin-top: 36px; border-bottom: 1px solid #dde3ec; padding-bottom: 4px; } h3 { margin-top: 26px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; } th, td { border: 1px solid #dde3ec; padding: 6px 8px; text-align: left; vertical-align: top; } th { background: #f3f6fa; }
  code { background: #f3f6fa; padding: 1px 4px; border-radius: 4px; } kbd { border: 1px solid #c7cfdb; border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; font-size: 14px; }
  blockquote { margin: 12px 0; padding: 8px 14px; background: #f0f6ff; border-left: 4px solid #4f8cff; }
  @media print { body { max-width: none; padding: 0; } h2 { break-after: avoid; } table { break-inside: auto; } }
`;

/** A whole, self-contained web page (no scripts, nothing from the internet). */
export function guidePage(title: string, markdown: string): string {
  // Headings get ids made from their words (as GitHub does), for the contents links.
  const body = marked
    .parse(markdown, { async: false, gfm: true })
    .replace(/<h([1-4])>(.*?)<\/h\1>/g, (_, level: string, inner: string) => {
      const id = inner
        .replace(/<[^>]+>/g, '')
        .toLowerCase()
        .replace(/&[a-z]+;/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return `<h${level} id="${id}">${inner}</h${level}>`;
    });
  const safeTitle = title.replace(
    /[<>&]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!,
  );
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>EasyMedia — ${safeTitle}</title>\n<style>${STYLE}</style>\n</head>\n<body>\n${body}</body>\n</html>\n`;
}

// P1: reading and writing .mve project files (JSON).
import { ProjectFileError } from '../model/errors.ts';
import type { Project } from '../model/types.ts';
import { DAMAGED, migrate, type ProjectDocument } from './migrate.ts';

export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function deserializeProject(text: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProjectFileError(DAMAGED);
  }
  if (!isObject(raw)) throw new ProjectFileError(DAMAGED);
  const doc = migrate(raw);
  if (!isProject(doc)) throw new ProjectFileError(DAMAGED);
  return doc;
}

// ---- shape checks: enough to refuse files that are not projects or are damaged ----

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const has = (o: Obj, keys: string[], check: (v: unknown) => boolean) =>
  keys.every((k) => check(o[k]));
const listOf = (v: unknown, check: (item: Obj) => boolean) =>
  Array.isArray(v) && v.every((item) => isObject(item) && check(item));

function isProject(doc: ProjectDocument): doc is ProjectDocument & Project {
  const { settings, timeline } = doc;
  return (
    doc.schemaVersion === 1 &&
    isString(doc.name) &&
    isObject(settings) &&
    has(settings, ['width', 'height', 'fps'], isNumber) &&
    has(settings, ['aspect', 'background'], isString) &&
    listOf(doc.media, isMediaAsset) &&
    isObject(timeline) &&
    listOf(timeline.main, isMainItem) &&
    listOf(timeline.text, isTextItem) &&
    Array.isArray(timeline.audio) &&
    timeline.audio.length === 2 &&
    timeline.audio.every((track) => listOf(track, isAudioItem))
  );
}

function isMediaAsset(m: Obj): boolean {
  return (
    has(m, ['id', 'path'], isString) &&
    ['video', 'image', 'audio'].includes(m.kind as string) &&
    (m.duration === undefined || isNumber(m.duration))
  );
}

function isMainItem(m: Obj): boolean {
  if (!isString(m.id)) return false;
  switch (m.type) {
    case 'video':
      return (
        isString(m.assetId) &&
        has(m, ['in', 'out', 'speed', 'volume'], isNumber) &&
        typeof m.muted === 'boolean'
      );
    case 'image':
      return isString(m.assetId) && isNumber(m.duration);
    case 'title':
      return (
        isString(m.text) && isNumber(m.duration) && isObject(m.background) && isObject(m.style)
      );
    default:
      return false;
  }
}

function isTextItem(t: Obj): boolean {
  return (
    ['caption', 'subtitle', 'credits'].includes(t.kind as string) &&
    has(t, ['id', 'text'], isString) &&
    has(t, ['start', 'duration'], isNumber) &&
    isObject(t.style)
  );
}

function isAudioItem(a: Obj): boolean {
  return (
    has(a, ['id', 'assetId'], isString) &&
    has(a, ['start', 'in', 'out', 'volume', 'fadeIn', 'fadeOut'], isNumber)
  );
}

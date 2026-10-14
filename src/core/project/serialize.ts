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
    (settings.fit === undefined || isString(settings.fit)) &&
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
    (m.duration === undefined || isNumber(m.duration)) &&
    (m.hasAudio === undefined || typeof m.hasAudio === 'boolean')
  );
}

function isMainItem(m: Obj): boolean {
  if (!isString(m.id) || !hasValidLook(m)) return false;
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

/** Optional M7 settings: fade, filters, pan & zoom, transition (absent in older files). */
function hasValidLook(m: Obj): boolean {
  const optional = (value: unknown, check: (o: Obj) => boolean) =>
    value === undefined || (isObject(value) && check(value as Obj));
  const frame = (f: unknown) => isObject(f) && has(f as Obj, ['zoom', 'x', 'y'], isNumber);
  return (
    optional(
      m.fade,
      (f) => has(f, ['in', 'out'], isNumber) && ['black', 'white'].includes(f.colour as string),
    ) &&
    (m.effects === undefined ||
      (Array.isArray(m.effects) &&
        m.effects.every(
          (e) =>
            isObject(e) &&
            isString((e as Obj).effectId) &&
            isObject((e as Obj).params) &&
            Object.values((e as Obj).params as Obj).every(isNumber),
        ))) &&
    optional(
      m.panZoom,
      (z) =>
        frame(z.from) &&
        frame(z.to) &&
        [z.start, z.end].every((t) => t === undefined || isNumber(t)),
    ) &&
    optional(m.transitionIn, (t) => isString(t.effectId) && isNumber(t.duration))
  );
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

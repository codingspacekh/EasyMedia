// AN16: reading and writing .mvea animation files (JSON), with picture paths relative to the
// file (X1) and the version upgrades of core/project/migrate.ts.
import { ProjectFileError } from '../model/errors.ts';
import { migrate, type Migration, type ProjectDocument } from '../project/migrate.ts';
import { fromProjectPath, toProjectPath } from '../project/paths.ts';
import { isColour } from './rules.ts';
import type { AnimationDoc, ObjectKind } from './types.ts';

export const ANIMATION_SCHEMA = 3;
export const ANIMATION_DAMAGED = 'This file is not an EasyMedia animation, or it is damaged.';

/** Add an entry whenever the animation format changes (see core/project/migrate.ts). */
export const ANIMATION_MIGRATIONS: Record<number, Migration> = {
  /** Version 2 (M14): objects may carry keyframe tracks. A v1 file has none, so nothing changes. */
  1: (v1) => ({ ...v1, schemaVersion: 2 }),
  /** Version 3 (M15): motion paths, shape keyframes and mask layers; a v2 file has none. */
  2: (v2) => ({ ...v2, schemaVersion: 3 }),
};

export function serializeAnimation(doc: AnimationDoc): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function deserializeAnimation(text: string): AnimationDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProjectFileError(ANIMATION_DAMAGED);
  }
  if (!isObject(raw) || !Number.isInteger(raw.schemaVersion) || !Array.isArray(raw.layers))
    throw new ProjectFileError(ANIMATION_DAMAGED);
  const doc = migrate(raw, ANIMATION_MIGRATIONS, ANIMATION_SCHEMA);
  if (!isAnimation(doc)) throw new ProjectFileError(ANIMATION_DAMAGED);
  return doc;
}

const relocate = (doc: AnimationDoc, map: (path: string) => string): AnimationDoc => ({
  ...doc,
  pictures: doc.pictures.map((p) => ({ ...p, path: map(p.path) })),
});

export const animationToDisk = (doc: AnimationDoc, dir: string): AnimationDoc =>
  relocate(doc, (path) => toProjectPath(dir, path));

export const animationFromDisk = (doc: AnimationDoc, dir: string): AnimationDoc =>
  relocate(doc, (path) => fromProjectPath(dir, path));

// ---- shape checks: enough to refuse files that are not animations or are damaged ----

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const has = (o: Obj, keys: string[], check: (v: unknown) => boolean) =>
  keys.every((k) => check(o[k]));
const listOf = (v: unknown, check: (item: Obj) => boolean) =>
  Array.isArray(v) && v.every((item) => isObject(item) && check(item));

const KINDS: ObjectKind[] = [
  'rect',
  'ellipse',
  'star',
  'polygon',
  'path',
  'text',
  'picture',
  'group',
];

function isPaint(p: unknown): boolean {
  if (!isObject(p)) return false;
  switch (p.kind) {
    case 'none':
      return true;
    case 'solid':
      return isColour(p.colour);
    case 'linear':
      return isColour(p.from) && isColour(p.to) && isNumber(p.angle);
    case 'radial':
      return isColour(p.from) && isColour(p.to);
    default:
      return false;
  }
}

const isTrack = (t: Obj): boolean =>
  isString(t.property) &&
  listOf(
    t.keyframes,
    (k) =>
      isNumber(k.frame) &&
      (isNumber(k.value) ||
        isString(k.value) ||
        (isObject(k.value) && isPathPoints(k.value.points) && isBoolean(k.value.closed))) &&
      isString(k.easing) &&
      isBoolean(k.hold),
  ) &&
  (t.repeat === undefined || t.repeat === 'end' || isNumber(t.repeat));

const isPathPoints = (v: unknown) => listOf(v, (p) => has(p, ['x', 'y'], isNumber));

const isMotion = (m: unknown): boolean =>
  isObject(m) &&
  isPathPoints(m.points) &&
  has(m, ['closed', 'orient', 'even'], isBoolean) &&
  has(m, ['from', 'to'], isNumber) &&
  isString(m.easing);

function isAnimObject(o: Obj): boolean {
  if (!isString(o.kind) || !KINDS.includes(o.kind as ObjectKind)) return false;
  if (!has(o, ['id', 'name'], isString)) return false;
  if (!has(o, ['x', 'y', 'width', 'height', 'rotation', 'opacity'], isNumber)) return false;
  if (!isPaint(o.fill)) return false;
  if (o.stroke !== undefined) {
    if (!isObject(o.stroke) || !isColour(o.stroke.colour) || !isNumber(o.stroke.width))
      return false;
  }
  if (o.tracks !== undefined && !listOf(o.tracks, isTrack)) return false;
  if (o.motion !== undefined && !isMotion(o.motion)) return false;
  switch (o.kind) {
    case 'rect':
      return isNumber(o.radius);
    case 'star':
      return isNumber(o.points) && isNumber(o.inner);
    case 'polygon':
      return isNumber(o.sides);
    case 'path':
      return isBoolean(o.closed) && listOf(o.points, (p) => has(p, ['x', 'y'], isNumber));
    case 'text':
      return (
        has(o, ['text', 'font', 'align'], isString) &&
        isNumber(o.size) &&
        has(o, ['bold', 'italic'], isBoolean)
      );
    case 'picture':
      return isString(o.pictureId);
    case 'group':
      return listOf(o.children, isAnimObject);
    default:
      return true;
  }
}

function isAnimation(doc: ProjectDocument): doc is ProjectDocument & AnimationDoc {
  const { stage, guides, view } = doc;
  return (
    doc.schemaVersion === ANIMATION_SCHEMA &&
    isString(doc.name) &&
    isObject(stage) &&
    has(stage, ['width', 'height', 'fps', 'length'], isNumber) &&
    isColour(stage.background) &&
    listOf(
      doc.layers,
      (l) =>
        has(l, ['id', 'name'], isString) &&
        has(l, ['visible', 'locked'], isBoolean) &&
        listOf(l.objects, isAnimObject),
    ) &&
    listOf(doc.folders, (f) => has(f, ['id', 'name'], isString)) &&
    listOf(
      doc.pictures,
      (p) => has(p, ['id', 'path'], isString) && has(p, ['width', 'height'], isNumber),
    ) &&
    isObject(guides) &&
    Array.isArray(guides.x) &&
    Array.isArray(guides.y) &&
    isObject(view) &&
    isObject(view.grid) &&
    isObject(view.snap)
  );
}

// Creates model objects with the defaults students expect (P12).
import { EditError } from './errors.ts';
import type { Seconds } from './time.ts';
import type {
  AudioItem,
  Id,
  ImageClip,
  MediaAsset,
  Project,
  TextItem,
  TextStyle,
  TitleSlide,
  VideoClip,
} from './types.ts';

export const DEFAULT_STILL_DURATION: Seconds = 5;

interface WithId {
  id?: Id;
}

export function newId(): Id {
  return globalThis.crypto.randomUUID();
}

export function createProject({ name }: { name: string }): Project {
  return {
    schemaVersion: 1,
    name,
    settings: { aspect: '16:9', width: 1920, height: 1080, fps: 30, background: '#000000' },
    media: [],
    timeline: { main: [], text: [], audio: [[], []] },
  };
}

export function createMediaAsset(asset: Omit<MediaAsset, 'id'> & WithId): MediaAsset {
  return { ...asset, id: asset.id ?? newId() };
}

export function createVideoClip(asset: MediaAsset, { id }: WithId = {}): VideoClip {
  if (asset.kind !== 'video') throw new EditError(`${asset.path} is not a video.`);
  return {
    type: 'video',
    id: id ?? newId(),
    assetId: asset.id,
    in: 0,
    out: sourceLength(asset),
    speed: 1,
    muted: false,
    volume: 1,
  };
}

export function createImageClip(asset: MediaAsset, { id }: WithId = {}): ImageClip {
  if (asset.kind !== 'image') throw new EditError(`${asset.path} is not an image.`);
  return { type: 'image', id: id ?? newId(), assetId: asset.id, duration: DEFAULT_STILL_DURATION };
}

export function createTitleSlide(text: string, { id }: WithId = {}): TitleSlide {
  return {
    type: 'title',
    id: id ?? newId(),
    text,
    duration: DEFAULT_STILL_DURATION,
    background: { kind: 'colour', colour: '#000000' },
    style: textStyle({ size: 60, align: 'centre', position: 'centre' }),
  };
}

const TEXT_DEFAULTS: Record<TextItem['kind'], Partial<TextStyle>> = {
  caption: { size: 36, align: 'left', position: 'top-left' },
  subtitle: { size: 32, align: 'centre', position: 'bottom' },
  credits: { size: 36, align: 'centre', position: 'centre' },
};

export function createTextItem(
  kind: TextItem['kind'],
  text: string,
  start: Seconds,
  { id }: WithId = {},
): TextItem {
  return {
    kind,
    id: id ?? newId(),
    text,
    start,
    duration: DEFAULT_STILL_DURATION,
    style: textStyle(TEXT_DEFAULTS[kind]),
  };
}

export function createAudioItem(asset: MediaAsset, start: Seconds, { id }: WithId = {}): AudioItem {
  return {
    id: id ?? newId(),
    assetId: asset.id,
    start,
    in: 0,
    out: sourceLength(asset),
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
  };
}

function textStyle(overrides: Partial<TextStyle>): TextStyle {
  return {
    font: 'Inter',
    size: 36,
    colour: '#ffffff',
    bold: false,
    italic: false,
    align: 'centre',
    position: 'centre',
    ...overrides,
  };
}

function sourceLength(asset: MediaAsset): Seconds {
  if (asset.duration === undefined) {
    throw new EditError(`The length of ${asset.path} is unknown, so it cannot be placed yet.`);
  }
  return asset.duration;
}

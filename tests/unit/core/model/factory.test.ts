import { describe, expect, it } from 'vitest';
import {
  assetFromProbe,
  createAudioItem,
  createImageClip,
  createMediaAsset,
  createProject,
  createTextItem,
  createTitleSlide,
  createVideoClip,
} from '../../../../src/core/model/factory.ts';

const video = createMediaAsset({
  id: 'm1',
  kind: 'video',
  path: 'media/Lake_Naivasha.mp4',
  duration: 20,
});
const image = createMediaAsset({ id: 'm2', kind: 'image', path: 'media/Fish_Eagle1.jpg' });
const music = createMediaAsset({
  id: 'm3',
  kind: 'audio',
  path: 'media/Task_11e_audio.mp3',
  duration: 52,
});

describe('P12 factory defaults', () => {
  it('a new project is 16:9, 1920 × 1080, 30 fps, schema v1 and empty', () => {
    const p = createProject({ name: 'Lake Naivasha' });
    expect(p).toEqual({
      schemaVersion: 2,
      name: 'Lake Naivasha',
      settings: {
        aspect: '16:9',
        width: 1920,
        height: 1080,
        fps: 30,
        background: '#000000',
        fit: 'letterbox',
      },
      media: [],
      timeline: { main: [], text: [], audio: [[], []] },
    });
  });

  it('a video clip uses the whole source at normal speed with sound', () => {
    expect(createVideoClip(video, { id: 'c1' })).toEqual({
      type: 'video',
      id: 'c1',
      assetId: 'm1',
      in: 0,
      out: 20,
      speed: 1,
      muted: false,
      volume: 1,
    });
  });

  it('an image clip shows for 5 s by default', () => {
    expect(createImageClip(image, { id: 'c2' })).toEqual({
      type: 'image',
      id: 'c2',
      assetId: 'm2',
      duration: 5,
    });
  });

  it('a title slide is white text on black for 5 s', () => {
    expect(createTitleSlide('Lake Naivasha, Kenya', { id: 't1' })).toMatchObject({
      type: 'title',
      id: 't1',
      text: 'Lake Naivasha, Kenya',
      duration: 5,
      background: { kind: 'colour', colour: '#000000' },
      style: { colour: '#ffffff' },
    });
  });

  it('a caption starts where asked and lasts 5 s', () => {
    expect(createTextItem('caption', 'Over 400 species', 16.7, { id: 'x1' })).toMatchObject({
      kind: 'caption',
      id: 'x1',
      text: 'Over 400 species',
      start: 16.7,
      duration: 5,
    });
  });

  it('subtitles default to the bottom, captions to the top-left, credits scroll', () => {
    expect(createTextItem('subtitle', 'Hi', 0).style.position).toBe('bottom');
    expect(createTextItem('caption', 'Hi', 0).style.position).toBe('top-left');
    expect(createTextItem('credits', 'Filmed by', 0).style.position).toBe('centre');
  });

  it('an audio item plays its whole source from the given start', () => {
    expect(createAudioItem(music, 5, { id: 'a1' })).toEqual({
      id: 'a1',
      assetId: 'm3',
      start: 5,
      in: 0,
      out: 52,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
    });
  });

  it('gives every new item a unique id when none is supplied', () => {
    const ids = new Set([
      createImageClip(image).id,
      createImageClip(image).id,
      createTitleSlide('a').id,
    ]);
    expect(ids.size).toBe(3);
  });

  it('refuses to make a video clip from an image or a source without a duration', () => {
    expect(() => createVideoClip(image)).toThrow(/not a video/i);
    expect(() => createImageClip(video)).toThrow(/not an image/i);
    expect(() => createAudioItem(createMediaAsset({ kind: 'audio', path: 'x.mp3' }), 0)).toThrow(
      /length/i,
    );
  });
});

describe('assetFromProbe: importing a file records what the export needs', () => {
  it('a video remembers its length and whether it has sound', () => {
    const info = {
      kind: 'video' as const,
      container: 'mp4',
      duration: 20,
      sizeBytes: 1,
      audio: { codec: 'aac', sampleRate: 44100, channels: 2 },
    };
    expect(assetFromProbe('media/a.mp4', info, { id: 'a' })).toEqual({
      id: 'a',
      kind: 'video',
      path: 'media/a.mp4',
      duration: 20,
      hasAudio: true,
    });
    expect(assetFromProbe('media/b.mp4', { ...info, audio: undefined }, { id: 'b' }).hasAudio).toBe(
      false,
    );
  });

  it('a still image has no length and no sound', () => {
    const info = {
      kind: 'image' as const,
      container: 'jpg',
      sizeBytes: 1,
      video: { codec: 'mjpeg', width: 10, height: 10 },
    };
    expect(assetFromProbe('media/a.jpg', info, { id: 'i' })).toEqual({
      id: 'i',
      kind: 'image',
      path: 'media/a.jpg',
      hasAudio: false,
    });
  });
});

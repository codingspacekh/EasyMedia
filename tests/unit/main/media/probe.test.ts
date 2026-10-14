import { describe, expect, it } from 'vitest';
import { MediaError } from '../../../../src/core/model/errors.ts';
import { parseProbe } from '../../../../src/main/media/probe.ts';

// Shapes copied from real ffprobe 9.0.2 output for the fixture files.
const h264 = {
  codec_type: 'video',
  codec_name: 'h264',
  width: 1920,
  height: 1080,
  r_frame_rate: '30/1',
};
const aac = {
  codec_type: 'audio',
  codec_name: 'aac',
  sample_rate: '44100',
  channels: 2,
  bits_per_sample: 0,
  bit_rate: '128120',
};
const fmt = (format_name: string, extra: object = {}) => ({
  format_name,
  duration: '10.000000',
  size: '7274507',
  bit_rate: '5819606',
  ...extra,
});

describe('T1 parseProbe: what is inside a media file', () => {
  it('reads an MP4 video with sound', () => {
    expect(
      parseProbe({
        format: fmt('mov,mp4,m4a,3gp,3g2,mj2', { tags: { major_brand: 'isom' } }),
        streams: [h264, aac],
      }),
    ).toEqual({
      kind: 'video',
      container: 'mp4',
      duration: 10,
      sizeBytes: 7274507,
      bitRate: 5819606,
      video: { codec: 'h264', width: 1920, height: 1080, fps: 30 },
      audio: { codec: 'aac', sampleRate: 44100, channels: 2, bitRate: 128120 },
    });
  });

  it.each([
    ['mov,mp4,m4a,3gp,3g2,mj2', { major_brand: 'qt  ' }, 'mov'],
    ['avi', undefined, 'avi'],
    ['asf', undefined, 'wmv'],
    ['mpeg', undefined, 'mpg'],
    ['matroska,webm', undefined, 'mkv'],
  ])('names the %s container (brand %j) as %s', (format_name, tags, container) => {
    expect(parseProbe({ format: fmt(format_name, { tags }), streams: [h264] }).container).toBe(
      container,
    );
  });

  it('treats a JPG as a still image, not a 0.04 s video', () => {
    const info = parseProbe({
      format: fmt('image2', { duration: '0.040000' }),
      streams: [
        {
          codec_type: 'video',
          codec_name: 'mjpeg',
          width: 3764,
          height: 3092,
          r_frame_rate: '25/1',
        },
      ],
    });
    expect(info).toMatchObject({
      kind: 'image',
      container: 'jpg',
      video: { width: 3764, height: 3092 },
    });
    expect(info.duration).toBeUndefined();
    expect(info.video!.fps).toBeUndefined();
  });

  it.each([
    ['png_pipe', 'png', 'png'],
    ['bmp_pipe', 'bmp', 'bmp'],
    ['tiff_pipe', 'tiff', 'tiff'],
  ])('names a %s image as %s', (format_name, codec_name, container) => {
    const info = parseProbe({
      format: fmt(format_name),
      streams: [{ codec_type: 'video', codec_name, width: 10, height: 10 }],
    });
    expect([info.kind, info.container]).toEqual(['image', container]);
  });

  it('treats an MP3 with album art as audio and ignores the picture', () => {
    const cover = {
      codec_type: 'video',
      codec_name: 'mjpeg',
      width: 300,
      height: 300,
      disposition: { attached_pic: 1 },
    };
    const mp3 = {
      codec_type: 'audio',
      codec_name: 'mp3',
      sample_rate: '44100',
      channels: 1,
      bits_per_sample: 0,
    };
    const info = parseProbe({
      format: fmt('mp3', { duration: '5.000000' }),
      streams: [mp3, cover],
    });
    expect(info).toMatchObject({ kind: 'audio', container: 'mp3', duration: 5 });
    expect(info.video).toBeUndefined();
  });

  it('names M4A audio and WMA audio', () => {
    expect(
      parseProbe({
        format: fmt('mov,mp4,m4a,3gp,3g2,mj2', { tags: { major_brand: 'M4A ' } }),
        streams: [aac],
      }).container,
    ).toBe('m4a');
    expect(
      parseProbe({ format: fmt('asf'), streams: [{ ...aac, codec_name: 'wmav2' }] }).container,
    ).toBe('wma');
  });

  it('reports bit depth for WAV and FLAC but not for compressed audio', () => {
    const wav = {
      codec_type: 'audio',
      codec_name: 'pcm_s16le',
      sample_rate: '44100',
      channels: 1,
      bits_per_sample: 16,
    };
    const flac = {
      codec_type: 'audio',
      codec_name: 'flac',
      sample_rate: '48000',
      channels: 2,
      bits_per_sample: 0,
      bits_per_raw_sample: '24',
    };
    expect(parseProbe({ format: fmt('wav'), streams: [wav] }).audio!.bitDepth).toBe(16);
    expect(parseProbe({ format: fmt('flac'), streams: [flac] }).audio!.bitDepth).toBe(24);
    expect(
      parseProbe({ format: fmt('mp3'), streams: [{ ...aac, codec_name: 'mp3' }] }).audio!.bitDepth,
    ).toBeUndefined();
  });

  it('reads NTSC frame rates such as 30000/1001 as 29.97', () => {
    expect(
      parseProbe({ format: fmt('avi'), streams: [{ ...h264, r_frame_rate: '30000/1001' }] }).video!
        .fps,
    ).toBe(29.97);
  });

  it('refuses a file with no picture or sound', () => {
    expect(() => parseProbe({ format: fmt('mp3'), streams: [] })).toThrow(MediaError);
    expect(() => parseProbe({ format: fmt('mp3'), streams: [] })).toThrow(/no picture or sound/i);
  });
});

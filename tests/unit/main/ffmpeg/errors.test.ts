import { describe, expect, it } from 'vitest';
import { MediaError } from '../../../../src/core/model/errors.ts';
import { explainFfmpegError } from '../../../../src/main/ffmpeg/errors.ts';

describe('N11 FFmpeg errors in plain English', () => {
  it.each([
    [
      '/x/a.mp4: Invalid data found when processing input',
      /damaged, or it is not a video, sound or picture/i,
    ],
    ['/x/missing.mp4: No such file or directory', /could not be found/i],
    ['/x/out.mp4: Permission denied', /not allowed to read or save/i],
    ['av_interleaved_write_frame(): No space left on device', /disk is full/i],
    ["Unknown encoder 'h264_nvenc'", /export format is not available on this computer/i],
    ['Decoder (codec hevc) not found for input stream #0:0', /cannot read the format/i],
    ['Output file does not contain any stream', /no picture or sound/i],
  ])('%s', (stderr, message) => {
    expect(explainFfmpegError(stderr).message).toMatch(message);
  });

  it('falls back to a general message for anything else', () => {
    expect(explainFfmpegError('Something odd happened').message).toMatch(/something went wrong/i);
  });

  it('keeps the last lines of the technical output as detail for the teacher', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    const error = explainFfmpegError(lines);
    expect(error).toBeInstanceOf(MediaError);
    expect(error.detail.split('\n')).toEqual(
      Array.from({ length: 10 }, (_, i) => `line ${i + 20}`),
    );
  });
});

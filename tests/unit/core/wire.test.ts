import { describe, expect, it } from 'vitest';
import {
  EditError,
  JobCancelledError,
  MediaError,
  ProjectFileError,
} from '../../../src/core/model/errors.ts';
import { fromWire, toWire } from '../../../src/core/wire.ts';

describe('errors keep their kind and message across the process boundary', () => {
  it.each([
    new EditError('The end point must be after the start point.'),
    new MediaError('The file could not be found.', 'ffmpeg: No such file'),
    new ProjectFileError('This file is not an EasyMedia project, or it is damaged.'),
    new JobCancelledError(),
  ])('%s', (error) => {
    const back = fromWire(JSON.parse(JSON.stringify(toWire(error))));
    expect(back).toBeInstanceOf(error.constructor);
    expect(back.message).toBe(error.message);
    if (error instanceof MediaError) expect((back as MediaError).detail).toBe(error.detail);
  });

  it('unknown errors become a general message (no stack traces shown to students)', () => {
    const back = fromWire(toWire(new TypeError('x is undefined')));
    expect(back).toBeInstanceOf(Error);
    expect(back.message).toMatch(/something went wrong/i);
  });
});

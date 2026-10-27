import { describe, expect, it } from 'vitest';
import { EditError } from '../../../../src/core/model/errors.ts';
import type { ProbeInfo } from '../../../../src/core/ports.ts';
import {
  checkFile,
  parseTaskSpec,
  serializeTaskSpec,
  type TaskSpec,
} from '../../../../src/core/teaching/task-check.ts';

// Book B Task 11b: an MP4 at 1920 × 1080, 5 s long, with stereo sound at 44 100 Hz.
const spec: TaskSpec = {
  name: 'Task 11b',
  container: 'mp4',
  width: 1920,
  height: 1080,
  duration: 5,
  tolerance: 0.1,
  channels: 2,
  sampleRate: 44100,
};
const good: ProbeInfo = {
  kind: 'video',
  container: 'mp4',
  duration: 5.03,
  sizeBytes: 3_000_000,
  video: { codec: 'h264', width: 1920, height: 1080, fps: 30 },
  audio: { codec: 'aac', sampleRate: 44100, channels: 2 },
};
const failed = (info: ProbeInfo) =>
  checkFile(spec, info)
    .rows.filter((r) => !r.pass)
    .map((r) => r.label);

describe('T6 task checker', () => {
  it('passes a correct export, row by row', () => {
    const result = checkFile(spec, good);
    expect(result.pass).toBe(true);
    expect(result.rows.map((r) => [r.label, r.expected, r.actual, r.pass])).toEqual([
      ['File format', 'MP4', 'MP4', true],
      ['Resolution', '1920 × 1080', '1920 × 1080', true],
      ['Duration', '5.00 s ± 0.10 s', '5.03 s', true],
      ['Channels', '2 (stereo)', '2 (stereo)', true],
      ['Sample rate', '44 100 Hz', '44 100 Hz', true],
    ]);
  });

  it('fails an export with the wrong resolution', () => {
    const small = { ...good, video: { ...good.video!, width: 1280, height: 720 } };
    expect(checkFile(spec, small).pass).toBe(false);
    expect(failed(small)).toEqual(['Resolution']);
  });

  it('fails an export that is too long or too short', () => {
    expect(failed({ ...good, duration: 5.2 })).toEqual(['Duration']);
    expect(failed({ ...good, duration: 4.85 })).toEqual(['Duration']);
  });

  it('fails an export with the wrong channel count', () => {
    expect(failed({ ...good, audio: { ...good.audio!, channels: 1 } })).toEqual(['Channels']);
  });

  it('fails the wrong format and the wrong sample rate', () => {
    expect(failed({ ...good, container: 'mov' })).toEqual(['File format']);
    expect(failed({ ...good, audio: { ...good.audio!, sampleRate: 48000 } })).toEqual([
      'Sample rate',
    ]);
  });

  it('a file with no sound fails the sound rows; no picture fails the resolution', () => {
    const silent: ProbeInfo = { ...good, audio: undefined };
    expect(failed(silent)).toEqual(['Channels', 'Sample rate']);
    expect(checkFile(spec, silent).rows[3]!.actual).toBe('no sound');
    const sound: ProbeInfo = { ...good, container: 'mp4', video: undefined, kind: 'audio' };
    expect(checkFile(spec, sound).rows[1]!.actual).toBe('no picture');
  });

  it('only checks what the teacher set; the duration tolerance defaults to 0.5 s', () => {
    const result = checkFile(
      { name: 'Mono only', channels: 1, duration: 10 },
      {
        ...good,
        duration: 10.4,
        audio: { ...good.audio!, channels: 1 },
      },
    );
    expect(result.rows.map((r) => r.label)).toEqual(['Duration', 'Channels']);
    expect(result.rows[0]!.expected).toBe('10.00 s ± 0.50 s');
    expect(result.pass).toBe(true);
  });

  it('M14: an animated GIF can be the task (exam-style question 3), saved and opened again', () => {
    const gif: TaskSpec = { name: 'Films by Ying', container: 'gif', width: 600, height: 400 };
    const made: ProbeInfo = {
      kind: 'video',
      container: 'gif',
      duration: 4,
      sizeBytes: 900_000,
      video: { codec: 'gif', width: 600, height: 400 },
    };
    expect(checkFile(gif, made).pass).toBe(true);
    expect(parseTaskSpec(serializeTaskSpec(gif))).toEqual(gif);
  });

  it('saves a task as a small file and opens it again', () => {
    expect(parseTaskSpec(serializeTaskSpec(spec))).toEqual(spec);
  });

  it('refuses a file that is not a task check, or a task with nothing to check', () => {
    expect(() => parseTaskSpec('{"schemaVersion": 3, "tracks": []}')).toThrow(EditError);
    expect(() => parseTaskSpec('not json')).toThrow(/not an EasyMedia task/);
    expect(() => parseTaskSpec(serializeTaskSpec({ name: 'Empty' } as TaskSpec))).toThrow(
      /nothing to check/,
    );
    expect(() => parseTaskSpec(serializeTaskSpec({ ...spec, width: -5 }))).toThrow(EditError);
  });
});

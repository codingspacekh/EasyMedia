import { describe, expect, it } from 'vitest';
import { EditError } from '../../../../src/core/model/errors.ts';
import type { ProbeInfo } from '../../../../src/core/ports.ts';
import {
  checkFile,
  parseTaskSpec,
  sequenceInfo,
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
    expect(() => parseTaskSpec('not json')).toThrow(/not a OneEditor task/);
    expect(() => parseTaskSpec(serializeTaskSpec({ name: 'Empty' } as TaskSpec))).toThrow(
      /nothing to check/,
    );
    expect(() => parseTaskSpec(serializeTaskSpec({ ...spec, width: -5 }))).toThrow(EditError);
  });

  // AN17: animation exports — the frame rate and, for a GIF or a web page, looping.
  const anim: TaskSpec = {
    name: 'Star Designs',
    container: 'mp4',
    width: 600,
    height: 400,
    fps: 24,
    duration: 3,
  };
  const mp4: ProbeInfo = {
    kind: 'video',
    container: 'mp4',
    duration: 3,
    sizeBytes: 200_000,
    video: { codec: 'h264', width: 600, height: 400, fps: 24 },
  };

  it('AN17 an MP4 of a 600 × 400, 24 fps, 3 s animation passes; the same task at 30 fps fails', () => {
    const result = checkFile(anim, mp4);
    expect(result.rows.map((r) => r.label)).toEqual([
      'File format',
      'Resolution',
      'Frame rate',
      'Duration',
    ]);
    expect(result.rows[2]).toMatchObject({ expected: '24 fps', actual: '24 fps', pass: true });
    expect(result.pass).toBe(true);
    const at30 = checkFile({ ...anim, fps: 30 }, mp4);
    expect(at30.pass).toBe(false);
    expect(at30.rows.filter((r) => !r.pass).map((r) => r.label)).toEqual(['Frame rate']);
    expect(
      checkFile(anim, { ...mp4, video: { ...mp4.video!, fps: undefined } }).rows[2],
    ).toMatchObject({ actual: 'unknown', pass: false });
  });

  it('AN17 a GIF stores its frame times in hundredths of a second: 24 fps is kept as 25', () => {
    const gif: ProbeInfo = {
      ...mp4,
      container: 'gif',
      video: { ...mp4.video!, codec: 'gif', fps: 25 },
    };
    expect(checkFile({ ...anim, container: 'gif' }, gif).pass).toBe(true);
    expect(checkFile({ ...anim, container: 'gif', fps: 12 }, gif).pass).toBe(false);
  });

  it('AN17 looping: a GIF or web page that plays again and again, or one that plays once', () => {
    const task: TaskSpec = { name: 'Banner', container: 'gif', loop: true };
    const looping: ProbeInfo = { ...mp4, container: 'gif', loop: true };
    expect(checkFile(task, looping).rows.at(-1)).toMatchObject({
      label: 'Looping',
      expected: 'plays again and again',
      actual: 'plays again and again',
      pass: true,
    });
    expect(checkFile(task, { ...looping, loop: false }).rows.at(-1)).toMatchObject({
      actual: 'plays once',
      pass: false,
    });
    expect(checkFile({ ...task, loop: false }, { ...looping, loop: false }).pass).toBe(true);
    // An MP4 cannot say: the player decides.
    expect(checkFile(task, mp4).rows.at(-1)).toMatchObject({
      actual: 'not set in the file',
      pass: false,
    });
  });

  it('AN17 a PNG sequence is checked by its number of frames (the length × the frame rate)', () => {
    const png: ProbeInfo = {
      kind: 'image',
      container: 'png',
      sizeBytes: 9_000,
      video: { codec: 'png', width: 600, height: 400 },
    };
    const seq = sequenceInfo(png, 72);
    const task: TaskSpec = { ...anim, container: 'png' };
    const result = checkFile(task, seq);
    expect(result.rows.map((r) => r.label)).toEqual(['File format', 'Resolution', 'Frames']);
    expect(result.rows[2]).toMatchObject({
      expected: '72 (3 s × 24 fps)',
      actual: '72',
      pass: true,
    });
    expect(checkFile(task, sequenceInfo(png, 60)).pass).toBe(false);
    expect(seq.sizeBytes).toBe(9_000 * 72);
  });

  it('AN17 frame rate, looping, HTML and PNG are saved with the task and checked when opened', () => {
    const page: TaskSpec = {
      name: 'Task 4',
      container: 'html',
      width: 600,
      height: 400,
      fps: 24,
      loop: true,
    };
    expect(parseTaskSpec(serializeTaskSpec(page))).toEqual(page);
    expect(parseTaskSpec(serializeTaskSpec({ name: 'Seq', container: 'png', fps: 12 }))).toEqual({
      name: 'Seq',
      container: 'png',
      fps: 12,
    });
    expect(parseTaskSpec(serializeTaskSpec({ name: 'L', loop: false }))).toEqual({
      name: 'L',
      loop: false,
    });
    expect(() => parseTaskSpec(serializeTaskSpec({ ...page, fps: 0 }))).toThrow(/fps/);
    expect(() => parseTaskSpec(serializeTaskSpec({ ...page, loop: 'yes' as never }))).toThrow(
      /loop/i,
    );
  });
});

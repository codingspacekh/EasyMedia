// A14 recording a voiceover, X4 microphone access: the advice under the level meter and the
// messages when the microphone cannot be used.
import { describe, expect, it } from 'vitest';
import { levelAdvice, microphoneMessage } from '../../../../src/core/audio/recording.ts';
import { MicrophoneError } from '../../../../src/core/model/errors.ts';

describe('A14 input level advice (design screen 15)', () => {
  it('a good level: not too quiet, no clipping', () => {
    expect(levelAdvice(0.5)).toEqual({
      kind: 'good',
      text: 'Good level — not too quiet, no clipping',
    });
  });

  it('too quiet below −30 dB', () => {
    expect(levelAdvice(0.02).kind).toBe('quiet');
    expect(levelAdvice(0.02).text).toMatch(/closer to the microphone/);
  });

  it('too loud (clipping) at full level', () => {
    expect(levelAdvice(0.999).kind).toBe('loud');
    expect(levelAdvice(1).text).toMatch(/clipping/);
  });

  it('silence says it hears nothing', () => {
    expect(levelAdvice(0).kind).toBe('quiet');
    expect(levelAdvice(0).text).toMatch(/nothing/i);
  });
});

describe('X4 when the microphone cannot be used', () => {
  it('macOS: permission denied points to System Settings', () => {
    expect(microphoneMessage('denied', 'mac')).toBe(
      'EasyMedia is not allowed to use the microphone. Open System Settings ▸ Privacy & Security ▸ Microphone, turn on EasyMedia, then try again.',
    );
  });

  it('Windows: blocked by the Microphone privacy setting', () => {
    expect(microphoneMessage('denied', 'windows')).toMatch(
      /Settings ▸ Privacy & security ▸ Microphone/,
    );
    expect(microphoneMessage('denied', 'windows')).toMatch(/desktop apps/);
  });

  it('no microphone, or one that another app is using', () => {
    expect(microphoneMessage('none', 'mac')).toMatch(/No microphone found.*headset/);
    expect(microphoneMessage('busy', 'windows')).toMatch(/another app/);
  });

  it('MicrophoneError carries the problem and its message', () => {
    const e = new MicrophoneError('none', 'windows');
    expect(e.problem).toBe('none');
    expect(e.message).toBe(microphoneMessage('none', 'windows'));
  });
});

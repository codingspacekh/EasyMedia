// X4: on macOS the app asks the system for the microphone the first time and respects a "no";
// elsewhere (Windows) the browser's own check applies.
import { describe, expect, it, vi } from 'vitest';
import { microphoneAccess } from '../../../src/main/microphone.ts';

const prefs = (status: string, answer = true) => ({
  getMediaAccessStatus: vi.fn(() => status),
  askForMediaAccess: vi.fn(async () => answer),
});

describe('X4 microphone permission', () => {
  it('macOS, first time: asks the system and passes on the answer', async () => {
    const p = prefs('not-determined', false);
    expect(await microphoneAccess('darwin', p, false)()).toBe(false);
    expect(p.askForMediaAccess).toHaveBeenCalledWith('microphone');
  });

  it('macOS: already allowed, or refused / restricted, without asking again', async () => {
    expect(await microphoneAccess('darwin', prefs('granted'), false)()).toBe(true);
    for (const status of ['denied', 'restricted']) {
      const p = prefs(status);
      expect(await microphoneAccess('darwin', p, false)()).toBe(false);
      expect(p.askForMediaAccess).not.toHaveBeenCalled();
    }
  });

  it('Windows: the browser checks the Microphone privacy setting itself', async () => {
    const p = prefs('denied');
    expect(await microphoneAccess('win32', p, false)()).toBe(true);
    expect(p.getMediaAccessStatus).not.toHaveBeenCalled();
  });

  it('with the test microphone (end-to-end tests) the system is not asked', async () => {
    const p = prefs('not-determined');
    expect(await microphoneAccess('darwin', p, true)()).toBe(true);
    expect(p.askForMediaAccess).not.toHaveBeenCalled();
  });
});

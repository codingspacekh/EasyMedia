// File ▸ Candidate Details…: the centre and candidate number (and name) set once, kept in the
// preferences, and every Save and Export dialog then suggests <name>_<centre>_<candidate>, as the
// 9626 papers ask (Gas_ZZ999_9999).
import { describe, expect, it } from 'vitest';
import { defaultAudioExport } from '../../../src/core/render/audio-formats.ts';
import { testApp } from '../../helpers/test-app.ts';

const PREFS = '/prefs/preferences.json';
const DETAILS = { centre: 'kh012', number: '42', name: 'Sok Dara' };
const SAVED = { centre: 'KH012', number: '0042', name: 'Sok Dara' };

async function started(saved: unknown = { welcomeSeen: true }) {
  const t = testApp(undefined, { preferences: PREFS });
  t.disk.set(PREFS, JSON.stringify(saved));
  await t.app.start();
  return t;
}

describe('candidate details (exam file names)', () => {
  it('are kept in the preferences beside the other settings, and come back after a restart', async () => {
    const t = await started();
    expect(t.app.candidate.store.get().candidate).toBeNull();
    expect(await t.app.candidate.set(DETAILS)).toBeNull();
    expect(t.app.candidate.store.get().candidate).toEqual(SAVED);
    expect(JSON.parse(t.disk.get(PREFS)!)).toEqual({ welcomeSeen: true, candidate: SAVED });

    const again = await started(JSON.parse(t.disk.get(PREFS)!));
    expect(again.app.candidate.store.get().candidate).toEqual(SAVED);
  });

  it('wrong details are refused with the reason, and nothing is saved', async () => {
    const t = await started();
    expect(await t.app.candidate.set({ ...DETAILS, centre: 'K12' })).toEqual({
      field: 'centre',
      error: expect.stringMatching(/two letters and three digits/),
    });
    expect(t.app.candidate.store.get().candidate).toBeNull();
    expect(JSON.parse(t.disk.get(PREFS)!)).toEqual({ welcomeSeen: true });
  });

  it('damaged details in the preferences are ignored', async () => {
    const t = await started({ candidate: { centre: 'nonsense', number: 7 } });
    expect(t.app.candidate.store.get().candidate).toBeNull();
  });

  it('every Save and Export dialog suggests <name>_<centre>_<candidate>; cleared, the names are as before', async () => {
    const t = await started();
    await t.app.candidate.set(DETAILS);
    // Video mode: Save As and Export.
    await t.app.saveAs();
    expect(t.dialogs.saveProject).toHaveBeenLastCalledWith('Untitled_KH012_0042');
    await t.importFiles('/m/clip.mp4');
    t.app.addToTimeline(t.app.store.get().history.present.media[0]!.id);
    await t.app.exportVideo();
    expect(t.dialogs.exportVideo).toHaveBeenLastCalledWith('Untitled_KH012_0042', 'mp4');
    // Animation mode: Save As and Export.
    await t.app.animation.saveAs();
    expect(t.dialogs.saveAnimation).toHaveBeenLastCalledWith('Untitled_KH012_0042');
    await t.app.animation.exportAnimation('gif');
    expect(t.dialogs.exportAnimation).toHaveBeenLastCalledWith('Untitled_KH012_0042', 'gif');
    // Audio mode: Export.
    t.dialogs.openMedia.mockResolvedValueOnce(['/m/clip.mp4']);
    await t.app.audio.importAudio();
    await t.app.audio.exportAudio(defaultAudioExport({ rate: 44100, channels: 2 }));
    expect(t.dialogs.exportAudio).toHaveBeenLastCalledWith('clip_KH012_0042', 'mp3');

    await t.app.candidate.clear();
    expect(JSON.parse(t.disk.get(PREFS)!)).toEqual({ welcomeSeen: true });
    await t.app.saveAs();
    expect(t.dialogs.saveProject).toHaveBeenLastCalledWith('Untitled');
  });

  it('File ▸ Candidate Details… opens and closes its dialog', async () => {
    const t = await started();
    t.app.candidate.openDialog();
    expect(t.app.candidate.store.get().dialog).toBe(true);
    t.app.candidate.closeDialog();
    expect(t.app.candidate.store.get().dialog).toBe(false);
  });
});

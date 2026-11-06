// AN28: sounds in an animation — added from a file or the built-in sound effects at the playhead,
// moved, trimmed, made louder or quieter, faded, muted and deleted (each one undo step), heard
// while the animation plays, saved with it (paths relative to the file), packaged with it, and
// put into the MP4 and the web page.
import { describe, expect, it } from 'vitest';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import { IMAGE, testApp, VIDEO } from '../../helpers/test-app.ts';

const ALARM: ProbeInfo = {
  kind: 'audio',
  container: 'mp3',
  duration: 2,
  sizeBytes: 32_000,
  audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
};

/** A 4 s animation at 24 fps (96 frames), with the playhead at 1 s. */
function setup() {
  const t = testApp({ '/m/alarm.mp3': ALARM, '/m/photo.jpg': IMAGE, '/m/clip.mp4': VIDEO });
  const anim = t.app.animation;
  const stage = anim.store.get().history.present.stage;
  anim.setStage({ ...stage, width: 600, height: 400, fps: 24, length: 96 });
  anim.setFrame(24);
  const doc = () => anim.store.get().history.present;
  const sounds = () => doc().sounds ?? [];
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { ...t, anim, doc, sounds, flush, state: () => anim.store.get() };
}

async function withAlarm() {
  const s = setup();
  s.dialogs.openSound.mockResolvedValueOnce('/m/alarm.mp3');
  await s.anim.addSound();
  return { ...s, id: s.sounds()[0]!.id };
}

describe('sounds in an animation (AN28)', () => {
  it('AN28 Add sound…: the file chosen starts at the playhead, at its own length, one undo step', async () => {
    const s = await withAlarm();
    expect(s.sounds()).toEqual([
      { id: s.id, name: 'alarm.mp3', path: '/m/alarm.mp3', duration: 2, start: 24, volume: 100 },
    ]);
    expect(s.anim.isDirty()).toBe(true);
    s.anim.undo();
    expect(s.doc().sounds).toBeUndefined();
  });

  it('AN28 Add sound… refuses a picture or a video and says what to choose', async () => {
    const s = setup();
    s.dialogs.openSound.mockResolvedValueOnce('/m/photo.jpg');
    await s.anim.addSound();
    expect(s.state().message).toEqual({
      kind: 'error',
      text: 'Choose a sound file, such as an MP3 or WAV.',
    });
    s.dialogs.openSound.mockResolvedValueOnce('/m/clip.mp4');
    await s.anim.addSound();
    expect(s.doc().sounds).toBeUndefined();
  });

  it('AN28 X8 Add a sound effect…: made by the app, saved as a WAV in its folder, at the playhead', async () => {
    const s = setup();
    await s.anim.addSoundEffect('alarm-clock');
    expect(s.saveSound).toHaveBeenCalledWith('alarm-clock', expect.any(Uint8Array));
    expect(s.sounds()[0]).toMatchObject({
      name: 'Alarm clock',
      path: '/cache/sounds/alarm-clock.wav',
      effect: 'alarm-clock',
      start: 24,
      volume: 100,
    });
    expect(s.sounds()[0]!.duration).toBeGreaterThan(0.5);
    await s.anim.addSoundEffect('no-such-sound');
    expect(s.state().message?.text).toMatch(/no sound effect called/);
    expect(s.sounds()).toHaveLength(1);
  });

  it('AN28 moved (dragged, or a start typed in frames or seconds), trimmed, louder, faded, muted', async () => {
    const s = await withAlarm();
    s.anim.moveSound(s.id, 48);
    expect(s.sounds()[0]!.start).toBe(48);
    s.anim.moveSound(s.id, -10);
    expect(s.sounds()[0]!.start).toBe(0);
    expect(s.anim.setSoundStart(s.id, '1.5 s')).toBeNull();
    expect(s.sounds()[0]!.start).toBe(36);
    expect(s.anim.setSoundStart(s.id, '60')).toBeNull();
    expect(s.sounds()[0]!.start).toBe(60);
    expect(s.anim.setSoundStart(s.id, 'soon')).toMatch(/Type a frame number/);
    expect(s.anim.setSound(s.id, { volume: 150, fadeIn: 0.5, offset: 0.25, length: 1 })).toBeNull();
    expect(s.sounds()[0]).toMatchObject({ volume: 150, fadeIn: 0.5, offset: 0.25, length: 1 });
    expect(s.anim.setSound(s.id, { volume: 300 })).toMatch(/between 0 and 200 %/);
    expect(s.anim.setSound(s.id, { fadeOut: 0.75 })).toMatch(/fades together/);
    s.anim.setSound(s.id, { muted: true });
    expect(s.sounds()[0]!.muted).toBe(true);
    // Taking the trim off: heard to the end of its file again.
    expect(s.anim.setSound(s.id, { length: undefined, offset: undefined })).toBeNull();
    expect('length' in s.sounds()[0]! || 'offset' in s.sounds()[0]!).toBe(false);
    s.anim.undo();
    // Each change was one undo step.
    s.anim.undo();
    expect(s.sounds()[0]!.muted).toBeUndefined();
  });

  it('AN28 several sounds may overlap; Delete removes one (none left: no sounds at all)', async () => {
    const s = await withAlarm();
    await s.anim.addSoundEffect('ding');
    expect(s.sounds().map((x) => x.start)).toEqual([24, 24]);
    s.anim.removeSound(s.id);
    expect(s.sounds().map((x) => x.name)).toEqual(['Ding']);
    s.anim.removeSound(s.sounds()[0]!.id);
    expect(s.doc().sounds).toBeUndefined();
  });

  it('AN28 heard while playing: the mix from the playhead; Pause stops it; a loop starts it again', async () => {
    const s = await withAlarm();
    s.anim.setFrame(36); // half a second into the alarm
    s.anim.play();
    await s.flush();
    await s.flush();
    expect(s.animationAudio.played).toHaveLength(1);
    const played = s.animationAudio.played[0]!;
    expect(played.sampleRate).toBe(48000);
    // From frame 36 to the end (frame 96): 2.5 s, the alarm heard from the start.
    expect(played.channels[0]!.length).toBe(120_000);
    expect(Math.max(...played.channels[0]!.slice(0, 48_000).map(Math.abs))).toBeGreaterThan(0.1);
    expect(Math.max(...played.channels[0]!.slice(80_000).map(Math.abs))).toBe(0);
    const stops = s.animationAudio.stops;
    s.anim.pause();
    expect(s.animationAudio.stops).toBe(stops + 1);
  });

  it('AN28 an animation without sounds plays nothing on the speakers', async () => {
    const s = setup();
    s.anim.play();
    await s.flush();
    expect(s.animationAudio.played).toEqual([]);
    s.anim.pause();
  });

  it('AN28 X1 saved with paths relative to the file; opened again, a missing sound is named', async () => {
    const s = await withAlarm();
    s.dialogs.saveAnimation.mockResolvedValueOnce('/m/Alarm.mvea');
    await s.anim.saveAs();
    const saved = JSON.parse(s.disk.get('/m/Alarm.mvea')!);
    expect(saved.sounds[0].path).toBe('alarm.mp3');
    // On another computer without alarm.mp3: the rest opens, the sound is named.
    const other = testApp({});
    other.disk.set('/n/Alarm.mvea', s.disk.get('/m/Alarm.mvea')!);
    other.dialogs.openAnimation.mockResolvedValueOnce('/n/Alarm.mvea');
    await other.app.animation.open();
    const state = other.app.animation.store.get();
    expect(state.history.present.sounds![0]!.path).toBe('/n/alarm.mp3');
    expect(state.message).toEqual({
      kind: 'error',
      text: 'This sound could not be found, so it is not heard: alarm.mp3. Put it back beside the animation file and open it again.',
    });
  });

  it('AN28 X8 a sound effect whose file has gone (another computer) is made again', async () => {
    const s = setup();
    await s.anim.addSoundEffect('ding');
    s.dialogs.saveAnimation.mockResolvedValueOnce('/m/Ding.mvea');
    await s.anim.saveAs();
    const other = testApp({});
    other.disk.set('/n/Ding.mvea', s.disk.get('/m/Ding.mvea')!);
    other.dialogs.openAnimation.mockResolvedValueOnce('/n/Ding.mvea');
    await other.app.animation.open();
    const state = other.app.animation.store.get();
    expect(other.saveSound).toHaveBeenCalledWith('ding', expect.any(Uint8Array));
    expect(state.history.present.sounds![0]!.path).toBe('/cache/sounds/ding.wav');
    expect(state.message).toBeNull();
  });

  it('AN28 P2 Package copies the sound files into a sounds folder', async () => {
    const s = await withAlarm();
    s.dialogs.chooseFolder.mockResolvedValueOnce('/usb/Alarm');
    await s.anim.packageAnimation();
    expect(s.copies).toContainEqual(['/m/alarm.mp3', '/usb/Alarm/sounds/alarm.mp3']);
    const packaged = JSON.parse(s.disk.get('/usb/Alarm/Untitled.mvea')!);
    expect(packaged.sounds[0].path).toBe('sounds/alarm.mp3');
  });

  it('AN15 AN28 MP4: the sound goes into the video at its time', async () => {
    const s = await withAlarm();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Alarm.mp4');
    await s.anim.exportAnimation('mp4');
    expect(await s.engine.probe('/work/Alarm.mp4')).toMatchObject({
      container: 'mp4',
      duration: 4,
      audio: { codec: 'aac' },
    });
  });

  it('AN15 AN28 a GIF has no sound: the export says the sounds are left out', async () => {
    const s = await withAlarm();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Alarm.gif');
    await s.anim.exportAnimation('gif');
    expect((await s.engine.probe('/work/Alarm.gif')).audio).toBeUndefined();
    expect(s.state().message?.text).toBe(
      'Saved Alarm.gif. A GIF has no sound, so the animation’s sound is left out.',
    );
  });

  it('AN15 AN28 the web page carries the sound inside it; one that cannot be read is named', async () => {
    const s = await withAlarm();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Alarm.html');
    await s.anim.exportAnimation('html');
    const html = s.disk.get('/work/Alarm.html')!;
    expect(html).toContain(`"sounds":{"${s.id}":"data:audio/mpeg;base64,`);
    s.pageAssets.soundDataUrl.mockRejectedValueOnce(new Error('gone'));
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Alarm2.html');
    await s.anim.exportAnimation('html');
    expect(s.state().message?.text).toMatch(/without alarm\.mp3/);
  });

  it('AN28 M14 Send to Video mode: the MP4 carries the sound onto the video timeline', async () => {
    const s = await withAlarm();
    s.dialogs.saveAnimation.mockResolvedValueOnce('/m/Alarm.mvea');
    expect(await s.app.sendAnimationToVideo()).toBe(true);
    const project = s.app.store.get().history.present;
    const asset = project.media.find((m) => m.path === '/m/Alarm.mp4')!;
    expect(asset.hasAudio).toBe(true);
  });
});

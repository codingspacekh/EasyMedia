import { describe, expect, it, vi } from 'vitest';
import { makeSoundEffect } from '../../../src/core/audio/sound-effects.ts';
import { createProject } from '../../../src/core/model/factory.ts';
import { testApp } from '../../helpers/test-app.ts';

const text = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

describe('X8 built-in sound effects in Video mode: on the effects tracks at the playhead', () => {
  it('saves the sound as a WAV in the app folder, imports it once and puts it on effects track 1', async () => {
    const t = testApp();
    const project = () => t.app.store.get().history.present;
    t.app.setPlayhead(3);
    await t.app.addSoundEffect('pop');
    expect(t.saveSound).toHaveBeenCalledTimes(1);
    const [name, wav] = t.saveSound.mock.calls[0]!;
    expect(name).toBe('pop');
    expect([text(wav, 0), text(wav, 8)]).toEqual(['RIFF', 'WAVE']);
    const [asset] = project().media;
    expect(asset).toMatchObject({
      kind: 'audio',
      path: '/cache/sounds/pop.wav',
      soundEffect: 'pop',
      hasAudio: true,
    });
    expect(asset!.duration).toBeCloseTo(makeSoundEffect('pop', 48000)[0]!.length / 48000, 6);
    const [item] = project().timeline.audio[2]!;
    expect(item).toMatchObject({ assetId: asset!.id, start: 3 });
    expect(t.app.store.get().selection).toBe(item!.id);
    expect(t.app.store.get().history.past.at(-1)).toBeDefined();
  });

  it('the same sound again uses the same file; a second one at once goes on effects track 2 (V13: a third is explained)', async () => {
    const t = testApp();
    const project = () => t.app.store.get().history.present;
    t.app.setPlayhead(3);
    await t.app.addSoundEffect('pop');
    await t.app.addSoundEffect('pop');
    expect(project().media).toHaveLength(1);
    expect(t.saveSound).toHaveBeenCalledTimes(1);
    expect(project().timeline.audio[3]!.map((a) => a.start)).toEqual([3]);
    await t.app.addSoundEffect('pop');
    expect(t.app.store.get().message).toEqual({
      kind: 'error',
      text: 'Both sound effects tracks already have a sound at 3.00 s. Move one, or choose another time.',
    });
    expect(project().timeline.audio.flat()).toHaveLength(2);
  });

  it('an unknown sound is refused with a message', async () => {
    const t = testApp();
    await t.app.addSoundEffect('nope');
    expect(t.app.store.get().message?.kind).toBe('error');
    expect(t.app.store.get().history.present.media).toEqual([]);
  });

  it('a project opened where its sound effect file is missing makes the file again', async () => {
    const t = testApp();
    const saved = {
      ...createProject({ name: 'Task' }),
      media: [
        {
          id: 'e',
          kind: 'audio',
          path: 'gone/pop.wav',
          duration: 0.15,
          hasAudio: true,
          soundEffect: 'pop',
        },
      ],
    };
    t.disk.set('/p/task.mve', JSON.stringify(saved));
    t.dialogs.openProject.mockResolvedValueOnce('/p/task.mve');
    await t.app.open();
    await vi.waitFor(() => expect(t.app.store.get().assets.e?.state).toBe('ready'));
    expect(t.saveSound.mock.calls.map((c) => c[0])).toEqual(['pop']);
    expect(t.app.store.get().history.present.media[0]!.path).toBe('/cache/sounds/pop.wav');
  });
});

describe('X8 built-in sound effects in Audio mode: a new track at the cursor', () => {
  it('adds the sound as a track named after it, starting at the selection start', () => {
    const t = testApp();
    const audio = t.app.audio;
    audio.addSoundEffect('ding');
    const doc = () => audio.store.get().history.present;
    const [track] = doc().tracks;
    expect(track!.name).toBe('Ding');
    expect(track!.clips[0]!.offset).toBe(0);
    expect(track!.clips[0]!.out).toBe(makeSoundEffect('ding', doc().rate)[0]!.length);
    audio.setSelectionStart(2);
    audio.addSoundEffect('whoosh');
    const whoosh = doc().tracks[1]!;
    expect([whoosh.name, whoosh.channelCount, whoosh.clips[0]!.offset]).toEqual(['Whoosh', 2, 2]);
    expect(audio.store.get().selection.tracks).toEqual([whoosh.id]);
  });

  it('an unknown sound is refused with a message', () => {
    const t = testApp();
    t.app.audio.addSoundEffect('nope');
    expect(t.app.audio.store.get().message).not.toBeNull();
    expect(t.app.audio.store.get().history.present.tracks).toEqual([]);
  });
});

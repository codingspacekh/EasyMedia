// P1, P3, P7 for Audio mode: its session is saved with the project, each track's sound in an
// exact 32-bit WAV file, and opened again exactly as it was.
import { describe, expect, it, vi } from 'vitest';
import { createAudioApp, SILENT_OUTPUT } from '../../../src/app/audio.ts';
import { createMockMediaEngine } from '../../../src/adapters/mock/media-engine.ts';
import type { Dialogs, ProbeInfo } from '../../../src/core/ports.ts';

const sound = (duration: number, channels: number): ProbeInfo => ({
  kind: 'audio',
  container: 'mp3',
  duration,
  sizeBytes: 1000,
  audio: { codec: 'mp3', sampleRate: 44100, channels, bitDepth: 16 },
});

function setup(
  engine = createMockMediaEngine({ '/m/music.mp3': sound(2, 2), '/m/voice.mp3': sound(1, 1) }),
) {
  const dialogs = {
    openMedia: vi.fn<Dialogs['openMedia']>(async () => []),
    exportAudio: vi.fn<Dialogs['exportAudio']>(async () => null),
  };
  const audio = createAudioApp({ engine, dialogs, output: SILENT_OUTPUT });
  const doc = () => audio.store.get().history.present;
  return {
    engine,
    audio,
    doc,
    async open(...paths: string[]) {
      dialogs.openMedia.mockResolvedValueOnce(paths);
      await audio.importAudio();
    },
  };
}

describe('P1 for Audio mode: saving and opening the session', () => {
  it('there is nothing to save until a sound is imported', async () => {
    const s = setup();
    expect(s.audio.isDirty()).toBe(false);
    expect(await s.audio.saveSession('/p/Task audio')).toBeNull();
    await s.open('/m/music.mp3');
    expect(s.audio.isDirty()).toBe(true);
  });

  it('saves each track as an exact 32-bit WAV in the folder, with its name, place, gain and pan', async () => {
    const s = setup();
    const encode = vi.spyOn(s.engine, 'encodeAudio');
    await s.open('/m/music.mp3', '/m/voice.mp3');
    const voice = s.doc().tracks[1]!;
    s.audio.timeShift(voice.id, 11);
    s.audio.setTrack(voice.id, { gain: -3, pan: 0.5, name: 'Voiceover' });
    const session = await s.audio.saveSession('/p/Task_11p audio');
    expect(session).toEqual({
      rate: 44100,
      tracks: [
        {
          id: s.doc().tracks[0]!.id,
          name: 'music',
          file: '/p/Task_11p audio/track-1.wav',
          offset: 0,
          gain: 0,
          pan: 0,
          bits: 16,
        },
        {
          id: voice.id,
          name: 'Voiceover',
          file: '/p/Task_11p audio/track-2.wav',
          offset: 11,
          gain: -3,
          pan: 0.5,
          bits: 16,
        },
      ],
    });
    expect(encode).toHaveBeenCalledTimes(2);
    expect(encode.mock.calls[1]![2]).toMatchObject({
      format: 'wav',
      bitDepth: 32,
      sampleRate: 44100,
      channels: 1,
    });
    expect(s.audio.isDirty()).toBe(false);
  });

  it('opening the saved session gives exactly the same samples, tracks and rate', async () => {
    const s = setup();
    await s.open('/m/music.mp3', '/m/voice.mp3');
    s.audio.select({ start: 0.5, end: 1 });
    s.audio.applyEffect('audio.amplify', { gain: -6, allowClipping: 0 });
    const session = await s.audio.saveSession('/p/a');
    const again = setup(s.engine);
    await again.audio.openSession(session);
    expect(again.doc().rate).toBe(44100);
    expect(again.doc().tracks).toEqual(s.doc().tracks);
    expect(again.audio.isDirty()).toBe(false);
    expect(again.audio.store.get().history.past).toEqual([]);
  });

  it('saving again rewrites only the tracks that changed', async () => {
    const s = setup();
    await s.open('/m/music.mp3', '/m/voice.mp3');
    await s.audio.saveSession('/p/a');
    const encode = vi.spyOn(s.engine, 'encodeAudio');
    await s.audio.saveSession('/p/a');
    expect(encode).not.toHaveBeenCalled();
    s.audio.select({ start: 0, end: 0.5, tracks: [s.doc().tracks[1]!.id] });
    s.audio.applyEffect('audio.fadein', {});
    await s.audio.saveSession('/p/a');
    expect(encode).toHaveBeenCalledTimes(1);
    expect(encode.mock.calls[0]![1]).toBe('/p/a/track-2.wav');
  });

  it('a track that moves to another file (one before it removed) is written again', async () => {
    const s = setup();
    await s.open('/m/music.mp3', '/m/voice.mp3');
    await s.audio.saveSession('/p/a');
    s.audio.select({ start: 0, end: 0, tracks: [s.doc().tracks[0]!.id] });
    s.audio.removeTracks();
    const encode = vi.spyOn(s.engine, 'encodeAudio');
    const session = await s.audio.saveSession('/p/a');
    expect(session!.tracks.map((t) => t.file)).toEqual(['/p/a/track-1.wav']);
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it('a missing WAV file is reported; the other tracks still open', async () => {
    const s = setup();
    await s.open('/m/music.mp3');
    const session = (await s.audio.saveSession('/p/a'))!;
    const again = setup(s.engine);
    await again.audio.openSession({
      ...session,
      tracks: [
        ...session.tracks,
        { ...session.tracks[0]!, id: 'x', name: 'Lost', file: '/p/a/gone.wav' },
      ],
    });
    expect(again.doc().tracks.map((t) => t.name)).toEqual(['music']);
    expect(again.audio.store.get().message).toEqual({
      kind: 'error',
      text: expect.stringMatching(/sound of the track "Lost" could not be found/),
    });
  });

  it('a new project starts Audio mode empty, with nothing unsaved', async () => {
    const s = setup();
    await s.open('/m/music.mp3');
    s.audio.reset();
    expect(s.doc().tracks).toEqual([]);
    expect(s.audio.isDirty()).toBe(false);
    await s.audio.openSession(null);
    expect(s.doc().tracks).toEqual([]);
  });
});

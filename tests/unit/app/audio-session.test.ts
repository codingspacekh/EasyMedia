// P1, P3, P7 for Audio mode: its session is saved with the project, each clip's sound in an
// exact 32-bit WAV file, and opened again exactly as it was.
import { describe, expect, it, vi } from 'vitest';
import { createAudioApp, SILENT_OUTPUT } from '../../../src/app/audio.ts';
import { createMockMediaEngine } from '../../../src/adapters/mock/media-engine.ts';
import type { Dialogs, ProbeInfo } from '../../../src/core/ports.ts';
import { sameSamples } from '../../helpers/samples.ts';

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

type Tracks = ReturnType<ReturnType<typeof setup>['doc']>['tracks'];
/** Exactly the same tracks and clips, sample for sample (see sameSamples). */
function expectSameTracks(actual: Tracks, expected: Tracks) {
  const settings = (tracks: Tracks) =>
    tracks.map(({ clips, ...rest }) => ({
      ...rest,
      clips: clips.map(({ source, ...clip }) => ({ ...clip, channels: source.length })),
    }));
  expect(settings(actual)).toEqual(settings(expected));
  actual.forEach((t, i) =>
    t.clips.forEach((clip, j) =>
      clip.source.forEach((c, k) =>
        expect(
          sameSamples(c, expected[i]!.clips[j]!.source[k]!),
          `track ${i}, clip ${j}, channel ${k}`,
        ).toBe(true),
      ),
    ),
  );
}

describe('P1 for Audio mode: saving and opening the session', () => {
  it('there is nothing to save until a sound is imported', async () => {
    const s = setup();
    expect(s.audio.isDirty()).toBe(false);
    expect(await s.audio.saveSession('/p/Task audio')).toBeNull();
    await s.open('/m/music.mp3');
    expect(s.audio.isDirty()).toBe(true);
  });

  it('saves the sound of each clip as an exact 32-bit WAV in the folder; tracks with name, gain and pan', async () => {
    const s = setup();
    const encode = vi.spyOn(s.engine, 'encodeAudio');
    await s.open('/m/music.mp3', '/m/voice.mp3');
    const [music, voice] = s.doc().tracks;
    const clip = voice!.clips[0]!.id;
    s.audio.moveClip(clip, 11);
    s.audio.setTrack(voice!.id, { gain: -3, pan: 0.5, name: 'Voiceover' });
    const session = await s.audio.saveSession('/p/Task_11p audio');
    expect(session).toEqual({
      rate: 44100,
      tracks: [
        {
          id: music!.id,
          name: 'music',
          channels: 2,
          clips: [
            {
              id: music!.clips[0]!.id,
              file: `/p/Task_11p audio/clip-${music!.clips[0]!.id}.wav`,
              offset: 0,
              in: 0,
              out: 88200,
            },
          ],
          gain: 0,
          pan: 0,
          bits: 16,
        },
        {
          id: voice!.id,
          name: 'Voiceover',
          channels: 1,
          clips: [
            { id: clip, file: `/p/Task_11p audio/clip-${clip}.wav`, offset: 11, in: 0, out: 44100 },
          ],
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

  it('opening the saved session gives exactly the same samples, clips, tracks and rate', async () => {
    const s = setup();
    await s.open('/m/music.mp3', '/m/voice.mp3');
    s.audio.select({ start: 0.5, end: 1 });
    s.audio.applyEffect('audio.amplify', { gain: -6, allowClipping: 0 });
    s.audio.setPosition(0.25);
    s.audio.split();
    s.audio.trimClip(s.doc().tracks[1]!.clips[0]!.id, 'start', 0.1);
    const session = await s.audio.saveSession('/p/a');
    const again = setup(s.engine);
    await again.audio.openSession(session);
    expect(again.doc().rate).toBe(44100);
    expectSameTracks(again.doc().tracks, s.doc().tracks);
    expect(again.audio.isDirty()).toBe(false);
    expect(again.audio.store.get().history.past).toEqual([]);
  });

  it('saving again rewrites only the clips whose sound changed', async () => {
    const s = setup();
    await s.open('/m/music.mp3', '/m/voice.mp3');
    await s.audio.saveSession('/p/a');
    const encode = vi.spyOn(s.engine, 'encodeAudio');
    await s.audio.saveSession('/p/a');
    expect(encode).not.toHaveBeenCalled();
    const voice = s.doc().tracks[1]!.clips[0]!.id;
    s.audio.moveClip(voice, 3); // moving or trimming writes no sound
    await s.audio.saveSession('/p/a');
    expect(encode).not.toHaveBeenCalled();
    s.audio.select({ start: 3, end: 3.5, tracks: [s.doc().tracks[1]!.id] });
    s.audio.applyEffect('audio.fadein', {});
    await s.audio.saveSession('/p/a');
    expect(encode).toHaveBeenCalledTimes(1);
    expect(encode.mock.calls[0]![1]).toBe(`/p/a/clip-${voice}.wav`);
  });

  it('the two halves of a split clip share one file', async () => {
    const s = setup();
    await s.open('/m/music.mp3');
    s.audio.setPosition(1);
    s.audio.split();
    const session = await s.audio.saveSession('/p/a');
    const [left, right] = session!.tracks[0]!.clips;
    expect(right!.file).toBe(left!.file);
    expect([left!.in, left!.out, right!.in, right!.out]).toEqual([0, 44100, 44100, 88200]);
  });

  it('a file is written again when undo brings back sound that a later save replaced', async () => {
    const s = setup();
    await s.open('/m/music.mp3');
    await s.audio.saveSession('/p/a');
    s.audio.selectAll();
    s.audio.applyEffect('audio.fadein', {});
    await s.audio.saveSession('/p/a');
    await s.audio.undo();
    const encode = vi.spyOn(s.engine, 'encodeAudio');
    const session = await s.audio.saveSession('/p/a');
    expect(encode).toHaveBeenCalledTimes(1);
    const again = setup(s.engine);
    await again.audio.openSession(session);
    expectSameTracks(again.doc().tracks, s.doc().tracks);
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
        {
          ...session.tracks[0]!,
          id: 'x',
          name: 'Lost',
          clips: [{ id: 'gone', file: '/p/a/gone.wav', offset: 0 }],
        },
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

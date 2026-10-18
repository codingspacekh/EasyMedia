import { describe, expect, it, vi } from 'vitest';
import { createAudioApp, type AudioOutput } from '../../../src/app/audio.ts';
import { createMockMediaEngine } from '../../../src/adapters/mock/media-engine.ts';
import { peak } from '../../../src/core/audio/dsp/volume.ts';
import { trackDuration } from '../../../src/core/audio/pcm.ts';
import { JobCancelledError } from '../../../src/core/model/errors.ts';
import type { Dialogs, ProbeInfo } from '../../../src/core/ports.ts';
import { defaultAudioExport } from '../../../src/core/render/audio-formats.ts';

const sound = (duration: number, channels = 2, sampleRate = 44100): ProbeInfo => ({
  kind: 'audio',
  container: 'mp3',
  duration,
  sizeBytes: 1000,
  audio: { codec: 'mp3', sampleRate, channels },
});

function setup() {
  const engine = createMockMediaEngine({
    '/m/Task_11j_audio_1.mp3': sound(4),
    '/m/Task_11j_audio_2.mp3': sound(6),
    '/m/voice.wav': { ...sound(2, 1, 48000), container: 'wav' },
    '/m/clip.mp4': {
      kind: 'video',
      container: 'mp4',
      duration: 3,
      sizeBytes: 1,
      video: { codec: 'h264', width: 640, height: 360 },
      audio: { codec: 'aac', sampleRate: 44100, channels: 2 },
    },
    '/m/photo.jpg': {
      kind: 'image',
      container: 'jpg',
      sizeBytes: 1,
      video: { codec: 'mjpeg', width: 9, height: 9 },
    },
  });
  const dialogs = {
    openMedia: vi.fn<Dialogs['openMedia']>(async () => []),
    exportAudio: vi.fn<Dialogs['exportAudio']>(async () => null),
  };
  const played: { seconds: number; channels: number; loop: boolean }[] = [];
  let ended: (() => void) | null = null;
  const output: AudioOutput = {
    play: vi.fn((audio, { loop, onEnded }) => {
      played.push({
        seconds: audio.channels[0]!.length / audio.sampleRate,
        channels: audio.channels.length,
        loop,
      });
      ended = onEnded;
    }),
    stop: vi.fn(),
    elapsed: () => 0.5,
  };
  const audio = createAudioApp({ engine, dialogs, output });
  const state = () => audio.store.get();
  const doc = () => state().history.present;
  const importFiles = async (...paths: string[]) => {
    dialogs.openMedia.mockResolvedValueOnce(paths);
    await audio.importAudio();
  };
  return { audio, engine, dialogs, output, played, state, doc, importFiles, end: () => ended?.() };
}

describe('A1 importing sound into Audio mode', () => {
  it('each file becomes a track named after it, with its channels and sample rate', async () => {
    const { doc, importFiles, state } = setup();
    await importFiles('/m/Task_11j_audio_1.mp3');
    expect(doc().rate).toBe(44100);
    expect(doc().tracks).toHaveLength(1);
    const [track] = doc().tracks;
    expect(track!.name).toBe('Task_11j_audio_1');
    expect(track!.channels).toHaveLength(2);
    expect(trackDuration(track!, 44100)).toBeCloseTo(4);
    expect(state().selection.tracks).toEqual([track!.id]);
    expect(state().history.past.map((c) => c.label)).toEqual(['Import Task_11j_audio_1.mp3']);
  });

  it('A2 "Import audio as new track": the next file is added below, at the project rate', async () => {
    const { doc, importFiles } = setup();
    await importFiles('/m/Task_11j_audio_1.mp3');
    await importFiles('/m/voice.wav');
    expect(doc().tracks.map((t) => t.name)).toEqual(['Task_11j_audio_1', 'voice']);
    expect(trackDuration(doc().tracks[1]!, doc().rate)).toBeCloseTo(2);
    expect(doc().tracks[1]!.channels).toHaveLength(1);
  });

  it('takes the sound of a video file; explains a file without sound', async () => {
    const { doc, importFiles, state } = setup();
    await importFiles('/m/clip.mp4', '/m/photo.jpg');
    expect(doc().tracks.map((t) => t.name)).toEqual(['clip']);
    expect(state().message).toMatchObject({
      kind: 'error',
      text: expect.stringMatching(/no sound/i),
    });
  });

  it('a cancelled open dialog changes nothing', async () => {
    const { doc, audio } = setup();
    await audio.importAudio();
    expect(doc().tracks).toEqual([]);
  });
});

describe('A5 selection with numbers (Selection start / end, Audio position)', () => {
  it('typed times set the selection; the length and sample count follow', async () => {
    const { audio, importFiles, state } = setup();
    await importFiles('/m/Task_11j_audio_1.mp3');
    expect(audio.setSelectionStart(1)).toBeNull();
    expect(audio.setSelectionEnd(2.5)).toBeNull();
    expect(state().selection).toMatchObject({ start: 1, end: 2.5 });
    expect(audio.selectionInfo()).toEqual({ length: 1.5, samples: 66150 });
  });

  it('an end before the start is refused with an explanation', async () => {
    const { audio, importFiles } = setup();
    await importFiles('/m/Task_11j_audio_1.mp3');
    audio.setSelectionStart(2);
    expect(audio.setSelectionEnd(1)).toMatch(/after the selection start/i);
  });

  it('a start after the end moves the end with it (a cursor)', async () => {
    const { audio, importFiles, state } = setup();
    await importFiles('/m/Task_11j_audio_1.mp3');
    audio.setSelectionEnd(1);
    audio.setSelectionStart(3);
    expect(state().selection).toMatchObject({ start: 3, end: 3 });
  });

  it('Select all takes every track from 0 to the end', async () => {
    const { audio, importFiles, state, doc } = setup();
    await importFiles('/m/Task_11j_audio_1.mp3', '/m/Task_11j_audio_2.mp3');
    audio.selectAll();
    expect(state().selection).toEqual({ start: 0, end: 6, tracks: doc().tracks.map((t) => t.id) });
  });

  it('clicking a track selects it; with Shift it is added', async () => {
    const { audio, importFiles, state, doc } = setup();
    await importFiles('/m/Task_11j_audio_1.mp3', '/m/Task_11j_audio_2.mp3');
    const [a, b] = doc().tracks.map((t) => t.id);
    audio.selectTrack(a!);
    expect(state().selection.tracks).toEqual([a]);
    audio.selectTrack(b!, true);
    expect(state().selection.tracks).toEqual([a, b]);
    audio.selectTrack(a!, true);
    expect(state().selection.tracks).toEqual([b]);
  });

  it('Audio position is the playhead, never below 0', async () => {
    const { audio, state } = setup();
    audio.setPosition(19.1);
    expect(state().position).toBe(19.1);
    audio.setPosition(-1);
    expect(state().position).toBe(0);
  });
});

describe('A5 cut, copy, paste, delete, trim, insert silence — and A18 undo', () => {
  async function oneTrack() {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_2.mp3'); // 6 s
    return s;
  }
  const length = (s: ReturnType<typeof setup>) => trackDuration(s.doc().tracks[0]!, 44100);

  it('Book B 11.2.4: select 19.1 s → after the end, Cut: only the start remains', async () => {
    const s = await oneTrack();
    s.audio.select({ start: 1.5, end: 8 });
    s.audio.cut();
    expect(length(s)).toBeCloseTo(1.5, 5);
    expect(s.state().clipboard?.channels[0]!.length).toBe(4.5 * 44100);
    expect(s.state().history.past.at(-1)!.label).toBe('Cut 1.50 – 8.00 s');
  });

  it('copy then paste at the cursor makes the track longer', async () => {
    const s = await oneTrack();
    s.audio.select({ start: 1, end: 2 });
    s.audio.copy();
    s.audio.select({ start: 3, end: 3 });
    s.audio.paste();
    expect(length(s)).toBeCloseTo(7, 5);
  });

  it('paste without copying first explains what to do', async () => {
    const s = await oneTrack();
    s.audio.paste();
    expect(s.state().message?.text).toMatch(/copy or cut/i);
  });

  it('delete, trim to selection and insert silence', async () => {
    const s = await oneTrack();
    s.audio.select({ start: 0, end: 1 });
    s.audio.deleteSelection();
    expect(length(s)).toBeCloseTo(5, 5);
    s.audio.select({ start: 1, end: 3 });
    s.audio.trimToSelection();
    expect(length(s)).toBeCloseTo(2, 5);
    s.audio.select({ start: 1, end: 1 });
    s.audio.insertSilence(0.5);
    expect(length(s)).toBeCloseTo(2.5, 5);
  });

  it('an edit that is not allowed shows why and changes nothing', async () => {
    const s = await oneTrack();
    s.audio.select({ start: 2, end: 2 });
    s.audio.cut();
    expect(s.state().message).toMatchObject({
      kind: 'error',
      text: expect.stringMatching(/select some sound/i),
    });
    expect(s.state().history.past).toHaveLength(1);
  });

  it('undo and redo step back and forward through the edits', async () => {
    const s = await oneTrack();
    const original = [...s.doc().tracks[0]!.channels[0]!];
    s.audio.select({ start: 0, end: 1 });
    s.audio.deleteSelection();
    s.audio.undo();
    expect([...s.doc().tracks[0]!.channels[0]!]).toEqual(original);
    s.audio.redo();
    expect(length(s)).toBeCloseTo(5, 5);
  });
});

describe('effects on the selection', () => {
  it('A3 Normalise with the defaults: −1 dB peak; undo restores the exact samples', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    const before = [...s.doc().tracks[0]!.channels[0]!];
    s.audio.selectAll();
    expect(
      s.audio.applyEffect('audio.normalise', s.audio.effectSettings('audio.normalise')),
    ).toBeNull();
    expect(peak(s.doc().tracks[0]!.channels)).toBeCloseTo(0.891, 3);
    expect(s.state().history.past.at(-1)!.label).toBe('Normalise 0.00 – 4.00 s');
    s.audio.undo();
    expect([...s.doc().tracks[0]!.channels[0]!]).toEqual(before);
  });

  it('A4 Amplify suggests the largest gain without clipping and refuses to clip', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3'); // mock tone peak 0.5
    s.audio.selectAll();
    const suggested = s.audio.effectSettings('audio.amplify');
    expect(suggested.gain).toBeCloseTo(6.02, 1);
    expect(s.audio.applyEffect('audio.amplify', { ...suggested, gain: 12 })).toMatch(/clip/i);
    expect(s.state().history.past).toHaveLength(1);
    expect(s.audio.effectNote('audio.amplify', suggested)).toMatch(/new peak/i);
  });

  it('A8 Change speed 2×: the selection lasts half as long', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    s.audio.selectAll();
    s.audio.applyEffect('audio.speed', { speed: 2, percent: 100 });
    expect(trackDuration(s.doc().tracks[0]!, 44100)).toBeCloseTo(2, 3);
  });

  it('A7 fades need no settings; settings outside the limits are refused', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    s.audio.select({ start: 0, end: 1 });
    expect(s.audio.applyEffect('audio.fadein', {})).toBeNull();
    expect(s.doc().tracks[0]!.channels[0]![0]).toBe(0);
    expect(s.audio.applyEffect('audio.speed', { speed: 0, percent: -100 })).toMatch(/between/);
    expect(s.audio.applyEffect('audio.nothing', {})).toMatch(/not available/i);
  });

  it('A13 noise reduction, step 1: Get noise profile remembers the selected noise (not an edit)', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    expect(s.audio.getNoiseProfile()).toMatch(/select a part/i); // nothing selected yet
    const steps = s.state().history.past.length;
    s.audio.select({ start: 1, end: 2 });
    expect(s.audio.getNoiseProfile()).toBeNull();
    expect(s.state().noiseProfile).toMatchObject({ start: 1, end: 2 });
    expect(s.state().history.past).toHaveLength(steps);
    expect(s.state().message).toEqual({
      kind: 'info',
      text: 'Noise profile taken from 1.00 – 2.00 s. Now select the sound to clean (Ctrl/Cmd + A for all) and open Noise reduction again.',
    });
    s.audio.select({ start: 1, end: 1.01 });
    expect(s.audio.getNoiseProfile()).toMatch(/longer/);
    expect(s.state().noiseProfile).toMatchObject({ start: 1, end: 2 }); // the old one is kept
  });

  it('A13 step 2: reducing needs the profile; with it, it is one undo step and can be previewed', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    s.audio.selectAll();
    const params = s.audio.effectSettings('audio.noise');
    expect(s.audio.applyEffect('audio.noise', params)).toMatch(/first get a noise profile/i);
    expect(s.audio.previewEffect('audio.noise', params)).toMatch(/first get a noise profile/i);
    s.audio.select({ start: 0, end: 1 });
    s.audio.getNoiseProfile();
    s.audio.selectAll();
    const steps = s.state().history.past.length;
    expect(s.audio.previewEffect('audio.noise', params)).toBeNull();
    expect(s.audio.applyEffect('audio.noise', params)).toBeNull();
    expect(s.state().history.past).toHaveLength(steps + 1);
    expect(s.audio.effectNote('audio.noise', params)).toMatch(/12 dB quieter/);
  });

  it('A19 the selection in blocks, as levels in dB (for the compressor before / after picture)', async () => {
    const s = setup();
    expect(s.audio.selectionLevels(10)).toEqual([]); // nothing to show
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    s.audio.selectAll();
    const levels = s.audio.selectionLevels(10);
    expect(levels).toHaveLength(10);
    const loudest = 20 * Math.log10(peak(s.doc().tracks[0]!.channels));
    expect(Math.max(...levels)).toBeCloseTo(loudest, 5);
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(-60); // silence shows as −60 dB
  });

  it('A18 Preview plays the effect on (at most 6 s of) the selection without changing it', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_2.mp3');
    s.audio.selectAll();
    s.audio.previewEffect('audio.amplify', { gain: -6, allowClipping: 0 });
    expect(s.played.at(-1)).toMatchObject({ seconds: 6, loop: false });
    expect(s.state().history.past).toHaveLength(1);
  });
});

describe('A2, A6, A15 Tracks menu', () => {
  async function twoTracks() {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3', '/m/Task_11j_audio_2.mp3');
    return s;
  }

  it('Book B 11.2.5: move track up, select all, align end to end, mix and render', async () => {
    const s = await twoTracks();
    const second = s.doc().tracks[1]!.id;
    s.audio.selectTrack(second);
    s.audio.moveTrack(-1);
    expect(s.doc().tracks[0]!.id).toBe(second);
    s.audio.selectAll();
    s.audio.alignEndToEnd();
    expect(s.doc().tracks[1]!.offset).toBeCloseTo(6);
    s.audio.mixAndRender();
    expect(s.doc().tracks).toHaveLength(1);
    expect(trackDuration(s.doc().tracks[0]!, 44100)).toBeCloseTo(10);
    expect(s.state().selection.tracks).toEqual([s.doc().tracks[0]!.id]);
  });

  it('mix and render to a new track keeps the originals', async () => {
    const s = await twoTracks();
    s.audio.selectAll();
    s.audio.mixAndRender(true);
    expect(s.doc().tracks.map((t) => t.name)).toEqual([
      'Task_11j_audio_1',
      'Task_11j_audio_2',
      'Mix',
    ]);
  });

  it('A15 stereo to mono; align start to the cursor and to zero', async () => {
    const s = await twoTracks();
    const [a] = s.doc().tracks;
    s.audio.selectTrack(a!.id);
    s.audio.stereoToMono();
    expect(s.doc().tracks[0]!.channels).toHaveLength(1);
    s.audio.select({ start: 2.5, end: 2.5 });
    s.audio.alignStart('cursor');
    expect(s.doc().tracks[0]!.offset).toBe(2.5);
    s.audio.alignStart('zero');
    expect(s.doc().tracks[0]!.offset).toBe(0);
  });

  it('add a new empty track, remove tracks, time-shift a track', async () => {
    const s = await twoTracks();
    s.audio.addTrack(2);
    expect(s.doc().tracks.at(-1)).toMatchObject({ name: 'Audio track 3' });
    expect(s.doc().tracks.at(-1)!.channels).toHaveLength(2);
    s.audio.removeTracks();
    expect(s.doc().tracks).toHaveLength(2);
    s.audio.timeShift(s.doc().tracks[1]!.id, 1.234567);
    expect(s.doc().tracks[1]!.offset).toBeCloseTo(1.234567, 4);
    s.audio.timeShift(s.doc().tracks[1]!.id, -3);
    expect(s.doc().tracks[1]!.offset).toBe(0);
  });

  it('gain, pan and name are undoable; mute and solo are not edits', async () => {
    const s = await twoTracks();
    const id = s.doc().tracks[0]!.id;
    s.audio.setTrack(id, { gain: -6, pan: 0.5, name: 'Piano' });
    expect(s.doc().tracks[0]).toMatchObject({ gain: -6, pan: 0.5, name: 'Piano' });
    const steps = s.state().history.past.length;
    s.audio.toggleMute(id);
    s.audio.toggleSolo(id);
    expect(s.state().muted).toEqual([id]);
    expect(s.state().solo).toEqual([id]);
    expect(s.state().history.past).toHaveLength(steps);
  });
});

describe('A18 play, pause, stop and loop', () => {
  it('plays from the playhead to the end, and the selection when there is one', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_2.mp3');
    s.audio.setPosition(2);
    s.audio.play();
    expect(s.played.at(-1)).toMatchObject({ seconds: 4, channels: 2, loop: false });
    expect(s.state().playing).toBe(true);
    s.audio.stop();
    expect(s.state()).toMatchObject({ playing: false, position: 2 });
    s.audio.select({ start: 1, end: 2 });
    s.audio.toggleLoop();
    s.audio.play();
    expect(s.played.at(-1)).toMatchObject({ seconds: 1, loop: true });
  });

  it('pause keeps the place; the playhead follows while playing', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_2.mp3');
    s.audio.setPosition(1);
    s.audio.play();
    expect(s.audio.currentPosition()).toBeCloseTo(1.5);
    s.audio.pause();
    expect(s.state()).toMatchObject({ playing: false, position: 1.5 });
  });

  it('stops by itself at the end', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_2.mp3');
    s.audio.play();
    s.end();
    expect(s.state().playing).toBe(false);
  });

  it('muted tracks are not heard; solo plays only the solo tracks', async () => {
    const s = setup();
    await s.importFiles('/m/voice.wav', '/m/Task_11j_audio_2.mp3');
    const [voice, music] = s.doc().tracks.map((t) => t.id);
    s.audio.toggleMute(music!);
    s.audio.play();
    expect(s.played.at(-1)).toMatchObject({ seconds: 2, channels: 1 });
    s.audio.stop();
    s.audio.toggleMute(music!);
    s.audio.toggleSolo(voice!);
    s.audio.play();
    expect(s.played.at(-1)).toMatchObject({ seconds: 2 });
  });
});

describe('A16, A17 export', () => {
  it('asks where to save, then exports the mix in the chosen format', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    s.dialogs.exportAudio.mockResolvedValueOnce('/out/Task_11j.mp3');
    const settings = { ...defaultAudioExport({ rate: 44100, channels: 2 }), channels: 1 as const };
    await s.audio.exportAudio(settings);
    expect(s.dialogs.exportAudio).toHaveBeenCalledWith('Task_11j_audio_1', 'mp3');
    expect(s.state().exporting).toEqual({ state: 'done', output: '/out/Task_11j.mp3' });
    expect(await s.engine.probe('/out/Task_11j.mp3')).toMatchObject({
      container: 'mp3',
      duration: 4,
      audio: { channels: 1, sampleRate: 44100 },
    });
  });

  it('the summary shows the length, estimated size and the same sound as a WAV', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    const summary = s.audio.exportSummary(defaultAudioExport({ rate: 44100, channels: 2 }));
    expect(summary.duration).toBeCloseTo(4);
    expect(summary.bytes).toBeCloseTo(64_000, -3);
    expect(summary.wavBytes).toBeCloseTo(44100 * 2 * 2 * 4 + 44, -2);
  });

  it('there is nothing to export without sound; a cancelled dialog exports nothing', async () => {
    const s = setup();
    await s.audio.exportAudio(defaultAudioExport({ rate: 44100, channels: 2 }));
    expect(s.state().message?.text).toMatch(/import a sound/i);
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    await s.audio.exportAudio(defaultAudioExport({ rate: 44100, channels: 2 }));
    expect(s.state().exporting).toEqual({ state: 'idle' });
  });

  it('settings a format cannot have are explained', async () => {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    s.dialogs.exportAudio.mockResolvedValueOnce('/out/x.mp3');
    await s.audio.exportAudio({
      ...defaultAudioExport({ rate: 44100, channels: 2 }),
      sampleRate: 96000,
    });
    expect(s.state().exporting).toMatchObject({
      state: 'failed',
      message: expect.stringMatching(/96 000/),
    });
  });
});

describe('refusals, cancelling and clean-up', () => {
  async function ready() {
    const s = setup();
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    return s;
  }

  it('menu actions without a selection explain what to do', async () => {
    const s = await ready();
    s.audio.select({ start: 0, end: 1, tracks: [] });
    for (const action of [
      () => s.audio.removeTracks(),
      () => s.audio.moveTrack(1),
      () => s.audio.mixAndRender(),
      () => s.audio.copy(),
    ]) {
      s.audio.dismissMessage();
      action();
      expect(s.state().message?.text).toMatch(/select a track/i);
    }
    s.audio.selectAll();
    s.audio.select({ start: 9, end: 10 });
    s.audio.applyNow('audio.fadeout');
    expect(s.state().message?.text).toMatch(/no sound in the selection/i);
  });

  it('solo and mute switch off again; undo / redo availability', async () => {
    const s = await ready();
    const id = s.doc().tracks[0]!.id;
    s.audio.toggleSolo(id);
    s.audio.toggleSolo(id);
    s.audio.toggleMute(id);
    s.audio.toggleMute(id);
    expect([s.state().solo, s.state().muted]).toEqual([[], []]);
    expect([s.audio.canUndo(), s.audio.canRedo()]).toEqual([true, false]);
    s.audio.undo();
    expect([s.audio.canUndo(), s.audio.canRedo()]).toEqual([false, true]);
  });

  it('effect settings, notes and preview for unknown effects or no sound', async () => {
    const s = await ready();
    expect(s.audio.effectSettings('audio.nothing')).toEqual({});
    expect(s.audio.previewEffect('audio.nothing', {})).toMatch(/not available/i);
    s.audio.select({ start: 8, end: 9 });
    expect(s.audio.effectNote('audio.amplify', { gain: 0, allowClipping: 0 })).toBeNull();
    expect(s.audio.previewEffect('audio.amplify', { gain: 0, allowClipping: 0 })).toMatch(
      /select some sound/i,
    );
    s.audio.select({ start: 0, end: 1 });
    expect(s.audio.previewEffect('audio.speed', { speed: 0, percent: -100 })).toMatch(/between/);
  });

  it('playing with nothing to hear explains it; the playhead loops with the selection', async () => {
    const s = setup();
    s.audio.play();
    expect(s.state().message?.text).toMatch(/import a sound/i);
    expect(s.audio.exportSummary(defaultAudioExport({ rate: 44100, channels: 2 })).duration).toBe(
      0,
    );
    await s.importFiles('/m/Task_11j_audio_1.mp3');
    s.audio.select({ start: 1, end: 1.2 });
    s.audio.toggleLoop();
    s.audio.play();
    expect(s.audio.currentPosition()).toBeCloseTo(1.1); // 0.5 s played of a 0.2 s loop
  });

  it('a WAV keeps its sample resolution (bits) for the track details', async () => {
    const s = setup();
    s.engine.addFile('/m/deep.wav', {
      ...sound(1, 1),
      container: 'wav',
      audio: { codec: 'pcm_s24le', sampleRate: 44100, channels: 1, bitDepth: 24 },
    });
    await s.importFiles('/m/deep.wav');
    expect(s.doc().tracks[0]!.bits).toBe(24);
  });

  it('an export can be cancelled; a failed one is explained', async () => {
    const s = await ready();
    s.dialogs.exportAudio.mockResolvedValue('/out/x.wav');
    const settings = {
      ...defaultAudioExport({ rate: 44100, channels: 2 }),
      format: 'wav' as const,
    };
    s.engine.encodeAudio = () => {
      let reject!: (e: Error) => void;
      const done = new Promise<void>((_, r) => (reject = r));
      done.catch(() => {});
      return { id: 'slow', done, cancel: () => reject(new JobCancelledError()) };
    };
    const running = s.audio.exportAudio(settings);
    await vi.waitFor(() => expect(s.state().exporting.state).toBe('running'));
    s.audio.cancelExport();
    await running;
    expect(s.state().exporting).toEqual({ state: 'idle' });
    s.engine.encodeAudio = () => {
      const done = Promise.reject(new Error('disk full'));
      done.catch(() => {});
      return { id: 'x', done, cancel: () => {} };
    };
    await s.audio.exportAudio(settings);
    expect(s.state().exporting).toEqual({
      state: 'failed',
      message: 'Something went wrong. Please try again.',
    });
  });

  it('dispose stops the sound', async () => {
    const s = await ready();
    s.audio.dispose();
    expect(s.output.stop).toHaveBeenCalled();
  });
});

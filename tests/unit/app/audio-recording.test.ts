// A14 Recording a voiceover / overdubbing (design screen 15), with a fake microphone (X4).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioApp, type AudioOutput } from '../../../src/app/audio.ts';
import { createMockMediaEngine } from '../../../src/adapters/mock/media-engine.ts';
import { createMockRecorder } from '../../../src/adapters/mock/recorder.ts';
import type { Dialogs, ProbeInfo } from '../../../src/core/ports.ts';

const MUSIC: ProbeInfo = {
  kind: 'audio',
  container: 'mp3',
  duration: 4,
  sizeBytes: 1000,
  audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
};
const tone = (seconds: number, rate: number, amp = 0.5) =>
  Float32Array.from({ length: Math.round(seconds * rate) }, (_, i) => amp * Math.sin(i / 5));

function setup(rate = 48000) {
  const engine = createMockMediaEngine({ '/m/music.mp3': MUSIC });
  const dialogs = {
    openMedia: vi.fn<Dialogs['openMedia']>(async () => []),
    exportAudio: vi.fn<Dialogs['exportAudio']>(async () => null),
  };
  const output: AudioOutput = { play: vi.fn(), stop: vi.fn(), elapsed: () => 0 };
  const recorder = createMockRecorder({ rate });
  const audio = createAudioApp({ engine, dialogs, output, recorder });
  const state = () => audio.store.get();
  const doc = () => state().history.present;
  return {
    audio,
    output,
    recorder,
    state,
    doc,
    async music() {
      dialogs.openMedia.mockResolvedValueOnce(['/m/music.mp3']);
      await audio.importAudio();
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('A14 the recording panel', () => {
  it('opens the default microphone, lists the others and shows the input level', async () => {
    const s = setup();
    await s.audio.openRecorder();
    expect(s.state().recording).toMatchObject({
      phase: 'ready',
      microphoneId: 'built-in',
      label: 'Built-in Microphone',
      overdub: true,
      countIn: true,
    });
    expect(s.state().recording!.microphones.map((m) => m.label)).toEqual([
      'Built-in Microphone',
      'Headset Microphone (USB)',
    ]);
    s.recorder.speak(tone(0.1, 48000, 0.5));
    expect(s.state().recording!.level).toBeCloseTo(0.5, 2);
  });

  it('the level holds a peak for a moment, then falls back (a voice has pauses)', async () => {
    const s = setup();
    await s.audio.openRecorder();
    s.recorder.speak(tone(0.05, 48000, 0.5));
    s.recorder.speak(new Float32Array(4800)); // 0.1 s of silence
    expect(s.state().recording!.level).toBeGreaterThan(0.3);
    s.recorder.speak(new Float32Array(96000)); // 2 s of silence
    expect(s.state().recording!.level).toBeLessThan(0.01);
  });

  it('while the microphone is opening, recording cannot start yet', async () => {
    const s = setup();
    const opening = s.audio.openRecorder();
    await Promise.resolve();
    expect(s.state().recording!.phase).toBe('opening');
    s.audio.startRecording();
    expect(s.state().recording!.phase).toBe('opening');
    await opening;
    expect(s.state().recording!.phase).toBe('ready');
  });

  it('choosing another microphone opens that one', async () => {
    const s = setup();
    await s.audio.openRecorder();
    await s.audio.chooseMicrophone('usb');
    expect(s.state().recording).toMatchObject({
      microphoneId: 'usb',
      label: 'Headset Microphone (USB)',
    });
    expect(s.recorder.isOpen).toBe(true);
  });

  it('X4: a refused microphone shows why and how to fix it; nothing is opened', async () => {
    const s = setup();
    s.recorder.refuse('denied');
    await s.audio.openRecorder();
    expect(s.state().recording).toBeNull();
    expect(s.state().message).toEqual({
      kind: 'error',
      text: expect.stringMatching(/System Settings ▸ Privacy & Security ▸ Microphone/),
    });
  });

  it('closing the panel closes the microphone and keeps nothing', async () => {
    const s = setup();
    await s.audio.openRecorder();
    s.audio.closeRecorder();
    expect(s.recorder.isOpen).toBe(false);
    expect(s.state().recording).toBeNull();
  });
});

describe('A14 recording into a new track at the playhead', () => {
  it('counts in 3, 2, 1; what is heard during the count-in is not kept', async () => {
    const s = setup();
    await s.audio.openRecorder();
    s.audio.startRecording();
    expect(s.state().recording).toMatchObject({ phase: 'count-in', countdown: 3 });
    s.recorder.speak(tone(0.5, 48000));
    vi.advanceTimersByTime(1000);
    expect(s.state().recording!.countdown).toBe(2);
    vi.advanceTimersByTime(2000);
    expect(s.state().recording).toMatchObject({ phase: 'recording', elapsed: 0 });
    s.recorder.speak(tone(1, 48000));
    expect(s.state().recording!.elapsed).toBeCloseTo(1, 3);
    s.audio.stopRecording();
    expect(s.doc().tracks[0]!.channels[0]!.length).toBe(48000);
  });

  it('the first recording sets the project rate; it becomes a mono track named Recording 1', async () => {
    const s = setup(48000);
    await s.audio.openRecorder();
    s.audio.setRecordingOptions({ countIn: false });
    s.audio.startRecording();
    const said = tone(1.5, 48000);
    s.recorder.speak(said);
    s.audio.stopRecording();
    expect(s.doc().rate).toBe(48000);
    const track = s.doc().tracks[0]!;
    expect(track).toMatchObject({ name: 'Recording 1', offset: 0 });
    expect(track.channels).toHaveLength(1);
    expect(track.channels[0]).toEqual(said);
    expect(s.state().history.past.at(-1)!.label).toBe('Record 1.50 s');
    expect(s.state().selection.tracks).toEqual([track.id]);
    expect(s.state().recording).toBeNull();
    expect(s.recorder.isOpen).toBe(false);
  });

  it('overdubbing: the music plays from the playhead while recording, and the voice goes there', async () => {
    const s = setup(48000);
    await s.music();
    s.audio.setPosition(1.5);
    await s.audio.openRecorder();
    s.audio.setRecordingOptions({ countIn: false });
    s.audio.startRecording();
    expect(s.output.play).toHaveBeenCalledTimes(1);
    s.recorder.speak(tone(1, 48000));
    s.audio.stopRecording();
    expect(s.output.stop).toHaveBeenCalled();
    const voice = s.doc().tracks[1]!;
    expect(voice.offset).toBe(1.5);
    expect(voice.channels[0]!.length).toBe(44100); // 48 kHz microphone, 44.1 kHz project
    expect(s.doc().tracks).toHaveLength(2);
  });

  it('without "play other tracks" nothing plays while recording', async () => {
    const s = setup();
    await s.music();
    await s.audio.openRecorder();
    s.audio.setRecordingOptions({ countIn: false, overdub: false });
    s.audio.startRecording();
    expect(s.output.play).not.toHaveBeenCalled();
  });

  it('stopping during the count-in records nothing; Undo removes a recording', async () => {
    const s = setup();
    await s.audio.openRecorder();
    s.audio.startRecording();
    s.audio.stopRecording();
    expect(s.doc().tracks).toHaveLength(0);

    await s.audio.openRecorder();
    s.audio.setRecordingOptions({ countIn: false });
    s.audio.startRecording();
    s.recorder.speak(tone(0.5, 48000));
    s.audio.stopRecording();
    expect(s.doc().tracks).toHaveLength(1);
    await s.audio.undo();
    expect(s.doc().tracks).toHaveLength(0);
  });

  it('the next recording is Recording 2', async () => {
    const s = setup();
    for (let take = 0; take < 2; take++) {
      await s.audio.openRecorder();
      s.audio.setRecordingOptions({ countIn: false });
      s.audio.startRecording();
      s.recorder.speak(tone(0.2, 48000));
      s.audio.stopRecording();
    }
    expect(s.doc().tracks.map((t) => t.name)).toEqual(['Recording 1', 'Recording 2']);
    s.audio.selectTrack(s.doc().tracks[0]!.id);
    s.audio.removeTracks(); // only Recording 2 is left
    await s.audio.openRecorder();
    s.audio.setRecordingOptions({ countIn: false });
    s.audio.startRecording();
    s.recorder.speak(tone(0.2, 48000));
    s.audio.stopRecording();
    expect(s.doc().tracks.map((t) => t.name)).toEqual(['Recording 2', 'Recording 3']);
  });
});

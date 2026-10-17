// AudioOutput with the Web Audio API (README §11): plays Audio mode's samples on the speakers.
// The browser resamples to the sound card's rate itself; a mono sound plays on both sides.
import type { AudioOutput } from '../../app/audio.ts';

export function createWebAudioOutput(
  makeContext: () => AudioContext = () => new AudioContext(),
): AudioOutput {
  let ctx: AudioContext | null = null;
  let current: { source: AudioBufferSourceNode; startedAt: number } | null = null;

  function stop(): void {
    if (!current) return;
    const { source } = current;
    current = null; // first, so its "ended" event is not taken as finishing by itself
    source.onended = null;
    source.stop();
  }

  return {
    play(audio, { loop, onEnded }) {
      stop();
      const length = audio.channels[0]?.length ?? 0;
      if (length === 0) {
        onEnded();
        return;
      }
      ctx ??= makeContext();
      if (ctx.state === 'suspended') void ctx.resume();
      const buffer = ctx.createBuffer(audio.channels.length, length, audio.sampleRate);
      audio.channels.forEach((c, ch) => buffer.copyToChannel(c as Float32Array<ArrayBuffer>, ch));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.connect(ctx.destination);
      const playing = { source, startedAt: ctx.currentTime };
      source.onended = () => {
        if (current !== playing) return;
        current = null;
        onEnded();
      };
      current = playing;
      source.start();
    },
    stop,
    elapsed: () => (current && ctx ? ctx.currentTime - current.startedAt : 0),
  };
}

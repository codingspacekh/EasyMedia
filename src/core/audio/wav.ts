// X8: samples as a 16-bit PCM WAV file (a built-in sound effect saved for Video mode).
import type { Channels } from './pcm.ts';

const HEADER = 44;

export function encodeWav(channels: Channels, rate: number): Uint8Array {
  const count = channels.length;
  const length = channels[0]?.length ?? 0;
  const dataBytes = length * count * 2;
  const bytes = new Uint8Array(HEADER + dataBytes);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, HEADER - 8 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, count, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * count * 2, true);
  view.setUint16(32, count * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  let at = HEADER;
  for (let i = 0; i < length; i++) {
    for (const c of channels) {
      const v = Math.max(-1, Math.min(1, c[i]!));
      view.setInt16(at, Math.round(v * 32767), true);
      at += 2;
    }
  }
  return bytes;
}

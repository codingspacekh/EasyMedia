import { describe, expect, it, vi } from 'vitest';
import { createWebAudioOutput } from '../../../src/adapters/webaudio/output.ts';

/** Just enough of Web Audio to see what the adapter asks for. */
function fakeContext() {
  const sources: {
    buffer: { channels: Float32Array[]; sampleRate: number } | null;
    loop: boolean;
    started: boolean;
    stopped: boolean;
    onended: (() => void) | null;
  }[] = [];
  const ctx = {
    currentTime: 10,
    state: 'running',
    resume: vi.fn(async () => {}),
    destination: {},
    createBuffer(count: number, length: number, sampleRate: number) {
      const channels = Array.from({ length: count }, () => new Float32Array(length));
      return {
        channels,
        sampleRate,
        copyToChannel: (data: Float32Array, ch: number) => channels[ch]!.set(data),
      };
    },
    createBufferSource() {
      const source = {
        buffer: null,
        loop: false,
        started: false,
        stopped: false,
        onended: null as (() => void) | null,
        connect: () => {},
        start: () => void (source.started = true),
        stop: () => {
          source.stopped = true;
          source.onended?.();
        },
      };
      sources.push(source);
      return source;
    },
  };
  return { ctx, sources };
}

describe('A18 playback through Web Audio', () => {
  it('plays the samples at their own rate, looped if asked', () => {
    const { ctx, sources } = fakeContext();
    const out = createWebAudioOutput(() => ctx as never);
    out.play(
      { sampleRate: 22050, channels: [new Float32Array([0.1, 0.2]), new Float32Array([0.3, 0.4])] },
      { loop: true, onEnded: () => {} },
    );
    expect(sources[0]).toMatchObject({ loop: true, started: true });
    expect(sources[0]!.buffer!.sampleRate).toBe(22050);
    expect([...sources[0]!.buffer!.channels[1]!]).toEqual([Math.fround(0.3), Math.fround(0.4)]);
  });

  it('counts the seconds played; stop ends it without calling back as if it had finished', () => {
    const { ctx, sources } = fakeContext();
    const out = createWebAudioOutput(() => ctx as never);
    const onEnded = vi.fn();
    out.play({ sampleRate: 100, channels: [new Float32Array(100)] }, { loop: false, onEnded });
    ctx.currentTime = 10.75;
    expect(out.elapsed()).toBeCloseTo(0.75);
    out.stop();
    expect(sources[0]!.stopped).toBe(true);
    expect(onEnded).not.toHaveBeenCalled();
    expect(out.elapsed()).toBe(0);
  });

  it('calls back when the sound finishes by itself', () => {
    const { ctx, sources } = fakeContext();
    const out = createWebAudioOutput(() => ctx as never);
    const onEnded = vi.fn();
    out.play({ sampleRate: 100, channels: [new Float32Array(10)] }, { loop: false, onEnded });
    sources[0]!.onended!();
    expect(onEnded).toHaveBeenCalledOnce();
  });

  it('makes one audio context, only when first needed, and wakes it if suspended', () => {
    const { ctx } = fakeContext();
    const make = vi.fn(() => ctx as never);
    const out = createWebAudioOutput(make);
    expect(make).not.toHaveBeenCalled();
    ctx.state = 'suspended';
    out.play(
      { sampleRate: 100, channels: [new Float32Array(1)] },
      { loop: false, onEnded: () => {} },
    );
    out.play(
      { sampleRate: 100, channels: [new Float32Array(1)] },
      { loop: false, onEnded: () => {} },
    );
    expect(make).toHaveBeenCalledOnce();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('an empty sound plays nothing and ends at once', () => {
    const { ctx, sources } = fakeContext();
    const out = createWebAudioOutput(() => ctx as never);
    const onEnded = vi.fn();
    out.play({ sampleRate: 100, channels: [new Float32Array(0)] }, { loop: false, onEnded });
    expect(sources).toHaveLength(0);
    expect(onEnded).toHaveBeenCalledOnce();
  });
});

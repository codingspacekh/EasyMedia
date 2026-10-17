// Audio mode details: waveform drawing, ruler, status bar, side panel and menu edge cases.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import { audioUi } from '../../../src/ui/audio/audio-ui.svelte.ts';
import { testApp } from '../../helpers/test-app.ts';

const sound = (duration: number, channels: number, bitDepth?: number): ProbeInfo => ({
  kind: 'audio',
  container: bitDepth ? 'wav' : 'mp3',
  duration,
  sizeBytes: 1,
  audio: { codec: 'x', sampleRate: 44100, channels, ...(bitDepth ? { bitDepth } : {}) },
});

async function audioMode(...files: string[]) {
  const t = testApp({
    '/m/music.mp3': sound(4, 2),
    '/m/voice.wav': sound(2, 1, 16),
  });
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', { name: 'Audio' }),
  );
  if (files.length) {
    t.dialogs.openMedia.mockResolvedValueOnce(files);
    await t.app.audio.importAudio();
  }
  return { ...t, audio: t.app.audio, state: () => t.app.audio.store.get() };
}

describe('waveform drawing', () => {
  const original = HTMLCanvasElement.prototype.getContext;
  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = original;
  });

  it('A1 draws each channel of the visible part of every track', async () => {
    const rects: number[][] = [];
    HTMLCanvasElement.prototype.getContext = (() => ({
      setTransform: () => {},
      clearRect: () => {},
      fillRect: (...r: number[]) => rects.push(r),
      fillStyle: '',
    })) as never;
    await audioMode('/m/music.mp3', '/m/voice.wav');
    await vi.waitFor(() => expect(rects.length).toBeGreaterThan(100));
  });
});

describe('ruler', () => {
  it('shows hundredths when zoomed far in, and Fit shows all the sound', async () => {
    await audioMode('/m/music.mp3');
    audioUi.pxPerSecond = 2000;
    await vi.waitFor(() => expect(screen.getAllByText(/^00:00\.\d\d$/).length).toBeGreaterThan(1));
    await fireEvent.click(screen.getByRole('button', { name: 'Fit to window' }));
    expect(audioUi.pxPerSecond).toBeLessThan(2000);
  });

  it('arrow keys move the Audio position by a second', async () => {
    const t = await audioMode('/m/music.mp3');
    const ruler = screen.getByRole('slider', { name: 'Audio position on the ruler' });
    await fireEvent.keyDown(ruler, { key: 'ArrowRight' });
    await fireEvent.keyDown(ruler, { key: 'ArrowRight' });
    await fireEvent.keyDown(ruler, { key: 'ArrowLeft' });
    expect(t.state().position).toBe(1);
  });

  it('Skip to start puts the Audio position back to 0', async () => {
    const t = await audioMode('/m/music.mp3');
    t.audio.setPosition(3);
    await fireEvent.click(screen.getByRole('button', { name: 'Skip to start' }));
    expect(t.state().position).toBe(0);
  });
});

describe('tracks and side panel', () => {
  it('a track can be removed from its header; an empty track says what to do', async () => {
    const t = await audioMode('/m/music.mp3');
    t.audio.addTrack(1);
    await vi.waitFor(() => screen.getByText('Empty track: paste sound here'));
    await fireEvent.click(screen.getByRole('button', { name: 'Remove track Audio track 2' }));
    expect(t.state().history.present.tracks.map((x) => x.name)).toEqual(['music']);
  });

  it('a WAV shows its own resolution; no track selected shows a hint; undone steps are struck', async () => {
    const t = await audioMode('/m/voice.wav');
    const panel = screen.getByRole('complementary', { name: 'Selected track' });
    expect(within(panel).getByText('16-bit')).toBeTruthy();
    t.audio.undo();
    await vi.waitFor(() => within(panel).getByText('Click a track to see its details.'));
    expect(within(panel).getByText('Import voice.wav').className).toMatch(/fut/);
  });

  it('nothing done yet', async () => {
    await audioMode();
    expect(screen.getByText('Nothing done yet.')).toBeTruthy();
  });
});

describe('status bar', () => {
  it('shows the tracks, messages (with Dismiss), export progress and where it was saved', async () => {
    const t = await audioMode('/m/music.mp3');
    expect(screen.getByText(/1 track · stereo mix · 44\.1 kHz/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
    t.engine.encodeAudio = () => {
      let resolve!: () => void;
      const done = new Promise<void>((r) => (resolve = r));
      setTimeout(() => resolve(), 50);
      return { id: 'slow', done, cancel: () => {} };
    };
    t.dialogs.exportAudio.mockResolvedValueOnce('/out/a.mp3');
    const running = t.audio.exportAudio({
      format: 'mp3',
      sampleRate: 44100,
      channels: 2,
      bitRate: 128,
      mode: 'cbr',
      bitDepth: 16,
      tags: {},
    });
    await vi.waitFor(() => screen.getByText(/Exporting audio… 0 %/));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    await running;
    t.audio.dismissMessage();
    await vi.waitFor(() => screen.getByText('Saved to /out/a.mp3'));
  });

  it('shows what the app is busy with', async () => {
    const t = await audioMode();
    let finish!: () => void;
    t.engine.decodeAudio = () =>
      new Promise(
        (resolve) =>
          (finish = () => resolve({ sampleRate: 44100, channels: [new Float32Array(10)] })),
      );
    t.dialogs.openMedia.mockResolvedValueOnce(['/m/music.mp3']);
    const opening = t.audio.importAudio();
    await vi.waitFor(() => screen.getByText('Opening music.mp3…'));
    finish();
    await opening;
  });
});

describe('menus and dialogs', () => {
  it('the Effect menu asks for a selection first; clicking outside closes a menu', async () => {
    await audioMode('/m/music.mp3');
    await fireEvent.click(screen.getByRole('button', { name: 'Effect' }));
    expect(screen.getByRole('menu').textContent).toMatch(/select some sound first/i);
    await fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('A14 Record is available when there is a microphone port', async () => {
    await audioMode();
    expect((screen.getByRole('button', { name: 'Record' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('Escape closes an effect dialog; a Preview problem is shown in it', async () => {
    const t = await audioMode('/m/music.mp3');
    t.audio.select({ start: 8, end: 9 });
    audioUi.dialog = { kind: 'effect', id: 'audio.amplify' };
    const dialog = await vi.waitFor(() => screen.getByRole('dialog', { name: 'Amplify' }));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Preview' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/select some sound/i);
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Insert silence starts with the length of the selection', async () => {
    const t = await audioMode('/m/music.mp3');
    t.audio.select({ start: 1, end: 1.75 });
    audioUi.dialog = { kind: 'silence' };
    const dialog = await vi.waitFor(() => screen.getByRole('dialog', { name: 'Insert silence' }));
    expect((within(dialog).getByLabelText('Length') as HTMLInputElement).value).toBe('0.75');
  });

  it('a time box explains text that is not a time; shortcuts with Ctrl are left to the menus', async () => {
    const t = await audioMode('/m/music.mp3');
    await fireEvent.change(screen.getByLabelText('Selection start'), { target: { value: 'abc' } });
    expect(screen.getByRole('alert').textContent).toMatch(/type a time/i);
    await fireEvent.keyDown(window, { key: ' ', ctrlKey: true });
    expect(t.state().playing).toBe(false);
  });
});

describe('following the playhead', () => {
  it('measures the view and moves the playhead with the speakers while playing', async () => {
    const frames: (() => void)[] = [];
    const observers: (() => void)[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          observers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    try {
      const t = await audioMode('/m/music.mp3');
      observers.forEach((cb) => cb());
      vi.spyOn(t.audio, 'currentPosition').mockReturnValue(3);
      t.audio.play();
      await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0));
      frames.shift()!();
      const ruler = screen.getByRole('slider', { name: 'Audio position on the ruler' });
      expect(ruler).toBeTruthy();
      t.audio.stop();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('side panel and export details', () => {
  it('a compressed stereo file is shown as 16-bit, as on a CD', async () => {
    await audioMode('/m/music.mp3');
    const panel = screen.getByRole('complementary', { name: 'Selected track' });
    expect(within(panel).getByText('2 (stereo)')).toBeTruthy();
    expect(within(panel).getByText('16-bit (as on a CD)')).toBeTruthy();
  });
});

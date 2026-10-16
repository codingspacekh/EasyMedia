import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { addEffect, setFade, setPanZoom, setTransition } from '../../../src/app/commands.ts';
import Preview from '../../../src/ui/Preview.svelte';
import { setDuration } from '../../../src/app/commands.ts';
import { addMainItem } from '../../../src/app/commands.ts';
import { toMediaUrl } from '../../../src/core/media-url.ts';
import { createTitleSlide } from '../../../src/core/model/factory.ts';
import { testApp } from '../../helpers/test-app.ts';

const screenKind = () => document.querySelector('[data-preview]')!.getAttribute('data-preview');

describe('preview player', () => {
  it('shows nothing and cannot play an empty timeline', () => {
    render(Preview, { props: { app: testApp().app } });
    expect(screen.getByText(/nothing to show yet/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows "Preparing preview" for a video until its proxy is ready, then plays the proxy', async () => {
    const { app, importFiles } = testApp();
    render(Preview, { props: { app } });
    await importFiles('/m/clip.mp4');
    app.addToTimeline(app.store.get().history.present.media[0]!.id);
    await Promise.resolve();
    expect(screen.getByText(/preparing preview/i)).toBeTruthy();
    await screen.findByText((_, el) => el?.tagName === 'VIDEO');
    expect(screenKind()).toBe('video');
    expect(document.querySelector('video')!.getAttribute('src')).toMatch(/^media:\/\/file\//);
  });

  it('shows a still image from its file', async () => {
    const { app, importFiles } = testApp();
    render(Preview, { props: { app } });
    await importFiles('/m/photo.jpg');
    app.addToTimeline(app.store.get().history.present.media[0]!.id);
    await Promise.resolve();
    expect(document.querySelector('img')!.getAttribute('src')).toBe(toMediaUrl('/m/photo.jpg'));
  });

  it('shows a title slide as its colour', async () => {
    const { app } = testApp();
    render(Preview, { props: { app } });
    app.edit(
      addMainItem({
        ...createTitleSlide('', { id: 't' }),
        background: { kind: 'colour', colour: '#ff0000' },
      }),
    );
    app.edit(setDuration('t', 2));
    await Promise.resolve();
    expect(screenKind()).toBe('colour');
    expect((document.querySelector('.fill') as HTMLElement).style.background).toMatch(
      /rgb\(255, 0, 0\)|#ff0000/,
    );
  });

  it('Play becomes Pause while playing, and the time is shown', async () => {
    const { app, importFiles } = testApp();
    render(Preview, { props: { app } });
    await importFiles('/m/photo.jpg');
    app.addToTimeline(app.store.get().history.present.media[0]!.id);
    await Promise.resolve();
    expect(document.querySelector('.tc')!.textContent).toBe('00:00.00 / 00:05.00');
    await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('V15 / V7 / V8 shows a still with its filter, fade and pan & zoom view', async () => {
    const { app, importFiles } = testApp();
    await importFiles('/m/photo.jpg');
    app.addToTimeline(app.store.get().history.present.media[0]!.id);
    const id = app.store.get().history.present.timeline.main[0]!.id;
    app.edit(addEffect(id, 'video.blackwhite'));
    app.edit(setFade(id, { in: 2, out: 0, colour: 'black' }));
    app.edit(
      setPanZoom(id, { from: { zoom: 2, x: 0.5, y: 0.5 }, to: { zoom: 2, x: 0.5, y: 0.5 } }),
    );
    app.setPlayhead(1);
    render(Preview, { props: { app } });
    expect((document.querySelector('.layer') as HTMLElement).style.filter).toBe('grayscale(1)');
    expect((document.querySelector('.view') as HTMLElement).style.transform).toBe(
      'scale(2) translate(0%, 0%)',
    );
    const fade = document.querySelector('.fade') as HTMLElement;
    expect([fade.style.background, fade.style.opacity]).toEqual(['black', '0.5']);
  });

  it('V9 during a transition shows the next clip coming in on top', async () => {
    const { app, importFiles } = testApp();
    await importFiles('/m/photo.jpg');
    const photo = app.store.get().history.present.media[0]!.id;
    app.addToTimeline(photo);
    app.addToTimeline(photo);
    const second = app.store.get().history.present.timeline.main[1]!.id;
    app.edit(setTransition(second, { effectId: 'transition.dissolve', duration: 2 }));
    app.setPlayhead(3.5); // the first still runs 0–5 s, the second starts at 3 s
    render(Preview, { props: { app } });
    const incoming = document.querySelector('.incoming') as HTMLElement;
    expect(incoming.style.opacity).toBe('0.25');
    expect(incoming.getAttribute('aria-label')).toBe('Dissolve');
    expect(document.querySelectorAll('img')).toHaveLength(2);
  });
});

describe('V13 music in the preview (Task 11e: "test the audio plays when the video is played")', () => {
  it('plays the music file from the right moment while the playhead is over it', async () => {
    const t = testApp({
      '/m/photo.jpg': {
        kind: 'image',
        container: 'jpg',
        sizeBytes: 1,
        video: { codec: 'mjpeg', width: 100, height: 100 },
      },
      '/m/music.mp3': {
        kind: 'audio',
        container: 'mp3',
        duration: 30,
        sizeBytes: 1,
        audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
      },
    });
    await t.importFiles('/m/photo.jpg', '/m/music.mp3');
    const [photo, music] = t.app.store.get().history.present.media;
    t.app.addToTimeline(photo!.id); // 5 s
    t.app.setPlayhead(2);
    t.app.addToTimeline(music!.id); // from 2 s
    t.app.setPlayhead(1);
    render(Preview, { props: { app: t.app } });
    expect(document.querySelector('audio')).toBeNull();
    t.app.setPlayhead(3);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    const audio = document.querySelector('audio')!;
    expect(audio.getAttribute('src')).toBe(toMediaUrl('/m/music.mp3'));
    expect(audio.currentTime).toBeCloseTo(1, 5);
  });
});

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
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
    expect(screen.getByText('00:00.00 / 00:05.00')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });
});

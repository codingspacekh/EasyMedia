import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import MediaBin from '../../../src/ui/MediaBin.svelte';
import { IMAGE, testApp } from '../../helpers/test-app.ts';

describe('media bin', () => {
  it('invites the student to import when empty', () => {
    render(MediaBin, { props: { app: testApp().app } });
    expect(screen.getByText(/no media yet/i)).toBeTruthy();
  });

  it('M4: shows "Preparing preview" for a video until its proxy is ready', async () => {
    const { app, importFiles } = testApp();
    render(MediaBin, { props: { app } });
    await importFiles('/m/clip.mp4');
    expect(screen.getByText('clip.mp4')).toBeTruthy();
    expect(screen.getByText(/preparing preview/i)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/preparing preview/i)).toBeNull());
    expect(screen.getByText('1080p · 30 fps')).toBeTruthy();
  });

  it('shows what each file is: length, size and type', async () => {
    const { app, importFiles } = testApp();
    render(MediaBin, { props: { app } });
    await importFiles('/m/clip.mp4', '/m/photo.jpg');
    await waitFor(() => expect(screen.getByText('1080p · 30 fps')).toBeTruthy());
    expect(screen.getByText('0:10')).toBeTruthy();
    expect(screen.getByText('100×100')).toBeTruthy();
  });

  it('adds a file to the timeline', async () => {
    const { app, importFiles } = testApp();
    render(MediaBin, { props: { app } });
    await importFiles('/m/photo.jpg');
    await fireEvent.click(screen.getByRole('button', { name: /add photo\.jpg to the timeline/i }));
    expect(app.store.get().history.present.timeline.main).toHaveLength(1);
  });

  it('P6 offers Locate… for a file that cannot be found', async () => {
    const { app } = testApp({ '/new/photo.jpg': IMAGE });
    app.store.update((st) => ({
      ...st,
      history: {
        ...st.history,
        present: {
          ...st.history.present,
          media: [{ id: 'p', kind: 'image', path: '/old/photo.jpg', hasAudio: false }],
        },
      },
      assets: { p: { state: 'failed', progress: 0, message: 'The file could not be found.' } },
    }));
    render(MediaBin, { props: { app } });
    expect(screen.getByText(/could not be found/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Locate photo.jpg' })).toBeTruthy();
  });
});

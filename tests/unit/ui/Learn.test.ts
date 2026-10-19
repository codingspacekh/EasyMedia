// Learn mode (screens 21–22): the media inspector (T1), the file-size calculator (T2), the
// sampling visualiser (T4), the compression comparison (T3), the format guide (T7), the task
// checker (T6) and the glossary.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import App from '../../../src/ui/App.svelte';
import { ui } from '../../../src/ui/ui-state.svelte.ts';
import { testApp, VIDEO } from '../../helpers/test-app.ts';

const SONG: ProbeInfo = {
  kind: 'audio',
  container: 'mp3',
  duration: 120,
  sizeBytes: 1_920_000,
  audio: { codec: 'mp3', sampleRate: 44100, channels: 2, bitRate: 128_000 },
};

async function learnMode(tab?: string) {
  const t = testApp({ '/m/clip.mp4': VIDEO, '/m/song.mp3': SONG });
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
      name: 'Learn',
    }),
  );
  if (tab) await fireEvent.click(screen.getByRole('tab', { name: tab }));
  return { ...t, learn: t.app.learn };
}
const card = (name: string) => screen.getByRole('region', { name });
const inspect = async (t: Awaited<ReturnType<typeof learnMode>>, path: string) => {
  t.dialogs.openMedia.mockResolvedValueOnce([path]);
  await fireEvent.click(
    within(card('Media inspector')).getByRole('button', { name: /Choose a file/ }),
  );
  await vi.waitFor(() => expect(t.learn.store.get().inspected?.path).toBe(path));
};

afterEach(() => {
  ui.mode = 'Video';
  ui.learnTab = 'inspect';
  ui.glossary = false;
});

describe('Learn mode layout (screens 21–22)', () => {
  it('has two tabs and the task checker, a Glossary button, and says the project is not changed', async () => {
    await learnMode();
    expect(screen.getAllByRole('tab').map((t) => t.textContent!.trim())).toEqual([
      'Inspector & sampling',
      'Formats & compression',
      'Task checker',
    ]);
    for (const name of [
      'Media inspector',
      'Audio file-size calculator',
      'Sampling visualiser',
      'Compression comparison',
    ])
      expect(card(name)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Glossary' })).toBeTruthy();
    expect(screen.getByText('Learn mode does not change your project')).toBeTruthy();
  });
});

describe('T1 media inspector', () => {
  it('shows what is inside a chosen file, with lossy codecs marked', async () => {
    const t = await learnMode();
    await inspect(t, '/m/clip.mp4');
    const box = card('Media inspector');
    expect(box.textContent).toContain('clip.mp4');
    expect(box.textContent).toContain('7.0 MB');
    const row = (label: string) => within(box).getByRole('button', { name: label }).closest('tr')!;
    expect(row('Video codec').textContent).toMatch(/H\.264\s*lossy/);
    expect(row('Resolution').textContent).toContain('1920 × 1080 (16:9)');
    expect(box.textContent).toMatch(/File vs container/);
  });

  it('clicking a row explains it', async () => {
    const t = await learnMode();
    await inspect(t, '/m/clip.mp4');
    const label = within(card('Media inspector')).getByRole('button', { name: 'Frame rate' });
    expect(label.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(label);
    expect(label.getAttribute('aria-expanded')).toBe('true');
    expect(card('Media inspector').textContent).toMatch(/twice the data of 15 fps/);
  });

  it('a file dropped on the inspector is inspected', async () => {
    const t = await learnMode();
    window.mve = { pathForFile: () => '/m/song.mp3' } as unknown as typeof window.mve;
    const zone = within(card('Media inspector')).getByLabelText('Drop a file here to inspect it');
    await fireEvent.drop(zone, { dataTransfer: { files: [new File([''], 'song.mp3')] } });
    await vi.waitFor(() => expect(t.learn.store.get().inspected?.name).toBe('song.mp3'));
    delete (window as { mve?: unknown }).mve;
  });
});

describe('T2 audio file-size calculator', () => {
  it('starts with Book A Question 5a and shows the working', async () => {
    await learnMode();
    const box = card('Audio file-size calculator');
    expect(box.textContent).toContain('44 100 × 16 × 1 = 705 600 bits');
    expect(box.textContent).toContain('705 600 × 120 = 84 672 000 bits');
    expect(box.textContent).toContain('10 584 000 ÷ 1 000 000 = 10.58 MB');
    expect(within(box).getByText('≈ 10.6 MB')).toBeTruthy();
  });

  it('Question 5b: 32-bit doubles it; stereo and the sample rate change it too', async () => {
    await learnMode();
    const box = card('Audio file-size calculator');
    await fireEvent.click(within(box).getByRole('button', { name: '32-bit' }));
    expect(within(box).getByText('≈ 21.2 MB')).toBeTruthy();
    await fireEvent.click(within(box).getByRole('button', { name: '2 · stereo' }));
    expect(within(box).getByText('≈ 42.3 MB')).toBeTruthy();
    await fireEvent.change(within(box).getByLabelText('Sample rate'), {
      target: { value: '22050' },
    });
    await fireEvent.change(within(box).getByLabelText('Length (seconds)'), {
      target: { value: '60' },
    });
    expect(box.textContent).toContain('22 050 × 32 × 2 = 1 411 200 bits');
    expect(within(box).getByText('≈ 10.6 MB')).toBeTruthy();
  });

  it('"What if…" shows the size at double the resolution and half the sample rate', async () => {
    await learnMode();
    const rows = within(card('Audio file-size calculator')).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      '16-bit (now) 10.6 MB',
      '32-bit 21.2 MB',
      '22 050 Hz 5.3 MB',
    ]);
  });
});

describe('T4 sampling visualiser (Book A 11.28)', () => {
  it("starts with Figure 11.23 sampled 10 times: the book's table", async () => {
    await learnMode();
    const box = card('Sampling visualiser');
    expect(within(box).getByText('10 samples')).toBeTruthy();
    const values = within(box)
      .getAllByRole('cell', { name: /^\d+(\.\d)?$/ })
      .filter((c) => c.dataset.kind === 'value')
      .map((c) => c.textContent);
    expect(values).toEqual(['6', '8.5', '2.5', '8', '3.5', '2', '4.5', '3', '8.5', '3.5']);
  });

  it('twice as many samples: the stored sound is closer to the original', async () => {
    await learnMode();
    const box = card('Sampling visualiser');
    const distance = () => Number(within(box).getByTestId('distance').textContent);
    const ten = distance();
    await fireEvent.input(within(box).getByLabelText('Sample rate'), { target: { value: '20' } });
    expect(within(box).getByText('20 samples')).toBeTruthy();
    expect(distance()).toBeLessThan(ten);
  });

  it('a lower resolution has fewer levels', async () => {
    await learnMode();
    const box = card('Sampling visualiser');
    await fireEvent.input(within(box).getByLabelText('Resolution'), { target: { value: '3' } });
    expect(within(box).getByText('3-bit · 8 levels')).toBeTruthy();
  });

  it('the student can draw their own wave by moving its points', async () => {
    await learnMode();
    const box = card('Sampling visualiser');
    await fireEvent.click(within(box).getByRole('button', { name: 'Draw your own' }));
    const point = within(box).getByRole('slider', { name: 'Point at 1 s' });
    expect(point.getAttribute('aria-valuenow')).toBe('6');
    await fireEvent.keyDown(point, { key: 'ArrowUp' });
    expect(point.getAttribute('aria-valuenow')).toBe('6.5');
    const first = within(box)
      .getAllByRole('cell')
      .find((c) => c.dataset.kind === 'value')!;
    expect(first.textContent).toBe('6.5');
    await fireEvent.click(within(box).getByRole('button', { name: 'Book A Figure 11.23' }));
    expect(within(box).queryByRole('slider', { name: 'Point at 1 s' })).toBeNull();
  });
});

describe('T3 compression comparison', () => {
  it('asks for a file first', async () => {
    await learnMode();
    expect(card('Compression comparison').textContent).toMatch(/Inspect a sound or video/);
  });

  it('compares the sound: sizes, how much smaller, and a play button for each', async () => {
    const t = await learnMode();
    await inspect(t, '/m/song.mp3');
    const box = card('Compression comparison');
    await fireEvent.click(within(box).getByRole('button', { name: 'Compare 10 s of the sound' }));
    await vi.waitFor(() => expect(within(box).getAllByRole('listitem')).toHaveLength(5));
    const rows = within(box).getAllByRole('listitem');
    expect(rows[0]!.textContent).toMatch(/WAV · lossless.*1\.76 MB/);
    expect(rows[3]!.textContent).toMatch(/MP3 128 kbps.*91 % smaller/);
    expect(within(rows[3]!).getByRole('button', { name: 'Play MP3 128 kbps' })).toBeTruthy();
  });
});

describe('Formats & compression tab (screen 22)', () => {
  it('T7 lists every export format with its advantages and disadvantages', async () => {
    await learnMode('Formats & compression');
    const table = within(card('Export format guide')).getByRole('table');
    const formats = within(table)
      .getAllByRole('rowheader')
      .map((c) => c.textContent);
    expect(formats).toEqual([
      'MP4',
      'MOV',
      'AVI',
      'WMV',
      'MPG',
      'MP3',
      'M4A',
      'AAC',
      'WAV',
      'FLAC',
    ]);
    expect(table.textContent).toMatch(/Plays on almost all devices and websites/);
  });

  it('Book B 11.1.19: pixels per frame; estimates until real files are made from a video', async () => {
    const t = await learnMode('Formats & compression');
    const box = card('Video compression & quality');
    expect(box.textContent).toContain('2 073 600 px');
    expect(box.textContent).toContain('8 294 400 px');
    expect(box.textContent).toMatch(/Lossless · 1920 × 1080.*≈/);
    await fireEvent.click(screen.getByRole('tab', { name: 'Inspector & sampling' }));
    await inspect(t, '/m/clip.mp4');
    await fireEvent.click(screen.getByRole('tab', { name: 'Formats & compression' }));
    await fireEvent.click(
      within(card('Video compression & quality')).getByRole('button', {
        name: 'Make real files from clip.mp4',
      }),
    );
    const quality = card('Video compression & quality');
    await vi.waitFor(() => expect(quality.querySelectorAll('video')).toHaveLength(3));
    for (const v of quality.querySelectorAll('video'))
      expect(v.getAttribute('preload')).toBe('auto');
    expect(quality.textContent).toMatch(/MP4 · 426 × 240/);
    // Players cannot show the lossless AVI: one exact frame of it, and why.
    const still = within(quality).getByRole('img', { name: /One frame of the lossless file/ });
    expect(still.getAttribute('src')).toContain('compare-1.png');
    expect(quality.textContent).toMatch(/cannot play/);
  });
});

describe('T6 task checker', () => {
  it('the teacher sets and saves a task; a student checks an export against it', async () => {
    const t = await learnMode('Task checker');
    const task = card('Task');
    await fireEvent.input(within(task).getByLabelText('Task name'), {
      target: { value: 'Task 11b' },
    });
    await fireEvent.change(within(task).getByLabelText('Duration (s)'), {
      target: { value: '10' },
    });
    t.dialogs.saveTaskCheck.mockResolvedValueOnce('/t/Task 11b.mvetask');
    await fireEvent.click(within(task).getByRole('button', { name: 'Save task…' }));
    expect(t.dialogs.saveTaskCheck).toHaveBeenCalledWith('Task 11b');
    t.dialogs.openMedia.mockResolvedValueOnce(['/m/clip.mp4']);
    await fireEvent.click(
      within(card('Check an export')).getByRole('button', { name: 'Check a file…' }),
    );
    const result = card('Check an export');
    await vi.waitFor(() => expect(result.textContent).toMatch(/clip\.mp4/));
    expect(result.textContent).toMatch(/Passed/);
    expect(within(result).getAllByRole('row').length).toBeGreaterThanOrEqual(4);
  });

  it('a wrong resolution fails, with the row marked', async () => {
    const t = await learnMode('Task checker');
    await fireEvent.change(within(card('Task')).getByLabelText('Width'), {
      target: { value: '1280' },
    });
    await fireEvent.change(within(card('Task')).getByLabelText('Height'), {
      target: { value: '720' },
    });
    t.dialogs.openMedia.mockResolvedValueOnce(['/m/clip.mp4']);
    await fireEvent.click(
      within(card('Check an export')).getByRole('button', { name: 'Check a file…' }),
    );
    const result = card('Check an export');
    await vi.waitFor(() => expect(result.textContent).toMatch(/Not yet/));
    const row = within(result).getByRole('row', { name: /Resolution/ });
    expect(row.textContent).toMatch(/1280 × 720.*1920 × 1080.*✗/);
  });
});

describe('Glossary', () => {
  it('opens from the toolbar, finds words, and lists why each tool is used', async () => {
    await learnMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Glossary' }));
    const dialog = screen.getByRole('dialog', { name: 'Glossary' });
    await fireEvent.input(within(dialog).getByRole('searchbox'), { target: { value: 'aspect' } });
    expect(within(dialog).getByRole('heading', { name: 'Aspect ratio' })).toBeTruthy();
    expect(within(dialog).queryByRole('heading', { name: 'Codec' })).toBeNull();
    await fireEvent.input(within(dialog).getByRole('searchbox'), { target: { value: '' } });
    expect(dialog.textContent).toMatch(/Why use each tool/);
    expect(dialog.textContent).toMatch(/Trimming removes unwanted footage/);
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Glossary' })).toBeNull();
  });
});

// V18 (F/M/25 Q2): the cropped still of cells A1:E5 placed in the bottom-left corner of
// credits.png and saved as a new picture, to be the credits' background.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import MediaBin from '../../../src/ui/MediaBin.svelte';
import { testApp } from '../../helpers/test-app.ts';

const picture = (width: number, height: number) => ({
  kind: 'image' as const,
  container: 'png',
  sizeBytes: 100_000,
  video: { codec: 'png', width, height },
});

async function open(...files: string[]) {
  const t = testApp({
    '/m/credits.png': picture(1440, 1080),
    '/m/TTT_A1E5.png': picture(1000, 500),
  });
  await t.importFiles(...files);
  render(MediaBin, { props: { app: t.app } });
  await fireEvent.click(screen.getByRole('button', { name: 'Place a picture on credits.png' }));
  const project = () => t.app.store.get().history.present;
  return { ...t, project, dialog: screen.getByRole('dialog', { name: 'Place a picture' }) };
}

describe('V18 place a picture on a picture', () => {
  it('asks for another picture first when there is none', async () => {
    const { dialog } = await open('/m/credits.png');
    expect(dialog.textContent).toMatch(/import the picture to place/i);
    expect(
      (screen.getByRole('button', { name: 'Save picture' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('F/M/25 Q2: the grid at 25 % in the bottom-left corner, saved as credits1.png', async () => {
    const { app, project, dialog } = await open('/m/credits.png', '/m/TTT_A1E5.png');
    const combine = vi.spyOn(app, 'combineImages');
    expect((screen.getByLabelText('Picture to place') as HTMLSelectElement).value).toBe(
      project().media[1]!.id,
    );
    await fireEvent.change(screen.getByLabelText('Width'), { target: { value: '25' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Place Bottom left' }));
    expect(dialog.textContent).toMatch(/360 × 180 at 0, 900/);
    await fireEvent.click(screen.getByLabelText('Add to the timeline'));
    await fireEvent.click(screen.getByRole('button', { name: 'Save picture' }));
    expect(combine).toHaveBeenCalledWith(project().media[0]!.id, project().media[1]!.id, {
      anchor: 'bottom-left',
      widthPercent: 25,
      margin: 0,
    });
    await vi.waitFor(() => expect(project().media.map((m) => m.path)).toContain('/m/credits1.png'));
    const made = project().media.find((m) => m.path === '/m/credits1.png')!;
    expect(project().timeline.main).toEqual([expect.objectContaining({ assetId: made.id })]);
    expect(app.store.get().message?.text).toMatch(/saved credits1\.png/i);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves under the file name typed', async () => {
    const { app, project } = await open('/m/credits.png', '/m/TTT_A1E5.png');
    const combine = vi.spyOn(app, 'combineImages');
    await fireEvent.input(screen.getByLabelText('File name'), {
      target: { value: 'credits_grid' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Save picture' }));
    expect(combine).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      'credits_grid',
    );
    await vi.waitFor(() =>
      expect(project().media.map((m) => m.path)).toContain('/m/credits_grid.png'),
    );
  });

  it('explains a size it cannot use, next to the box', async () => {
    await open('/m/credits.png', '/m/TTT_A1E5.png');
    await fireEvent.change(screen.getByLabelText('Width'), { target: { value: '150' } });
    expect(screen.getByRole('alert').textContent).toMatch(/between 1 and 100/);
    expect(within(screen.getByRole('dialog')).getByText(/Result/)).toBeTruthy();
  });
});

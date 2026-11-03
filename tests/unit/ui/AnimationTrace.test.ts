// M16 / AN5: the Trace bitmap dialog — opened from a selected picture's Properties, it shows how
// many shapes the colours, detail and smoothing make (a preview of a small copy), says that detail
// is lost, and Trace replaces the picture with the shapes.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import type { Pixels } from '../../../src/core/animation/trace.ts';
import { testApp } from '../../helpers/test-app.ts';

/** Two red squares and a blue one on white, 60 × 40. */
const PIXELS: Pixels = (() => {
  const data = new Uint8ClampedArray(60 * 40 * 4);
  for (let i = 0; i < 60 * 40; i++) {
    const [x, y] = [i % 60, Math.floor(i / 60)];
    const inside = y >= 10 && y < 30;
    data.set(
      inside && x >= 5 && x < 15
        ? [230, 20, 30, 255]
        : inside && x >= 25 && x < 35
          ? [20, 40, 220, 255]
          : inside && x >= 45 && x < 55
            ? [230, 20, 30, 255]
            : [255, 255, 255, 255],
      i * 4,
    );
  }
  return { width: 60, height: 40, data };
})();

async function withPicture() {
  const t = testApp();
  t.stageRenderer.pixels.mockResolvedValue(PIXELS);
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
      name: 'Animation',
    }),
  );
  const anim = t.app.animation;
  t.dialogs.openPicture.mockResolvedValueOnce('/m/photo.jpg');
  await anim.addPicture({ x: 0, y: 0 });
  const objects = () => anim.store.get().history.present.layers.flatMap((l) => l.objects);
  return { ...t, anim, objects };
}

const dialog = () => screen.getByRole('dialog', { name: 'Trace bitmap' });

describe('the Trace bitmap dialog (AN5)', () => {
  it('AN5 a selected picture offers Trace bitmap…; the dialog previews the shapes and warns of lost detail', async () => {
    await withPicture();
    await fireEvent.click(await screen.findByRole('button', { name: 'Trace bitmap…' }));
    const d = within(dialog());
    expect(d.getAllByText(/some detail is lost/i).length).toBeGreaterThan(0);
    expect(await d.findByText('4 shapes in 3 colours')).toBeTruthy();
    // Two colours: the blue square joins the red ones or the white.
    await fireEvent.input(d.getByLabelText('Colours'), { target: { value: '2' } });
    expect(await d.findByText(/in 2 colours/)).toBeTruthy();
    expect(d.getByRole('img', { name: 'Preview of the traced shapes' })).toBeTruthy();
  });

  it('AN5 Trace replaces the picture with a group of shapes and closes; Cancel changes nothing', async () => {
    const s = await withPicture();
    await fireEvent.click(await screen.findByRole('button', { name: 'Trace bitmap…' }));
    await fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Trace bitmap' })).toBeNull();
    expect(s.objects()[0]).toMatchObject({ kind: 'picture' });

    await fireEvent.click(screen.getByRole('button', { name: 'Trace bitmap…' }));
    await fireEvent.click(within(dialog()).getByRole('button', { name: 'Trace' }));
    await vi.waitFor(() => expect(s.objects()[0]).toMatchObject({ kind: 'group' }));
    expect(screen.queryByRole('dialog', { name: 'Trace bitmap' })).toBeNull();
  });

  it('AN5 a shape (not a picture) has no Trace bitmap button', async () => {
    const s = await withPicture();
    s.anim.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: 'Trace bitmap…' })).toBeNull();
  });
});

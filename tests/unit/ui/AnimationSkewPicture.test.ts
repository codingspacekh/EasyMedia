// M17a, from the animation benchmark: AN25 Skew in Properties (9626/04 M/J/21: the shield turned
// sideways), keyed on a later frame like the turn; AN5 Crop… and Make a colour see-through… for a
// picture (9626/04 O/N/19: the pearl cut from a photo, on a transparent background).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import App from '../../../src/ui/App.svelte';
import type { AnimObject, PictureObject } from '../../../src/core/animation/types.ts';
import { testApp } from '../../helpers/test-app.ts';

async function mode() {
  const t = testApp();
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
      name: 'Animation',
    }),
  );
  const anim = t.app.animation;
  const objects = (): AnimObject[] =>
    anim.store.get().history.present.layers.flatMap((l) => l.objects);
  return { ...t, anim, objects };
}

const typeIn = async (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });

describe('AN25 Skew in Properties', () => {
  it('skew horizontal and vertical are typed in degrees beside the rotation; too far is explained', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 0, y: 0, width: 100, height: 100 });
    await tick();
    await typeIn('Skew ↔', '30');
    await typeIn('Skew ↕', '-15');
    expect(s.objects()[0]).toMatchObject({ skewX: 30, skewY: -15 });
    await typeIn('Skew ↔', '85');
    expect(screen.getByRole('alert').textContent).toBe('A skew must be between −80° and 80°.');
    expect(s.objects()[0]!.skewX).toBe(30);
    // One undo step takes the last skew off.
    s.anim.undo();
    expect(s.objects()[0]!.skewY).toBeUndefined();
  });

  it('typed with the playhead on a later frame, it is a keyframe (tweened like the turn)', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 0, y: 0, width: 100, height: 100 });
    await tick();
    s.anim.setFrame(12);
    await tick();
    await typeIn('Skew ↔', '40');
    const track = s.objects()[0]!.tracks!.find((t) => t.property === 'skewX')!;
    expect(track.keyframes.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [12, 40],
    ]);
  });
});

describe('AN5 Crop… and Make a colour see-through… (Properties ▸ Picture)', () => {
  async function withPicture() {
    const s = await mode();
    s.dialogs.openPicture.mockResolvedValueOnce('/m/photo.jpg');
    await s.anim.addPicture({ x: 0, y: 0 });
    await tick();
    const picture = () => s.objects()[0] as PictureObject;
    const file = () =>
      s.anim.store.get().history.present.pictures.find((p) => p.id === picture().pictureId)!;
    return { ...s, picture, file };
  }

  it('Crop… cuts out the part dragged on the picture, saved under the name typed', async () => {
    const s = await withPicture();
    await fireEvent.click(screen.getByRole('button', { name: 'Crop…' }));
    const dialog = screen.getByRole('dialog', { name: 'Crop picture' });
    // The whole picture is kept until a part is drawn.
    expect(within(dialog).getByText('Keeps 100 × 100 px')).toBeTruthy();
    const area = within(dialog).getByLabelText('Picture — drag to choose the part to keep');
    await fireEvent.mouseDown(area, { clientX: 10, clientY: 20 });
    await fireEvent.mouseUp(window, { clientX: 60, clientY: 60 });
    expect(within(dialog).getByText('Keeps 50 × 40 px')).toBeTruthy();
    await fireEvent.input(within(dialog).getByLabelText('File name'), {
      target: { value: 'pearl' },
    });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Crop' }));
    await vi.waitFor(() => expect(s.file().path).toBe('/m/pearl.jpg'));
    expect(s.picture()).toMatchObject({ x: 10, y: 20, width: 50, height: 40 });
    expect(screen.queryByRole('dialog', { name: 'Crop picture' })).toBeNull();
  });

  it('Make a colour see-through… picks the colour clicked in the picture, with a tolerance', async () => {
    const s = await withPicture();
    await fireEvent.click(screen.getByRole('button', { name: 'Make a colour see-through…' }));
    const dialog = screen.getByRole('dialog', { name: 'Make a colour see-through' });
    const make = within(dialog).getByRole('button', { name: 'Make see-through' });
    // Nothing is picked yet.
    expect((make as HTMLButtonElement).disabled).toBe(true);
    const preview = await within(dialog).findByLabelText(
      'Picture — click the colour to make see-through',
    );
    await fireEvent.click(preview, { clientX: 0, clientY: 0 });
    expect(within(dialog).getByText('#FFFFFF')).toBeTruthy();
    await fireEvent.input(within(dialog).getByLabelText('Tolerance'), { target: { value: '35' } });
    await fireEvent.click(within(dialog).getByLabelText('Soft edges'));
    await fireEvent.click(make);
    await vi.waitFor(() => expect(s.file().path).toBe('/m/photo1.png'));
    expect(s.picture()).toMatchObject({ width: 100, height: 100 });
  });
});

// File ▸ Candidate Details…: the centre number, candidate number and name the papers ask for,
// with the file name they give; a wrong number is explained at its box; Clear forgets them.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import { menuActions } from '../../../src/ui/menu-actions.ts';
import { testApp } from '../../helpers/test-app.ts';

async function open() {
  const t = testApp(undefined, { preferences: '/prefs/preferences.json' });
  t.disk.set('/prefs/preferences.json', '{"welcomeSeen":true}');
  await t.app.start();
  render(App, { props: { app: t.app } });
  await menuActions(t.app).candidate();
  const dialog = await screen.findByRole('dialog', { name: 'Candidate details' });
  return { ...t, dialog: within(dialog) };
}

async function type(box: HTMLElement, value: string) {
  await fireEvent.input(box, { target: { value } });
}

describe('File ▸ Candidate Details…', () => {
  it('saves the details and shows the file name the papers ask for', async () => {
    const { app, dialog } = await open();
    expect(dialog.getByText(/Gas_ZZ999_9999/)).toBeTruthy();
    await type(dialog.getByLabelText('Centre number'), 'kh012');
    await type(dialog.getByLabelText('Candidate number'), '0042');
    await type(dialog.getByLabelText('Your name'), 'Sok Dara');
    expect(dialog.getByText(/Gas_KH012_0042/)).toBeTruthy();
    await fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await expect
      .poll(() => app.candidate.store.get())
      .toEqual({
        candidate: { centre: 'KH012', number: '0042', name: 'Sok Dara' },
        dialog: false,
      });
  });

  it('a wrong number is explained at its box and the dialog stays open', async () => {
    const { app, dialog } = await open();
    await type(dialog.getByLabelText('Centre number'), 'K12');
    await type(dialog.getByLabelText('Candidate number'), '42');
    await fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    const centre = dialog.getByLabelText('Centre number');
    await expect.poll(() => centre.getAttribute('aria-invalid')).toBe('true');
    expect(dialog.getByText(/two letters and three digits/)).toBeTruthy();
    expect(app.candidate.store.get()).toMatchObject({ candidate: null, dialog: true });
  });

  it('opens with the saved details; Clear forgets them', async () => {
    const t = await open();
    await t.app.candidate.set({ centre: 'KH012', number: '0042', name: '' });
    await fireEvent.click(t.dialog.getByRole('button', { name: 'Cancel' }));
    await expect.poll(() => screen.queryByRole('dialog', { name: 'Candidate details' })).toBeNull();
    await menuActions(t.app).candidate();
    const dialog = within(await screen.findByRole('dialog', { name: 'Candidate details' }));
    expect((dialog.getByLabelText('Centre number') as HTMLInputElement).value).toBe('KH012');
    await fireEvent.click(dialog.getByRole('button', { name: 'Clear' }));
    await expect.poll(() => t.app.candidate.store.get().candidate).toBeNull();
  });
});

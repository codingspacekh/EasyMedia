// M17a U1–U5: the note at the bottom of the window and Help ▸ Check for Updates…, as in the
// ZISPP Gradebook: "1.5.1 is out" with what's new and Download; the download's progress; "Update
// ready" with Restart and update or Later; "Updated to 1.5.1" once after an update.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import { menuActions } from '../../../src/ui/menu-actions.ts';
import { testApp } from '../../helpers/test-app.ts';
import { fakeUpdates } from '../../helpers/fake-updates.ts';

async function open(initial = {}) {
  const updates = fakeUpdates(initial);
  const t = testApp(undefined, { updates: updates.port });
  render(App, { props: { app: t.app } });
  await vi.waitFor(() => expect(updates.port.get).toHaveBeenCalled());
  return { ...t, ...updates };
}
const note = () => screen.queryByRole('status', { name: 'Updates' });

describe('U1–U3 the update note', () => {
  it('says nothing while there is nothing new', async () => {
    await open();
    expect(note()).toBeNull();
  });

  it('a newer version: "OneEditor 1.5.1 is out", what is new, and Download', async () => {
    const { push, port } = await open();
    push({ status: 'available', version: '1.5.1', notes: ['SVG pictures', 'OGG audio'] });
    await vi.waitFor(() => expect(note()!.textContent).toMatch(/OneEditor 1\.5\.1 is out/));
    await fireEvent.click(within(note()!).getByRole('button', { name: "What's new" }));
    expect(screen.getByText('SVG pictures')).toBeTruthy();
    await fireEvent.click(within(note()!).getByRole('button', { name: 'Download' }));
    expect(port.download).toHaveBeenCalled();
  });

  it('downloading shows its progress; ready offers Restart and update, or Later', async () => {
    const { push, port } = await open();
    push({ status: 'downloading', version: '1.5.1', percent: 42 });
    await vi.waitFor(() => expect(note()!.textContent).toMatch(/Downloading 1\.5\.1… 42 %/));
    push({ status: 'ready', percent: 100 });
    await vi.waitFor(() => expect(note()!.textContent).toMatch(/1\.5\.1 is ready/));
    expect(note()!.textContent).toMatch(/when you next close OneEditor/i);
    await fireEvent.click(within(note()!).getByRole('button', { name: 'Restart and update' }));
    expect(port.install).toHaveBeenCalled();
    await fireEvent.click(within(note()!).getByRole('button', { name: 'Later' }));
    expect(note()).toBeNull();
  });

  it('a Mac that cannot update by itself: the .dmg is in Downloads, Open it', async () => {
    const { push, port } = await open({ mode: 'dmg' });
    push({
      status: 'dmg',
      version: '1.5.1',
      dmg: '/Users/x/Downloads/OneEditor-1.5.1-mac-arm64.dmg',
    });
    await vi.waitFor(() => expect(note()!.textContent).toMatch(/in Downloads/));
    await fireEvent.click(within(note()!).getByRole('button', { name: 'Open it' }));
    expect(port.openDmg).toHaveBeenCalled();
  });

  it('U4 after an update: "Updated to 1.5.1" once, with what is new; OK makes it go', async () => {
    const { port } = await open({ updatedTo: '1.5.1', updatedNotes: ['SVG pictures'] });
    await vi.waitFor(() => expect(note()!.textContent).toMatch(/Updated to 1\.5\.1/));
    expect(note()!.textContent).toMatch(/SVG pictures/);
    await fireEvent.click(within(note()!).getByRole('button', { name: 'OK' }));
    expect(port.seen).toHaveBeenCalled();
    await vi.waitFor(() => expect(note()).toBeNull());
  });
});

describe('U2 Help ▸ Check for Updates…', () => {
  it('shows the version, Check now, and "Download updates by itself" (off)', async () => {
    const t = await open();
    await menuActions(t.app).updates();
    const dialog = await screen.findByRole('dialog', { name: 'Updates' });
    expect(dialog.textContent).toMatch(/OneEditor 1\.5\.0/);
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Check now' }));
    expect(t.port.check).toHaveBeenCalled();
    t.push({ status: 'none', checkedAt: '2026-11-04T10:00:00.000Z' });
    await vi.waitFor(() => expect(dialog.textContent).toMatch(/This is the newest version/));
    const auto = within(dialog).getByLabelText(/Download updates by itself/) as HTMLInputElement;
    expect(auto.checked).toBe(false);
    await fireEvent.click(auto);
    expect(t.port.setAuto).toHaveBeenCalledWith(true);
  });

  it('run from the source: updates are off and the dialog says why', async () => {
    const t = await open({ mode: 'off' });
    await menuActions(t.app).updates();
    const dialog = await screen.findByRole('dialog', { name: 'Updates' });
    expect(dialog.textContent).toMatch(/only in the installed app/i);
    expect(within(dialog).queryByRole('button', { name: 'Check now' })).toBeNull();
  });
});

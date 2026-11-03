// The shared Dialog (N10): its title is its name, Escape closes it — but not while it is busy
// (saving, exporting), so work is never left half done.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Dialog from '../../../src/ui/Dialog.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Body</p>' }));

describe('Dialog', () => {
  it('is named by its title, shows its syllabus point, and Escape closes it', async () => {
    const onclose = vi.fn();
    render(Dialog, {
      props: { label: 'Stage settings', syllabus: '20.1 the stage', onclose, children },
    });
    expect(screen.getByRole('dialog', { name: 'Stage settings' }).textContent).toContain(
      '20.1 the stage',
    );
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onclose).toHaveBeenCalledOnce();
  });

  it('while busy, Escape does nothing', async () => {
    const onclose = vi.fn();
    render(Dialog, { props: { label: 'Export', busy: true, onclose, children } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onclose).not.toHaveBeenCalled();
  });
});

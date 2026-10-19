// T5: every editing tool links to its "why" text — a "Why use this?" box in its section or
// dialog, or, for a toolbar button or menu item, in its tooltip.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { WHY } from '../../../src/core/effects/help.ts';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import App from '../../../src/ui/App.svelte';
import Inspector from '../../../src/ui/Inspector.svelte';
import MediaBin from '../../../src/ui/MediaBin.svelte';
import ProjectSettings from '../../../src/ui/ProjectSettings.svelte';
import Timeline from '../../../src/ui/Timeline.svelte';
import { testApp } from '../../helpers/test-app.ts';

/** The section under a heading that starts with `name`. */
const section = (name: string) =>
  screen.getByRole('heading', { name: new RegExp(`^${name}`) }).closest('section')!;

async function videoClip() {
  const t = testApp();
  await t.importFiles('/m/clip.mp4', '/m/photo.jpg');
  const [clip, photo] = t.app.store.get().history.present.media;
  t.app.addToTimeline(clip!.id);
  t.app.addToTimeline(photo!.id);
  return t;
}

describe('T5 every editing tool links to why it is used', () => {
  it('Video inspector: trim, speed, clip sound, separate sound', async () => {
    const t = await videoClip();
    t.app.select(t.app.store.get().history.present.timeline.main[0]!.id);
    render(Inspector, { props: { app: t.app } });
    expect(section('Trim').textContent).toContain(WHY.trim);
    expect(section('Speed').textContent).toContain(WHY.speed);
    await fireEvent.click(screen.getByRole('tab', { name: 'Audio' }));
    expect(section('Clip sound').textContent).toContain(WHY.clipSound);
    expect(section('Separate sound').textContent).toContain(WHY.separateSound);
  });

  it('a still image: its duration', async () => {
    const t = await videoClip();
    t.app.select(t.app.store.get().history.present.timeline.main[1]!.id);
    render(Inspector, { props: { app: t.app } });
    expect(section('Duration').textContent).toContain(WHY.duration);
  });

  it.each(['caption', 'subtitle', 'credits'] as const)('text: %s', (kind) => {
    const t = testApp();
    t.app.addText(kind);
    render(Inspector, { props: { app: t.app } });
    expect(section('Text').textContent).toContain(WHY[kind]);
  });

  it('text: a title slide', async () => {
    const t = testApp();
    t.app.addTitle();
    render(Inspector, { props: { app: t.app } });
    expect(section('Text').textContent).toContain(WHY.title);
  });

  it('resize & crop', async () => {
    const eagle: ProbeInfo = {
      kind: 'image',
      container: 'jpg',
      sizeBytes: 1000,
      video: { codec: 'mjpeg', width: 3764, height: 3092 },
    };
    const t = testApp({ '/m/Fish_Eagle.jpg': eagle });
    await t.importFiles('/m/Fish_Eagle.jpg');
    render(MediaBin, { props: { app: t.app } });
    await fireEvent.click(screen.getByRole('button', { name: 'Resize and crop Fish_Eagle.jpg' }));
    expect(screen.getByRole('dialog', { name: 'Resize and crop image' }).textContent).toContain(
      WHY.resizeCrop,
    );
  });

  it('project settings: the aspect ratio', () => {
    const t = testApp();
    render(ProjectSettings, { props: { app: t.app, onclose: () => {} } });
    expect(screen.getByRole('dialog').textContent).toContain(WHY.aspectRatio);
  });

  it('timeline: split and join, delete (tooltips)', async () => {
    const t = await videoClip();
    render(Timeline, { props: { app: t.app } });
    expect(screen.getByRole('button', { name: /Split/ }).title).toContain(WHY.split);
    expect(screen.getByRole('button', { name: /Join/ }).title).toContain(WHY.split);
    expect(screen.getByRole('button', { name: /Delete/ }).title).toContain(WHY.remove);
  });

  it('Audio mode: the editing buttons and the Tracks menu (tooltips)', async () => {
    const t = testApp();
    render(App, { props: { app: t.app } });
    await fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
        name: 'Audio',
      }),
    );
    const button = (name: string) => screen.getByRole('button', { name });
    for (const name of ['Cut', 'Copy', 'Paste'])
      expect(button(name).title, name).toContain(WHY.cutCopyPaste);
    expect(button('Trim to selection').title).toContain(WHY.trimAudio);
    expect(button('Insert silence').title).toContain(WHY.silence);
    expect(button('Record').title).toContain(WHY.recording);
    await fireEvent.click(screen.getByRole('button', { name: /^Tracks/ }));
    const item = (name: string) => screen.getByRole('menuitem', { name });
    const expected = {
      'Add new mono track': WHY.addTrack,
      'Add new stereo track': WHY.addTrack,
      'Import audio as new track…': WHY.addTrack,
      'Record into new track': WHY.recording,
      'Move track up': WHY.moveTrack,
      'Move track down': WHY.moveTrack,
      'Align end to end': WHY.align,
      'Align start to cursor': WHY.align,
      'Align start to zero': WHY.align,
      'Mix stereo down to mono': WHY.mono,
      'Mix and render': WHY.mix,
      'Mix and render to new track': WHY.mix,
      'Remove track': WHY.removeTrack,
    };
    for (const [name, why] of Object.entries(expected))
      expect(item(name).title, name).toContain(why);
    vi.restoreAllMocks();
  });
});

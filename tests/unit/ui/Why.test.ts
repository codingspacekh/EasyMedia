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
import { expectWhy, whyTexts } from '../../helpers/why.ts';

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
    expectWhy(whyTexts(section('Trim')), WHY.trim);
    expectWhy(whyTexts(section('Speed')), WHY.speed);
    await fireEvent.click(screen.getByRole('tab', { name: 'Audio' }));
    expectWhy(whyTexts(section('Clip sound')), WHY.clipSound);
    expectWhy(whyTexts(section('Separate sound')), WHY.separateSound);
  });

  it('V19: turn & flip, on a video clip and on a picture', async () => {
    const t = await videoClip();
    const main = () => t.app.store.get().history.present.timeline.main;
    t.app.select(main()[0]!.id);
    const { unmount } = render(Inspector, { props: { app: t.app } });
    expectWhy(whyTexts(section('Turn & flip')), WHY.turn);
    unmount();
    t.app.select(main()[1]!.id);
    render(Inspector, { props: { app: t.app } });
    expectWhy(whyTexts(section('Turn & flip')), WHY.turn);
  });

  it('a still image: its duration', async () => {
    const t = await videoClip();
    t.app.select(t.app.store.get().history.present.timeline.main[1]!.id);
    render(Inspector, { props: { app: t.app } });
    expectWhy(whyTexts(section('Duration')), WHY.duration);
  });

  it.each(['caption', 'subtitle', 'credits'] as const)('text: %s', (kind) => {
    const t = testApp();
    t.app.addText(kind);
    render(Inspector, { props: { app: t.app } });
    expectWhy(whyTexts(section('Text')), WHY[kind]);
  });

  it('text: a title slide', async () => {
    const t = testApp();
    t.app.addTitle();
    render(Inspector, { props: { app: t.app } });
    expectWhy(whyTexts(section('Text')), WHY.title);
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
    expectWhy(
      whyTexts(screen.getByRole('dialog', { name: 'Resize and crop image' })),
      WHY.resizeCrop,
    );
  });

  it('project settings: the aspect ratio', () => {
    const t = testApp();
    render(ProjectSettings, { props: { app: t.app, onclose: () => {} } });
    expectWhy(whyTexts(screen.getByRole('dialog')), WHY.aspectRatio);
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

  it('N17 "Why use this?" is a tooltip above everything: shown on hover or focus, pinned by a click', async () => {
    const t = await videoClip();
    t.app.select(t.app.store.get().history.present.timeline.main[0]!.id);
    render(Inspector, { props: { app: t.app } });
    const link = within(section('Trim')).getByRole('button', { name: 'Why use this?' });
    const tip = document.getElementById(link.getAttribute('aria-controls')!)!;
    // It lives at the end of the page, so no panel or dialog can cover or clip it.
    expect(tip.parentElement).toBe(document.body);
    expect(tip.hidden).toBe(true);
    await fireEvent.pointerEnter(link);
    expect(tip.hidden).toBe(false);
    expect(link.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.pointerLeave(link);
    await vi.waitFor(() => expect(tip.hidden).toBe(true));
    await fireEvent.focus(link);
    expect(tip.hidden).toBe(false);
    await fireEvent.blur(link);
    await vi.waitFor(() => expect(tip.hidden).toBe(true));
    // A click pins it: leaving does not hide it; Escape does.
    await fireEvent.click(link);
    await fireEvent.pointerLeave(link);
    await new Promise((r) => setTimeout(r, 200));
    expect(tip.hidden).toBe(false);
    await fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(tip.hidden).toBe(true);
    // A click elsewhere closes a pinned one too.
    await fireEvent.click(link);
    await fireEvent.pointerDown(document.body);
    expect(tip.hidden).toBe(true);
  });
});

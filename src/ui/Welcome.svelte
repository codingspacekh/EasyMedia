<script lang="ts">
  // X7: what EasyMedia is for and where to start, on the first launch (Help ▸ Welcome again).
  import type { App } from '../app/app.ts';
  import Icon from './Icon.svelte';

  let { app }: { app: App } = $props();

  const MODES = [
    {
      name: 'Video',
      icon: 'video',
      text: 'Put clips, pictures and titles on the timeline; trim, split and add transitions, captions, music and a voiceover; export for the web, a phone or a DVD.',
      syllabus: '11.1',
    },
    {
      name: 'Audio',
      icon: 'audio',
      text: 'Edit sound in clips on tracks: cut, split and move it, add effects such as fades, echo and noise reduction, record a voiceover, and export.',
      syllabus: '11.2',
    },
    {
      name: 'Learn',
      icon: 'learn',
      text: 'See what is inside a media file, work out file sizes, watch how sampling works, compare compressions, and check an export against a task.',
      syllabus: '11.1 · 11.2',
    },
  ] as const;

  const close = () => void app.closeWelcome();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Welcome to EasyMedia">
    <h2>Welcome to EasyMedia</h2>
    <p class="lead">
      A video and sound editor for Cambridge AS & A Level IT, Chapter 11. Choose a mode at the top
      left.
    </p>
    <div class="modes">
      {#each MODES as mode (mode.name)}
        <section>
          <h3><Icon name={mode.icon} size={18} />{mode.name}</h3>
          <p>{mode.text}</p>
          <span class="syl">{mode.syllabus}</span>
        </section>
      {/each}
    </div>
    <h4>Where your work is saved</h4>
    <ul>
      <li>
        <b>File ▸ Save</b> makes a project file (<code>.mve</code>) and, for Audio mode, a folder of
        sound next to it. Your videos, pictures and music stay where they are.
      </li>
      <li>
        To take a project to another computer or a USB stick, use <b>File ▸ Package Project</b>: it
        copies everything into one folder.
      </li>
      <li>EasyMedia saves your work in the background, so it can be restored after a crash.</li>
    </ul>
    <p class="hint">
      Rest the mouse on any button to see what it does. <b>Help ▸ Welcome</b> shows this page again.
    </p>
    <div class="actions">
      <button class="primary" onclick={close}>Start</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(6, 7, 9, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }
  .dialog {
    width: 720px;
    max-width: calc(100vw - 32px);
    max-height: 90vh;
    overflow: auto;
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 22px 24px;
  }
  h2 {
    font-size: 20px;
    margin: 0 0 6px;
  }
  .lead {
    margin: 0 0 16px;
    color: var(--tx-2);
  }
  .modes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  section {
    position: relative;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg-2);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
    font-size: 14px;
  }
  section p {
    margin: 0;
    font-size: 12.5px;
    color: var(--tx-2);
    line-height: 1.45;
  }
  .syl {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 10px;
    font-weight: 600;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  h4 {
    margin: 0 0 6px;
    font-size: 13px;
  }
  ul {
    margin: 0 0 12px;
    padding-left: 18px;
    font-size: 12.5px;
    color: var(--tx-2);
    line-height: 1.5;
  }
  .hint {
    font-size: 12.5px;
    color: var(--tx-3);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>

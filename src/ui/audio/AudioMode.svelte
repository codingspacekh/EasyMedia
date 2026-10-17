<script lang="ts">
  // Audio mode (screens 13, 14, 20): tracks and side panel, the selection bar, the effect and
  // export dialogs, and the keyboard: Space plays / stops, Delete deletes, and the Edit menu's
  // cut, copy and paste work on the selected sound (N10).
  import type { App } from '../../app/app.ts';
  import { audioEffectById } from '../../core/effects/registry.ts';
  import { WHY } from '../../core/effects/help.ts';
  import { ui } from '../ui-state.svelte.ts';
  import AudioExportDialog from './AudioExportDialog.svelte';
  import AudioSidePanel from './AudioSidePanel.svelte';
  import AudioTracks from './AudioTracks.svelte';
  import EffectDialog from './EffectDialog.svelte';
  import SelectionBar from './SelectionBar.svelte';
  import { audioUi } from './audio-ui.svelte.ts';

  let { app }: { app: App } = $props();
  const audio = $derived(app.audio);
  const store = $derived(app.audio.store);
  const sel = $derived($store.selection);
  const appliesTo = $derived(
    sel.end > sel.start
      ? `${sel.start.toFixed(2)} – ${sel.end.toFixed(2)} s`
      : `the cursor at ${sel.start.toFixed(2)} s`,
  );
  const effect = $derived(
    audioUi.dialog?.kind === 'effect' ? audioEffectById(audioUi.dialog.id) : undefined,
  );

  /** Typing in a box, or a dialog is open: the shortcuts leave the keys alone. */
  function busy(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return (
      audioUi.dialog !== null ||
      ui.audioExport ||
      (el instanceof HTMLElement &&
        (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName)))
    );
  }

  function onkeydown(e: KeyboardEvent): void {
    if (busy(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') {
      e.preventDefault();
      if ($store.playing) audio.stop();
      else audio.play();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      audio.deleteSelection();
    }
  }

  function clipboard(action: 'cut' | 'copy' | 'paste') {
    return (e: ClipboardEvent) => {
      if (busy(e.target)) return;
      e.preventDefault();
      audio[action]();
    };
  }
</script>

<svelte:window {onkeydown} />
<svelte:document oncut={clipboard('cut')} oncopy={clipboard('copy')} onpaste={clipboard('paste')} />

<div class="audio-mode">
  <div class="a-body">
    <AudioTracks {app} />
    <AudioSidePanel {app} />
  </div>
  <SelectionBar {app} />
</div>

{#if effect}
  <EffectDialog
    id={effect.id}
    title={effect.label.replace('…', '')}
    syllabus={effect.syllabus}
    why={effect.why}
    params={effect.params}
    initial={audio.effectSettings(effect.id)}
    {appliesTo}
    note={(p) => audio.effectNote(effect.id, p)}
    {...effect.link ? { link: effect.link } : {}}
    preview={(p) => audio.previewEffect(effect.id, p)}
    apply={(p) => audio.applyEffect(effect.id, p)}
    {...effect.needsNoiseProfile
      ? {
          step1: {
            taken: $store.noiseProfile
              ? `${$store.noiseProfile.start.toFixed(2)} – ${$store.noiseProfile.end.toFixed(2)} s`
              : null,
            take: () => audio.getNoiseProfile(),
          },
        }
      : {}}
    {...effect.curve && effect.shape
      ? { levels: { curve: effect.curve, shape: effect.shape, before: audio.selectionLevels(60) } }
      : {}}
    onclose={() => (audioUi.dialog = null)}
  />
{:else if audioUi.dialog?.kind === 'silence'}
  <EffectDialog
    id="audio.silence"
    title="Insert silence"
    syllabus="11.2 trimming"
    why={WHY.silence}
    params={{
      length: { label: 'Length', unit: 's', min: 0.01, max: 3600, step: 0.01, default: 1 },
    }}
    initial={{ length: sel.end > sel.start ? Math.round((sel.end - sel.start) * 100) / 100 : 1 }}
    {appliesTo}
    apply={(p) => audio.insertSilence(p.length!)}
    onclose={() => (audioUi.dialog = null)}
  />
{/if}
{#if ui.audioExport}
  <AudioExportDialog {app} onclose={() => (ui.audioExport = false)} />
{/if}

<style>
  .audio-mode {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  .a-body {
    flex: 1;
    display: flex;
    min-height: 0;
    min-width: 0;
  }
</style>

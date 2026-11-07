<script lang="ts">
  // Animation mode (M13, M14): the Layers panel, the tool strip, the stage with the timeline under it
  // and the Properties panel, the stage settings dialog, and the keyboard: Space plays and pauses,
  // comma and full stop step a frame, Delete, arrow keys nudge (Shift: 10 px), V R E S G L P
  // B T I choose tools, F6 duplicates the frame-by-frame drawing and F7 adds a blank one (Shift:
  // removes it), Ctrl/Cmd + D duplicates, G groups, Shift + G ungroups, 0 fits, + / −
  // zoom; the Edit menu's cut, copy and paste work on the selected objects (N10).
  import type { App } from '../../app/app.ts';
  import { editorOf } from './editor.ts';
  import type { Tool } from '../../app/animation.ts';
  import { shortcutAllowed } from '../keys.ts';
  import { animUi, ZOOM_STEPS } from './animation-ui.svelte.ts';
  import LayersPanel from './LayersPanel.svelte';
  import PanelSlot from '../PanelSlot.svelte';
  import PropertiesPanel from './PropertiesPanel.svelte';
  import Stage from './Stage.svelte';
  import AnimationExportDialog from './AnimationExportDialog.svelte';
  import TraceDialog from './TraceDialog.svelte';
  import ImportFramesDialog from './ImportFramesDialog.svelte';
  import LibraryDialog from './LibraryDialog.svelte';
  import PictureCropDialog from './PictureCropDialog.svelte';
  import SeeThroughDialog from './SeeThroughDialog.svelte';
  import StageSettings from './StageSettings.svelte';
  import Timeline from './Timeline.svelte';
  import ToolStrip from './ToolStrip.svelte';

  let { app }: { app: App } = $props();
  const editor = editorOf(() => app);
  const anim = $derived(editor.anim);
  const store = $derived(editor.anim.store);

  const TOOL_KEYS: Record<string, Tool> = {
    v: 'select',
    r: 'rect',
    e: 'ellipse',
    s: 'star',
    g: 'polygon',
    l: 'line',
    p: 'pen',
    b: 'brush',
    t: 'text',
    i: 'picture',
    u: 'button',
  };

  function busy(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return (
      animUi.dialog !== null ||
      (el instanceof HTMLElement &&
        (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName)))
    );
  }

  function onkeydown(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && !busy(e.target)) {
      const key = e.key.toLowerCase();
      if (key === 'd') {
        e.preventDefault();
        anim.duplicate();
      } else if (key === 'g') {
        e.preventDefault();
        if (e.shiftKey) anim.ungroup();
        else anim.group();
      } else if (key === 'enter') {
        // AN18: Test, as Animate's Test Movie (Ctrl+Enter).
        e.preventDefault();
        void anim.testAnimation();
      } else if (key === '0') {
        e.preventDefault();
        anim.setZoom('fit');
      } else if (key === '=' || key === '+') {
        e.preventDefault();
        const z = $store.zoom === 'fit' ? 1 : $store.zoom;
        anim.setZoom(ZOOM_STEPS.find((s) => s > z + 1e-9) ?? ZOOM_STEPS.at(-1)!);
      } else if (key === '-') {
        e.preventDefault();
        const z = $store.zoom === 'fit' ? 1 : $store.zoom;
        anim.setZoom([...ZOOM_STEPS].reverse().find((s) => s < z - 1e-9) ?? ZOOM_STEPS[0]!);
      }
      return;
    }
    if (!shortcutAllowed(e) || animUi.dialog !== null) return;
    if (e.key.toLowerCase() === 'k' && !e.shiftKey) {
      // AN19: the library.
      e.preventDefault();
      animUi.dialog = 'library';
      return;
    }
    if (e.key === 'F6' || e.key === 'F7') {
      // AN14: as Animate — F6 a keyframe copying the drawing, F7 a blank one (Shift: remove).
      e.preventDefault();
      if (e.shiftKey) anim.removeDrawing();
      else anim.insertDrawing(e.key === 'F6' ? 'copy' : 'blank');
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      anim.togglePlay();
    } else if (e.key === ',' || e.key === '.') {
      e.preventDefault();
      anim.step(e.key === '.' ? 1 : -1);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      anim.deleteSelection();
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      anim.nudge(dx, dy);
    } else if (e.key === 'Escape') {
      if ($store.tool !== 'select') anim.setTool('select');
      else anim.select([]);
    } else {
      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool && !e.shiftKey) anim.setTool(tool);
    }
  }

  function clipboard(action: 'cut' | 'copy' | 'paste') {
    return (e: ClipboardEvent) => {
      if (busy(e.target)) return;
      e.preventDefault();
      anim[action]();
    };
  }
</script>

<svelte:window {onkeydown} />
<svelte:document oncut={clipboard('cut')} oncopy={clipboard('copy')} onpaste={clipboard('paste')} />

<div class="animation-mode">
  <PanelSlot layout={app.layout} id="animation.layers"><LayersPanel {app} /></PanelSlot>
  <ToolStrip {app} />
  <div class="centre">
    <Stage {app} />
    <PanelSlot layout={app.layout} id="animation.timeline"><Timeline {app} /></PanelSlot>
  </div>
  <PanelSlot layout={app.layout} id="animation.properties"><PropertiesPanel {app} /></PanelSlot>
</div>
{#if animUi.dialog === 'stage'}
  <StageSettings {app} onclose={() => (animUi.dialog = null)} />
{:else if animUi.dialog === 'export'}
  <AnimationExportDialog {app} onclose={() => (animUi.dialog = null)} />
{:else if animUi.dialog === 'trace'}
  <TraceDialog {app} onclose={() => (animUi.dialog = null)} />
{:else if animUi.dialog === 'frames'}
  <ImportFramesDialog {app} onclose={() => (animUi.dialog = null)} />
{:else if animUi.dialog === 'library'}
  <LibraryDialog {app} onclose={() => (animUi.dialog = null)} />
{:else if animUi.dialog === 'cropPicture'}
  <PictureCropDialog {app} onclose={() => (animUi.dialog = null)} />
{:else if animUi.dialog === 'seeThrough'}
  <SeeThroughDialog {app} onclose={() => (animUi.dialog = null)} />
{/if}

<style>
  .centre {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .animation-mode {
    flex: 1;
    display: flex;
    min-height: 0;
    min-width: 0;
  }
</style>

<script lang="ts">
  // Graphics mode (M18, syllabus 19): Animation mode's Layers panel, tool strip, stage (here the
  // canvas) and Properties panel, on Graphics mode's own app (EditorScope), with no timeline. The
  // keyboard is Animation mode's without the timeline's keys: V R E S G L P B T I choose tools,
  // Delete, arrows nudge (Shift: 10 px), Ctrl/Cmd + D duplicates, G groups, Shift + G
  // ungroups, 0 fits, + / − zoom, K the library; cut, copy and paste work on the selection and
  // between Graphics and Animation modes (one clipboard).
  import type { App } from '../../app/app.ts';
  import type { Tool } from '../../app/animation.ts';
  import { shortcutAllowed } from '../keys.ts';
  import PanelSlot from '../PanelSlot.svelte';
  import { animUi, ZOOM_STEPS } from '../animation/animation-ui.svelte.ts';
  import LayersPanel from '../animation/LayersPanel.svelte';
  import LibraryDialog from '../animation/LibraryDialog.svelte';
  import PictureCropDialog from '../animation/PictureCropDialog.svelte';
  import PropertiesPanel from '../animation/PropertiesPanel.svelte';
  import SeeThroughDialog from '../animation/SeeThroughDialog.svelte';
  import Stage from '../animation/Stage.svelte';
  import ToolStrip from '../animation/ToolStrip.svelte';
  import TraceDialog from '../animation/TraceDialog.svelte';
  import EditorScope from './EditorScope.svelte';
  import GraphicsExportDialog from './GraphicsExportDialog.svelte';
  import ImageSettings from './ImageSettings.svelte';

  let { app }: { app: App } = $props();
  const g = $derived(app.graphics);
  const store = $derived(app.graphics.store);

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
        g.duplicate();
      } else if (key === 'g') {
        e.preventDefault();
        if (e.shiftKey) g.ungroup();
        else g.group();
      } else if (key === '0') {
        e.preventDefault();
        g.setZoom('fit');
      } else if (key === '=' || key === '+') {
        e.preventDefault();
        const z = $store.zoom === 'fit' ? 1 : $store.zoom;
        g.setZoom(ZOOM_STEPS.find((s) => s > z + 1e-9) ?? ZOOM_STEPS.at(-1)!);
      } else if (key === '-') {
        e.preventDefault();
        const z = $store.zoom === 'fit' ? 1 : $store.zoom;
        g.setZoom([...ZOOM_STEPS].reverse().find((s) => s < z - 1e-9) ?? ZOOM_STEPS[0]!);
      }
      return;
    }
    if (!shortcutAllowed(e) || animUi.dialog !== null) return;
    if (e.key.toLowerCase() === 'k' && !e.shiftKey) {
      e.preventDefault();
      animUi.dialog = 'library';
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      g.deleteSelection();
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      g.nudge(dx, dy);
    } else if (e.key === 'Escape') {
      if ($store.tool !== 'select') g.setTool('select');
      else g.select([]);
    } else {
      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool && !e.shiftKey) g.setTool(tool);
    }
  }

  function clipboard(action: 'cut' | 'copy' | 'paste') {
    return (e: ClipboardEvent) => {
      if (busy(e.target)) return;
      e.preventDefault();
      g[action]();
    };
  }
</script>

<svelte:window {onkeydown} />
<svelte:document oncut={clipboard('cut')} oncopy={clipboard('copy')} onpaste={clipboard('paste')} />

<EditorScope {app}>
  <div class="graphics-mode">
    <PanelSlot layout={app.layout} id="graphics.layers"><LayersPanel {app} /></PanelSlot>
    <ToolStrip {app} />
    <div class="centre">
      <Stage {app} />
    </div>
    <PanelSlot layout={app.layout} id="graphics.properties"><PropertiesPanel {app} /></PanelSlot>
  </div>
  {#if animUi.dialog === 'newImage' || animUi.dialog === 'image'}
    <ImageSettings
      {app}
      mode={animUi.dialog === 'newImage' ? 'new' : 'edit'}
      onclose={() => (animUi.dialog = null)}
    />
  {:else if animUi.dialog === 'export'}
    <GraphicsExportDialog {app} onclose={() => (animUi.dialog = null)} />
  {:else if animUi.dialog === 'trace'}
    <TraceDialog {app} onclose={() => (animUi.dialog = null)} />
  {:else if animUi.dialog === 'library'}
    <LibraryDialog {app} onclose={() => (animUi.dialog = null)} />
  {:else if animUi.dialog === 'cropPicture'}
    <PictureCropDialog {app} onclose={() => (animUi.dialog = null)} />
  {:else if animUi.dialog === 'seeThrough'}
    <SeeThroughDialog {app} onclose={() => (animUi.dialog = null)} />
  {/if}
</EditorScope>

<style>
  .centre {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .graphics-mode {
    flex: 1;
    display: flex;
    min-height: 0;
    min-width: 0;
  }
</style>

<script lang="ts">
  // Animation mode (M13): the Layers panel, the tool strip, the stage and the Properties panel, the stage
  // settings dialog, and the keyboard: Delete, arrow keys nudge (Shift: 10 px), V R E S G L P
  // B T I choose tools, Ctrl/Cmd + D duplicates, G groups, Shift + G ungroups, 0 fits, + / −
  // zoom; the Edit menu's cut, copy and paste work on the selected objects (N10).
  import type { App } from '../../app/app.ts';
  import type { Tool } from '../../app/animation.ts';
  import { shortcutAllowed } from '../keys.ts';
  import { animUi, ZOOM_STEPS } from './animation-ui.svelte.ts';
  import LayersPanel from './LayersPanel.svelte';
  import PropertiesPanel from './PropertiesPanel.svelte';
  import Stage from './Stage.svelte';
  import StageSettings from './StageSettings.svelte';
  import ToolStrip from './ToolStrip.svelte';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);

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
        anim.duplicate();
      } else if (key === 'g') {
        e.preventDefault();
        if (e.shiftKey) anim.ungroup();
        else anim.group();
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
    if (e.key === 'Delete' || e.key === 'Backspace') {
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
  <LayersPanel {app} />
  <ToolStrip {app} />
  <Stage {app} />
  <PropertiesPanel {app} />
</div>
{#if animUi.dialog === 'stage'}
  <StageSettings {app} onclose={() => (animUi.dialog = null)} />
{/if}

<style>
  .animation-mode {
    flex: 1;
    display: flex;
    min-height: 0;
    min-width: 0;
  }
</style>

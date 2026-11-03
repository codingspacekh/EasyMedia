<script lang="ts">
  // T5, N17: "Why use this?" — a small link under a tool's heading. Resting the mouse on it (or
  // focusing it) shows the explanation in a floating tooltip above everything else, dialogs
  // included; clicking pins it open until clicked again, Escape, or a click elsewhere. It never
  // changes the layout around it. The text is arranged to read at a glance: the short answer, the
  // reasons as points, and the syllabus point it belongs to.
  import { onDestroy, tick } from 'svelte';
  import { WHY, explain, toolById, type ToolId } from '../core/effects/help.ts';
  import Icon from './Icon.svelte';

  let {
    tool,
    text,
    title = 'Why use this?',
    syllabus,
  }: {
    tool?: ToolId;
    text?: string;
    title?: string;
    syllabus?: string;
  } = $props();

  const explained = $derived(explain(text ?? (tool ? WHY[tool] : '')));
  const point = $derived(syllabus ?? (tool ? toolById(tool)?.syllabus : undefined));

  const id = `why-${Math.random().toString(36).slice(2, 10)}`;
  let trigger: HTMLButtonElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  let open = $state(false);
  let pinned = $state(false);
  let place = $state({ left: 0, top: 0, above: false });
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let refocusing = false;

  const GAP = 6;
  const EDGE = 8;

  /** Puts the tooltip under the link (above it if there is no room), inside the window. */
  async function position(): Promise<void> {
    await tick();
    if (!trigger || !panel) return;
    const r = trigger.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const above = r.bottom + GAP + h > window.innerHeight - EDGE && r.top - GAP - h > EDGE;
    const left = Math.min(Math.max(EDGE, r.left), window.innerWidth - w - EDGE);
    const top = above ? r.top - GAP - h : Math.min(r.bottom + GAP, window.innerHeight - h - EDGE);
    place = { left, top: Math.max(EDGE, top), above };
  }

  function show(): void {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    if (!open) {
      open = true;
      void position();
    }
  }

  function hideSoon(): void {
    if (pinned) return;
    if (hideTimer) clearTimeout(hideTimer);
    // A moment to move the mouse onto the tooltip (to read or select its words).
    hideTimer = setTimeout(() => {
      open = false;
      hideTimer = null;
    }, 150);
  }

  function close(): void {
    open = false;
    pinned = false;
  }

  function toggle(): void {
    if (pinned) close();
    else {
      pinned = true;
      show();
    }
  }

  /** The tooltip lives at the end of the page, so no panel or dialog can cover or clip it. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return () => node.remove();
  }

  function onWindowKey(e: KeyboardEvent): void {
    if (open && e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
      // Back to the link for keyboard users, without opening the tooltip again.
      refocusing = true;
      trigger?.focus();
      refocusing = false;
    }
  }

  // Escape closes an open tooltip first (caught before a dialog's own Escape can close the dialog).
  $effect(() => {
    if (!open) return;
    document.addEventListener('keydown', onWindowKey, true);
    return () => document.removeEventListener('keydown', onWindowKey, true);
  });

  function onWindowPointer(e: PointerEvent): void {
    if (!pinned) return;
    const target = e.target as Node;
    if (trigger?.contains(target) || panel?.contains(target)) return;
    close();
  }

  // Escape closes an open tooltip first (caught before a dialog's own Escape can close the dialog).
  $effect(() => {
    if (!open) return;
    document.addEventListener('keydown', onWindowKey, true);
    return () => document.removeEventListener('keydown', onWindowKey, true);
  });

  onDestroy(() => {
    if (hideTimer) clearTimeout(hideTimer);
  });
</script>

<svelte:window
  onpointerdown={onWindowPointer}
  onresize={() => open && void position()}
  onscrollcapture={() => open && void position()}
/>

<span class="why">
  <button
    bind:this={trigger}
    type="button"
    class="trigger"
    aria-expanded={open}
    aria-controls={id}
    onclick={toggle}
    onpointerenter={show}
    onpointerleave={hideSoon}
    onfocus={() => !refocusing && show()}
    onblur={hideSoon}><Icon name="help" size={13} /><span>{title}</span></button
  >
</span>

<div
  bind:this={panel}
  {@attach portal}
  {id}
  class="why-tip"
  class:above={place.above}
  role="tooltip"
  hidden={!open}
  style:left="{place.left}px"
  style:top="{place.top}px"
  onpointerenter={show}
  onpointerleave={hideSoon}
>
  <p class="answer">{explained.answer}</p>
  {#if explained.reasons.length}
    <ul>
      {#each explained.reasons as reason (reason)}<li>{reason}</li>{/each}
    </ul>
  {/if}
  {#if point}<p class="syl">Syllabus {point}</p>{/if}
</div>

<style>
  .why {
    display: inline-flex;
  }
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: auto;
    padding: 2px 4px;
    margin-left: -4px;
    border: 0;
    background: transparent;
    color: var(--accent);
    font-size: 12.5px;
    font-weight: 600;
    border-radius: 4px;
  }
  .trigger:hover span,
  .trigger[aria-expanded='true'] span {
    text-decoration: underline;
  }
  /* Above dialogs (20), tooltips (1000) and everything else. */
  .why-tip {
    position: fixed;
    z-index: 10000;
    width: max-content;
    max-width: min(380px, calc(100vw - 16px));
    max-height: min(60vh, 420px);
    overflow: auto;
    padding: 11px 13px;
    border-radius: 8px;
    border: 1px solid var(--line-strong);
    border-left: 3px solid var(--accent);
    background: #12161d;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
    color: var(--tx-1);
    font-size: 13px;
    line-height: 1.55;
    text-align: left;
    white-space: normal;
  }
  .why-tip[hidden] {
    display: none;
  }
  .answer {
    margin: 0;
    font-weight: 500;
  }
  ul {
    margin: 6px 0 0;
    padding-left: 18px;
    opacity: 0.9;
  }
  li + li {
    margin-top: 3px;
  }
  .syl {
    margin: 8px 0 0;
    font-size: 11.5px;
    color: var(--tx-2);
  }
</style>

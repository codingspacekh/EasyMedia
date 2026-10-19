<script lang="ts">
  // One tooltip for the whole app: when the mouse rests on a button (or it gets keyboard focus)
  // it says what the button does: its title, or the label of an icon-only button. A "Why?" part
  // (T5) is shown under it. The built-in tooltip is kept away while ours shows, so there are
  // never two.
  import { TOOLTIP_DELAY } from './ui-state.svelte.ts';

  const TARGETS =
    '[title], button[aria-label], [role="button"][aria-label], [role="menuitem"][aria-label]';
  const GAP = 6;
  const MARGIN = 8;

  let tip: { what: string; why: string | null; x: number; y: number; above: boolean } | null =
    $state(null);
  let current: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  /** What the element says about itself, or null when it needs no tooltip. */
  function textOf(el: HTMLElement): string | null {
    const title = el.dataset.tip ?? el.getAttribute('title');
    if (title?.trim()) return title.trim();
    // A label is only needed when the button shows no words of its own.
    const label = el.getAttribute('aria-label');
    return label && !el.textContent?.trim() ? label : null;
  }

  function targetOf(node: EventTarget | null): HTMLElement | null {
    const el = node instanceof Element ? node.closest<HTMLElement>(TARGETS) : null;
    return el && textOf(el) ? el : null;
  }

  /** The built-in tooltip stays away: the title waits in data-tip while the mouse is there. */
  function hideTitle(el: HTMLElement): void {
    const title = el.getAttribute('title');
    if (title === null) return;
    el.dataset.tip = title;
    el.removeAttribute('title');
  }

  function restoreTitle(el: HTMLElement): void {
    const kept = el.dataset.tip;
    if (kept === undefined) return;
    delete el.dataset.tip;
    // The page may have given it a new title meanwhile: that one wins.
    if (!el.hasAttribute('title')) el.setAttribute('title', kept);
  }

  function clear(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    if (current) restoreTitle(current);
    current = null;
    tip = null;
  }

  function start(el: HTMLElement): void {
    if (el === current) return;
    clear();
    current = el;
    hideTitle(el);
    timer = setTimeout(() => show(el), TOOLTIP_DELAY);
  }

  function show(el: HTMLElement): void {
    timer = null;
    if (!el.isConnected) return clear();
    const text = textOf(el)!;
    const [what, why] = text.split(/\n\s*\n(?=Why\? )/);
    const r = el.getBoundingClientRect();
    const above = r.bottom + 60 > window.innerHeight;
    tip = {
      what: what!.trim(),
      why: why?.trim() ?? null,
      x: r.left + r.width / 2,
      y: above ? r.top - GAP : r.bottom + GAP,
      above,
    };
  }

  /** Keeps the tooltip inside the window once its size is known. */
  function place(node: HTMLDivElement): void {
    if (!tip) return;
    const width = node.offsetWidth;
    const left = Math.min(
      Math.max(MARGIN, tip.x - width / 2),
      Math.max(MARGIN, window.innerWidth - width - MARGIN),
    );
    node.style.left = `${left}px`;
  }

  function over(e: PointerEvent): void {
    const el = targetOf(e.target);
    if (el) start(el);
  }

  function out(e: PointerEvent): void {
    if (!current) return;
    const to = e.relatedTarget;
    if (to instanceof Node && current.contains(to)) return;
    clear();
  }

  function focusIn(e: FocusEvent): void {
    const el = targetOf(e.target);
    // A click focuses the button too: only keyboard focus shows the tooltip (the mouse already
    // has). An element focused from code (not :focus) counts as keyboard focus.
    if (el && (el.matches(':focus-visible') || !el.matches(':focus'))) start(el);
  }

  function focusOut(e: FocusEvent): void {
    if (e.target === current) clear();
  }

  $effect(() => clear);
</script>

<svelte:document
  onpointerover={over}
  onpointerout={out}
  onpointerdown={clear}
  onfocusin={focusIn}
  onfocusout={focusOut}
/>
<svelte:window onkeydown={(e) => e.key === 'Escape' && clear()} onscroll={clear} onblur={clear} />

{#if tip}
  <div class="tooltip" class:above={tip.above} role="tooltip" style:top="{tip.y}px" {@attach place}>
    <div class="what">{tip.what}</div>
    {#if tip.why}<div class="why">{tip.why}</div>{/if}
  </div>
{/if}

<style>
  .tooltip {
    position: fixed;
    z-index: 1000;
    max-width: 320px;
    padding: 6px 9px;
    border-radius: 6px;
    background: #10141b;
    border: 1px solid var(--line-strong);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    color: var(--tx-1);
    font-size: 12px;
    line-height: 1.4;
    pointer-events: none;
    white-space: pre-line;
  }
  .tooltip.above {
    transform: translateY(-100%);
  }
  .what {
    font-weight: 600;
  }
  .why {
    margin-top: 4px;
    color: var(--tx-2);
    font-weight: 400;
  }
</style>

<script lang="ts">
  // The app's own colour picker (issues/video-2.png): the operating system's colour box is a
  // white window that cannot be styled. A swatch button opens a dark panel beside it: a square
  // for strength and brightness, a hue bar, the hex code (tasks give colours like #F4C8EE),
  // ready-made colours, the ones used lately, and a dropper to take a colour off the screen.
  // The panel lives at the end of the page, so no panel or dialog clips it; Escape closes it
  // first (not the dialog it is in), as does a click elsewhere.
  import { untrack } from 'svelte';
  import { hexToHsv, hsvToHex, normaliseHex, type Hsv } from '../core/colour.ts';
  import { recentColours, rememberColour } from './recent-colours.svelte.ts';

  let {
    label,
    value,
    onchange,
    text,
    disabled = false,
  }: {
    /** The button's name for screen readers and tests ("Outline colour"). */
    label: string;
    value: string;
    /** May return an error message to show. */
    onchange: (colour: string) => string | null | void;
    /** Words shown on the button beside the swatch. */
    text?: string;
    disabled?: boolean;
  } = $props();

  /** Two rows of ready-made colours: greys, then a rainbow, then school-poster favourites. */
  const PALETTE = [
    '#ffffff',
    '#d9dde3',
    '#9aa4b2',
    '#555c68',
    '#000000',
    '#ffe4c4',
    '#8b5a2b',
    '#c8901a',
    '#ffd400',
    '#e84545',
    '#ff7a1a',
    '#5cbf60',
    '#1a9e8f',
    '#3fc5f0',
    '#2f7fe0',
    '#00008b',
    '#7c3aed',
    '#f472b6',
  ];
  const WIDTH = 236;
  const HEIGHT = 330;
  const MARGIN = 8;

  let open = $state(false);
  let button: HTMLButtonElement | undefined = $state();
  let panel: HTMLElement | undefined = $state();
  let square: HTMLElement | undefined = $state();
  let hexBox: HTMLInputElement | undefined = $state();
  let place = $state({ left: 0, top: 0 });
  let error: string | null = $state(null);
  let dragging = false;
  /** Where the swatch was when the panel opened. */
  let at = { x: 0, y: 0 };
  let hsv: Hsv = $state(hexToHsv(untrack(() => value)));
  const current = $derived(hsvToHex(hsv));
  const canDrop = typeof window !== 'undefined' && 'EyeDropper' in window;

  // A change made elsewhere (undo, a ready-made look) moves the picker, unless it is the colour
  // the picker shows already (a grey keeps the hue it was given).
  $effect(() => {
    const wanted = normaliseHex(value);
    if (wanted && !dragging && wanted !== untrack(() => current)) hsv = hexToHsv(wanted);
  });

  function use(hex: string): void {
    const problem = onchange(hex);
    error = typeof problem === 'string' ? problem : null;
    if (!error) rememberColour(hex);
  }

  function toggle(): void {
    if (open) return close(false);
    const r = button!.getBoundingClientRect();
    at = { x: r.left, y: r.top };
    const below = innerHeight - r.bottom - MARGIN;
    const top = below >= HEIGHT || below >= r.top ? r.bottom + 4 : r.top - 4 - HEIGHT;
    place = {
      left: Math.max(MARGIN, Math.min(r.left, innerWidth - WIDTH - MARGIN)),
      top: Math.max(MARGIN, Math.min(top, innerHeight - HEIGHT - MARGIN)),
    };
    error = null;
    open = true;
    queueMicrotask(() => hexBox?.select());
  }

  function close(refocus: boolean): void {
    open = false;
    if (refocus) button?.focus();
  }

  function fromSquare(e: PointerEvent): void {
    const r = square!.getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    hsv = {
      ...hsv,
      s: clamp((e.clientX - r.left) / (r.width || 1)),
      v: clamp(1 - (e.clientY - r.top) / (r.height || 1)),
    };
  }

  function squareKey(e: KeyboardEvent): void {
    const step = e.shiftKey ? 0.2 : 0.05;
    const move: Record<string, [number, number]> = {
      ArrowRight: [step, 0],
      ArrowLeft: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const by = move[e.key];
    if (!by) return;
    e.preventDefault();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    hsv = { ...hsv, s: clamp(hsv.s + by[0]), v: clamp(hsv.v + by[1]) };
    use(current);
  }

  function fromHex(e: Event): void {
    const hex = normaliseHex((e.currentTarget as HTMLInputElement).value);
    if (!hex) {
      error = 'Type a colour such as #F4C8EE.';
      return;
    }
    hsv = hexToHsv(hex);
    use(hex);
  }

  async function drop(): Promise<void> {
    try {
      const Dropper = (
        window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }
      ).EyeDropper;
      const { sRGBHex } = await new Dropper().open();
      const hex = normaliseHex(sRGBHex);
      if (hex) {
        hsv = hexToHsv(hex);
        use(hex);
      }
    } catch {
      // Escape while dropping: nothing chosen.
    }
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return () => node.remove();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    close(true);
  }
  function onPointer(e: PointerEvent): void {
    const target = e.target as Node;
    if (!button?.contains(target) && !panel?.contains(target)) close(false);
  }
  /** The page scrolling the swatch away would leave the panel behind: it closes. (A scroll
   *  event can arrive a frame late, for the scroll that brought the swatch into view: the swatch
   *  has not moved since, so the panel stays.) */
  function onScroll(e: Event): void {
    if (panel?.contains(e.target as Node) || !button) return;
    const r = button.getBoundingClientRect();
    if (Math.abs(r.left - at.x) > 1 || Math.abs(r.top - at.y) > 1) close(false);
  }

  // Escape is caught before a dialog's own Escape can close the dialog.
  $effect(() => {
    if (!open) return;
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', toggle);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', toggle);
    };
  });

  const upper = (hex: string) => hex.toUpperCase();
</script>

<button
  bind:this={button}
  type="button"
  class="colour-button"
  class:with-text={text}
  aria-label={label}
  aria-haspopup="dialog"
  aria-expanded={open}
  title={`${label}: ${upper(normaliseHex(value) ?? value)}`}
  {disabled}
  onclick={toggle}
>
  <span class="chip" style:background={value}></span>
  {#if text}<span class="text">{text}</span>{/if}
</button>

{#if open}
  <div
    class="colour-panel"
    role="dialog"
    aria-label={label}
    bind:this={panel}
    style:left="{place.left}px"
    style:top="{place.top}px"
    {@attach portal}
  >
    <div
      bind:this={square}
      class="square"
      role="slider"
      tabindex="0"
      aria-label="Saturation and brightness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsv.s * 100)}
      aria-valuetext="strength {Math.round(hsv.s * 100)} %, brightness {Math.round(hsv.v * 100)} %"
      style:--hue="hsl({hsv.h} 100% 50%)"
      onpointerdown={(e) => {
        dragging = true;
        square!.setPointerCapture?.(e.pointerId);
        fromSquare(e);
      }}
      onpointermove={(e) => dragging && fromSquare(e)}
      onpointerup={() => {
        if (!dragging) return;
        dragging = false;
        use(current);
      }}
      onkeydown={squareKey}
    >
      <span
        class="thumb"
        style:left="{hsv.s * 100}%"
        style:top="{(1 - hsv.v) * 100}%"
        style:background={current}
      ></span>
    </div>
    <input
      class="hue"
      type="range"
      aria-label="Hue"
      min="0"
      max="360"
      step="1"
      value={Math.round(hsv.h)}
      oninput={(e) => (hsv = { ...hsv, h: Number(e.currentTarget.value) })}
      onchange={() => use(current)}
    />
    <div class="code">
      <span class="now" style:background={current} aria-hidden="true"></span>
      <input
        bind:this={hexBox}
        type="text"
        aria-label="{label} hex"
        spellcheck="false"
        value={upper(current)}
        onchange={fromHex}
        aria-invalid={error !== null}
      />
      {#if canDrop}
        <button
          type="button"
          class="drop"
          aria-label="Take a colour from the screen"
          title="Take a colour from the screen"
          onclick={drop}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="m2 22 1-1h3l9-9M3 21v-3l9-9m3-3 3-3a2.1 2.1 0 0 1 3 3l-3 3 1 1-2 2-6-6 2-2Z"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      {/if}
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="swatches" role="group" aria-label="Ready-made colours">
      {#each PALETTE as hex (hex)}
        <button
          type="button"
          aria-label="Use {upper(hex)}"
          title={upper(hex)}
          aria-pressed={hex === current}
          style:background={hex}
          onclick={() => {
            hsv = hexToHsv(hex);
            use(hex);
          }}
        ></button>
      {/each}
    </div>
    {#if recentColours.length}
      <div class="recent-label">Recent</div>
      <div class="swatches" role="group" aria-label="Recent colours">
        {#each recentColours as hex (hex)}
          <button
            type="button"
            aria-label="Use {upper(hex)}"
            title={upper(hex)}
            aria-pressed={hex === current}
            style:background={hex}
            onclick={() => {
              hsv = hexToHsv(hex);
              use(hex);
            }}
          ></button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .colour-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    min-width: 28px;
    padding: 3px;
    flex: none;
  }
  .colour-button.with-text {
    padding-right: 10px;
  }
  .chip {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
    flex: none;
  }
  .colour-button.with-text .chip {
    width: 18px;
    height: 18px;
  }
  .text {
    font-size: 12px;
    color: var(--tx-1);
  }
  .colour-panel {
    position: fixed;
    z-index: 10000;
    width: 236px;
    box-sizing: border-box;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 9px;
    background: var(--bg-2);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  }
  .square {
    position: relative;
    height: 128px;
    border-radius: 6px;
    background:
      linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, var(--hue));
    cursor: crosshair;
    touch-action: none;
  }
  .square:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .thumb {
    position: absolute;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.55),
      0 1px 3px rgba(0, 0, 0, 0.5);
    transform: translate(-50%, -50%);
    pointer-events: none;
    box-sizing: border-box;
  }
  .hue {
    width: 100%;
    height: 14px;
    border-radius: 7px;
    background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  }
  .hue::-webkit-slider-runnable-track {
    height: 14px;
    background: transparent;
  }
  .hue::-webkit-slider-thumb {
    margin-top: 0;
    width: 14px;
    height: 14px;
    background: #fff;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55);
  }
  .code {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .now {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    flex: none;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  }
  .code input {
    flex: 1;
    min-width: 0;
    font-family: var(--mono);
    letter-spacing: 0.04em;
  }
  .code input[aria-invalid='true'] {
    border-color: var(--danger);
  }
  .drop {
    width: 28px;
    height: 28px;
    padding: 0;
    flex: none;
    justify-content: center;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    gap: 4px;
  }
  .swatches button {
    aspect-ratio: 1;
    height: auto;
    min-width: 0;
    padding: 0;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.14);
  }
  .swatches button:hover {
    transform: scale(1.12);
  }
  .swatches button[aria-pressed='true'] {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .recent-label {
    margin-bottom: -4px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tx-3);
  }
  .error {
    margin: -3px 0 0;
    font-size: 11.5px;
    color: var(--danger);
  }
</style>

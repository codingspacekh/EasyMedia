<script lang="ts">
  // Text of a title slide, caption, subtitle or credits (screens 02–04): words, look, place,
  // readability and effects (V4–V7). Every change is one undoable step.
  import type { App } from '../app/app.ts';
  import {
    setText,
    setTextEffects,
    setTextLook,
    setTextStyle,
    setTitleBackground,
  } from '../app/commands.ts';
  import type { Entrance, Exit, TextItem, TextStyle, TitleSlide } from '../core/model/types.ts';
  import { ENTRANCES, EXITS } from '../core/text/motion.ts';
  import { readability } from '../core/text/layout.ts';
  import { fileNameOf } from '../core/project/relocate.ts';
  import ColourPicker from './ColourPicker.svelte';
  import FontPicker from './FontPicker.svelte';
  import LookPicker from './LookPicker.svelte';
  import TimeField from './TimeField.svelte';
  import Why from './Why.svelte';

  let { app, item }: { app: App; item: TitleSlide | TextItem } = $props();
  const store = $derived(app.store);
  const media = $derived($store.history.present.media);
  let error: string | null = $state(null);

  const POSITIONS: [TextStyle['position'], string][] = [
    ['top-left', 'Top left'],
    ['top', 'Top'],
    ['top-right', 'Top right'],
    ['left', 'Left'],
    ['centre', 'Centre'],
    ['right', 'Right'],
    ['bottom-left', 'Bottom left'],
    ['bottom', 'Bottom'],
    ['bottom-right', 'Bottom right'],
  ];
  const ALIGNS: TextStyle['align'][] = ['left', 'centre', 'right'];
  const ALIGN_NAMES: Record<TextStyle['align'], string> = {
    left: 'Left',
    centre: 'Centre',
    right: 'Right',
  };
  type Toggle = 'shadow' | 'outline' | 'box' | 'glow' | 'gradient' | 'depth';
  const READABLE: { key: Toggle; name: string; hint: string }[] = [
    { key: 'shadow', name: 'Shadow', hint: 'A soft shadow behind the words' },
    { key: 'outline', name: 'Outline', hint: 'An edge around every letter' },
    { key: 'box', name: 'Box', hint: 'A band of colour behind the words' },
  ];
  const STAND_OUT: { key: Toggle; name: string; hint: string }[] = [
    { key: 'glow', name: 'Glow', hint: 'The words light up the space around them' },
    { key: 'gradient', name: 'Gradient', hint: 'From the text colour at the top to the second' },
    { key: 'depth', name: '3D', hint: 'The words stand out, with sides in the second colour' },
  ];

  const style = (change: Partial<TextStyle>) => (error = app.edit(setTextStyle(item.id, change)));
  const effects = (change: Parameters<typeof setTextEffects>[1]) =>
    app.edit(setTextEffects(item.id, change));

  const accent = $derived(item.style.accent ?? (item.style.depth ? '#333333' : item.style.colour));
  const title = $derived('type' in item ? item : null);
  const credits = $derived(!('type' in item) && item.kind === 'credits' ? item : null);
  const contrast = $derived(
    title?.background.kind === 'colour'
      ? readability(item.style.colour, title.background.colour)
      : null,
  );

  function chooseBackground(kind: string): void {
    if (!title) return;
    if (kind === 'colour') {
      error = app.edit(setTitleBackground(title.id, { kind: 'colour', colour: '#000000' }));
      return;
    }
    const wanted = kind === 'image' ? 'image' : 'video';
    const first = media.find((m) => m.kind === wanted);
    error = first
      ? app.edit(setTitleBackground(title.id, { kind: wanted, assetId: first.id }))
      : `Import a ${wanted === 'image' ? 'picture' : 'video'} first.`;
  }
</script>

<section>
  <h3>Text <span class="syl">11.4</span></h3>
  <label class="stack">
    Text
    <textarea
      aria-label="Text"
      rows="3"
      value={item.text}
      onchange={(e) => (error = app.edit(setText(item.id, e.currentTarget.value)))}></textarea>
  </label>
  <div class="grid2">
    <div class="stack">
      Font
      <FontPicker value={item.style.font} onchange={(font) => style({ font })} />
    </div>
    <label class="stack">
      Size
      <input
        aria-label="Size"
        type="number"
        min="8"
        max="300"
        value={item.style.size}
        onchange={(e) => style({ size: Number(e.currentTarget.value) })}
      />
    </label>
  </div>
  <div class="row">
    <ColourPicker
      label="Colour"
      text="Colour"
      value={item.style.colour}
      onchange={(colour) => style({ colour })}
    />
    <label class="check">
      <input
        type="checkbox"
        checked={item.style.bold}
        onchange={(e) => style({ bold: e.currentTarget.checked })}
      />
      Bold
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={item.style.italic}
        onchange={(e) => style({ italic: e.currentTarget.checked })}
      />
      Italic
    </label>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <Why tool={'type' in item ? 'title' : item.kind} />
</section>

<section>
  <h3>Ready-made looks</h3>
  <LookPicker style={item.style} onchange={(id) => (error = app.edit(setTextLook(item.id, id)))} />
</section>

<section>
  <h3>Position <span class="syl">11.4</span></h3>
  <div class="place">
    <div class="where">
      <span class="sub" id="place-{item.id}">Place on the screen</span>
      <!-- A small screen: click where the words go. Each spot shows lines of text, lined up as
           the words are, so the two choices are seen together. -->
      <div class="screen" role="group" aria-labelledby="place-{item.id}">
        {#each POSITIONS as [position, name] (position)}
          <button
            aria-label={name}
            title={name}
            aria-pressed={item.style.position === position}
            class="spot {position}"
            onclick={() => style({ position })}
          >
            <span class="glyph align-{item.style.align}" aria-hidden="true"
              ><i></i><i></i><i></i></span
            >
          </button>
        {/each}
      </div>
    </div>
    <div class="aligns">
      <span class="sub" id="align-{item.id}">Line up the lines</span>
      <div class="align-list" role="group" aria-labelledby="align-{item.id}">
        {#each ALIGNS as align (align)}
          <button
            aria-label="Align {align}"
            aria-pressed={item.style.align === align}
            onclick={() => style({ align })}
          >
            <span class="glyph align-{align}" aria-hidden="true"><i></i><i></i><i></i></span>
            {ALIGN_NAMES[align]}
          </button>
        {/each}
      </div>
    </div>
  </div>
</section>

<section>
  <h3>Readability and effects <span class="syl">11.4</span></h3>
  <!-- Each choice shows "Aa" in the words' own colours with that effect, so a student sees what
       it does before trying it. The colour it uses sits at the end of its row. -->
  <div
    class="opts"
    style:--text={item.style.colour}
    style:--font="'{item.style.font}'"
    style:--second={accent}
    style:--sides={item.style.accent ?? '#333333'}
    style:--edge={item.style.outlineColour ?? '#000000'}
    style:--band={item.style.boxColour ?? 'rgba(0, 0, 0, 0.7)'}
  >
    <div class="opt-head">Keep it readable</div>
    {#each READABLE as opt (opt.key)}
      <div class="opt" title={opt.hint}>
        <label>
          <input
            type="checkbox"
            aria-label={opt.name}
            checked={item.style[opt.key] ?? false}
            onchange={(e) => style({ [opt.key]: e.currentTarget.checked })}
          />
          <span class="demo {opt.key}" aria-hidden="true"><span>Aa</span></span>
          <span class="name">{opt.name}<small>{opt.hint}</small></span>
        </label>
        {#if opt.key === 'outline'}
          <ColourPicker
            label="Outline colour"
            value={item.style.outlineColour ?? '#000000'}
            disabled={!item.style.outline}
            onchange={(outlineColour) => style({ outlineColour })}
          />
        {:else if opt.key === 'box'}
          <ColourPicker
            label="Box colour"
            value={item.style.boxColour ?? '#000000'}
            disabled={!item.style.box}
            onchange={(boxColour) => style({ boxColour })}
          />
        {/if}
      </div>
    {/each}
    <div class="opt-head">Make it stand out</div>
    {#each STAND_OUT as opt (opt.key)}
      <div class="opt" title={opt.hint}>
        <label>
          <input
            type="checkbox"
            aria-label={opt.name}
            checked={item.style[opt.key] ?? false}
            onchange={(e) => style({ [opt.key]: e.currentTarget.checked })}
          />
          <span class="demo {opt.key}" aria-hidden="true"><span>Aa</span></span>
          <span class="name">{opt.name}<small>{opt.hint}</small></span>
        </label>
      </div>
    {/each}
    <div class="opt second" title="Used by glow, gradient and 3D">
      <span class="name">Second colour<small>Used by glow, gradient and 3D</small></span>
      <ColourPicker
        label="Second colour"
        value={accent}
        disabled={!(item.style.glow || item.style.gradient || item.style.depth)}
        onchange={(accent) => style({ accent })}
      />
    </div>
  </div>
  {#if contrast}
    <p class={contrast.easy ? 'hint' : 'warn'}>
      {contrast.easy ? 'Easy to read' : 'Hard to read'} — contrast {contrast.ratio}:1{contrast.easy
        ? ''
        : '. Choose a darker background or lighter text (4.5:1 or more), or add an outline.'}
    </p>
  {:else}
    <p class="hint">Over a picture or video, a shadow, outline or dark box keeps words readable.</p>
  {/if}
</section>

{#if title}
  <section>
    <h3>Background <span class="syl">11.4</span></h3>
    <label class="stack">
      Background
      <select
        aria-label="Background"
        value={title.background.kind}
        onchange={(e) => chooseBackground(e.currentTarget.value)}
      >
        <option value="colour">Colour</option>
        <option value="image">Picture</option>
        <option value="video">Video</option>
      </select>
    </label>
    {#if title.background.kind === 'colour'}
      <div class="check">
        <ColourPicker
          label="Background colour"
          text="Background colour"
          value={title.background.colour}
          onchange={(colour) =>
            (error = app.edit(setTitleBackground(title.id, { kind: 'colour', colour })))}
        />
      </div>
    {:else}
      {@const kind = title.background.kind}
      <label class="stack">
        {kind === 'image' ? 'Background picture' : 'Background video'}
        <select
          aria-label={kind === 'image' ? 'Background picture' : 'Background video'}
          value={title.background.assetId}
          onchange={(e) =>
            (error = app.edit(
              setTitleBackground(title.id, { kind, assetId: e.currentTarget.value }),
            ))}
        >
          {#each media.filter((m) => m.kind === kind) as asset (asset.id)}
            <option value={asset.id}>{fileNameOf(asset.path)}</option>
          {/each}
        </select>
      </label>
    {/if}
  </section>
{/if}

<section>
  <h3>Effects <span class="syl">11.4</span></h3>
  <TimeField label="Text fade in" value={item.fadeIn ?? 0} commit={(t) => effects({ fadeIn: t })} />
  <TimeField
    label="Text fade out"
    value={item.fadeOut ?? 0}
    commit={(t) => effects({ fadeOut: t })}
  />
  <label class="stack">
    Entrance
    <select
      aria-label="Entrance"
      value={item.entrance ?? 'none'}
      onchange={(e) => (error = effects({ entrance: e.currentTarget.value as Entrance }))}
    >
      {#each ENTRANCES as [value, name] (value)}
        <option {value}>{name}</option>
      {/each}
    </select>
  </label>
  <label class="stack">
    Exit
    <select
      aria-label="Exit"
      value={item.exit ?? 'none'}
      onchange={(e) => (error = effects({ exit: e.currentTarget.value as Exit }))}
    >
      {#each EXITS as [value, name] (value)}
        <option {value}>{name}</option>
      {/each}
    </select>
  </label>
  {#if credits}
    <label class="check">
      <input
        type="checkbox"
        checked={credits.scroll !== false}
        onchange={(e) => (error = effects({ scroll: e.currentTarget.checked }))}
      />
      Scroll up the screen
    </label>
  {/if}
</section>

<style>
  section {
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h3 {
    font-size: 12.5px;
    margin: 0;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .syl {
    font-size: 10px;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--tx-2);
  }
  textarea,
  select,
  textarea {
    resize: vertical;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 80px;
    gap: 8px;
  }
  .row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .check {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
  }
  .sub {
    font-size: 11.5px;
    color: var(--tx-2);
  }
  .place {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .where,
  .aligns {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  /* The screen: 16:9, split into thirds by faint lines. */
  .screen {
    width: 136px;
    aspect-ratio: 16 / 9;
    display: grid;
    grid-template: repeat(3, 1fr) / repeat(3, 1fr);
    padding: 3px;
    gap: 2px;
    box-sizing: border-box;
    background:
      linear-gradient(var(--line) 0 0) 33.3% 0 / 1px 100% no-repeat,
      linear-gradient(var(--line) 0 0) 66.6% 0 / 1px 100% no-repeat,
      linear-gradient(var(--line) 0 0) 0 33.3% / 100% 1px no-repeat,
      linear-gradient(var(--line) 0 0) 0 66.6% / 100% 1px no-repeat,
      var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
  }
  .spot {
    height: auto;
    min-width: 0;
    padding: 3px 4px;
    display: flex;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--tx-3);
  }
  .spot:hover {
    background: var(--bg-3);
    color: var(--tx-2);
  }
  .spot[aria-pressed='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }
  /* Where the lines sit in their spot: as the words sit on the screen. */
  .spot.top-left,
  .spot.left,
  .spot.bottom-left {
    justify-content: flex-start;
  }
  .spot.top,
  .spot.centre,
  .spot.bottom {
    justify-content: center;
  }
  .spot.top-right,
  .spot.right,
  .spot.bottom-right {
    justify-content: flex-end;
  }
  .spot.top-left,
  .spot.top,
  .spot.top-right {
    align-items: flex-start;
  }
  .spot.left,
  .spot.centre,
  .spot.right {
    align-items: center;
  }
  .spot.bottom-left,
  .spot.bottom,
  .spot.bottom-right {
    align-items: flex-end;
  }
  /* Three lines of text, lined up left, centre or right. */
  .glyph {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 18px;
  }
  .glyph i {
    display: block;
    height: 2px;
    border-radius: 1px;
    background: currentColor;
  }
  .glyph i:nth-child(2) {
    width: 65%;
  }
  .glyph i:nth-child(3) {
    width: 85%;
  }
  .glyph.align-centre {
    align-items: center;
  }
  .glyph.align-right {
    align-items: flex-end;
  }
  .align-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .align-list button {
    justify-content: flex-start;
    gap: 8px;
    min-width: 92px;
    padding: 3px 10px;
    font-size: 12px;
    color: var(--tx-2);
  }
  .align-list button .glyph {
    width: 14px;
  }
  .align-list button[aria-pressed='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--tx-1);
  }
  /* Readability and effects: one row per choice. */
  .opts {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .opt-head {
    margin: 4px 0 2px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tx-3);
  }
  .opt-head:first-child {
    margin-top: 0;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 2px 4px 2px 6px;
    border-radius: 6px;
  }
  .opt:hover {
    background: var(--bg-2);
  }
  .opt label {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 9px;
    cursor: pointer;
  }
  .name {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: 12px;
    color: var(--tx-1);
  }
  .name small {
    font-size: 10.5px;
    color: var(--tx-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .opt.second {
    margin-top: 2px;
    border-top: 1px solid var(--line);
    border-radius: 0;
    padding-top: 6px;
  }
  .opt.second .name {
    flex: 1;
  }
  /* "Aa" over a mid grey (like a photo), in the words' colour, with the effect. */
  .demo {
    flex: none;
    width: 34px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 4px;
    background: linear-gradient(135deg, #7d8a99, #4c5664);
    font: 800 14px/1 var(--font, system-ui);
    color: var(--text);
  }
  .demo span {
    padding: 0 2px;
  }
  .demo.shadow span {
    text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.9);
  }
  .demo.outline span {
    -webkit-text-stroke: 1px var(--edge);
    paint-order: stroke fill;
  }
  .demo.box span {
    background: var(--band);
    border-radius: 2px;
  }
  .demo.glow span {
    text-shadow:
      0 0 4px var(--second),
      0 0 8px var(--second);
  }
  .demo.gradient span {
    background: linear-gradient(var(--text), var(--second));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .demo.depth span {
    text-shadow:
      1px 1px 0 var(--sides),
      2px 2px 0 var(--sides),
      3px 3px 0 var(--sides);
  }
  .hint,
  .warn,
  .error {
    margin: 0;
    font-size: 11.5px;
  }
  .hint {
    color: var(--tx-3);
  }
  .warn {
    color: var(--warn);
  }
  .error {
    color: var(--danger);
  }
</style>

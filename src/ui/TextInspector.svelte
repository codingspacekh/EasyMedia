<script lang="ts">
  // Text of a title slide, caption, subtitle or credits (screens 02–04): words, look, place,
  // readability and effects (V4–V7). Every change is one undoable step.
  import type { App } from '../app/app.ts';
  import { setText, setTextEffects, setTextStyle, setTitleBackground } from '../app/commands.ts';
  import type { Entrance, TextItem, TextStyle, TitleSlide } from '../core/model/types.ts';
  import { FONTS } from '../core/text/fonts.ts';
  import { readability } from '../core/text/layout.ts';
  import { fileNameOf } from '../core/project/relocate.ts';
  import TimeField from './TimeField.svelte';

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
  const ENTRANCES: [Entrance, string][] = [
    ['none', 'None'],
    ['fly-left', 'Fly in from the left'],
    ['fly-right', 'Fly in from the right'],
    ['fly-up', 'Fly in from the bottom'],
    ['fly-down', 'Fly in from the top'],
  ];

  const style = (change: Partial<TextStyle>) => (error = app.edit(setTextStyle(item.id, change)));
  const effects = (change: Parameters<typeof setTextEffects>[1]) =>
    app.edit(setTextEffects(item.id, change));

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
    <label class="stack">
      Font
      <select
        aria-label="Font"
        value={item.style.font}
        onchange={(e) => style({ font: e.currentTarget.value })}
      >
        {#each FONTS as font (font.name)}
          <option value={font.name}>{font.label}</option>
        {/each}
      </select>
    </label>
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
    <label class="check">
      <input
        aria-label="Colour"
        type="color"
        value={item.style.colour}
        onchange={(e) => style({ colour: e.currentTarget.value })}
      />
      Colour
    </label>
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
</section>

<section>
  <h3>Position <span class="syl">11.4</span></h3>
  <div class="place">
    <div class="grid9">
      {#each POSITIONS as [position, name] (position)}
        <button
          aria-label={name}
          aria-pressed={item.style.position === position}
          onclick={() => style({ position })}
        ></button>
      {/each}
    </div>
    <div class="aligns">
      {#each ALIGNS as align (align)}
        <button
          aria-label="Align {align}"
          aria-pressed={item.style.align === align}
          onclick={() => style({ align })}>{align[0]!.toUpperCase()}</button
        >
      {/each}
    </div>
  </div>
</section>

<section>
  <h3>Readability <span class="syl">11.4</span></h3>
  <div class="row">
    <label class="check">
      <input
        type="checkbox"
        checked={item.style.shadow ?? false}
        onchange={(e) => style({ shadow: e.currentTarget.checked })}
      />
      Shadow
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={item.style.outline ?? false}
        onchange={(e) => style({ outline: e.currentTarget.checked })}
      />
      Outline
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={item.style.box ?? false}
        onchange={(e) => style({ box: e.currentTarget.checked })}
      />
      Dark box
    </label>
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
      <label class="check">
        <input
          aria-label="Background colour"
          type="color"
          value={title.background.colour}
          onchange={(e) =>
            (error = app.edit(
              setTitleBackground(title.id, { kind: 'colour', colour: e.currentTarget.value }),
            ))}
        />
        Background colour
      </label>
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
  input[type='number'] {
    font: inherit;
    color: var(--tx-1);
    background: var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 5px 7px;
  }
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
  input[type='color'] {
    width: 28px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--line-strong);
    background: none;
  }
  .place {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .grid9 {
    display: grid;
    grid-template-columns: repeat(3, 22px);
    gap: 3px;
  }
  .grid9 button {
    height: 16px;
    padding: 0;
  }
  .grid9 button[aria-pressed='true'],
  .aligns button[aria-pressed='true'] {
    background: var(--accent);
    border-color: var(--accent);
  }
  .aligns {
    display: flex;
    gap: 3px;
  }
  .aligns button {
    padding: 3px 8px;
    font-size: 12px;
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

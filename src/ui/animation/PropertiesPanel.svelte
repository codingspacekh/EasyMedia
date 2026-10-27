<script lang="ts">
  // Properties (AN6): the selected object's exact numbers — position, size, rotation, opacity,
  // fill, stroke, and what its kind adds (corners, points, sides, words and font). With several
  // objects selected, a value typed here goes to all of them.
  import { tick } from 'svelte';
  import type { App } from '../../app/app.ts';
  import { DEFAULT_STROKE } from '../../core/animation/factory.ts';
  import { findObject } from '../../core/animation/layers.ts';
  import { stateAt } from '../../core/animation/state.ts';
  import { aspectOf } from '../../core/animation/rules.ts';
  import type {
    AnimObject,
    Dash,
    Paint,
    TextAlign,
    TextObject,
  } from '../../core/animation/types.ts';
  import FontPicker from '../FontPicker.svelte';
  import Icon from '../Icon.svelte';
  import Why from '../Why.svelte';
  import { animUi } from './animation-ui.svelte.ts';
  import ColourField from './ColourField.svelte';
  import { textBox } from './measure.ts';
  import NumField from './NumField.svelte';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  // M14: what the student sees and edits is the animation at the playhead.
  const doc = $derived(stateAt($store.history.present, $store.frame));
  const found = $derived(
    $store.selection.flatMap((id) => {
      const f = findObject(doc, id);
      return f ? [f] : [];
    }),
  );
  const first = $derived(found[0]?.object ?? null);
  const many = $derived(found.length > 1);
  const KINDS: Record<AnimObject['kind'], string> = {
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    star: 'Star',
    polygon: 'Polygon',
    path: 'Path',
    text: 'Text',
    picture: 'Picture',
    group: 'Group',
  };
  const DASHES: [Dash, string][] = [
    ['solid', 'Solid'],
    ['dashed', 'Dashed'],
    ['dotted', 'Dotted'],
  ];
  const set = (patch: Partial<AnimObject>) => anim.setProperties(patch);
  let words: HTMLTextAreaElement | undefined = $state();
  let lastFocus = 0;
  $effect(() => {
    if (animUi.focusText !== lastFocus && first?.kind === 'text') {
      lastFocus = animUi.focusText;
      void tick().then(() => {
        words?.focus();
        words?.select();
      });
    }
  });

  function setWidth(w: number): string | null {
    if (!first) return null;
    if (animUi.lockRatio && first.width > 0)
      return set({ width: w, height: Math.round(((w * first.height) / first.width) * 100) / 100 });
    return set({ width: w });
  }
  function setHeight(h: number): string | null {
    if (!first) return null;
    if (animUi.lockRatio && first.height > 0)
      return set({ width: Math.round(((h * first.width) / first.height) * 100) / 100, height: h });
    return set({ height: h });
  }
  function setFillKind(kind: Paint['kind']): void {
    if (!first) return;
    const current = first.fill;
    const base =
      current.kind === 'solid'
        ? current.colour
        : current.kind === 'linear' || current.kind === 'radial'
          ? current.from
          : '#9aa4b2';
    const to = current.kind === 'linear' || current.kind === 'radial' ? current.to : '#ffffff';
    const fill: Paint =
      kind === 'none'
        ? { kind: 'none' }
        : kind === 'solid'
          ? { kind: 'solid', colour: base }
          : kind === 'linear'
            ? { kind: 'linear', from: base, to, angle: 0 }
            : { kind: 'radial', from: base, to };
    set({ fill });
  }
  const fillPatch = (change: Partial<Extract<Paint, { kind: 'linear' }>>) => {
    if (!first || first.fill.kind === 'none') return null;
    return set({ fill: { ...first.fill, ...change } as Paint });
  };
  /** AN4: words, font, size and style change the box with them (one undo step). */
  const textPatch = (change: Partial<TextObject>): string | null => {
    if (!first || first.kind !== 'text') return null;
    const next = { ...first, ...change } as TextObject;
    return set({ ...change, ...textBox(next) } as Partial<AnimObject>);
  };
  const strokePatch = (change: Partial<NonNullable<AnimObject['stroke']>>) => {
    if (!first) return null;
    return set({ stroke: { ...(first.stroke ?? DEFAULT_STROKE), ...change } });
  };
</script>

<aside class="props" aria-label="Properties">
  <div class="panel-h">Properties</div>
  <div class="body">
    {#if !first}
      <p class="hint">
        Click an object on the stage, or draw one with a tool from the strip on the left.
      </p>
      <div class="sec">
        <h4>Stage</h4>
        <table class="facts">
          <tbody>
            <tr><td>Size</td><td>{doc.stage.width} × {doc.stage.height} px</td></tr>
            <tr><td>Aspect ratio</td><td>{aspectOf(doc.stage.width, doc.stage.height)}</td></tr>
            <tr><td>Frame rate</td><td>{doc.stage.fps} fps</td></tr>
            <tr><td>Colour</td><td>{doc.stage.background.toUpperCase()}</td></tr>
          </tbody>
        </table>
      </div>
      <Why tool="objectProperties" />
    {:else}
      <div class="sec">
        <h4>
          {many ? `${found.length} objects` : KINDS[first.kind]}
          <span class="syl">20.1 object properties</span>
        </h4>
        {#if !many}
          <div class="field">
            <label for="prop-name">Name</label>
            <input
              id="prop-name"
              class="text"
              value={first.name}
              onchange={(e) =>
                set({ name: (e.currentTarget as HTMLInputElement).value.trim() || first!.name })}
            />
          </div>
        {/if}
        <div class="two">
          <NumField
            label="X"
            value={first.x}
            unit="px"
            decimals={2}
            commit={(v) => set({ x: v })}
          />
          <NumField
            label="Y"
            value={first.y}
            unit="px"
            decimals={2}
            commit={(v) => set({ y: v })}
          />
          <NumField label="W" value={first.width} unit="px" decimals={2} commit={setWidth} />
          <NumField label="H" value={first.height} unit="px" decimals={2} commit={setHeight} />
        </div>
        <label class="check">
          <input type="checkbox" bind:checked={animUi.lockRatio} /> Lock proportions
        </label>
        <div class="two">
          <NumField
            label="Rotation"
            value={first.rotation}
            unit="°"
            commit={(v) => set({ rotation: ((v % 360) + 360) % 360 })}
          />
          <NumField
            label="Opacity"
            value={first.opacity}
            unit="%"
            commit={(v) => set({ opacity: v })}
          />
        </div>
      </div>

      {#if first.kind !== 'picture' && first.kind !== 'group'}
        <div class="sec">
          <h4>Fill</h4>
          <div class="field">
            <label for="prop-fill">Fill</label>
            <select
              id="prop-fill"
              value={first.fill.kind}
              onchange={(e) =>
                setFillKind((e.currentTarget as HTMLSelectElement).value as Paint['kind'])}
            >
              <option value="none">None</option>
              <option value="solid">Solid colour</option>
              <option value="linear">Gradient (linear)</option>
              <option value="radial">Gradient (radial)</option>
            </select>
          </div>
          {#if first.fill.kind === 'solid'}
            <ColourField
              label="Colour"
              value={first.fill.colour}
              commit={(c) => set({ fill: { kind: 'solid', colour: c } })}
            />
          {:else if first.fill.kind === 'linear' || first.fill.kind === 'radial'}
            <ColourField
              label="From"
              value={first.fill.from}
              commit={(c) => fillPatch({ from: c })}
            />
            <ColourField label="To" value={first.fill.to} commit={(c) => fillPatch({ to: c })} />
            {#if first.fill.kind === 'linear'}
              <NumField
                label="Angle"
                value={first.fill.angle}
                unit="°"
                commit={(v) => fillPatch({ angle: v })}
              />
            {/if}
          {/if}
        </div>
        <div class="sec">
          <h4>Stroke</h4>
          <label class="check">
            <input
              type="checkbox"
              checked={first.stroke !== undefined}
              onchange={(e) =>
                set({
                  stroke: (e.currentTarget as HTMLInputElement).checked
                    ? { ...DEFAULT_STROKE }
                    : undefined,
                })}
            />
            Outline
          </label>
          {#if first.stroke}
            <ColourField
              label="Colour"
              value={first.stroke.colour}
              commit={(c) => strokePatch({ colour: c })}
            />
            <div class="two">
              <NumField
                label="Width"
                value={first.stroke.width}
                unit="px"
                decimals={1}
                commit={(v) => strokePatch({ width: v })}
              />
              <div class="field">
                <label for="prop-dash">Style</label>
                <select
                  id="prop-dash"
                  value={first.stroke.dash}
                  onchange={(e) =>
                    strokePatch({ dash: (e.currentTarget as HTMLSelectElement).value as Dash })}
                >
                  {#each DASHES as [d, label] (d)}<option value={d}>{label}</option>{/each}
                </select>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if first.kind === 'rect'}
        <div class="sec">
          <h4>Corners</h4>
          <NumField
            label="Radius"
            value={first.radius}
            unit="px"
            commit={(v) => set({ radius: v } as Partial<AnimObject>)}
          />
        </div>
      {:else if first.kind === 'star'}
        <div class="sec">
          <h4>Star</h4>
          <div class="two">
            <NumField
              label="Points"
              value={first.points}
              commit={(v) => set({ points: Math.round(v) } as Partial<AnimObject>)}
            />
            <NumField
              label="Inner"
              value={first.inner * 100}
              unit="%"
              commit={(v) => set({ inner: v / 100 } as Partial<AnimObject>)}
            />
          </div>
        </div>
      {:else if first.kind === 'polygon'}
        <div class="sec">
          <h4>Polygon</h4>
          <NumField
            label="Sides"
            value={first.sides}
            commit={(v) => set({ sides: Math.round(v) } as Partial<AnimObject>)}
          />
        </div>
      {:else if first.kind === 'text'}
        <div class="sec">
          <h4>Text <span class="syl">20.1 adding text</span></h4>
          <textarea
            class="words"
            aria-label="Words"
            bind:this={words}
            value={first.text}
            rows="3"
            onchange={(e) => textPatch({ text: (e.currentTarget as HTMLTextAreaElement).value })}
          ></textarea>
          <div class="field">
            <label for="prop-font">Font</label>
            <FontPicker value={first.font} onchange={(font) => textPatch({ font })} />
          </div>
          <div class="two">
            <NumField
              label="Size"
              value={first.size}
              unit="px"
              commit={(v) => textPatch({ size: v })}
            />
            <div class="field">
              <label for="prop-align">Align</label>
              <select
                id="prop-align"
                value={first.align}
                onchange={(e) =>
                  set({
                    align: (e.currentTarget as HTMLSelectElement).value as TextAlign,
                  } as Partial<AnimObject>)}
              >
                <option value="left">Left</option>
                <option value="centre">Centre</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
          <div class="row">
            <button
              class="sm"
              aria-pressed={first.bold}
              onclick={() => textPatch({ bold: !(first as TextObject).bold })}><b>B</b> Bold</button
            >
            <button
              class="sm"
              aria-pressed={first.italic}
              onclick={() => textPatch({ italic: !(first as TextObject).italic })}
              ><i>I</i> Italic</button
            >
            <button
              class="sm"
              title="One text object per letter, so the letters can move one at a time"
              onclick={() => anim.splitText((t) => textBox(t))}>Split into letters</button
            >
          </div>
          <Why tool="animText" />
        </div>
      {/if}

      <div class="sec">
        <h4>Arrange</h4>
        <div class="row">
          <button
            class="sm icon-only"
            aria-label="Bring to front"
            title="Bring to front"
            onclick={() => anim.reorder('front')}><Icon name="front" size={14} /></button
          >
          <button
            class="sm icon-only"
            aria-label="Bring forward"
            title="Bring forward"
            onclick={() => anim.reorder('forward')}><Icon name="up" size={14} /></button
          >
          <button
            class="sm icon-only"
            aria-label="Send backward"
            title="Send backward"
            onclick={() => anim.reorder('back')}><Icon name="down" size={14} /></button
          >
          <button
            class="sm icon-only"
            aria-label="Send to back"
            title="Send to back"
            onclick={() => anim.reorder('backmost')}><Icon name="back" size={14} /></button
          >
          <span class="spacer"></span>
          <button
            class="sm"
            title="Group the selected objects into one (Ctrl/Cmd + G)"
            disabled={found.length < 2}
            onclick={() => anim.group()}><Icon name="group" size={14} /> Group</button
          >
          <button
            class="sm"
            title="Take the group apart (Ctrl/Cmd + Shift + G)"
            disabled={!found.some((f) => f.object.kind === 'group')}
            onclick={() => anim.ungroup()}>Ungroup</button
          >
        </div>
        <div class="row">
          <button
            class="sm"
            title="Make a copy 10 px away (Ctrl/Cmd + D)"
            onclick={() => anim.duplicate()}><Icon name="copy" size={14} /> Duplicate</button
          >
          <button
            class="sm"
            title="Delete the selected objects (Delete)"
            onclick={() => anim.deleteSelection()}><Icon name="delete" size={14} /> Delete</button
          >
        </div>
        <div class="field">
          <label for="prop-layer">On layer</label>
          <select
            id="prop-layer"
            value={found[0]!.layerId}
            onchange={(e) =>
              anim.moveSelectionToLayer((e.currentTarget as HTMLSelectElement).value)}
          >
            {#each [...doc.layers].reverse() as layer (layer.id)}
              <option value={layer.id}>{layer.name}</option>
            {/each}
          </select>
        </div>
        <Why tool="animGroup" />
      </div>
      <Why tool="objectProperties" />
    {/if}
  </div>
</aside>

<style>
  .props {
    width: 290px;
    flex: none;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--bg-1);
    border-left: 1px solid var(--line);
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: 8px 12px 12px;
  }
  .hint {
    margin: 4px 0 12px;
    color: var(--tx-2);
    font-size: 12px;
  }
  .sec {
    padding: 8px 0 10px;
    border-bottom: 1px solid var(--line);
  }
  h4 {
    margin: 0 0 8px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--tx-2);
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .syl {
    font-size: 10px;
    font-weight: 500;
    color: var(--tx-3);
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 8px;
  }
  .field {
    display: grid;
    grid-template-columns: 58px 1fr;
    align-items: center;
    gap: 3px 6px;
    margin-bottom: 6px;
    min-width: 0;
  }
  .field label {
    color: var(--tx-2);
    font-size: 12px;
  }
  input.text,
  select,
  .words {
    width: 100%;
    min-width: 0;
    font: inherit;
    font-size: 12.5px;
    background: var(--bg-2);
    color: var(--tx-1);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 4px 6px;
  }
  .words {
    display: block;
    margin-bottom: 6px;
    resize: vertical;
    font-family: var(--font);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--tx-2);
    margin: 0 0 8px;
  }
  .row {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }
  .facts {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .facts td {
    padding: 2px 0;
    color: var(--tx-2);
  }
  .facts td + td {
    color: var(--tx-1);
    text-align: right;
    font-family: var(--mono);
  }
</style>

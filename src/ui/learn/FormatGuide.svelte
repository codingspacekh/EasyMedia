<script lang="ts">
  // T7 export format guide (screen 22): every export format side by side, with the same
  // advantages and disadvantages as the export dialogs.
  import { formatGuide } from '../../core/teaching/format-guide.ts';
  import Icon from '../Icon.svelte';
  import LearnCard from './LearnCard.svelte';

  const rows = formatGuide();
  const groups = [
    { kind: 'video', label: 'Video' },
    { kind: 'audio', label: 'Audio' },
  ] as const;
</script>

<LearnCard title="Export format guide" icon="file" tag="advantages · disadvantages">
  <table>
    <thead>
      <tr>
        <th scope="col">Format</th>
        <th scope="col">Compression</th>
        <th scope="col">Advantages</th>
        <th scope="col">Disadvantages</th>
        <th scope="col">Best for</th>
      </tr>
    </thead>
    {#each groups as g (g.kind)}
      <tbody>
        <tr class="grp"><td colspan="5">{g.label}</td></tr>
        {#each rows.filter((r) => r.kind === g.kind) as r (r.format)}
          <tr>
            <th scope="row">{r.format}</th>
            <td>{r.compression}</td>
            <td
              ><ul>
                {#each r.pros as p (p)}<li class="plus">{p}</li>{/each}
              </ul></td
            >
            <td
              ><ul>
                {#each r.cons as c (c)}<li class="minus">{c}</li>{/each}
              </ul></td
            >
            <td>{r.bestFor}</td>
          </tr>
        {/each}
      </tbody>
    {/each}
  </table>
  <div class="why-box">
    <Icon name="info" />
    <div>
      <b>Files vs containers.</b> MP4, MOV, AVI and WAV are <b>containers</b>: they hold compressed
      streams plus information about them. The <b>codec</b> inside decides whether the data is lossy or
      lossless.
    </div>
  </div>
</LearnCard>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  thead th {
    text-align: left;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--tx-3);
    padding: 0 8px 8px 0;
    border-bottom: 1px solid var(--line-strong);
  }
  td,
  tbody th {
    padding: 7px 8px 7px 0;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
    color: var(--tx-2);
    line-height: 1.45;
    text-align: left;
  }
  tbody th {
    color: var(--tx-1);
    font-weight: 650;
    font-family: var(--mono);
    white-space: nowrap;
  }
  .grp td {
    color: var(--tx-3);
    font: 600 10.5px var(--font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding-top: 12px;
    border-bottom: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li::before {
    font-weight: 700;
    margin-right: 5px;
  }
  .plus::before {
    content: '+';
    color: var(--success);
  }
  .minus::before {
    content: '−';
    color: var(--danger);
  }
  .why-box {
    display: flex;
    gap: 10px;
    margin-top: 14px;
    padding: 12px;
    border-radius: var(--radius);
    background: rgba(79, 140, 255, 0.08);
    border: 1px solid rgba(79, 140, 255, 0.25);
    color: var(--tx-2);
    font-size: 12px;
    line-height: 1.5;
  }
  .why-box :global(.icon) {
    color: var(--accent);
    margin-top: 1px;
  }
  .why-box b {
    color: var(--tx-1);
  }
</style>

<script lang="ts">
  // A Learn mode card (screens 21–22): an icon, a title and the syllabus point, then its body.
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from '../Icon.svelte';

  let {
    title,
    icon,
    tag,
    grow = false,
    children,
  }: { title: string; icon: IconName; tag: string; grow?: boolean; children: Snippet } = $props();
</script>

<section class="lcard" class:grow aria-label={title}>
  <div class="lh">
    <Icon name={icon} />
    <h3>{title}</h3>
    <span class="spacer"></span>
    <span class="syl">{tag}</span>
  </div>
  <div class="lb">{@render children()}</div>
</section>

<style>
  .lcard {
    background: var(--bg-1);
    border: 1px solid var(--line);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  .grow {
    flex: 1;
  }
  .lh {
    padding: 14px 16px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 650;
  }
  .syl {
    font-size: 10px;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .lb {
    padding: 0 16px 16px;
    overflow: auto;
    min-height: 0;
  }
</style>

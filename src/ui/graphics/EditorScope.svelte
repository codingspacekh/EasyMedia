<script lang="ts">
  // M18: puts Graphics mode's app round the Animation mode panels inside it (ui/animation/editor.ts).
  import type { Snippet } from 'svelte';
  import type { App } from '../../app/app.ts';
  import { provideEditor } from '../animation/editor.ts';

  let { app, children }: { app: App; children: Snippet } = $props();
  // svelte-ignore state_referenced_locally
  provideEditor({
    anim: app.graphics,
    still: true,
    panels: { layers: 'graphics.layers', properties: 'graphics.properties' },
  });
</script>

{@render children()}

<script lang="ts">
  // Help ▸ About OneEditor: the version, who makes it, its licence (README §17) and the website
  // for contributors, which opens in the browser (the main process opens only that address).
  import type { App } from '../app/app.ts';
  import { ABOUT } from '../core/about.ts';
  import Dialog from './Dialog.svelte';

  let { app }: { app: App } = $props();
  const updates = $derived(app.updates.store);
  const version = $derived($updates.state?.current);
  const close = () => app.closeAbout();

  function website(e: MouseEvent): void {
    e.preventDefault();
    void app.openWebsite();
  }

  function licences(): void {
    close();
    void app.showLicences();
  }
</script>

<Dialog label="About OneEditor" width={420} onclose={close}>
  <div class="about">
    <h2>OneEditor</h2>
    {#if version}<p class="version">Version {version}</p>{/if}
    <p class="lead">
      Video, audio, animation and graphics for Cambridge International AS &amp; A Level IT (9626).
    </p>
    <p>{ABOUT.copyright}<br />{ABOUT.licence}</p>
    <p>To contribute, visit <a href={ABOUT.website} onclick={website}>{ABOUT.site}</a></p>
  </div>
  {#snippet buttons()}
    <button onclick={licences}>Licences</button>
    <button class="primary" onclick={close}>Close</button>
  {/snippet}
</Dialog>

<style>
  .about {
    text-align: center;
  }
  h2 {
    margin: 0;
    font-size: 22px;
  }
  p {
    margin: 10px 0 0;
  }
  .version,
  .lead {
    color: var(--tx-2);
  }
  .version {
    margin-top: 2px;
  }
  a {
    color: var(--accent);
  }
</style>

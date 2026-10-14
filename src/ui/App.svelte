<script lang="ts">
  const modes = ['Video', 'Audio', 'Learn'] as const;
  type Mode = (typeof modes)[number];

  let mode: Mode = $state('Video');
</script>

<main>
  <h1>EasyMedia</h1>
  <nav aria-label="Mode">
    {#each modes as m (m)}
      <button type="button" aria-pressed={mode === m} onclick={() => (mode = m)}>{m}</button>
    {/each}
  </nav>
  <p>{mode} mode — the editor arrives in milestone M4.</p>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #101216;
    color: #eceef2;
    font-family:
      Inter,
      -apple-system,
      'Segoe UI',
      system-ui,
      sans-serif;
  }
  main {
    padding: 32px;
  }
  nav {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    background: #171a20;
  }
  button {
    border: 0;
    border-radius: 6px;
    padding: 6px 14px;
    background: transparent;
    color: #a9b0bc;
    font: inherit;
  }
  button[aria-pressed='true'] {
    background: #272c36;
    color: #eceef2;
  }
</style>

<script lang="ts" module>
  // Line icons from the design (design/screens): 24 × 24, drawn with the current text colour.
  const ICONS = {
    video:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/>',
    audio: '<path d="M2 12h2M6 8v8M10 4v16M14 7v10M18 10v4M22 12h0"/>',
    learn:
      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    import: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    title: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    caption: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M13 15h4M7 11h10"/>',
    subtitle: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h10"/>',
    credits: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="m3 9 2.5-3L8 9"/><path d="M5.5 6v13"/>',
    snapshot:
      '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    split:
      '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    transition:
      '<rect x="3" y="6" width="11" height="12" rx="1.5"/><rect x="10" y="6" width="11" height="12" rx="1.5"/>',
    music:
      '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    export: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    image:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    toStart: '<path d="M19 20 9 12l10-8z"/><path d="M5 19V5"/>',
    toEnd: '<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor" stroke="none"/>',
    trim: '<path d="M8 4H5v16h3M16 4h3v16h-3"/><path d="M10 12h4"/>',
    join: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    delete: '<path d="M18 6 6 18M6 6l12 12"/>',
    snap: '<path d="M6 15V8a6 6 0 0 1 12 0v7"/><path d="M6 15h4v-4M14 11v4h4"/><path d="M6 19h4M14 19h4"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    volume:
      '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
    speed: '<path d="M12 14 16 9"/><path d="M3.3 19a10 10 0 1 1 17.4 0z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    sparkles:
      '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17v4M17 19h4"/>',
    locate: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    screen: '<rect x="2" y="6" width="20" height="12" rx="2"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    fade: '<path d="M3 20 21 4v16z"/>',
    filter: '<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/>',
    panzoom: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none"/>',
    record: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
    loop: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    cursor: '<path d="M9 4h6M9 20h6M12 4v16"/>',
    shift: '<path d="M5 12h14"/><path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    paste:
      '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    silence: '<path d="M3 12h4M17 12h4"/><path d="M9 8v8M15 8v8"/>',
    tracks: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    fit: '<path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/>',
  } as const;
  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let { name, size = 16 }: { name: IconName; size?: number } = $props();
</script>

<svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- fixed icon markup from this file only -->
  {@html ICONS[name]}
</svg>

<style>
  .icon {
    flex: none;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

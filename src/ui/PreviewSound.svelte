<script lang="ts">
  // One music or voiceover clip heard in the preview (V13), kept on the right moment of its file.
  import type { PreviewSound } from '../app/preview.ts';

  let { sound, playing }: { sound: PreviewSound; playing: boolean } = $props();
  let audio: HTMLAudioElement | undefined = $state();

  $effect(() => {
    if (!audio) return;
    audio.volume = Math.min(1, sound.volume); // a browser cannot play louder than 100 %
    audio.playbackRate = sound.rate;
    if (!playing || Math.abs(audio.currentTime - sound.mediaTime) > 0.3)
      audio.currentTime = sound.mediaTime;
    if (playing) void audio.play()?.catch(() => {});
    else audio.pause();
  });
</script>

<audio bind:this={audio} src={sound.src} preload="auto"></audio>

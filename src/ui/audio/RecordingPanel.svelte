<script lang="ts">
  // A14 Recording a voiceover (design screen 15): the microphone, its input level with advice,
  // "play other tracks" (overdubbing), the count-in, and Start / Stop. Floating, so the tracks
  // stay in view while the student records.
  import type { App } from '../../app/app.ts';
  import { levelAdvice } from '../../core/audio/recording.ts';
  import Icon from '../Icon.svelte';

  let { app }: { app: App } = $props();
  const audio = $derived(app.audio);
  const store = $derived(app.audio.store);
  const rec = $derived($store.recording!);
  const advice = $derived(levelAdvice(rec.level));
  const ready = $derived(rec.phase === 'ready');

  /** mm:ss.cc, as on design screen 15 */
  function clock(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${String(minutes).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}`;
  }
</script>

<div class="panel" role="dialog" aria-label="Recording">
  <div class="head">
    <span class="dot" class:on={rec.phase === 'recording'}></span>
    <h2>Recording</h2>
    <span class="syl">11.2 overdubbing</span>
    <span class="spacer"></span>
    <span class="time" aria-label="Recorded time">{clock(rec.elapsed)}</span>
  </div>
  <div class="body">
    <label for="rec-microphone">Microphone</label>
    <select
      id="rec-microphone"
      disabled={!ready}
      value={rec.microphoneId ?? ''}
      onchange={(e) => void audio.chooseMicrophone(e.currentTarget.value)}
    >
      {#each rec.microphones as m (m.id)}
        <option value={m.id}>{m.label}</option>
      {/each}
    </select>
    <span class="label">Input level</span>
    <meter
      aria-label="Input level"
      min="0"
      max="1"
      low="0.0316"
      high="0.99"
      optimum="0.5"
      value={rec.level}
    ></meter>
    {#if rec.phase === 'opening'}
      <p class="advice">Opening the microphone…</p>
    {:else}
      <p class="advice {advice.kind}">{advice.text}</p>
    {/if}
    <label class="check">
      <input
        type="checkbox"
        checked={rec.overdub}
        disabled={!ready}
        onchange={(e) => audio.setRecordingOptions({ overdub: e.currentTarget.checked })}
      />
      Play other tracks while recording
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={rec.countIn}
        disabled={!ready}
        onchange={(e) => audio.setRecordingOptions({ countIn: e.currentTarget.checked })}
      />
      3-second count-in
    </label>
    {#if rec.phase === 'count-in'}
      <p class="countdown" role="status">Recording starts in {rec.countdown}…</p>
    {/if}
  </div>
  <div class="foot">
    {#if ready || rec.phase === 'opening'}
      <span class="hint">Records into a new track at the playhead</span>
      <span class="spacer"></span>
      <button onclick={() => audio.closeRecorder()}>Cancel</button>
      <button class="danger" disabled={!ready} onclick={() => audio.startRecording()}
        ><Icon name="record" size={12} /> Start recording</button
      >
    {:else}
      <span class="hint">Space = stop</span>
      <span class="spacer"></span>
      <button class="danger" onclick={() => audio.stopRecording()}
        ><Icon name="stop" size={12} /> Stop</button
      >
    {/if}
  </div>
</div>

<style>
  .panel {
    position: fixed;
    top: 96px;
    left: 330px;
    width: 340px;
    z-index: 20;
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    font-size: 12px;
  }
  .head,
  .foot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
  }
  .head {
    border-bottom: 1px solid var(--line);
  }
  .foot {
    border-top: 1px solid var(--line);
  }
  h2 {
    margin: 0;
    font-size: 14px;
  }
  .syl {
    font-size: 10.5px;
    color: var(--tx-2);
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 0 5px;
  }
  .spacer {
    flex: 1;
  }
  .time {
    font: 700 16px var(--mono);
    color: var(--danger);
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--tx-3);
  }
  .dot.on {
    background: var(--danger);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
  }
  label,
  .label {
    color: var(--tx-2);
  }
  select {
    font: inherit;
    color: var(--tx-1);
    background: var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 4px 6px;
    margin-bottom: 4px;
  }
  meter {
    width: 100%;
    height: 10px;
  }
  .advice {
    margin: 0 0 4px;
    font-size: 11.5px;
  }
  .advice.good {
    color: var(--success);
  }
  .advice.quiet,
  .advice.loud {
    color: var(--warn);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--tx-1);
  }
  .countdown {
    margin: 4px 0 0;
    font: 700 15px var(--mono);
    color: var(--danger);
    text-align: center;
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
  }
  .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }
</style>

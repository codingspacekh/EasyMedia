// Effects on the selected sound (registry, P6 / P7; A7–A13): the settings a dialog opens with,
// its level graph and note, applying (one undo step), Preview, and the noise profile that
// Noise reduction needs first.
import { applyToSelection, soundIn } from '../../core/audio/edit.ts';
import { noiseProfile } from '../../core/audio/dsp/noise.ts';
import { audioEffectById, defaultParams, validateParams } from '../../core/effects/registry.ts';
import type { EffectContext, Params } from '../../core/effects/types.ts';
import type { AudioContext } from './context.ts';
import { PREVIEW_SECONDS, range } from './state.ts';

export function effectActions(ctx: AudioContext) {
  const { store, patch, doc, selection, errorText, showProblem, tryEdit } = ctx;
  const { selectedSound, startPlaying } = ctx;

  const effectContext = (): EffectContext => ({
    noiseProfile: store.get().noiseProfile?.profile ?? null,
  });

  /** Applies an effect to the selection; returns why it cannot, or null. */
  function applyEffect(id: string, params: Params): string | null {
    const def = audioEffectById(id);
    if (!def) return 'This effect is not available in this version of EasyMedia.';
    const sel = selection();
    return tryEdit(`${def.label.replace('…', '')} ${range(sel)}`, (tx) => {
      validateParams(def, params);
      def.check?.(selectedSound(), params);
      applyToSelection(tx, sel, (channels, rate) =>
        def.process(channels, rate, params, effectContext()),
      );
    });
  }

  return {
    /** The settings a dialog opens with: the defaults, adjusted to the selected sound. */
    effectSettings(id: string): Params {
      const def = audioEffectById(id);
      if (!def) return {};
      const params = defaultParams(def);
      const sound = selectedSound();
      return def.suggest && sound.length ? def.suggest(sound, params) : params;
    },

    /** The selected sound in `count` blocks, each as its peak level in dB (silence: −60). */
    selectionLevels(count: number): number[] {
      const sound = selectedSound();
      const n = sound[0]?.length ?? 0;
      if (!n) return [];
      return Array.from({ length: count }, (_, b) => {
        const from = Math.floor((b * n) / count);
        const to = Math.max(from + 1, Math.floor(((b + 1) * n) / count));
        let most = 0;
        for (const c of sound)
          for (let i = from; i < Math.min(to, n); i++) most = Math.max(most, Math.abs(c[i]!));
        return Math.max(-60, 20 * Math.log10(most || 1e-6));
      });
    },

    /** The line under the settings: a warning or what will happen. */
    effectNote(id: string, params: Params): string | null {
      const def = audioEffectById(id);
      const sound = selectedSound();
      return def?.note && sound.length ? def.note(sound, doc().rate, params) : null;
    },

    applyEffect,

    /** A13 step 1: measures the selected background noise for Noise reduction. */
    getNoiseProfile(): string | null {
      const sel = selection();
      const sound = selectedSound();
      if (sel.end <= sel.start || !sound.length)
        return 'Select a part with only background noise first, then click Get noise profile.';
      try {
        const profile = noiseProfile(sound, doc().rate);
        patch({
          noiseProfile: { start: sel.start, end: sel.end, profile },
          message: {
            kind: 'info',
            text: `Noise profile taken from ${range(sel)}. Now select the sound to clean (Ctrl/Cmd + A for all) and open Noise reduction again.`,
          },
        });
        return null;
      } catch (error) {
        return errorText(error);
      }
    },

    /** For menu items without settings (Fade in, Fade out): a refusal goes to the status bar. */
    applyNow(id: string): void {
      const problem = applyEffect(id, {});
      if (problem) showProblem(problem);
    },

    /** A18 Preview: plays the effect on the start of the selection, without changing anything. */
    previewEffect(id: string, params: Params): string | null {
      const def = audioEffectById(id);
      if (!def) return 'This effect is not available in this version of EasyMedia.';
      const sel = selection();
      const short = { ...sel, end: Math.min(sel.end, sel.start + PREVIEW_SECONDS) };
      const sound = doc()
        .tracks.filter((t) => sel.tracks.includes(t.id))
        .map((t) => soundIn(t, doc().rate, short))
        .find((c) => c !== null);
      if (!sound) return 'Select some sound first.';
      try {
        validateParams(def, params);
        const processed = def.process(sound, doc().rate, params, effectContext());
        startPlaying(processed, sel.start, false);
        return null;
      } catch (error) {
        return errorText(error);
      }
    },
  };
}

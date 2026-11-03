// N17: "Why use this?" is shown arranged (a short answer, then its reasons as points); a test
// checks every part of the arranged text is there.
import { expect } from 'vitest';
import { explain } from '../../src/core/effects/help.ts';

export function expectWhy(shown: string | null | undefined, text: string): void {
  const { answer, reasons } = explain(text);
  for (const part of [answer, ...reasons]) expect(shown ?? '').toContain(part);
}

/**
 * N17: the explanations of the "Why use this?" links inside an element. Each tooltip lives at the
 * end of the page (above everything), so it is found through its link's aria-controls.
 */
export function whyTexts(container: Element): string {
  return [...container.querySelectorAll('button[aria-controls^="why-"]')]
    .map((b) => document.getElementById(b.getAttribute('aria-controls')!)?.textContent ?? '')
    .join(' ');
}

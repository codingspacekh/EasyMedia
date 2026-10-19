// N10: when a single-key shortcut (Space, Delete) may act — not while the student types in a box,
// presses a focused button (Space clicks it already), holds a modifier, or has a dialog open.
export function shortcutAllowed(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (document.querySelector('[aria-modal="true"]')) return false;
  const el = e.target;
  return !(
    el instanceof HTMLElement &&
    (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName))
  );
}

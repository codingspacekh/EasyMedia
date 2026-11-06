// The colours chosen lately in any colour picker, newest first, for the pickers' Recent row
// (this session only).
const MOST = 9;

export const recentColours: string[] = $state([]);

export function rememberColour(hex: string): void {
  const at = recentColours.indexOf(hex);
  if (at === 0) return;
  if (at > 0) recentColours.splice(at, 1);
  recentColours.unshift(hex);
  recentColours.length = Math.min(recentColours.length, MOST);
}

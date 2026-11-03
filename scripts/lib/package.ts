// What scripts/package.ts runs: electron-builder for this computer's platform and chip only
// (the other Mac's FFmpeg is not on a CI runner), and where the packaged program lands.

/** electron-builder's arguments; `dir`: an unpacked app only (quick, for the self-check). */
export function builderArgs(platform: string, arch: string, { dir }: { dir: boolean }): string[] {
  const os = platform === 'win32' ? '--win' : '--mac';
  return [
    ...['--config', 'electron-builder.config.ts', '--publish', 'never', os, `--${arch}`],
    ...(dir ? ['--dir'] : []),
  ];
}

/** The packaged program, relative to the project folder. */
export function packagedProgram(platform: string, arch: string): string {
  if (platform === 'win32') return 'release/win-unpacked/OneEditor.exe';
  const folder = arch === 'x64' ? 'mac' : `mac-${arch}`;
  return `release/${folder}/OneEditor.app/Contents/MacOS/OneEditor`;
}

/** README N6 (decided 2026-10-19: Electron alone is about 134 MB compressed). */
export const MAX_INSTALLER_MB = 220;

/**
 * The installers (.exe, .dmg) bigger than N6 allows, explained (1 MB = 1 000 000 bytes). The
 * portable .zip is not an installer: zip packs less tightly (about 235 MB).
 */
export function oversized(files: readonly { name: string; bytes: number }[]): string[] {
  return files
    .filter((f) => !f.name.endsWith('.zip') && f.bytes > MAX_INSTALLER_MB * 1e6)
    .map(
      (f) =>
        `${f.name} is ${Math.round(f.bytes / 1e6)} MB (at most ${MAX_INSTALLER_MB} MB, README N6)`,
    );
}

/**
 * M17a: what goes into the installed app's resources as updates.json: the update address
 * (ONEEDITOR_UPDATE_URL; none, updates are off) and whether this Mac build is signed with the
 * maintainer's certificate (CSC_NAME), so it can take an update by itself.
 */
export function updateConfig(
  env: Record<string, string | undefined>,
  platform: string,
): { url: string | null; macSigned: boolean } {
  return {
    url: env.ONEEDITOR_UPDATE_URL || null,
    macSigned: platform === 'darwin' && Boolean(env.CSC_NAME),
  };
}

/** M17a: each Mac build's own feed, kept apart until both are merged into latest-mac.yml. */
export const macFeedName = (arch: string): string => `latest-mac-${arch}.yml`;

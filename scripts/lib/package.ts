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
  if (platform === 'win32') return 'release/win-unpacked/EasyMedia.exe';
  const folder = arch === 'x64' ? 'mac' : `mac-${arch}`;
  return `release/${folder}/EasyMedia.app/Contents/MacOS/EasyMedia`;
}

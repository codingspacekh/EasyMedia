// M12: an installed app checks itself — CI starts every packaged build with EASYMEDIA_SELF_CHECK
// set to a file, and the app writes this result there and quits. It proves the installer put
// FFmpeg, the pages and every bundled font where the app looks for them.
import { join } from 'node:path';
import { FONTS } from '../core/text/fonts.ts';
import type { BinaryPaths } from './ffmpeg/paths.ts';

export interface SelfCheckDeps {
  binaries: BinaryPaths;
  /** The built pages (dist). */
  pagesDir: string;
  /** Runs a program and gives its output. */
  run(file: string, args: string[]): Promise<string>;
  exists(path: string): Promise<boolean>;
  list(dir: string): Promise<string[]>;
}

export interface SelfCheckResult {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
}

export async function selfCheck(d: SelfCheckDeps): Promise<SelfCheckResult> {
  const checks: SelfCheckResult['checks'] = [];
  const check = async (name: string, test: () => Promise<string>) => {
    try {
      checks.push({ name, ok: true, detail: await test() });
    } catch (error) {
      checks.push({
        name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const version = (bin: string) => async () =>
    /^\S+ version \S+/.exec(await d.run(bin, ['-hide_banner', '-version']))?.[0] ??
    'runs, but did not say its version';
  await check('ffmpeg', version(d.binaries.ffmpeg));
  await check('ffprobe', version(d.binaries.ffprobe));
  await check('pages', async () => {
    const page = join(d.pagesDir, 'index.html');
    if (!(await d.exists(page))) throw new Error(`${page} is missing`);
    return page;
  });
  await check('fonts', async () => {
    const files = await d.list(join(d.pagesDir, 'assets'));
    const missing = FONTS.filter(
      (f) => !files.some((file) => file.startsWith(`${f.name.replace(/ /g, '')}-`)),
    );
    if (missing.length) throw new Error(`missing fonts: ${missing.map((f) => f.name).join(', ')}`);
    return `${FONTS.length} fonts`;
  });
  return { ok: checks.every((c) => c.ok), checks };
}

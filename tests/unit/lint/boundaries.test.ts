import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';

// ARCHITECTURE §1: core/ is plain TypeScript and imports nothing outside core/.
const root = fileURLToPath(new URL('../../..', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function boundaryErrors(filePath: string, importPath: string): Promise<number> {
  const [result] = await eslint.lintText(`import '${importPath}';\n`, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-imports').length;
}

describe('architecture boundary: core imports nothing outside core', () => {
  it.each([
    'electron',
    'node:fs',
    'fs',
    'path',
    'child_process',
    'svelte',
    'svelte/store',
    '../../app/store.ts',
    '../../ui/App.svelte',
    '../../adapters/electron/index.ts',
    '../../main/ffmpeg/paths.ts',
  ])('rejects %s inside src/core', async (importPath) => {
    expect(await boundaryErrors('src/core/model/example.ts', importPath)).toBe(1);
  });

  it.each(['./time.ts', '../render/compile.ts', '../../core/model/types.ts'])(
    'allows %s inside src/core',
    async (importPath) => {
      expect(await boundaryErrors('src/core/model/example.ts', importPath)).toBe(0);
    },
  );

  it('allows electron and node modules outside core', async () => {
    expect(await boundaryErrors('src/main/index.ts', 'electron')).toBe(0);
    expect(await boundaryErrors('src/main/index.ts', 'node:fs')).toBe(0);
  });
});

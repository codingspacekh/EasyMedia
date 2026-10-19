// M12 / README §16: THIRD_PARTY_LICENSES lists everything shipped that EasyMedia did not write.
import { describe, expect, it } from 'vitest';
import {
  bundledPackages,
  thirdPartyLicences,
  type LicenceInputs,
} from '../../../scripts/lib/licences.ts';

const inputs = (): LicenceInputs => ({
  appVersion: '1.0.0',
  ffmpeg: {
    version: '9.0.2',
    licence: 'GNU GPL v3\nfull text…',
    builds: ['https://example.org/win.zip', 'https://example.org/mac.zip'],
  },
  electron: { version: '44.5.0', licence: 'MIT License\nCopyright (c) Electron contributors' },
  fonts: [
    { name: 'Inter', licence: 'SIL OPEN FONT LICENSE Version 1.1 (Inter)' },
    { name: 'Lobster', licence: 'SIL OPEN FONT LICENSE Version 1.1 (Lobster)' },
  ],
  packages: [
    { name: 'svelte', version: '5.57.1', licence: 'MIT', text: 'Copyright (c) Svelte' },
    { name: 'clsx', version: '2.1.1', licence: 'MIT', text: 'Copyright (c) Luke Edwards' },
  ],
});

describe('THIRD_PARTY_LICENSES', () => {
  it('names FFmpeg, its GPL licence and where its source and builds come from', () => {
    const text = thirdPartyLicences(inputs());
    expect(text).toMatch(/FFmpeg 9\.0\.2/);
    expect(text).toMatch(/GNU GPL v3/);
    expect(text).toMatch(/https:\/\/ffmpeg\.org\/download\.html/);
    expect(text).toContain('https://example.org/win.zip');
  });

  it('names Electron, every bundled font and every bundled package with its licence text', () => {
    const text = thirdPartyLicences(inputs());
    for (const part of [
      'Electron 44.5.0',
      'Copyright (c) Electron contributors',
      'Chromium',
      'Inter',
      'SIL OPEN FONT LICENSE Version 1.1 (Lobster)',
      'svelte 5.57.1 (MIT)',
      'Copyright (c) Luke Edwards',
    ])
      expect(text).toContain(part);
  });

  it('refuses a font or package without a licence (the build stops)', () => {
    expect(() =>
      thirdPartyLicences({ ...inputs(), fonts: [{ name: 'Mystery', licence: '' }] }),
    ).toThrow(/Mystery has no licence/);
    expect(() =>
      thirdPartyLicences({
        ...inputs(),
        packages: [{ name: 'left-pad', version: '1.0.0', licence: 'MIT', text: '' }],
      }),
    ).toThrow(/left-pad has no licence/);
  });

  it('the packages in the app are read from the build (module ids under node_modules)', () => {
    expect(
      bundledPackages([
        '/p/node_modules/svelte/src/internal/client/index.js',
        '/p/node_modules/svelte/src/store/index.js',
        'C:\\p\\node_modules\\clsx\\dist\\clsx.mjs',
        '/p/node_modules/@scope/pkg/index.js',
        '/p/src/ui/App.svelte',
        '\0vite/preload-helper',
      ]),
    ).toEqual(['@scope/pkg', 'clsx', 'svelte']);
  });
});

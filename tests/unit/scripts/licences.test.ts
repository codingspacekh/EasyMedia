// M12 / README §17: THIRD_PARTY_LICENSES lists everything shipped that OneEditor did not write.
import { describe, expect, it } from 'vitest';
import {
  bundledPackages,
  licenceTextOf,
  packageLists,
  shippedPackages,
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

  it('reads only the package lists from build-info, not the other files kept there (updates.json)', () => {
    expect(
      packageLists([[], ['clsx', 'svelte'], { url: null, macSigned: false }, ['svelte']]),
    ).toEqual(['clsx', 'svelte']);
  });

  it('M17a the packages the installers carry in node_modules: the dependencies and theirs, nested copies too', () => {
    const disk: Record<string, { version: string; dependencies?: Record<string, string> }> = {
      'node_modules/electron-updater': {
        version: '6.8.11',
        dependencies: { 'js-yaml': '^4', semver: '^7', lazy: '^1' },
      },
      'node_modules/js-yaml': { version: '4.3.2', dependencies: { argparse: '^2' } },
      'node_modules/argparse': { version: '2.0.1' },
      // electron-updater's own semver, beside an older one at the top that it does not use.
      'node_modules/electron-updater/node_modules/semver': { version: '7.7.4' },
      'node_modules/semver': { version: '6.3.1' },
      'node_modules/lazy': { version: '1.0.5', dependencies: { argparse: '^2' } },
    };
    expect(shippedPackages({ 'electron-updater': '^6.8.11' }, (dir) => disk[dir] ?? null)).toEqual([
      { name: 'argparse', version: '2.0.1', dir: 'node_modules/argparse' },
      { name: 'electron-updater', version: '6.8.11', dir: 'node_modules/electron-updater' },
      { name: 'js-yaml', version: '4.3.2', dir: 'node_modules/js-yaml' },
      { name: 'lazy', version: '1.0.5', dir: 'node_modules/lazy' },
      {
        name: 'semver',
        version: '7.7.4',
        dir: 'node_modules/electron-updater/node_modules/semver',
      },
    ]);
  });

  it('a package with no licence file: the standard MIT text with its author when it says MIT; else none', () => {
    expect(licenceTextOf({ license: 'ISC' }, 'ISC License\n\nCopyright (c) Isaac')).toBe(
      'ISC License\n\nCopyright (c) Isaac',
    );
    const mit = licenceTextOf({ license: 'MIT', author: 'Vladimir Krivosheev' }, '');
    expect(mit).toContain('Copyright (c) Vladimir Krivosheev');
    expect(mit).toContain('Permission is hereby granted, free of charge');
    expect(mit).toMatch(/has no licence file/);
    expect(licenceTextOf({ license: 'MIT', author: { name: 'Ann' } }, '')).toContain(
      'Copyright (c) Ann',
    );
    expect(licenceTextOf({ license: 'Python-2.0' }, '')).toBe('');
  });
});

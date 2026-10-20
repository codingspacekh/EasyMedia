// M12: `npm run app` shows EasyMedia, not Electron, in the menu bar and the app menu.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renameBundle } from '../../../scripts/lib/dev-app-name.ts';

const root = join(import.meta.dirname, '../../..');

const plist = (name: string) => `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
	<key>CFBundleDisplayName</key>
	<string>${name}</string>
	<key>CFBundleExecutable</key>
	<string>Electron</string>
	<key>CFBundleName</key>
	<string>${name}</string>
</dict>
</plist>
`;

describe('the app name when run with npm run app', () => {
  it('the app menu (About, Hide, Quit) says EasyMedia: package.json has the product name', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.productName).toBe('EasyMedia');
  });

  it("the macOS menu bar says EasyMedia: Electron's bundle name and display name are changed", () => {
    expect(renameBundle(plist('Electron'), 'EasyMedia')).toBe(plist('EasyMedia'));
  });

  it('leaves the executable name alone, and does nothing when already renamed', () => {
    expect(renameBundle(plist('Electron'), 'EasyMedia')).toContain('<string>Electron</string>');
    expect(renameBundle(plist('EasyMedia'), 'EasyMedia')).toBe(plist('EasyMedia'));
  });

  it('npm run app renames Electron before starting it', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.scripts.app).toBe(
      'npm run build:app && node scripts/dev-app-name.ts && electron .',
    );
  });
});

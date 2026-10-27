// The macOS menu bar shows the bundle's name, which for `npm run app` is Electron's own bundle.
// The installers already say EasyMedia (electron-builder's productName).
export function renameBundle(plist: string, name: string): string {
  return plist.replace(
    /(<key>CFBundle(?:Display)?Name<\/key>\s*<string>)[^<]*(<\/string>)/g,
    `$1${name}$2`,
  );
}

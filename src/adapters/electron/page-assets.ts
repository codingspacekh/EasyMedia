// AN15: what an HTML web animation carries inside it, read by the main process (the page cannot
// read files itself, ARCHITECTURE §2). The bundled fonts are the built pages' own font files:
// `fontUrls` gives each one's URL in the built pages (import.meta.glob in ui/main.ts).
import { EditError } from '../../core/model/errors.ts';
import type { PageAssets } from '../../core/ports.ts';
import type { MveApi } from '../../preload/api.ts';
import { unwrap } from './media-engine.ts';

/** The file name in the built pages' assets folder: "./assets/Inter-B2xq_9aZ.ttf" → "Inter-B2xq_9aZ.ttf". */
const assetName = (url: string): string =>
  decodeURIComponent(url.split(/[?#]/)[0]!.split('/').at(-1)!);

export function createElectronPageAssets(
  api: MveApi,
  fontUrls: Record<string, string>,
): PageAssets {
  return {
    playerScript: () => unwrap(api.invoke('page:player')),
    pictureDataUrl: (path) => unwrap(api.invoke('page:picture', path)),
    async fontDataUrl(file) {
      const url = fontUrls[file];
      if (!url) throw new EditError(`${file} is not one of the fonts that come with EasyMedia.`);
      // A small file may already be inside the page.
      if (url.startsWith('data:')) return url;
      return unwrap(api.invoke('page:font', assetName(url)));
    },
  };
}

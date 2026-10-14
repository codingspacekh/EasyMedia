// Dialogs, project files and app paths for the page, through window.mve.
import type { AppPaths, Dialogs, ProjectFiles } from '../../core/ports.ts';
import type { MveApi } from '../../preload/api.ts';
import { unwrap } from './media-engine.ts';

export function createElectronDialogs(api: MveApi): Dialogs {
  return {
    openMedia: () => unwrap(api.invoke('dialog:openMedia')),
    openProject: () => unwrap(api.invoke('dialog:openProject')),
    saveProject: (name) => unwrap(api.invoke('dialog:saveProject', name)),
    exportVideo: (name) => unwrap(api.invoke('dialog:exportVideo', name)),
    confirm: (message) => unwrap(api.invoke('dialog:confirm', message)),
  };
}

export function createElectronProjectFiles(api: MveApi): ProjectFiles {
  return {
    read: (path) => unwrap(api.invoke('project:read', path)),
    write: async (path, text) => void (await unwrap(api.invoke('project:write', path, text))),
    remove: async (path) => void (await unwrap(api.invoke('project:remove', path))),
  };
}

export const getAppPaths = (api: MveApi): Promise<AppPaths> => unwrap(api.invoke('app:paths'));

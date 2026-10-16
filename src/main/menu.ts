// Native menus (X3): platform conventions, CmdOrCtrl shortcuts; items send actions to the page.
import type { MenuItemConstructorOptions } from 'electron';
import type { MenuAction } from '../preload/api.ts';

export function menuTemplate(
  platform: string,
  send: (action: MenuAction) => void,
  developer: boolean,
): MenuItemConstructorOptions[] {
  const mac = platform === 'darwin';
  const item = (
    label: string,
    accelerator: string,
    action: MenuAction,
  ): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => send(action),
  });
  return [
    ...(mac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    {
      label: 'File',
      submenu: [
        item('New', 'CmdOrCtrl+N', 'new'),
        item('Open…', 'CmdOrCtrl+O', 'open'),
        item('Save', 'CmdOrCtrl+S', 'save'),
        item('Save As…', 'CmdOrCtrl+Shift+S', 'saveAs'),
        { type: 'separator' },
        item('Import Media…', 'CmdOrCtrl+I', 'import'),
        item('Export Video…', 'CmdOrCtrl+E', 'export'),
        item('Export Audio…', 'CmdOrCtrl+Shift+E', 'exportAudio'),
        item('Package Project…', 'CmdOrCtrl+Shift+P', 'package'),
        ...(mac ? [] : [{ type: 'separator' } as const, { role: 'quit', label: 'Exit' } as const]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        item('Undo', 'CmdOrCtrl+Z', 'undo'),
        item('Redo', mac ? 'Shift+CmdOrCtrl+Z' : 'Ctrl+Y', 'redo'),
        { type: 'separator' },
        // Cut, copy and paste work in text boxes and, in Audio mode, on the selected sound
        // (the page listens for the clipboard events). Select All is decided by the page too.
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        item('Select All', 'CmdOrCtrl+A', 'selectAll'),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(developer ? [{ role: 'toggleDevTools' } as const] : []),
      ],
    },
    { role: 'windowMenu' },
  ];
}

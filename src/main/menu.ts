// Native menus (X3): platform conventions, CmdOrCtrl shortcuts; items send actions to the page.
import type { MenuItemConstructorOptions } from 'electron';
import type { MenuAction } from '../preload/api.ts';

export type Guide = 'user-guide' | 'teacher-notes';

export function menuTemplate(
  platform: string,
  send: (action: MenuAction) => void,
  developer: boolean,
  /** Opens a guide shipped with the app (a web page) in the browser. */
  openGuide: (guide: Guide) => void = () => {},
  /** Help ▸ Report a Problem…: made by the main process, so it works when the page does not. */
  reportProblem: () => void = () => {},
): MenuItemConstructorOptions[] {
  const mac = platform === 'darwin';
  const item = (
    label: string,
    accelerator: string,
    action: MenuAction,
  ): MenuItemConstructorOptions => ({
    label,
    ...(accelerator ? { accelerator } : {}),
    click: () => send(action),
  });
  return [
    // macOS: the app menu as Mac apps have it, with OneEditor's own About box (the page's).
    ...(mac
      ? [
          {
            label: 'OneEditor',
            submenu: [
              item('About OneEditor', '', 'about'),
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } as MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'File',
      submenu: [
        item('New', 'CmdOrCtrl+N', 'new'),
        item('Open…', 'CmdOrCtrl+O', 'open'),
        item('Save', 'CmdOrCtrl+S', 'save'),
        item('Save As…', 'CmdOrCtrl+Shift+S', 'saveAs'),
        { type: 'separator' },
        item('New Animation', '', 'newAnimation'),
        item('Open Animation…', '', 'openAnimation'),
        item('New Image…', '', 'newImage'),
        item('Open Image…', '', 'openImage'),
        { type: 'separator' },
        item('Import Media…', 'CmdOrCtrl+I', 'import'),
        item('Export Video…', 'CmdOrCtrl+E', 'export'),
        item('Export Audio…', 'CmdOrCtrl+Shift+E', 'exportAudio'),
        item('Export Animation…', '', 'exportAnimation'),
        item('Export Image…', '', 'exportImage'),
        item('Package Project…', 'CmdOrCtrl+Shift+P', 'package'),
        { type: 'separator' },
        item('Candidate Details…', '', 'candidate'),
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
        // N16: the panels of the editor that is showing.
        item('Show / Hide Left Panel', 'CmdOrCtrl+Alt+1', 'toggleLeft'),
        item('Show / Hide Right Panel', 'CmdOrCtrl+Alt+2', 'toggleRight'),
        item('Show / Hide Timeline', 'CmdOrCtrl+Alt+3', 'toggleBottom'),
        item('Reset Layout', '', 'resetLayout'),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(developer ? [{ role: 'toggleDevTools' } as const] : []),
      ],
    },
    {
      // N15: Learn's pages fill the window in place of the editor, with Back.
      label: 'Learn',
      submenu: [
        item('Inspector & Sampling', '', 'learnInspect'),
        item('Formats & Compression', '', 'learnFormats'),
        item('Animation Theory', '', 'learnAnimation'),
        item('Task Checker', '', 'learnTask'),
        { type: 'separator' },
        item('Glossary', '', 'glossary'),
      ],
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        item('Welcome to OneEditor', '', 'welcome'),
        { label: 'User guide', click: () => openGuide('user-guide') },
        { label: 'Teacher notes', click: () => openGuide('teacher-notes') },
        { type: 'separator' },
        item('Check for Updates…', '', 'updates'),
        { label: 'Report a Problem…', click: () => reportProblem() },
        item('Licences', '', 'licences'),
        ...(mac ? [] : [{ type: 'separator' } as const, item('About OneEditor', '', 'about')]),
      ],
    },
  ];
}

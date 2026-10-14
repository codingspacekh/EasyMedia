import { describe, expect, it, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { menuTemplate } from '../../../src/main/menu.ts';
import type { MenuAction } from '../../../src/preload/api.ts';

type Item = MenuItemConstructorOptions;
const find = (menus: Item[], label: string) => menus.find((m) => m.label === label);
const items = (menu: Item | undefined) =>
  (menu?.submenu as Item[]).filter((i) => i.type !== 'separator');

describe('X3 native menus', () => {
  it('macOS has the app menu first; Windows does not', () => {
    expect(menuTemplate('darwin', () => {}, false)[0]).toMatchObject({ role: 'appMenu' });
    expect(menuTemplate('win32', () => {}, false)[0]).toMatchObject({ label: 'File' });
  });

  it.each([
    ['New', 'CmdOrCtrl+N', 'new'],
    ['Open…', 'CmdOrCtrl+O', 'open'],
    ['Save', 'CmdOrCtrl+S', 'save'],
    ['Save As…', 'CmdOrCtrl+Shift+S', 'saveAs'],
    ['Import Media…', 'CmdOrCtrl+I', 'import'],
    ['Export Video…', 'CmdOrCtrl+E', 'export'],
  ])('File ▸ %s (%s) sends "%s" to the page', (label, accelerator, action) => {
    const send = vi.fn<(a: MenuAction) => void>();
    const item = items(find(menuTemplate('darwin', send, false), 'File')).find(
      (i) => i.label === label,
    )!;
    expect(item.accelerator).toBe(accelerator);
    (item.click as () => void)();
    expect(send).toHaveBeenCalledWith(action);
  });

  it('Redo is ⇧⌘Z on macOS and Ctrl+Y on Windows', () => {
    const redo = (p: string) =>
      items(
        find(
          menuTemplate(p, () => {}, false),
          'Edit',
        ),
      ).find((i) => i.label === 'Redo')!;
    expect(redo('darwin').accelerator).toBe('Shift+CmdOrCtrl+Z');
    expect(redo('win32').accelerator).toBe('Ctrl+Y');
  });

  it('Edit keeps cut / copy / paste for text boxes', () => {
    const roles = items(
      find(
        menuTemplate('win32', () => {}, false),
        'Edit',
      ),
    ).map((i) => i.role);
    expect(roles).toEqual(expect.arrayContaining(['cut', 'copy', 'paste', 'selectAll']));
  });

  it('Windows has Exit in the File menu; macOS quits from the app menu', () => {
    expect(
      items(
        find(
          menuTemplate('win32', () => {}, false),
          'File',
        ),
      ).at(-1),
    ).toMatchObject({ role: 'quit', label: 'Exit' });
    expect(
      items(
        find(
          menuTemplate('darwin', () => {}, false),
          'File',
        ),
      ).some((i) => i.role === 'quit'),
    ).toBe(false);
  });

  it('developer tools appear only while developing', () => {
    const view = (dev: boolean) =>
      items(
        find(
          menuTemplate('win32', () => {}, dev),
          'View',
        ),
      ).map((i) => i.role);
    expect(view(true)).toContain('toggleDevTools');
    expect(view(false)).not.toContain('toggleDevTools');
  });
});

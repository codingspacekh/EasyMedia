const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spike', {
  autoInput: () => ipcRenderer.invoke('auto-input'),
  pickFile: () => ipcRenderer.invoke('pick-file'),
  probe: (file) => ipcRenderer.invoke('probe', file),
  makeProxy: (file, duration) => ipcRenderer.invoke('make-proxy', file, duration),
  exportVideo: (file, duration, encoder) => ipcRenderer.invoke('export', file, duration, encoder),
  hardwareEncoder: () => ipcRenderer.invoke('hw-encoder'),
  ram: () => ipcRenderer.invoke('ram'),
  report: (data) => ipcRenderer.invoke('report', data),
  onProgress: (cb) => ipcRenderer.on('progress', (_e, label, p) => cb(label, p)),
});

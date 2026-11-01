const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('workdesk', Object.freeze({
  call: (action, payload) => ipcRenderer.invoke('desk:action', action, payload),
  onState: (callback) => { const listener = (_event, value) => callback(value); ipcRenderer.on('desk:state', listener); return () => ipcRenderer.removeListener('desk:state', listener); },
  onNavigate: (callback) => { const listener = (_event, value) => callback(value); ipcRenderer.on('desk:navigate', listener); return () => ipcRenderer.removeListener('desk:navigate', listener); },
  onToast: (callback) => { const listener = (_event, value) => callback(value); ipcRenderer.on('desk:toast', listener); return () => ipcRenderer.removeListener('desk:toast', listener); },
  bounds: (value) => ipcRenderer.send('desk:bounds', value)
}));

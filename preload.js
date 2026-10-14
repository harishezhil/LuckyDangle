const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dangle", {
  setClickable: (clickable) => ipcRenderer.send("set-clickable", clickable),
  onSetCharm: (callback) => ipcRenderer.on("set-charm", (_event, index) => callback(index)),
})
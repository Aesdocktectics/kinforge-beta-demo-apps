const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kinforgeNative", {
  openDriveAuth: (url) => ipcRenderer.invoke("kinforge:open-drive-auth", url),
  cloudRequest: (request) => ipcRenderer.invoke("kinforge:cloud-request", request),
  getAppInfo: () => ipcRenderer.invoke("kinforge:get-app-info"),
  listLocalUpdates: () => ipcRenderer.invoke("kinforge:list-local-updates"),
  openLocalUpdate: (filePath) => ipcRenderer.invoke("kinforge:open-local-update", filePath),
  downloadUpdate: (url) => ipcRenderer.invoke("kinforge:download-update", url),
  openUpdateDownloads: () => ipcRenderer.invoke("kinforge:open-update-downloads"),
  getStorageFolders: () => ipcRenderer.invoke("kinforge:get-storage-folders"),
  saveFile: (payload) => ipcRenderer.invoke("kinforge:save-file", payload),
  showFolder: (target) => ipcRenderer.invoke("kinforge:show-folder", target)
});

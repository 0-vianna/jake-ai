const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("jakeDesktop", {
  platform: process.platform,
  version: "0.1.0"
});

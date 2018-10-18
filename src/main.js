// This is free and unencumbered software released into the public domain.
// See LICENSE for details

const { app, BrowserWindow, Menu, protocol, ipcMain } = require("electron");

const updater = require("./updater");

let win;

function sendStatusToWindow(text) {
  win.webContents.send("message", text);
}

function createDefaultWindow() {
  win = new BrowserWindow();
  win.webContents.openDevTools();
  win.on("closed", () => {
    win = null;
  });
  win.loadURL(`file://${__dirname}/version.html#v${app.getVersion()}`);
  return win;
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("ready", function() {
  createDefaultWindow();
  updater.init(sendStatusToWindow);
});

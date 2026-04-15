const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_SEND_CHANNELS = [
    'request-mode-switch', 'save-app-config', 'migrate-to-pro', 'update-setting', 'close-app', 'minimize-app', 'maximize-app',
    'force-maximize', 'resize-window', 'center-window', 'set-always-on-top', 'set-window-opacity',
    'move-to-next-display', 'move-to-prev-display', 'clipboard-write-text', 'clipboard-write-image', 'open-external', 'ondragstart',
    'renderer-ready-to-show', 'validate-license', 'renderer-content-ready',
    'toggle-dev-pro', 'hide-window', 'show-window','validate-license-string',
    'nuke-license'   
];

const ALLOWED_INVOKE_CHANNELS = [
    'select-directory', 'select-font', 'save-image', 'get-sources', 'get-window-pos',
    'start-fullscreen-capture', 'write-text', 
    'capture-window-mode-wgc', 'get-scale-factor'
];

const ALLOWED_RECEIVE_CHANNELS = [
    'window-shown', 'window-state-change', 'migration-result', 'license-response', 'wgc-data-received'
];

contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, ...args) => {
        if (ALLOWED_SEND_CHANNELS.includes(channel)) ipcRenderer.send(channel, ...args);
    },
    invoke: (channel, ...args) => {
        if (ALLOWED_INVOKE_CHANNELS.includes(channel)) return ipcRenderer.invoke(channel, ...args);
        return Promise.reject(new Error("Unauthorized IPC channel"));
    },
    on: (channel, func) => {
        if (ALLOWED_RECEIVE_CHANNELS.includes(channel)) ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
    },
    sendSync: (channel, data) => {
        // NEW DEV CHANNEL ADDED TO THIS ARRAY --> 'get-is-dev-sync'
        if (['get-is-pro-sync', 'get-app-config-sync', 'get-is-dev-sync'].includes(channel)) return ipcRenderer.sendSync(channel, data);
    },
    // Dedicated helpers
    writeText: (text) => ipcRenderer.send('clipboard-write-text', text),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    isMac: process.platform === 'darwin'
});
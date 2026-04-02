const { ipcRenderer } = require('electron');
window.api.exportZip(['some-id']).then(console.log).catch(console.error);

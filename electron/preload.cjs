'use strict';

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('sinterDesktop', Object.freeze({
  platform: process.platform,
  shell: 'electron',
}));

'use strict';

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('liminalDesktop', Object.freeze({
  platform: process.platform,
  shell: 'electron',
}));

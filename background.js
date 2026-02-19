// [Relocate] [background.js] - Service Worker
// Handles messaging, badge management, and state sync.

'use strict';

// On install: set default state
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    spoofEnabled: false,
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 10,
    presetName: 'Paris',
    theme: 'dark'
  });
  chrome.action.setBadgeText({ text: '' });
  console.log('[Relocate] [Install] [SUCCESS] Extension installed.');
});

// Update the toolbar icon badge based on spoof state
function updateBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    chrome.action.setTitle({ title: '📍 Relocate — SPOOFING ACTIVE' });
  } else {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: '📍 Relocate — Inactive' });
  }
}

// Listen for messages from popup → broadcast to all content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STATE_CHANGED') {
    updateBadge(message.spoofEnabled || false);

    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (!tab.url) return;
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
        chrome.tabs.sendMessage(tab.id, message).catch(() => { });
      });
    });
    sendResponse({ ok: true });
  }

  if (message.type === 'GET_STATE') {
    chrome.storage.local.get(
      ['spoofEnabled', 'latitude', 'longitude', 'accuracy', 'presetName', 'theme'],
      (data) => sendResponse(data)
    );
  }

  return true;
});

// Sync badge on startup
chrome.storage.local.get(['spoofEnabled'], (data) => {
  updateBadge(data.spoofEnabled || false);
});

// [Relocate] [background.js] - Service Worker
// Handles messaging, badge management, state sync, and update checks.

'use strict';

const GITHUB_REPO = 'kashif0700444846/relocate-extension';
const UPDATE_CHECK_ALARM = 'relocate-update-check';

// ──────────────────────────────────────────────
// On Install: set default state + schedule update checks
// ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.set({
    spoofEnabled: false,
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 10,
    presetName: 'Paris',
    theme: 'dark',
    useCount: 0,
    ratingDismissed: false,
    updateAvailable: null
  });
  chrome.action.setBadgeText({ text: '' });

  // Schedule update check every 6 hours
  chrome.alarms.create(UPDATE_CHECK_ALARM, {
    delayInMinutes: 1,       // first check 1 min after install
    periodInMinutes: 360     // then every 6 hours
  });

  console.log('[Relocate] [Install] [SUCCESS] Extension installed. Reason:', details.reason);
});

// ──────────────────────────────────────────────
// Update Checker — polls GitHub Releases API
// ──────────────────────────────────────────────
async function checkForUpdates() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    );

    if (!res.ok) {
      console.warn('[Relocate] [UpdateCheck] [WARN] GitHub API returned', res.status);
      return;
    }

    const release = await res.json();
    const manifest = chrome.runtime.getManifest();
    const currentVersion = manifest.version;

    // Extract version from tag (e.g. "v1.2.0-5" → "1.2.0")
    const remoteTag = release.tag_name || '';
    const remoteVersion = remoteTag.replace(/^v/, '').split('-')[0];

    if (remoteVersion && isNewerVersion(remoteVersion, currentVersion)) {
      const updateInfo = {
        version: remoteVersion,
        tag: remoteTag,
        url: release.html_url,
        downloadUrl: '',
        name: release.name || remoteTag
      };

      // Find the .zip asset
      if (release.assets && release.assets.length > 0) {
        const zip = release.assets.find(a => a.name.endsWith('.zip'));
        if (zip) updateInfo.downloadUrl = zip.browser_download_url;
      }

      chrome.storage.local.set({ updateAvailable: updateInfo });
      console.log('[Relocate] [UpdateCheck] [INFO] New version available:', remoteVersion);
    } else {
      chrome.storage.local.set({ updateAvailable: null });
      console.log('[Relocate] [UpdateCheck] [OK] Up to date. Current:', currentVersion);
    }
  } catch (err) {
    console.error('[Relocate] [UpdateCheck] [ERROR]', err.message);
  }
}

// Compare semver strings: returns true if remote > current
function isNewerVersion(remote, current) {
  const r = remote.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rv = r[i] || 0;
    const cv = c[i] || 0;
    if (rv > cv) return true;
    if (rv < cv) return false;
  }
  return false;
}

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_CHECK_ALARM) {
    checkForUpdates();
  }
});

// ──────────────────────────────────────────────
// Badge Management
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// Geolocation Consumer Tracking
// ──────────────────────────────────────────────
const geoConsumers = new Map(); // tabId → { url, title, lastSeen }

// ──────────────────────────────────────────────
// Message Router
// ──────────────────────────────────────────────
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
      ['spoofEnabled', 'latitude', 'longitude', 'accuracy', 'presetName', 'theme',
        'useCount', 'ratingDismissed', 'updateAvailable'],
      (data) => sendResponse(data)
    );
  }

  if (message.type === 'CHECK_UPDATE_NOW') {
    checkForUpdates().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'INCREMENT_USE') {
    chrome.storage.local.get(['useCount'], (data) => {
      const count = (data.useCount || 0) + 1;
      chrome.storage.local.set({ useCount: count });
      sendResponse({ count });
    });
    return true;
  }

  if (message.type === 'GEO_CONSUMER_REPORT') {
    if (sender.tab && sender.tab.id) {
      geoConsumers.set(sender.tab.id, {
        url: message.url || sender.tab.url || '',
        title: message.title || sender.tab.title || '',
        lastSeen: Date.now()
      });
    }
    sendResponse({ ok: true });
  }

  if (message.type === 'GET_GEO_CONSUMERS') {
    // Clean up stale entries (older than 5 minutes)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    for (const [tabId, info] of geoConsumers) {
      if (info.lastSeen < fiveMinAgo) geoConsumers.delete(tabId);
    }
    const consumers = Array.from(geoConsumers.entries()).map(([tabId, info]) => ({
      tabId, ...info
    }));
    sendResponse({ consumers });
  }

  return true;
});

// ──────────────────────────────────────────────
// Startup
// ──────────────────────────────────────────────
chrome.storage.local.get(['spoofEnabled'], (data) => {
  updateBadge(data.spoofEnabled || false);
});

// Ensure alarm exists on startup (service worker can restart)
chrome.alarms.get(UPDATE_CHECK_ALARM, (alarm) => {
  if (!alarm) {
    chrome.alarms.create(UPDATE_CHECK_ALARM, {
      delayInMinutes: 5,
      periodInMinutes: 360
    });
  }
});

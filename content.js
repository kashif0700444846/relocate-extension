// [Relocate] [content.js] - Content Script (ISOLATED world)
// STRATEGY:
//   1. Immediately set defaults on DOM attribute (synchronous)
//   2. Immediately inject inject.js — it reads DOM attr synchronously
//   3. After inject.js loads, dispatch real storage values via CustomEvent

'use strict';

const STATE_ATTR = 'data-relocate-spoof';

// Step 1 — Set defaults immediately
document.documentElement.setAttribute(STATE_ATTR, JSON.stringify({
    spoofEnabled: false,
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 10
}));

// Step 2 — Inject into the page's MAIN WORLD
let injected = false;

function injectScript() {
    if (injected) return;
    injected = true;

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');

    script.onload = () => {
        script.remove();
        syncStateFromStorage();
    };

    (document.head || document.documentElement).appendChild(script);
}

// Step 3 — Read real stored values and notify inject.js
function syncStateFromStorage() {
    chrome.storage.local.get(
        ['spoofEnabled', 'latitude', 'longitude', 'accuracy'],
        (data) => {
            document.documentElement.setAttribute(STATE_ATTR, JSON.stringify({
                spoofEnabled: data.spoofEnabled || false,
                latitude: data.latitude || 48.8566,
                longitude: data.longitude || 2.3522,
                accuracy: data.accuracy || 10
            }));

            window.dispatchEvent(
                new CustomEvent('__relocateSync', {
                    detail: {
                        spoofEnabled: data.spoofEnabled || false,
                        latitude: data.latitude || 48.8566,
                        longitude: data.longitude || 2.3522,
                        accuracy: data.accuracy || 10
                    }
                })
            );
        }
    );
}

// Boot
injectScript();

// Listen for live state changes from popup → background → here
chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'STATE_CHANGED') return;

    const state = {
        spoofEnabled: message.spoofEnabled || false,
        latitude: message.latitude || 48.8566,
        longitude: message.longitude || 2.3522,
        accuracy: message.accuracy || 10
    };

    document.documentElement.setAttribute(STATE_ATTR, JSON.stringify(state));

    window.dispatchEvent(
        new CustomEvent('__relocateSync', { detail: state })
    );

    // Report to background that this tab is consuming the spoofed location
    if (state.spoofEnabled) {
        try {
            chrome.runtime.sendMessage({
                type: 'GEO_CONSUMER_REPORT',
                url: window.location.href,
                title: document.title || window.location.hostname
            });
        } catch (e) { /* extension context invalidated */ }
    }
});

// Also report on initial load if spoof is active
chrome.storage.local.get(['spoofEnabled'], (data) => {
    if (data.spoofEnabled) {
        try {
            chrome.runtime.sendMessage({
                type: 'GEO_CONSUMER_REPORT',
                url: window.location.href,
                title: document.title || window.location.hostname
            });
        } catch (e) { /* extension context invalidated */ }
    }
});

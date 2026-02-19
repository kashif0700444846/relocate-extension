// [Relocate] [debug.js] - Debug Console Logic
// External script — MV3 CSP blocks inline scripts.

'use strict';

const logArea = document.getElementById('logArea');

function ts() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function log(msg, type) {
    type = type || 'info';
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = '<span class="log-time">' + ts() + '</span><span class="log-' + type + '">' + msg + '</span>';
    logArea.prepend(entry);
}

function setVal(id, text, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (cls) el.className = 'stat-value ' + cls;
}

function setTest(id, ok, val) {
    const iconEl = document.getElementById(id);
    const valEl = document.getElementById(id + '-val');
    if (iconEl) iconEl.textContent = ok ? '✅' : '❌';
    if (valEl) {
        valEl.textContent = val;
        valEl.className = 'test-val ' + (ok ? 'green' : 'red');
    }
}

function refresh() {
    log('Refreshing status...', 'info');

    chrome.storage.local.get(
        ['spoofEnabled', 'latitude', 'longitude', 'accuracy', 'presetName'],
        function (data) {
            var e = data.spoofEnabled || false;

            setVal('s-enabled', e ? 'YES' : 'NO', e ? 'green' : 'red');
            setVal('s-lat', data.latitude != null ? data.latitude : '—');
            setVal('s-lng', data.longitude != null ? data.longitude : '—');
            setVal('s-acc', (data.accuracy != null ? data.accuracy : '—') + 'm');
            setVal('s-preset', data.presetName || 'Custom');

            var badge = document.getElementById('globalBadge');
            if (badge) {
                badge.textContent = e ? 'SPOOF ON' : 'SPOOF OFF';
                badge.className = 'badge ' + (e ? 'badge-on' : 'badge-off');
            }

            setTest('x-storage', true, 'chrome.storage.local accessible ✓');
            log('[Storage] spoofEnabled=' + e + ' lat=' + data.latitude + ' lng=' + data.longitude, 'ok');

            runGeoTest(data);
        }
    );

    var hasGeo = !!navigator.geolocation;
    setTest('x-geo', hasGeo, hasGeo ? 'navigator.geolocation present' : 'MISSING!');

    window.dispatchEvent(new CustomEvent('__relocateSync', {
        detail: { spoofEnabled: false, latitude: 0, longitude: 0, accuracy: 10 }
    }));
    setTest('x-inject', true, 'inject.js event channel reachable');
    log('[inject.js] CustomEvent dispatched OK', 'ok');
}

function runGeoTest(stored) {
    if (!navigator.geolocation) {
        setVal('t-api', 'NOT AVAILABLE', 'red');
        return;
    }
    setVal('t-api', 'YES', 'green');

    var start = Date.now();
    log('[GeoAPI] Calling navigator.geolocation.getCurrentPosition()...', 'info');

    navigator.geolocation.getCurrentPosition(
        function (pos) {
            var elapsed = Date.now() - start;
            var lat = pos.coords.latitude.toFixed(6);
            var lng = pos.coords.longitude.toFixed(6);

            setVal('t-lat', lat);
            setVal('t-lng', lng);
            setVal('t-time', elapsed + 'ms');

            if (stored.spoofEnabled) {
                var expLat = parseFloat(stored.latitude).toFixed(4);
                var gotLat = parseFloat(lat).toFixed(4);
                var matched = expLat === gotLat;
                setVal('t-match', matched ? 'YES ✅' : 'NO ❌ (got ' + gotLat + ', expected ' + expLat + ')', matched ? 'green' : 'red');
                setTest('x-override', matched, matched ? 'Spoof confirmed ✓' : 'Mismatch — is inject.js loaded?');
                log('[GeoAPI] lat=' + lat + ' lng=' + lng + (matched ? ' SPOOF WORKING ✅' : ' MISMATCH ❌'), matched ? 'ok' : 'err');
            } else {
                setVal('t-match', 'Spoof OFF — real GPS', 'yellow');
                setTest('x-override', true, 'Spoof OFF — real GPS returned');
                log('[GeoAPI] lat=' + lat + ' lng=' + lng + ' (real GPS, spoof OFF)', 'warn');
            }
        },
        function (err) {
            if (err.code === 1) {
                log('[GeoAPI] PERMISSION DENIED — Extension pages cannot access real GPS. This is expected.', 'warn');
                setVal('t-lat', 'Permission denied (expected on extension page)', 'yellow');
                setVal('t-lng', '—');
                setVal('t-time', '—');
                setVal('t-match', 'N/A — test from a real webpage instead', 'yellow');
                setTest('x-override', true, 'Cannot test on extension page — use Google Maps test');
            } else {
                log('[GeoAPI] ERROR ' + err.code + ': ' + err.message, 'err');
                setVal('t-lat', 'Error: ' + err.message, 'red');
            }
        },
        { timeout: 8000, maximumAge: 0, enableHighAccuracy: false }
    );
}

function testGoogleMaps() {
    log('[Action] Opening Google Maps...', 'info');
    chrome.tabs.create({ url: 'https://www.google.com/maps' });
}

function resetSpoof() {
    chrome.storage.local.set({ spoofEnabled: false }, function () {
        // CRITICAL: Notify background.js to update the toolbar badge
        chrome.runtime.sendMessage({ type: 'STATE_CHANGED', spoofEnabled: false }, function () {
            log('[Action] Spoof DISABLED via debug page — badge updated', 'warn');
            refresh();
        });
    });
}

document.getElementById('btnRefresh').addEventListener('click', refresh);
document.getElementById('btnMaps').addEventListener('click', testGoogleMaps);
document.getElementById('btnReset').addEventListener('click', resetSpoof);

// Nav bar
document.getElementById('navSettings').addEventListener('click', function () {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
});
document.getElementById('navExtensions').addEventListener('click', function () {
    chrome.tabs.create({ url: 'chrome://extensions' });
});

log('[Debug] Relocate Debug Console loaded. Running self-tests...', 'info');
refresh();

// ──────────────────────────────────────────────
// LIVE REFRESH: auto-update when state changes from popup or background
// ──────────────────────────────────────────────
chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    // Only refresh for relevant keys
    var watchKeys = ['spoofEnabled', 'latitude', 'longitude', 'accuracy', 'presetName'];
    var shouldRefresh = Object.keys(changes).some(function (key) {
        return watchKeys.indexOf(key) !== -1;
    });
    if (shouldRefresh) {
        log('[LiveSync] State changed externally — refreshing...', 'info');
        refresh();
    }
});

// ──────────────────────────────────────────────
// LOCATION CONSUMERS — shows which sites use spoofed location
// ──────────────────────────────────────────────
var consumersArea = document.getElementById('consumersArea');

function pollConsumers() {
    chrome.runtime.sendMessage({ type: 'GET_GEO_CONSUMERS' }, function (response) {
        if (!response || !response.consumers) {
            consumersArea.innerHTML = '<div style="padding:10px;color:var(--muted);font-size:12px;text-align:center">No data available</div>';
            return;
        }

        var list = response.consumers;
        if (list.length === 0) {
            consumersArea.innerHTML = '<div style="padding:10px;color:var(--muted);font-size:12px;text-align:center">No sites are currently using your spoofed location</div>';
            return;
        }

        var html = '';
        list.forEach(function (c) {
            var ago = Math.round((Date.now() - c.lastSeen) / 1000);
            var agoText = ago < 60 ? ago + 's ago' : Math.round(ago / 60) + 'm ago';
            var domain = '—';
            try { domain = new URL(c.url).hostname; } catch (_e) { domain = c.url; }

            html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05)">';
            html += '<span style="font-size:18px">🌐</span>';
            html += '<div style="flex:1;min-width:0">';
            html += '<div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (c.title || domain) + '</div>';
            html += '<div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + domain + '</div>';
            html += '</div>';
            html += '<div style="font-size:11px;color:var(--green);flex-shrink:0">' + agoText + '</div>';
            html += '</div>';
        });

        consumersArea.innerHTML = html;
    });
}

// Poll every 5 seconds
pollConsumers();
setInterval(pollConsumers, 5000);

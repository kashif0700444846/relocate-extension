// [Relocate] [popup.js] - Popup Logic
// Features: Leaflet map, live autocomplete search, theme toggle, badge sync,
//           update notifications, and rating prompt banner.

'use strict';

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────
const spoofToggle = document.getElementById('spoofToggle');
const statusBar = document.getElementById('statusBar');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const latInput = document.getElementById('latInput');
const lngInput = document.getElementById('lngInput');
const accuracySlider = document.getElementById('accuracySlider');
const accuracyValue = document.getElementById('accuracyValue');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const applyBtn = document.getElementById('applyBtn');
const resetBtn = document.getElementById('resetBtn');
const presetBtns = document.querySelectorAll('.preset-btn');
const themeBtn = document.getElementById('themeBtn');
const autocompleteList = document.getElementById('autocompleteList');

// Banner DOM refs
const updateBanner = document.getElementById('updateBanner');
const updateVersionText = document.getElementById('updateVersionText');
const updateDownloadBtn = document.getElementById('updateDownloadBtn');
const updateDismissBtn = document.getElementById('updateDismissBtn');
const ratingBanner = document.getElementById('ratingBanner');
const ratingStarBtn = document.getElementById('ratingStarBtn');
const ratingDismissBtn = document.getElementById('ratingDismissBtn');

// Recent Locations DOM refs
const recentSection = document.getElementById('recentSection');
const recentList = document.getElementById('recentList');
const clearRecentBtn = document.getElementById('clearRecentBtn');

// Section refs for display toggles
const coordsSection = document.getElementById('coordsSection');
const presetsSection = document.getElementById('presetsSection');
const customPresetsContainer = document.getElementById('customPresetsGrid');

// ──────────────────────────────────────────────
// Theme (dark / light)
// ──────────────────────────────────────────────
let currentTheme = 'dark';

function applyTheme(theme) {
    currentTheme = theme;
    if (theme === 'light') {
        document.body.classList.add('light');
        themeBtn.textContent = '☀️';
        themeBtn.title = 'Switch to dark mode';
    } else {
        document.body.classList.remove('light');
        themeBtn.textContent = '🌙';
        themeBtn.title = 'Switch to light mode';
    }
}

themeBtn.addEventListener('click', () => {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    chrome.storage.local.set({ theme: next });
});

// ──────────────────────────────────────────────
// Leaflet Map
// ──────────────────────────────────────────────
let map, marker;

function initMap(lat, lng) {
    if (map) {
        map.setView([lat, lng], 13);
        if (marker) marker.setLatLng([lat, lng]);
        return;
    }

    map = L.map('map', { zoomControl: true }).setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19
    }).addTo(map);

    // Custom yellow marker
    const markerIcon = L.divIcon({
        html: `<div style="
          background: linear-gradient(135deg, #f59e0b, #fb923c);
          width: 22px; height: 22px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid rgba(255,255,255,0.7);
          box-shadow: 0 0 14px rgba(245,158,11,0.7);
        "></div>`,
        iconSize: [22, 22],
        className: ''
    });

    marker = L.marker([lat, lng], { draggable: true, icon: markerIcon }).addTo(map);

    marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        setCoords(pos.lat, pos.lng);
    });

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setCoords(lat, lng);
        clearPresets();
    });
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function setCoords(lat, lng) {
    latInput.value = parseFloat(lat).toFixed(6);
    lngInput.value = parseFloat(lng).toFixed(6);
}

function clearPresets() {
    presetBtns.forEach(b => b.classList.remove('active'));
}

function showToast(msg, color) {
    let toast = document.getElementById('rel-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'rel-toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    if (color) toast.style.background = color;
    else toast.style.background = '';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function updateStatusUI(enabled, presetName) {
    if (enabled) {
        spoofToggle.checked = true;
        statusBar.classList.add('active');
        statusDot.classList.add('active');
        statusText.textContent = 'Spoofing ON — ' + (presetName || 'Custom Location');
    } else {
        spoofToggle.checked = false;
        statusBar.classList.remove('active');
        statusDot.classList.remove('active');
        statusText.textContent = 'Spoofing OFF — Using real location';
    }
}

function notifyTabs(state) {
    chrome.runtime.sendMessage({ type: 'STATE_CHANGED', ...state });
}

// ──────────────────────────────────────────────
// REVERSE GEOCODE (for map-clicked coords)
// ──────────────────────────────────────────────
async function reverseGeocode(lat, lng) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`;
        const res = await fetch(url, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'RelocateExtension/1.2' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.display_name) return null;
        // Return short name: first 2 comma-separated parts
        const parts = data.display_name.split(', ');
        return parts.slice(0, 2).join(', ');
    } catch (err) {
        console.warn('[Relocate] [ReverseGeocode] [WARN]', err.message);
        return null;
    }
}

// ──────────────────────────────────────────────
// LIVE AUTOCOMPLETE SEARCH
// ──────────────────────────────────────────────
let acDebounceTimer = null;
let acResults = [];
let acHighlighted = -1;

function openAcList(items) {
    autocompleteList.innerHTML = '';
    acResults = items;
    acHighlighted = -1;

    if (!items.length) {
        autocompleteList.innerHTML = '<div class="autocomplete-loading">No results found</div>';
        autocompleteList.classList.add('open');
        return;
    }

    items.forEach((item, idx) => {
        const parts = item.display_name.split(', ');
        const main = parts[0];
        const sub = parts.slice(1, 3).join(', ');

        const el = document.createElement('div');
        el.className = 'autocomplete-item';
        el.innerHTML = `
          <span class="autocomplete-icon">📍</span>
          <div>
            <div class="autocomplete-main">${main}</div>
            <div class="autocomplete-sub">${sub}</div>
          </div>`;

        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectAcItem(idx);
        });

        autocompleteList.appendChild(el);
    });

    autocompleteList.classList.add('open');
}

function closeAcList() {
    autocompleteList.classList.remove('open');
    acResults = [];
    acHighlighted = -1;
}

function selectAcItem(idx) {
    const item = acResults[idx];
    if (!item) return;

    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const parts = item.display_name.split(', ');

    setCoords(lat, lng);
    if (map && marker) {
        map.setView([lat, lng], 14);
        marker.setLatLng([lat, lng]);
    }

    searchInput.value = parts[0];
    clearPresets();
    closeAcList();
    showToast(`📍 ${parts[0]}`);
}

async function fetchSuggestions(query) {
    if (!query || query.length < 2) { closeAcList(); return; }

    autocompleteList.innerHTML = '<div class="autocomplete-loading">🔍 Searching...</div>';
    autocompleteList.classList.add('open');

    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=0`;
        const res = await fetch(url, {
            headers: {
                'Accept-Language': 'en',
                'User-Agent': 'RelocateExtension/1.1'
            }
        });
        const data = await res.json();
        openAcList(data);
    } catch (err) {
        console.error('[Relocate] [Autocomplete] [ERROR]', err.message);
        closeAcList();
    }
}

searchInput.addEventListener('input', () => {
    clearTimeout(acDebounceTimer);
    const q = searchInput.value.trim();
    if (!q) { closeAcList(); return; }
    acDebounceTimer = setTimeout(() => fetchSuggestions(q), 350);
});

searchInput.addEventListener('keydown', (e) => {
    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        acHighlighted = Math.min(acHighlighted + 1, items.length - 1);
        items.forEach((el, i) => el.classList.toggle('highlighted', i === acHighlighted));
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        acHighlighted = Math.max(acHighlighted - 1, -1);
        items.forEach((el, i) => el.classList.toggle('highlighted', i === acHighlighted));
    } else if (e.key === 'Enter') {
        if (acHighlighted >= 0) {
            e.preventDefault();
            selectAcItem(acHighlighted);
        } else {
            if (acResults.length > 0) selectAcItem(0);
        }
    } else if (e.key === 'Escape') {
        closeAcList();
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-row')) closeAcList();
});

searchBtn.addEventListener('click', () => {
    if (acResults.length > 0) {
        selectAcItem(0);
    } else {
        fetchSuggestions(searchInput.value.trim()).then(() => {
            if (acResults.length > 0) selectAcItem(0);
        });
    }
});

// ──────────────────────────────────────────────
// Load State & Initialize
// ──────────────────────────────────────────────
chrome.storage.local.get(
    ['spoofEnabled', 'latitude', 'longitude', 'accuracy', 'presetName', 'theme',
        'useCount', 'ratingDismissed', 'updateAvailable', 'recentLocations',
        'showCoords', 'showPresets', 'showRecent', 'customPresets', 'routeActive'],
    (data) => {
        const {
            spoofEnabled = false,
            latitude = 48.8566,
            longitude = 2.3522,
            accuracy = 10,
            presetName = '',
            theme = 'dark',
            useCount = 0,
            ratingDismissed = false,
            updateAvailable = null,
            recentLocations = [],
            showCoords = true,
            showPresets = true,
            showRecent = true,
            customPresets = [],
            routeActive = false
        } = data;

        applyTheme(theme);
        latInput.value = latitude;
        lngInput.value = longitude;
        accuracySlider.value = accuracy;
        accuracyValue.textContent = accuracy;
        updateStatusUI(spoofEnabled, presetName);

        setTimeout(() => initMap(latitude, longitude), 100);

        // ── Display Settings ──
        applyDisplaySettings(showCoords, showPresets, showRecent);

        // ── Custom Presets ──
        renderCustomPresetsInPopup(customPresets);

        // ── Update Banner Logic ──
        showUpdateBanner(updateAvailable);

        // ── Rating Banner Logic ──
        const newCount = useCount + 1;
        chrome.storage.local.set({ useCount: newCount });

        // Show rating banner after 5+ uses, if not dismissed
        if (newCount >= 5 && !ratingDismissed) {
            showRatingBanner();
        }

        // ── Recent Locations ──
        renderRecentLocations(recentLocations);
    }
);

// ──────────────────────────────────────────────
// UPDATE BANNER
// ──────────────────────────────────────────────
function showUpdateBanner(updateInfo) {
    if (!updateInfo || !updateInfo.version) {
        if (updateBanner) updateBanner.style.display = 'none';
        return;
    }

    updateVersionText.textContent = updateInfo.name || ('v' + updateInfo.version);

    if (updateInfo.downloadUrl) {
        updateDownloadBtn.href = updateInfo.downloadUrl;
        updateDownloadBtn.textContent = '⬇️ Download';
    } else if (updateInfo.url) {
        updateDownloadBtn.href = updateInfo.url;
        updateDownloadBtn.textContent = 'View';
    }

    updateBanner.style.display = 'flex';
}

updateDismissBtn.addEventListener('click', () => {
    updateBanner.style.display = 'none';
    chrome.storage.local.set({ updateAvailable: null });
});

// ──────────────────────────────────────────────
// RATING BANNER
// ──────────────────────────────────────────────
function showRatingBanner() {
    ratingBanner.style.display = 'flex';
}

ratingDismissBtn.addEventListener('click', () => {
    ratingBanner.style.display = 'none';
    // Dismiss for 20 more uses before showing again
    chrome.storage.local.set({ ratingDismissed: true, useCount: 0 });
});

ratingStarBtn.addEventListener('click', () => {
    // User clicked star — dismiss permanently
    chrome.storage.local.set({ ratingDismissed: true });
    ratingBanner.style.display = 'none';
});

// ──────────────────────────────────────────────
// RECENT LOCATIONS
// ──────────────────────────────────────────────
const MAX_RECENT = 8;

function renderRecentLocations(locations) {
    if (!recentList || !recentSection) return;

    if (!Array.isArray(locations) || locations.length === 0) {
        recentSection.style.display = 'none';
        return;
    }

    recentSection.style.display = 'block';
    recentList.innerHTML = '';

    locations.forEach((loc, idx) => {
        const el = document.createElement('div');
        el.className = 'recent-item';
        el.innerHTML = `
          <span class="recent-icon">📍</span>
          <div class="recent-info">
            <div class="recent-name">${loc.name || 'Unknown'}</div>
            <div class="recent-coords">${parseFloat(loc.lat).toFixed(4)}, ${parseFloat(loc.lng).toFixed(4)}</div>
          </div>
          <button class="recent-remove" title="Remove" data-idx="${idx}">✕</button>`;

        // Click item → set location
        el.addEventListener('click', (e) => {
            if (e.target.closest('.recent-remove')) return; // don't trigger on remove btn
            setCoords(loc.lat, loc.lng);
            if (map && marker) {
                map.setView([loc.lat, loc.lng], 13);
                marker.setLatLng([loc.lat, loc.lng]);
            }
            clearPresets();
            showToast('📍 ' + (loc.name || 'Recent location'));
        });

        // Remove button
        el.querySelector('.recent-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeRecentLocation(idx);
        });

        recentList.appendChild(el);
    });
}

function addToRecentLocations(entry) {
    chrome.storage.local.get(['recentLocations'], (data) => {
        let locations = Array.isArray(data.recentLocations) ? data.recentLocations : [];

        // Deduplicate: remove existing entry with same lat/lng (rounded to 4 decimals)
        const newKey = parseFloat(entry.lat).toFixed(4) + ',' + parseFloat(entry.lng).toFixed(4);
        locations = locations.filter((loc) => {
            const key = parseFloat(loc.lat).toFixed(4) + ',' + parseFloat(loc.lng).toFixed(4);
            return key !== newKey;
        });

        // Add to front
        locations.unshift({
            lat: entry.lat,
            lng: entry.lng,
            name: entry.name || (entry.lat.toFixed(4) + ', ' + entry.lng.toFixed(4)),
            ts: Date.now()
        });

        // Cap at MAX_RECENT
        if (locations.length > MAX_RECENT) {
            locations = locations.slice(0, MAX_RECENT);
        }

        chrome.storage.local.set({ recentLocations: locations }, () => {
            renderRecentLocations(locations);
        });
    });
}

function removeRecentLocation(idx) {
    chrome.storage.local.get(['recentLocations'], (data) => {
        let locations = Array.isArray(data.recentLocations) ? data.recentLocations : [];
        locations.splice(idx, 1);
        chrome.storage.local.set({ recentLocations: locations }, () => {
            renderRecentLocations(locations);
        });
    });
}

clearRecentBtn.addEventListener('click', () => {
    chrome.storage.local.set({ recentLocations: [] }, () => {
        renderRecentLocations([]);
        showToast('🗑️ Recent locations cleared');
    });
});

// ──────────────────────────────────────────────
// Event Listeners
// ──────────────────────────────────────────────

spoofToggle.addEventListener('change', () => {
    const enabled = spoofToggle.checked;
    chrome.storage.local.get(['latitude', 'longitude', 'accuracy', 'presetName'], (data) => {
        const newState = { spoofEnabled: enabled, ...data };
        chrome.storage.local.set(newState, () => {
            updateStatusUI(enabled, data.presetName);
            notifyTabs(newState);
            showToast(enabled ? '📍 Spoofing Enabled!' : '🔴 Spoofing Off');
        });
    });
});

accuracySlider.addEventListener('input', () => {
    accuracyValue.textContent = accuracySlider.value;
});

function syncMapToInputs() {
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    if (!isNaN(lat) && !isNaN(lng) && map && marker) {
        marker.setLatLng([lat, lng]);
        map.setView([lat, lng], 13);
    }
}
latInput.addEventListener('change', syncMapToInputs);
lngInput.addEventListener('change', syncMapToInputs);

presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        const name = btn.dataset.name;
        setCoords(lat, lng);
        if (map && marker) {
            map.setView([lat, lng], 12);
            marker.setLatLng([lat, lng]);
        }
        clearPresets();
        btn.classList.add('active');
        showToast('📍 Moved to ' + name);
    });
});

applyBtn.addEventListener('click', () => {
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    const accuracy = parseInt(accuracySlider.value, 10);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        showToast('❌ Invalid coordinates!', '#ef4444');
        return;
    }

    const activePreset = document.querySelector('.preset-btn.active');
    // Name priority: preset name > search input > reverse geocode
    const searchName = searchInput.value.trim();
    const presetName = activePreset
        ? activePreset.dataset.name
        : (searchName || lat.toFixed(4) + ', ' + lng.toFixed(4));

    const newState = { spoofEnabled: true, latitude: lat, longitude: lng, accuracy, presetName };
    chrome.storage.local.set(newState, () => {
        spoofToggle.checked = true;
        updateStatusUI(true, presetName);
        notifyTabs(newState);
        showToast('📍 Location set to ' + presetName);

        // Save to recent locations — if name is just coords, reverse geocode it
        const isJustCoords = !activePreset && !searchName;
        if (isJustCoords) {
            reverseGeocode(lat, lng).then((address) => {
                addToRecentLocations({ lat, lng, name: address || presetName });
            });
        } else {
            addToRecentLocations({ lat, lng, name: presetName });
        }
    });
});

resetBtn.addEventListener('click', () => {
    const newState = { spoofEnabled: false };
    chrome.storage.local.set(newState, () => {
        spoofToggle.checked = false;
        updateStatusUI(false, '');
        notifyTabs(newState);
        clearPresets();
        showToast('🔄 Real GPS location restored', '#22c55e');
    });
});

document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
});

document.getElementById('debugLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('debug.html') });
});

document.getElementById('mapsTestLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://www.google.com/maps' });
});

// ──────────────────────────────────────────────
// DISPLAY SETTINGS
// ──────────────────────────────────────────────
function applyDisplaySettings(showCoords, showPresets, showRecent) {
    if (coordsSection) coordsSection.style.display = showCoords !== false ? '' : 'none';
    if (presetsSection) presetsSection.style.display = showPresets !== false ? '' : 'none';
    if (recentSection && showRecent === false) recentSection.style.display = 'none';
}

function renderCustomPresetsInPopup(presets) {
    if (!customPresetsContainer || !Array.isArray(presets) || presets.length === 0) return;
    customPresetsContainer.innerHTML = '';
    presets.forEach((p) => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        btn.dataset.lat = p.lat;
        btn.dataset.lng = p.lng;
        btn.dataset.name = p.name;
        btn.textContent = p.name;
        btn.addEventListener('click', () => {
            setCoords(p.lat, p.lng);
            if (map && marker) {
                map.setView([p.lat, p.lng], 13);
                marker.setLatLng([p.lat, p.lng]);
            }
            clearPresets();
            btn.classList.add('active');
            showToast('📍 Moved to ' + p.name);
        });
        customPresetsContainer.appendChild(btn);
    });
}

// ──────────────────────────────────────────────
// REACTIVE SETTINGS SYNC (from Settings page)
// ──────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.showCoords || changes.showPresets || changes.showRecent) {
        applyDisplaySettings(
            changes.showCoords ? changes.showCoords.newValue : undefined,
            changes.showPresets ? changes.showPresets.newValue : undefined,
            changes.showRecent ? changes.showRecent.newValue : undefined
        );
    }
    if (changes.customPresets) {
        renderCustomPresetsInPopup(changes.customPresets.newValue || []);
    }
});

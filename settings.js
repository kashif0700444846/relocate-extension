// [Relocate] [settings.js] - Settings Page Logic
// Features: Display toggles, unified presets manager with address search + map click,
//           route simulation engine with multi-waypoint, autocomplete,
//           forward/backward/loop direction.

'use strict';

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────

// Display toggles
const toggleCoords = document.getElementById('toggleCoords');
const togglePresets = document.getElementById('togglePresets');
const toggleRecent = document.getElementById('toggleRecent');

// Presets manager
const presetsTable = document.getElementById('presetsTable');
const presetsBody = document.getElementById('presetsBody');
const presetsEmpty = document.getElementById('presetsEmpty');
const addPresetBtn = document.getElementById('addPresetBtn');
const presetNameInput = document.getElementById('presetNameInput');
const presetLatInput = document.getElementById('presetLatInput');
const presetLngInput = document.getElementById('presetLngInput');
const presetSearchInput = document.getElementById('presetSearchInput');
const presetAcDropdown = document.getElementById('presetAcDropdown');

// Route simulation
const routeWaypointsContainer = document.getElementById('routeWaypoints');
const addWaypointBtn = document.getElementById('addWaypointBtn');
const modeBtns = document.querySelectorAll('.mode-btn');
const dirBtns = document.querySelectorAll('.dir-btn');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const routeStartBtn = document.getElementById('routeStartBtn');
const routePauseBtn = document.getElementById('routePauseBtn');
const routeStopBtn = document.getElementById('routeStopBtn');
const routeProgressBar = document.getElementById('routeProgressBar');
const routeStatusText = document.getElementById('routeStatusText');
const routeProgressPct = document.getElementById('routeProgressPct');

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
let presetMap = null;
let presetMapMarker = null;
let routeMap = null;
let routeLayerGroup = null;
let routePolyline = null;
let routeMovingMarker = null;

let waypoints = [
    { lat: null, lng: null, name: '', inputId: 'wp_0' },
    { lat: null, lng: null, name: '', inputId: 'wp_1' }
];
let wpCounter = 2;

let routePoints = [];
let routeMode = 'driving';
let routeDirection = 'forward';
let routeSpeedKmh = 50;
let routeIndex = 0;
let routeInterval = null;
let routePaused = false;
let routeGoingForward = true;

let acDebounceTimers = {};

// ──────────────────────────────────────────────
// DISPLAY PREFERENCES
// ──────────────────────────────────────────────
function loadDisplaySettings() {
    chrome.storage.local.get(['showCoords', 'showPresets', 'showRecent'], (data) => {
        toggleCoords.checked = data.showCoords !== false;
        togglePresets.checked = data.showPresets !== false;
        toggleRecent.checked = data.showRecent !== false;
    });
}

function saveDisplaySetting(key, value) {
    const obj = {};
    obj[key] = value;
    chrome.storage.local.set(obj);
}

toggleCoords.addEventListener('change', () => saveDisplaySetting('showCoords', toggleCoords.checked));
togglePresets.addEventListener('change', () => saveDisplaySetting('showPresets', togglePresets.checked));
toggleRecent.addEventListener('change', () => saveDisplaySetting('showRecent', toggleRecent.checked));

// ──────────────────────────────────────────────
// NOMINATIM AUTOCOMPLETE HELPER
// ──────────────────────────────────────────────
async function nominatimSearch(query, limit) {
    if (!query || query.length < 2) return [];
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit || 5}&addressdetails=0`;
        const res = await fetch(url, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'RelocateExtension/1.5' }
        });
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data.map(d => ({
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
            name: d.display_name.split(', ').slice(0, 2).join(', '),
            full: d.display_name
        }));
    } catch (err) {
        console.error('[Settings] [Nominatim] [ERROR]', err.message);
        return [];
    }
}

function showAcDropdown(dropdown, results, onSelect) {
    dropdown.innerHTML = '';
    if (!results || results.length === 0) {
        dropdown.classList.remove('open');
        return;
    }
    results.forEach(r => {
        const item = document.createElement('div');
        item.className = 'ac-item';
        const parts = r.full.split(', ');
        item.innerHTML = `<span class="ac-item-main">${escapeHtml(parts[0])}</span><span class="ac-item-sub">${escapeHtml(parts.slice(1, 3).join(', '))}</span>`;
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            onSelect(r);
            dropdown.classList.remove('open');
        });
        dropdown.appendChild(item);
    });
    dropdown.classList.add('open');
}

function showAcLoading(dropdown) {
    dropdown.innerHTML = '<div class="ac-loading">Searching...</div>';
    dropdown.classList.add('open');
}

function setupAutocomplete(inputEl, dropdownEl, onSelect) {
    const timerId = inputEl.id || Math.random().toString();

    inputEl.addEventListener('input', () => {
        if (acDebounceTimers[timerId]) clearTimeout(acDebounceTimers[timerId]);
        const query = inputEl.value.trim();
        if (query.length < 2) {
            dropdownEl.classList.remove('open');
            return;
        }
        acDebounceTimers[timerId] = setTimeout(async () => {
            showAcLoading(dropdownEl);
            const results = await nominatimSearch(query, 5);
            showAcDropdown(dropdownEl, results, onSelect);
        }, 300);
    });

    inputEl.addEventListener('blur', () => {
        setTimeout(() => dropdownEl.classList.remove('open'), 200);
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dropdownEl.classList.remove('open');
    });
}

// ──────────────────────────────────────────────
// PRESETS MANAGER (unified: defaults + custom)
// ──────────────────────────────────────────────
function loadAllPresets() {
    chrome.storage.local.get(['allPresets'], (data) => {
        renderAllPresets(data.allPresets || []);
    });
}

function renderAllPresets(presets) {
    presetsBody.innerHTML = '';
    if (!presets || presets.length === 0) {
        presetsEmpty.style.display = 'block';
        presetsTable.style.display = 'none';
        return;
    }
    presetsEmpty.style.display = 'none';
    presetsTable.style.display = 'table';
    presets.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="preset-emoji">📌</td>
            <td>${escapeHtml(p.name)}</td>
            <td style="font-family:var(--mono);font-size:12px">${parseFloat(p.lat).toFixed(4)}</td>
            <td style="font-family:var(--mono);font-size:12px">${parseFloat(p.lng).toFixed(4)}</td>
            <td><button class="preset-del-btn" data-idx="${idx}">🗑️</button></td>`;
        tr.querySelector('.preset-del-btn').addEventListener('click', () => deletePreset(idx));
        presetsBody.appendChild(tr);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function deletePreset(idx) {
    chrome.storage.local.get(['allPresets'], (data) => {
        const presets = data.allPresets || [];
        presets.splice(idx, 1);
        chrome.storage.local.set({ allPresets: presets }, () => {
            renderAllPresets(presets);
        });
    });
}

// Preset address search — fills lat/lng/name
setupAutocomplete(presetSearchInput, presetAcDropdown, (result) => {
    presetNameInput.value = result.name;
    presetLatInput.value = result.lat.toFixed(6);
    presetLngInput.value = result.lng.toFixed(6);
    presetSearchInput.value = result.name;
    // Update preset map marker
    updatePresetMapMarker(result.lat, result.lng);
});

addPresetBtn.addEventListener('click', () => {
    const name = presetNameInput.value.trim();
    const lat = parseFloat(presetLatInput.value);
    const lng = parseFloat(presetLngInput.value);

    if (!name) { alert('Please enter a name.'); return; }
    if (isNaN(lat) || lat < -90 || lat > 90) { alert('Invalid latitude.'); return; }
    if (isNaN(lng) || lng < -180 || lng > 180) { alert('Invalid longitude.'); return; }

    chrome.storage.local.get(['allPresets'], (data) => {
        const presets = data.allPresets || [];
        presets.push({ name, lat, lng });
        chrome.storage.local.set({ allPresets: presets }, () => {
            renderAllPresets(presets);
            presetNameInput.value = '';
            presetLatInput.value = '';
            presetLngInput.value = '';
            presetSearchInput.value = '';
        });
    });
});

// ──────────────────────────────────────────────
// PRESET MAP (click to pick location)
// ──────────────────────────────────────────────
function initPresetMap() {
    presetMap = L.map('presetMap', { zoomControl: true }).setView([48.86, 2.35], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OSM', maxZoom: 19
    }).addTo(presetMap);

    presetMap.on('click', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        presetLatInput.value = lat.toFixed(6);
        presetLngInput.value = lng.toFixed(6);
        updatePresetMapMarker(lat, lng);

        // Reverse geocode to get a name suggestion
        reverseGeocode(lat, lng).then((name) => {
            if (name && !presetNameInput.value.trim()) {
                presetNameInput.value = name;
            }
            if (name) {
                presetSearchInput.value = name;
            }
        });
    });
}

function updatePresetMapMarker(lat, lng) {
    if (presetMapMarker) {
        presetMapMarker.setLatLng([lat, lng]);
    } else {
        presetMapMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: '<div style="background:#f59e0b;color:#000;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;border:3px solid #fff;box-shadow:0 0 10px rgba(245,158,11,0.5)">📌</div>',
                iconSize: [28, 28], className: ''
            })
        }).addTo(presetMap);
    }
    presetMap.setView([lat, lng], Math.max(presetMap.getZoom(), 10));
}

async function reverseGeocode(lat, lng) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14`;
        const res = await fetch(url, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'RelocateExtension/1.5' }
        });
        const data = await res.json();
        if (data && data.display_name) {
            return data.display_name.split(', ').slice(0, 2).join(', ');
        }
        return null;
    } catch (err) {
        console.error('[Settings] [ReverseGeo] [ERROR]', err.message);
        return null;
    }
}

// ──────────────────────────────────────────────
// ROUTE MAP
// ──────────────────────────────────────────────
function initRouteMap() {
    routeMap = L.map('routeMap', { zoomControl: true }).setView([59.33, 18.07], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OSM', maxZoom: 19
    }).addTo(routeMap);
    routeLayerGroup = L.layerGroup().addTo(routeMap);
}

function wpBadgeColor(idx, total) {
    if (idx === 0) return '#10b981';
    if (idx === total - 1) return '#ef4444';
    return '#3b82f6';
}

function wpBadgeLetter(idx) {
    return String.fromCharCode(65 + Math.min(idx, 25));
}

function updateRouteMap() {
    routeLayerGroup.clearLayers();
    const validWps = waypoints.filter(w => w.lat !== null && w.lng !== null);
    if (validWps.length === 0) return;

    validWps.forEach((wp, i) => {
        const color = wpBadgeColor(i, validWps.length);
        const letter = wpBadgeLetter(i);
        L.marker([wp.lat, wp.lng], {
            icon: L.divIcon({
                html: `<div style="background:${color};color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:2px solid #fff;box-shadow:0 0 8px ${color}80">${letter}</div>`,
                iconSize: [24, 24], className: ''
            })
        }).addTo(routeLayerGroup);
    });

    if (validWps.length >= 2) {
        const bounds = L.latLngBounds(validWps.map(w => [w.lat, w.lng]));
        routeMap.fitBounds(bounds.pad(0.15));
    } else {
        routeMap.setView([validWps[0].lat, validWps[0].lng], 13);
    }
}

// ──────────────────────────────────────────────
// DYNAMIC WAYPOINTS
// ──────────────────────────────────────────────
function renderWaypoints() {
    routeWaypointsContainer.innerHTML = '';

    waypoints.forEach((wp, idx) => {
        const letter = wpBadgeLetter(idx);
        const div = document.createElement('div');
        div.className = 'route-field';
        div.innerHTML = `
            <span class="point-badge">${letter}</span>
            <input type="text" id="${wp.inputId}" placeholder="🔍 Search location..." autocomplete="off" value="${escapeHtml(wp.name)}" />
            <div class="ac-dropdown" id="ac_${wp.inputId}"></div>
            ${waypoints.length > 2 ? `<button class="route-remove-btn" data-idx="${idx}">✕</button>` : ''}
        `;
        routeWaypointsContainer.appendChild(div);

        const inputEl = div.querySelector(`#${wp.inputId}`);
        const acEl = div.querySelector(`#ac_${wp.inputId}`);

        setupAutocomplete(inputEl, acEl, (result) => {
            waypoints[idx].lat = result.lat;
            waypoints[idx].lng = result.lng;
            waypoints[idx].name = result.name;
            inputEl.value = result.name;
            updateRouteMap();
            updateRouteStatus();
        });

        inputEl.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            const results = await nominatimSearch(inputEl.value.trim(), 1);
            if (results.length > 0) {
                waypoints[idx].lat = results[0].lat;
                waypoints[idx].lng = results[0].lng;
                waypoints[idx].name = results[0].name;
                inputEl.value = results[0].name;
                acEl.classList.remove('open');
                updateRouteMap();
                updateRouteStatus();
            }
        });

        const removeBtn = div.querySelector('.route-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                waypoints.splice(idx, 1);
                renderWaypoints();
                updateRouteMap();
                updateRouteStatus();
            });
        }
    });
}

addWaypointBtn.addEventListener('click', () => {
    waypoints.push({ lat: null, lng: null, name: '', inputId: 'wp_' + wpCounter++ });
    renderWaypoints();
});

// ──────────────────────────────────────────────
// MODE SELECTOR
// ──────────────────────────────────────────────
modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        routeMode = btn.dataset.mode;
        if (routeMode === 'driving') { speedSlider.value = 50; speedValue.textContent = '50 km/h'; routeSpeedKmh = 50; }
        else if (routeMode === 'walking') { speedSlider.value = 5; speedValue.textContent = '5 km/h'; routeSpeedKmh = 5; }
    });
});

speedSlider.addEventListener('input', () => {
    routeSpeedKmh = parseInt(speedSlider.value, 10);
    speedValue.textContent = routeSpeedKmh + ' km/h';
    if (routeMode !== 'custom') {
        modeBtns.forEach(b => b.classList.remove('active'));
        document.getElementById('modeCustom').classList.add('active');
        routeMode = 'custom';
    }
});

// ──────────────────────────────────────────────
// DIRECTION SELECTOR
// ──────────────────────────────────────────────
dirBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        dirBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        routeDirection = btn.dataset.dir;
    });
});

// ──────────────────────────────────────────────
// ROUTE FETCHING (OSRM) — Multi-waypoint
// ──────────────────────────────────────────────
async function fetchMultiRoute(wps, mode) {
    const osrmMode = (mode === 'walking') ? 'foot' : 'driving';
    const coords = wps.map(w => `${w.lng},${w.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/${osrmMode}/${coords}?overview=full&geometries=geojson`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('OSRM API returned ' + res.status);
        const data = await res.json();
        if (!data.routes || !data.routes.length) throw new Error('No route found');
        return data.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
    } catch (err) {
        console.error('[Settings] [OSRM] [ERROR]', err.message);
        return null;
    }
}

// ──────────────────────────────────────────────
// ROUTE SIMULATION ENGINE
// ──────────────────────────────────────────────
function getValidWaypoints() {
    return waypoints.filter(w => w.lat !== null && w.lng !== null);
}

function updateRouteStatus() {
    const valid = getValidWaypoints();
    if (valid.length < 2) {
        routeStatusText.textContent = 'Add at least 2 waypoints to begin';
        routeStartBtn.disabled = true;
    } else {
        routeStatusText.textContent = `Ready — ${valid.length} points set. Press Start.`;
        routeStartBtn.disabled = false;
    }
}

routeStartBtn.addEventListener('click', async () => {
    const valid = getValidWaypoints();
    if (valid.length < 2) return;

    if (routePaused && routePoints.length > 0) {
        routePaused = false;
        routeStartBtn.disabled = true;
        routePauseBtn.disabled = false;
        routeStopBtn.disabled = false;
        routeStatusText.textContent = 'Simulating...';
        startSimulationLoop();
        return;
    }

    let orderedWps = [...valid];
    if (routeDirection === 'backward') {
        orderedWps.reverse();
    }

    routeStatusText.textContent = 'Fetching route from OSRM...';
    routeStartBtn.disabled = true;

    const points = await fetchMultiRoute(orderedWps, routeMode);
    if (!points || points.length < 2) {
        routeStatusText.textContent = '❌ Could not find a route. Try different locations.';
        routeStartBtn.disabled = false;
        return;
    }

    routePoints = points;
    routeIndex = 0;
    routeGoingForward = true;

    if (routePolyline) routeLayerGroup.removeLayer(routePolyline);
    routePolyline = L.polyline(
        points.map(p => [p.lat, p.lng]),
        { color: '#f59e0b', weight: 4, opacity: 0.7 }
    ).addTo(routeLayerGroup);

    if (routeMovingMarker) routeLayerGroup.removeLayer(routeMovingMarker);
    routeMovingMarker = L.circleMarker([points[0].lat, points[0].lng], {
        radius: 7, fillColor: '#3b82f6', fillOpacity: 1, color: '#fff', weight: 2
    }).addTo(routeLayerGroup);

    routeMap.fitBounds(routePolyline.getBounds().pad(0.1));

    routePaused = false;
    routeStartBtn.disabled = true;
    routePauseBtn.disabled = false;
    routeStopBtn.disabled = false;
    routeStatusText.textContent = 'Simulating...';

    updateSpoofedPosition(points[0]);
    startSimulationLoop();
});

function startSimulationLoop() {
    const metersPerSecond = (routeSpeedKmh * 1000) / 3600;
    if (routeInterval) clearInterval(routeInterval);

    routeInterval = setInterval(() => {
        if (routeDirection === 'loop') {
            if (routeGoingForward) {
                if (routeIndex >= routePoints.length - 1) routeGoingForward = false;
            } else {
                if (routeIndex <= 0) routeGoingForward = true;
            }
        } else {
            if (routeIndex >= routePoints.length - 1) {
                stopSimulation(true);
                return;
            }
        }

        let distToTravel = metersPerSecond;
        const step = routeGoingForward ? 1 : -1;

        while (distToTravel > 0) {
            const nextIdx = routeIndex + step;
            if (nextIdx < 0 || nextIdx >= routePoints.length) break;

            const current = routePoints[routeIndex];
            const next = routePoints[nextIdx];
            const segDist = haversineMeters(current.lat, current.lng, next.lat, next.lng);

            if (segDist <= distToTravel) {
                distToTravel -= segDist;
                routeIndex = nextIdx;
            } else {
                const fraction = distToTravel / segDist;
                const interpLat = current.lat + (next.lat - current.lat) * fraction;
                const interpLng = current.lng + (next.lng - current.lng) * fraction;
                routePoints[routeIndex] = { lat: interpLat, lng: interpLng };
                distToTravel = 0;
            }
        }

        const pos = routePoints[routeIndex];
        updateSpoofedPosition(pos);

        if (routeMovingMarker) routeMovingMarker.setLatLng([pos.lat, pos.lng]);

        const pct = Math.round((routeIndex / (routePoints.length - 1)) * 100);
        routeProgressBar.style.width = pct + '%';
        routeProgressPct.textContent = pct + '%';
    }, 1000);
}

function updateSpoofedPosition(pos) {
    const newState = {
        spoofEnabled: true,
        latitude: pos.lat,
        longitude: pos.lng,
        accuracy: 10,
        presetName: '🛣️ Route Simulation'
    };
    chrome.storage.local.set(newState);
    chrome.runtime.sendMessage({ type: 'STATE_CHANGED', ...newState });
}

routePauseBtn.addEventListener('click', () => {
    if (routeInterval) { clearInterval(routeInterval); routeInterval = null; }
    routePaused = true;
    routeStartBtn.disabled = false;
    routePauseBtn.disabled = true;
    routeStartBtn.textContent = '▶️ Resume';
    routeStatusText.textContent = 'Paused';
});

routeStopBtn.addEventListener('click', () => { stopSimulation(false); });

function stopSimulation(completed) {
    if (routeInterval) { clearInterval(routeInterval); routeInterval = null; }
    routePaused = false;
    routePoints = [];
    routeIndex = 0;
    routeStartBtn.disabled = false;
    routePauseBtn.disabled = true;
    routeStopBtn.disabled = true;
    routeStartBtn.textContent = '▶️ Start';

    if (completed) {
        routeStatusText.textContent = '✅ Route complete!';
        routeProgressBar.style.width = '100%';
        routeProgressPct.textContent = '100%';
    } else {
        routeStatusText.textContent = 'Stopped';
        routeProgressBar.style.width = '0%';
        routeProgressPct.textContent = '0%';
        if (routePolyline) { routeLayerGroup.removeLayer(routePolyline); routePolyline = null; }
        if (routeMovingMarker) { routeLayerGroup.removeLayer(routeMovingMarker); routeMovingMarker = null; }
    }
}

// ──────────────────────────────────────────────
// HAVERSINE DISTANCE
// ──────────────────────────────────────────────
function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ──────────────────────────────────────────────
// CHECK FOR UPDATES
// ──────────────────────────────────────────────
const checkUpdateBtn = document.getElementById('checkUpdateBtn');
const updateResult = document.getElementById('updateResult');
const GITHUB_REPO = 'kashif0700444846/relocate-extension';

checkUpdateBtn.addEventListener('click', async () => {
    checkUpdateBtn.disabled = true;
    checkUpdateBtn.textContent = '⏳ Checking...';
    updateResult.textContent = '';

    try {
        const currentVersion = chrome.runtime.getManifest().version;
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });

        if (!res.ok) throw new Error('GitHub API error: ' + res.status);
        const release = await res.json();

        // Extract version from tag (e.g. "v1.5.5-42" → "1.5.5")
        const latestTag = release.tag_name || '';
        const latestVersion = latestTag.replace(/^v/, '').split('-')[0];

        if (latestVersion === currentVersion) {
            updateResult.innerHTML = '✅ <strong style="color:#10b981">You are on the latest version!</strong> (v' + currentVersion + ')';
        } else {
            const downloadUrl = release.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`;
            updateResult.innerHTML = '🆕 <strong style="color:#f59e0b">Update available!</strong> v' + latestVersion +
                ' (you have v' + currentVersion + ') — <a href="' + downloadUrl + '" target="_blank" style="color:#3b82f6">Download</a>';
        }
    } catch (err) {
        console.error('[Settings] [UpdateCheck] [ERROR]', err.message);
        updateResult.innerHTML = '❌ <span style="color:#ef4444">Could not check for updates.</span> Check your connection.';
    }

    checkUpdateBtn.disabled = false;
    checkUpdateBtn.textContent = '🔄 Check for Updates';
});

// ──────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────
document.getElementById('navDebug').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('debug.html') });
});
document.getElementById('navExtensions').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions' });
});
document.getElementById('backToPopup').addEventListener('click', (e) => {
    e.preventDefault();
    window.close();
});

// ──────────────────────────────────────────────
// PRESET MAP TOGGLE (lazy init)
// ──────────────────────────────────────────────
const togglePresetMapBtn = document.getElementById('togglePresetMap');
const presetMapWrap = document.getElementById('presetMapWrap');
let presetMapInitialized = false;

togglePresetMapBtn.addEventListener('click', () => {
    const isHidden = presetMapWrap.style.display === 'none';
    presetMapWrap.style.display = isHidden ? '' : 'none';
    togglePresetMapBtn.textContent = isHidden
        ? '🗺️ Hide Map (click to collapse)'
        : '🗺️ Pick from Map (click to expand)';

    // Lazy init: only create the map on first open
    if (isHidden && !presetMapInitialized) {
        presetMapInitialized = true;
        setTimeout(() => {
            initPresetMap();
        }, 50);
    } else if (isHidden && presetMap) {
        // Fix Leaflet tile rendering after re-show
        setTimeout(() => presetMap.invalidateSize(), 50);
    }
});

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
loadDisplaySettings();
loadAllPresets();
renderWaypoints();

setTimeout(() => {
    initRouteMap();
}, 100);

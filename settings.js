// [Relocate] [settings.js] - Settings Page Logic
// Features: Display toggles, custom presets CRUD, route simulation engine.

'use strict';

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────

// Display toggles
const toggleCoords = document.getElementById('toggleCoords');
const togglePresets = document.getElementById('togglePresets');
const toggleRecent = document.getElementById('toggleRecent');

// Custom presets
const presetsTable = document.getElementById('presetsTable');
const presetsBody = document.getElementById('presetsBody');
const presetsEmpty = document.getElementById('presetsEmpty');
const addPresetBtn = document.getElementById('addPresetBtn');
const presetNameInput = document.getElementById('presetNameInput');
const presetLatInput = document.getElementById('presetLatInput');
const presetLngInput = document.getElementById('presetLngInput');

// Route simulation
const routeStartInput = document.getElementById('routeStartInput');
const routeEndInput = document.getElementById('routeEndInput');
const modeBtns = document.querySelectorAll('.mode-btn');
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
let routeMap = null;
let routeLayerGroup = null;
let routeMarkerA = null;
let routeMarkerB = null;
let routePolyline = null;
let routeMovingMarker = null;

let routePoints = [];
let routeMode = 'driving';
let routeSpeedKmh = 50;
let routeIndex = 0;
let routeInterval = null;
let routePaused = false;

let pointA = null;  // { lat, lng, name }
let pointB = null;

// ──────────────────────────────────────────────
// DISPLAY PREFERENCES
// ──────────────────────────────────────────────
function loadDisplaySettings() {
    chrome.storage.local.get(['showCoords', 'showPresets', 'showRecent'], (data) => {
        toggleCoords.checked = data.showCoords !== false;  // default true
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
// CUSTOM PRESETS
// ──────────────────────────────────────────────
function loadCustomPresets() {
    chrome.storage.local.get(['customPresets'], (data) => {
        renderCustomPresets(data.customPresets || []);
    });
}

function renderCustomPresets(presets) {
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
            <td><button class="preset-del-btn" data-idx="${idx}">🗑️ Delete</button></td>`;
        tr.querySelector('.preset-del-btn').addEventListener('click', () => deletePreset(idx));
        presetsBody.appendChild(tr);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

addPresetBtn.addEventListener('click', () => {
    const name = presetNameInput.value.trim();
    const lat = parseFloat(presetLatInput.value);
    const lng = parseFloat(presetLngInput.value);

    if (!name) { alert('Please enter a name.'); return; }
    if (isNaN(lat) || lat < -90 || lat > 90) { alert('Invalid latitude.'); return; }
    if (isNaN(lng) || lng < -180 || lng > 180) { alert('Invalid longitude.'); return; }

    chrome.storage.local.get(['customPresets'], (data) => {
        const presets = data.customPresets || [];
        presets.push({ name, lat, lng });
        chrome.storage.local.set({ customPresets: presets }, () => {
            renderCustomPresets(presets);
            presetNameInput.value = '';
            presetLatInput.value = '';
            presetLngInput.value = '';
        });
    });
});

function deletePreset(idx) {
    chrome.storage.local.get(['customPresets'], (data) => {
        const presets = data.customPresets || [];
        presets.splice(idx, 1);
        chrome.storage.local.set({ customPresets: presets }, () => {
            renderCustomPresets(presets);
        });
    });
}

// ──────────────────────────────────────────────
// ROUTE MAP
// ──────────────────────────────────────────────
function initRouteMap() {
    routeMap = L.map('routeMap', { zoomControl: true }).setView([59.33, 18.07], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OSM',
        maxZoom: 19
    }).addTo(routeMap);

    routeLayerGroup = L.layerGroup().addTo(routeMap);
}

function updateRouteMap() {
    routeLayerGroup.clearLayers();

    if (pointA) {
        routeMarkerA = L.marker([pointA.lat, pointA.lng], {
            icon: L.divIcon({
                html: '<div style="background:#10b981;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:2px solid #fff;box-shadow:0 0 8px rgba(16,185,129,0.6)">A</div>',
                iconSize: [24, 24],
                className: ''
            })
        }).addTo(routeLayerGroup);
    }

    if (pointB) {
        routeMarkerB = L.marker([pointB.lat, pointB.lng], {
            icon: L.divIcon({
                html: '<div style="background:#ef4444;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:2px solid #fff;box-shadow:0 0 8px rgba(239,68,68,0.6)">B</div>',
                iconSize: [24, 24],
                className: ''
            })
        }).addTo(routeLayerGroup);
    }

    if (pointA && pointB) {
        const bounds = L.latLngBounds([pointA.lat, pointA.lng], [pointB.lat, pointB.lng]);
        routeMap.fitBounds(bounds.pad(0.15));
    } else if (pointA) {
        routeMap.setView([pointA.lat, pointA.lng], 13);
    } else if (pointB) {
        routeMap.setView([pointB.lat, pointB.lng], 13);
    }
}

// ──────────────────────────────────────────────
// GEOCODE SEARCH (for route inputs)
// ──────────────────────────────────────────────
async function geocodeAddress(query) {
    if (!query || query.length < 2) return null;

    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
        const res = await fetch(url, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'RelocateExtension/1.3' }
        });
        const data = await res.json();
        if (!data || !data.length) return null;
        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            name: data[0].display_name.split(', ').slice(0, 2).join(', ')
        };
    } catch (err) {
        console.error('[Settings] [Geocode] [ERROR]', err.message);
        return null;
    }
}

// Debounced enter key handler for route inputs
routeStartInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const result = await geocodeAddress(routeStartInput.value.trim());
    if (result) {
        pointA = result;
        routeStartInput.value = result.name;
        updateRouteMap();
        updateRouteStatus();
    }
});

routeEndInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const result = await geocodeAddress(routeEndInput.value.trim());
    if (result) {
        pointB = result;
        routeEndInput.value = result.name;
        updateRouteMap();
        updateRouteStatus();
    }
});

// ──────────────────────────────────────────────
// MODE SELECTOR
// ──────────────────────────────────────────────
modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        routeMode = btn.dataset.mode;

        if (routeMode === 'driving') {
            speedSlider.value = 50;
            speedValue.textContent = '50 km/h';
            routeSpeedKmh = 50;
        } else if (routeMode === 'walking') {
            speedSlider.value = 5;
            speedValue.textContent = '5 km/h';
            routeSpeedKmh = 5;
        }
        // custom: keep current slider value
    });
});

speedSlider.addEventListener('input', () => {
    routeSpeedKmh = parseInt(speedSlider.value, 10);
    speedValue.textContent = routeSpeedKmh + ' km/h';

    // If user changes speed, switch to custom mode
    if (routeMode !== 'custom') {
        modeBtns.forEach(b => b.classList.remove('active'));
        document.getElementById('modeCustom').classList.add('active');
        routeMode = 'custom';
    }
});

// ──────────────────────────────────────────────
// ROUTE FETCHING (OSRM)
// ──────────────────────────────────────────────
async function fetchRoute(start, end, mode) {
    const osrmMode = (mode === 'walking') ? 'foot' : 'driving';
    const url = `https://router.project-osrm.org/route/v1/${osrmMode}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('OSRM API returned ' + res.status);
        const data = await res.json();

        if (!data.routes || !data.routes.length) {
            throw new Error('No route found');
        }

        const coords = data.routes[0].geometry.coordinates;
        // GeoJSON is [lng, lat] — convert to [lat, lng]
        return coords.map(c => ({ lat: c[1], lng: c[0] }));
    } catch (err) {
        console.error('[Settings] [OSRM] [ERROR]', err.message);
        return null;
    }
}

// ──────────────────────────────────────────────
// ROUTE SIMULATION ENGINE
// ──────────────────────────────────────────────
function updateRouteStatus() {
    if (!pointA || !pointB) {
        routeStatusText.textContent = 'Set both points A and B to begin';
        routeStartBtn.disabled = true;
    } else {
        routeStatusText.textContent = 'Ready — Press Start to simulate';
        routeStartBtn.disabled = false;
    }
}

routeStartBtn.addEventListener('click', async () => {
    if (!pointA || !pointB) return;

    // If paused, resume
    if (routePaused && routePoints.length > 0) {
        routePaused = false;
        routeStartBtn.disabled = true;
        routePauseBtn.disabled = false;
        routeStopBtn.disabled = false;
        routeStatusText.textContent = 'Simulating...';
        routeStatusText.classList.add('live');
        startSimulationLoop();
        return;
    }

    // Fetch route
    routeStatusText.textContent = 'Fetching route from OSRM...';
    routeStartBtn.disabled = true;

    const points = await fetchRoute(pointA, pointB, routeMode);
    if (!points || points.length < 2) {
        routeStatusText.textContent = '❌ Could not find a route. Try different locations.';
        routeStartBtn.disabled = false;
        return;
    }

    routePoints = points;
    routeIndex = 0;

    // Draw route on map
    if (routePolyline) routeLayerGroup.removeLayer(routePolyline);
    routePolyline = L.polyline(
        points.map(p => [p.lat, p.lng]),
        { color: '#f59e0b', weight: 4, opacity: 0.7 }
    ).addTo(routeLayerGroup);

    // Add moving marker
    if (routeMovingMarker) routeLayerGroup.removeLayer(routeMovingMarker);
    routeMovingMarker = L.circleMarker([points[0].lat, points[0].lng], {
        radius: 7,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        color: '#fff',
        weight: 2
    }).addTo(routeLayerGroup);

    // Fit map to route
    routeMap.fitBounds(routePolyline.getBounds().pad(0.1));

    // Update UI
    routePaused = false;
    routeStartBtn.disabled = true;
    routePauseBtn.disabled = false;
    routeStopBtn.disabled = false;
    routeStatusText.textContent = 'Simulating...';

    // Set initial spoofed position
    updateSpoofedPosition(points[0]);

    // Start loop
    startSimulationLoop();
});

function startSimulationLoop() {
    // Calculate meters per second from km/h
    const metersPerSecond = (routeSpeedKmh * 1000) / 3600;

    // We step every 1 second
    if (routeInterval) clearInterval(routeInterval);

    routeInterval = setInterval(() => {
        if (routeIndex >= routePoints.length - 1) {
            stopSimulation(true);
            return;
        }

        // Calculate distance to skip based on speed
        let distToTravel = metersPerSecond; // meters per tick (1s)
        while (distToTravel > 0 && routeIndex < routePoints.length - 1) {
            const current = routePoints[routeIndex];
            const next = routePoints[routeIndex + 1];
            const segDist = haversineMeters(current.lat, current.lng, next.lat, next.lng);

            if (segDist <= distToTravel) {
                distToTravel -= segDist;
                routeIndex++;
            } else {
                // Interpolate within this segment
                const fraction = distToTravel / segDist;
                const interpLat = current.lat + (next.lat - current.lat) * fraction;
                const interpLng = current.lng + (next.lng - current.lng) * fraction;
                routePoints[routeIndex] = { lat: interpLat, lng: interpLng };
                distToTravel = 0;
            }
        }

        const pos = routePoints[routeIndex];
        updateSpoofedPosition(pos);

        // Update moving marker
        if (routeMovingMarker) {
            routeMovingMarker.setLatLng([pos.lat, pos.lng]);
        }

        // Update progress
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
    if (routeInterval) {
        clearInterval(routeInterval);
        routeInterval = null;
    }
    routePaused = true;
    routeStartBtn.disabled = false;
    routePauseBtn.disabled = true;
    routeStartBtn.textContent = '▶️ Resume';
    routeStatusText.textContent = 'Paused';
});

routeStopBtn.addEventListener('click', () => {
    stopSimulation(false);
});

function stopSimulation(completed) {
    if (routeInterval) {
        clearInterval(routeInterval);
        routeInterval = null;
    }

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

        // Remove route line and moving marker
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
// NAVIGATION
// ──────────────────────────────────────────────
document.getElementById('backToPopup').addEventListener('click', (e) => {
    e.preventDefault();
    window.close();
});

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
loadDisplaySettings();
loadCustomPresets();

setTimeout(() => {
    initRouteMap();
}, 100);

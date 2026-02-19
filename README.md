# Relocate — Location Changer 📍

> **Everything you need to test, spoof, and simulate GPS locations — in one extension.**

A privacy-first Chrome extension that gives you complete control over `navigator.geolocation`. Change your GPS location to anywhere in the world with a single click, simulate movement along real roads, manage unlimited presets, and debug which sites are tracking you. Built for developers, QA testers, and privacy-conscious users.

---

## ✨ Features

### 🗺️ Location Control
| Feature | Description |
|---------|-------------|
| 🗺️ **Interactive Map** | Click anywhere on the Leaflet map to set your location instantly |
| 🔍 **Live Address Search** | Autocomplete powered by OpenStreetMap Nominatim — find any address worldwide |
| 📌 **Unlimited Presets** | Create, manage, and delete your own custom presets from the Settings page |
| 🌍 **6 Default Presets** | New York, London, Tokyo, Paris, Dubai, Sydney — fully removable |
| 📍 **Map Click Presets** | Click on the map in Settings to pick coordinates + auto reverse-geocode the name |
| 🕐 **Recent Locations** | Automatically saves your last 8 locations for quick re-selection |
| 🎯 **Accuracy Control** | Adjustable accuracy slider (1m – 100m) |

### 🛣️ Route Simulation
| Feature | Description |
|---------|-------------|
| 🛣️ **Multi-Waypoint Routes** | Add unlimited waypoints (A → B → C → D...) with real road routing |
| 🔍 **Live Autocomplete** | Search any address for route waypoints — suggestions appear as you type |
| 🚗 **Driving / Walking / Custom** | Choose your mode with auto-speed presets or set your own |
| ➡️ **Direction Controls** | Forward (A→Z), Backward (Z→A), or Loop (bounces back and forth) |
| ▶️ **Play / Pause / Stop** | Full simulation controls with live progress bar and moving marker |
| 🗺️ **Live Route Map** | See your route drawn on the map with colored waypoint markers |

### ⚙️ Settings & Customization
| Feature | Description |
|---------|-------------|
| ⚙️ **Full Settings Page** | Display toggles, preset management, and route simulation in one place |
| 🎛️ **Display Toggles** | Show/hide coordinates, presets, or recent locations in the popup |
| 🌙 **Dark & Light Mode** | Theme toggle with persistent preference |
| 🟡 **Toolbar Badge** | Yellow `●` badge when spoofing is active |

### 🔍 Debugging & Privacy
| Feature | Description |
|---------|-------------|
| 🧪 **Debug Console** | Self-test page to verify extension health and spoof status |
| 🌐 **Location Consumers** | See which tabs/sites are actively using your spoofed location |
| 🔔 **Update Notifications** | Auto-checks GitHub for new versions every 6 hours |
| 🛡️ **Privacy-First** | Zero data collection — everything stays local |

---

## 📥 Installation

### From GitHub Releases (Recommended)
1. Go to [**Releases**](https://github.com/kashif0700444846/relocate-extension/releases/latest)
2. Download `relocate-v*.zip`
3. Unzip the file
4. Open `chrome://extensions`
5. Enable **Developer Mode** (top right)
6. Click **Load unpacked** → select the unzipped folder

### From Source
```bash
git clone https://github.com/kashif0700444846/relocate-extension.git
```
Then load unpacked from `chrome://extensions`.

---

## 🧪 Testing

1. Click the Relocate icon in your toolbar
2. Choose a location (map click, search, preset, or recent)
3. Click **✅ Apply Location**
4. Open [Google Maps](https://www.google.com/maps) — it should show your spoofed location
5. Check the yellow `●` badge on the toolbar icon = spoofing active

---

## 🔐 Permissions

| Permission | Why |
|------------|-----|
| `storage` | Save your preferences locally |
| `scripting` | Inject geolocation override into web pages |
| `activeTab` / `tabs` | Communicate state changes to open tabs |
| `alarms` | Schedule periodic update checks |
| `host_permissions` | Override geolocation on all websites |

**No data is ever collected or transmitted.** See [Privacy Policy](privacy-policy.html).

---

## 🏗️ Tech Stack

- **Manifest V3** — Modern Chrome extension architecture
- **Leaflet.js** — Interactive map (bundled locally, no CDN)
- **Nominatim API** — Address search & reverse geocoding (OpenStreetMap)
- **OSRM API** — Real road routing for route simulation
- **GitHub Actions** — Auto-release ZIP on every push

---

## 🔄 Auto-Updates

- **Chrome Web Store users:** Updates are fully automatic and silent
- **Sideloaded users:** The extension checks GitHub Releases every 6 hours. When a new version is found, a blue banner appears in the popup with a download link

---

## 📝 Changelog

### v1.5.0
- 📌 **Unified Presets Manager** — all presets (default + custom) in one table, all deletable
- 🗺️ **Map Click to Add Presets** — click on the map to pick coordinates with auto reverse-geocode
- 🔍 **Inline Address Search** — search bar directly in preset form fills lat/lng automatically
- 🌍 **Default Presets in Settings** — 6 built-in presets shown and manageable (remove/add your own)
- 📝 **README Overhaul** — comprehensive feature documentation

### v1.4.0
- 🔍 **Live Address Autocomplete** — real-time address suggestions in route planner and custom presets
- 📍 **Multi-Waypoint Routes** — add unlimited waypoints (A→B→C→D...) with add/remove buttons
- 🔄 **Direction Controls** — forward (A→Z), backward (Z→A), or continuous loop mode
- 📌 **Preset Address Search** — search address to auto-fill lat/lng when adding custom presets
- 🌐 **Location Consumer Tracking** — debug page shows which sites/tabs are using your spoofed location

### v1.3.0
- ⚙️ **Settings Page** — full-page settings with display toggles, custom presets, and route simulation
- 📌 **Custom Presets** — create your own saved locations (add/delete from settings)
- 🎛️ **Display Toggles** — show/hide coords, presets, or recent locations in popup
- 🛣️ **Route Simulation** — set Point A → B, choose driving/walking/custom speed, follows real roads via OSRM
- ▶️ **Play/Pause/Stop** controls with live progress bar and moving map marker

### v1.2.2
- 🏠 **Recent Locations show addresses** — reverse geocode via Nominatim for map-clicked locations, search input name for searched locations
- 🔄 **Debug page live refresh** — auto-updates when state changes from popup (no manual refresh needed)

### v1.2.1
- 🐛 **Debug page badge sync** — disabling spoof from debug page now updates toolbar badge instantly
- 🐛 **Geolocation permission warning** — handled gracefully on extension pages

### v1.2.0
- 🕐 **Recent Locations** — auto-saves last 8 locations for quick access
- 🔔 **Update notifications** — checks GitHub Releases every 6h
- ⭐ **Rating prompt** — after 5+ uses
- 📋 **Privacy Policy** — for Chrome Web Store compliance

### v1.1.0
- 🔍 Live address autocomplete (Nominatim)
- 🌙 Dark/Light mode toggle
- 🟡 Toolbar badge when spoofing active
- 🗺️ Interactive Leaflet map with drag

### v1.0.0
- Initial release
- GPS spoofing via `navigator.geolocation` override
- Quick city presets
- Accuracy control

---

## 📄 License

MIT — Free to use, modify, and distribute.

---

**Keywords:** GPS spoofer, location changer, geolocation override, Chrome extension, fake GPS, location privacy, developer tools, navigator.geolocation, Relocate

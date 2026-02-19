# Relocate — Location Changer 📍

> **Spoof your GPS location on any website with a single click.**

A privacy-first Chrome extension that overrides `navigator.geolocation` to return coordinates you choose. Perfect for developers, testers, and privacy-conscious users.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Interactive Map** | Click anywhere on the Leaflet map to set your location |
| 🔍 **Live Address Search** | Autocomplete powered by OpenStreetMap Nominatim |
| 🕐 **Recent Locations** | Automatically saves your last 8 locations for quick re-selection |
| 🌆 **Quick Presets** | One-click: New York, London, Tokyo, Paris, Dubai, Sydney |
| 🎯 **Accuracy Control** | Adjustable accuracy slider (1m – 100m) |
| 🌙 **Dark & Light Mode** | Theme toggle with persistent preference |
| 🔔 **Update Notifications** | Auto-checks GitHub for new versions every 6 hours |
| ⭐ **Rating Prompt** | Friendly reminder to star the repo after 5+ uses |
| 🟡 **Toolbar Badge** | Yellow `●` badge when spoofing is active |
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
- **Nominatim API** — Address search (OpenStreetMap)
- **GitHub Actions** — Auto-release ZIP on every push

---

## 🔄 Auto-Updates

- **Chrome Web Store users:** Updates are fully automatic and silent
- **Sideloaded users:** The extension checks GitHub Releases every 6 hours. When a new version is found, a blue banner appears in the popup with a download link

---

## 📝 Changelog

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

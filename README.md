# Relocate — Location Changer 📍

**Spoof your GPS location on any website.** Change your geolocation to anywhere in the world with a single click. Privacy-first, developer-friendly Chrome Extension.

## ✨ Features

- 🌍 **GPS Location Spoofing** — Override `navigator.geolocation` on any website
- 🔍 **Live Address Search** — Type an address and get instant suggestions (powered by OpenStreetMap)
- 🗺️ **Interactive Map** — Click anywhere on the map to set your location
- 📍 **Quick Presets** — One-click locations: New York, London, Tokyo, Paris, Dubai, Sydney
- 🌙 **Dark / Light Mode** — Premium UI with automatic theme persistence
- 🟡 **Toolbar Badge** — Visible indicator when spoofing is active
- 🧪 **Debug Console** — Real-time status and self-tests for developers
- 🔒 **Privacy First** — No data collection, no external servers, 100% local

## 🚀 Installation

1. Download the [latest release](https://github.com/kashif0700444846/relocate-extension/releases/latest)
2. Unzip the file
3. Go to `chrome://extensions`
4. Enable **Developer Mode** (toggle in top right)
5. Click **Load unpacked** → select the unzipped folder
6. Click the **Relocate** icon in your toolbar

## 🧪 Testing

1. Open the extension popup
2. Select a preset (e.g. **Tokyo 🗼**)
3. Click **✅ Apply Location**
4. Open [Google Maps](https://maps.google.com) → click the My Location button
5. Google Maps shows your spoofed location!

## 📋 Permissions

| Permission | Reason |
|-----------|--------|
| `storage` | Save your location settings |
| `scripting` | Inject the GPS override into web pages |
| `activeTab` | Access the current tab for script injection |
| `tabs` | Open debug page and Google Maps test |
| `host_permissions: *://*/*` | Required to spoof location on all websites |

## 🛠️ Tech Stack

- **Manifest V3** — Latest Chrome Extension standard
- **Leaflet.js** — Interactive maps (bundled locally, no CDN)
- **Nominatim** — Free geocoding for address search
- **Pure CSS** — No frameworks, custom dark/light theme

## 📄 License

MIT License — free to use, modify, and distribute.

---

**Keywords:** GPS spoofer, location changer, geolocation override, Chrome extension, fake GPS, location privacy, developer tools, navigator.geolocation

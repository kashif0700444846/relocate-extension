// [Relocate] [inject.js] - Main World Injector
// Reads initial state from DOM attribute, listens for live updates.

(function () {
    'use strict';

    const STATE_ATTR = 'data-relocate-spoof';

    let state = {
        spoofEnabled: false,
        latitude: 48.8566,
        longitude: 2.3522,
        accuracy: 10
    };

    try {
        const raw = document.documentElement.getAttribute(STATE_ATTR);
        if (raw) {
            state = Object.assign({}, state, JSON.parse(raw));
        }
    } catch (e) { /* will receive real state via event */ }

    window.addEventListener('__relocateSync', function (e) {
        if (e && e.detail) {
            state = Object.assign({}, state, e.detail);
        }
    });

    function buildFakePosition() {
        return {
            coords: {
                latitude: Number(state.latitude),
                longitude: Number(state.longitude),
                accuracy: Number(state.accuracy) || 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
            },
            timestamp: Date.now()
        };
    }

    var _native = navigator.geolocation;
    if (!_native) return;

    var _spoofed = {
        getCurrentPosition: function (successCb, errorCb, opts) {
            if (!state.spoofEnabled) {
                return _native.getCurrentPosition.call(_native, successCb, errorCb, opts);
            }
            setTimeout(function () {
                try {
                    successCb(buildFakePosition());
                } catch (e) {
                    if (typeof errorCb === 'function') {
                        errorCb({ code: 2, message: 'Relocate internal error: ' + e.message });
                    }
                }
            }, 50);
        },

        watchPosition: function (successCb, errorCb, opts) {
            if (!state.spoofEnabled) {
                return _native.watchPosition.call(_native, successCb, errorCb, opts);
            }
            function fire() {
                try { successCb(buildFakePosition()); }
                catch (e) { if (typeof errorCb === 'function') errorCb({ code: 2 }); }
            }
            fire();
            return setInterval(fire, 2000);
        },

        clearWatch: function (id) {
            if (!state.spoofEnabled) {
                return _native.clearWatch.call(_native, id);
            }
            clearInterval(id);
        }
    };

    try {
        Object.defineProperty(navigator, 'geolocation', {
            get: function () {
                return state.spoofEnabled ? _spoofed : _native;
            },
            configurable: true,
            enumerable: true
        });
        console.log(
            '%c[Relocate] GPS Spoofer injected. spoofEnabled=' + state.spoofEnabled,
            'color:#f59e0b;font-weight:bold;'
        );
    } catch (err) {
        console.error('[Relocate] Could not override navigator.geolocation:', err.message);
    }

})();

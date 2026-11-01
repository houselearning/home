(function () {
    'use strict';

    var measurementIds = ['G-8YSM87GDVW', 'G-P42LD5XN48'];
    var localPreview = window.location.protocol === 'file:' ||
        /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);
    if (localPreview) return;

    var state = window.HouseLearningAnalytics || {};
    if (state.version === 'sitewide-consent-v1') return;
    state.version = 'sitewide-consent-v1';
    state.initialized = true;
    state.configuredIds = state.configuredIds || {};
    state.pageViewsSent = state.pageViewsSent || {};
    state.lastTrackedUrl = state.lastTrackedUrl || null;
    state.lastTrackedTitle = state.lastTrackedTitle || null;
    window.HouseLearningAnalytics = state;

    function consentAllowed() {
        try {
            return !!(
                window.cookieConsent &&
                typeof window.cookieConsent.isAllowed === 'function' &&
                window.cookieConsent.isAllowed('analytics')
            );
        } catch (error) {
            console.warn('HouseLearning Analytics could not read analytics consent.', error);
            return false;
        }
    }

    function ensureDataLayer() {
        if (window.dataLayer === undefined) {
            window.dataLayer = [];
        }
        if (!Array.isArray(window.dataLayer)) {
            console.error('HouseLearning Analytics found an invalid window.dataLayer.');
            return false;
        }
        if (typeof window.gtag !== 'function') {
            window.gtag = function gtag() {
                window.dataLayer.push(arguments);
            };
        }
        return true;
    }

    function getPreviouslyConfiguredIds() {
        var configured = {};
        (window.dataLayer || []).forEach(function (command) {
            if (!command || command[0] !== 'config' || !command[1]) return;
            var options = command[2] || {};
            configured[command[1]] = {
                pageViewSent: options.send_page_view !== false
            };
        });
        if (window._gaLoaded) {
            configured['G-P42LD5XN48'] = { pageViewSent: true };
        }
        return configured;
    }

    function ensureGtagScript() {
        if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return true;
        try {
            var script = document.createElement('script');
            script.async = true;
            script.src = 'https://www.googletagmanager.com/gtag/js?id=G-P42LD5XN48';
            script.setAttribute('data-houselearning-analytics', 'true');
            (document.head || document.documentElement).appendChild(script);
            return true;
        } catch (error) {
            console.warn('HouseLearning Analytics could not insert the Google tag script.', error);
            return false;
        }
    }

    function sendPageView(url, title, referrer) {
        if (!consentAllowed() || typeof window.gtag !== 'function') return;

        var pageLocation = url || window.location.href;
        var pageTitle = title || document.title || 'HouseLearning';
        var pageReferrer = referrer || state.lastTrackedUrl || document.referrer || undefined;
        var pageKey = pageLocation + '\n' + pageTitle;
        if (state.lastTrackedUrl !== pageLocation || state.lastTrackedTitle !== pageTitle) {
            state.lastTrackedUrl = pageLocation;
            state.lastTrackedTitle = pageTitle;
        }

        measurementIds.forEach(function (measurementId) {
            if (state.pageViewsSent[measurementId] === pageKey) return;
            try {
                window.gtag('event', 'page_view', {
                    send_to: measurementId,
                    page_location: pageLocation,
                    page_title: pageTitle,
                    page_referrer: pageReferrer
                });
                state.pageViewsSent[measurementId] = pageKey;
            } catch (error) {
                console.warn('HouseLearning Analytics could not queue a page view.', error);
            }
        });
    }

    function activate() {
        if (!consentAllowed() || !ensureDataLayer()) return;

        var existingConfigs = getPreviouslyConfiguredIds();
        if (!state.gtagInitialized && !window._gaLoaded) {
            window.gtag('js', new Date());
            state.gtagInitialized = true;
        }

        try {
            window.gtag('consent', 'update', {
                analytics_storage: 'granted',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
            });
            if (!ensureGtagScript()) return;
            window._gaLoaded = true;

            measurementIds.forEach(function (measurementId) {
                if (state.configuredIds[measurementId]) return;
                if (!existingConfigs[measurementId]) {
                    window.gtag('config', measurementId, { send_page_view: false });
                }
                state.configuredIds[measurementId] = true;
                if (existingConfigs[measurementId] && existingConfigs[measurementId].pageViewSent) {
                    state.pageViewsSent[measurementId] =
                        window.location.href + '\n' + (document.title || 'HouseLearning');
                }
            });
        } catch (error) {
            console.warn('HouseLearning Analytics could not initialize Google Analytics.', error);
            return;
        }

        sendPageView();
    }

    function handleConsentChange(consent) {
        if (consent && consent.analytics) {
            activate();
            return;
        }
        if (typeof window.gtag === 'function') {
            window.gtag('consent', 'update', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
            });
        }
        state.pageViewsSent = {};
    }

    function bindConsentApi() {
        if (!window.cookieConsent || typeof window.cookieConsent.onChange !== 'function') {
            return false;
        }
        if (!state.consentListenerBound) {
            window.cookieConsent.onChange(handleConsentChange);
            state.consentListenerBound = true;
        }
        if (consentAllowed()) activate();
        return true;
    }

    function ensureConsentScript() {
        if (document.querySelector('script[src*="cookiebanner.js"]')) return;
        try {
            var script = document.createElement('script');
            script.async = true;
            script.src = 'https://www.houselearning.org/cookiebanner.js?v=consent-choice-v2';
            script.setAttribute('data-houselearning-consent', 'true');
            script.onload = bindConsentApi;
            script.onerror = function () {
                console.warn('HouseLearning Analytics could not load the existing cookie consent script.');
            };
            (document.head || document.documentElement).appendChild(script);
        } catch (error) {
            console.warn('HouseLearning Analytics could not load the existing cookie consent script.', error);
        }
    }

    function onNavigation() {
        if (consentAllowed()) {
            activate();
            sendPageView();
        }
    }

    function installNavigationTracking() {
        if (state.navigationInitialized || !window.history) return;
        ['pushState', 'replaceState'].forEach(function (method) {
            var original = window.history[method];
            if (typeof original !== 'function') return;
            window.history[method] = function () {
                var result = original.apply(this, arguments);
                window.setTimeout(onNavigation, 0);
                return result;
            };
        });
        window.addEventListener('popstate', onNavigation);
        window.addEventListener('hashchange', onNavigation);
        state.navigationInitialized = true;
    }

    state.init = activate;
    state.trackVirtualPage = function (url, title, referrer) {
        var normalizedUrl;
        try {
            normalizedUrl = new URL(url, window.location.href).href;
        } catch (error) {
            console.warn('HouseLearning Analytics ignored an invalid virtual page URL.', error);
            return;
        }
        activate();
        sendPageView(normalizedUrl, title, referrer);
    };

    installNavigationTracking();
    if (!bindConsentApi()) {
        ensureConsentScript();
        var attempts = 0;
        var poller = window.setInterval(function () {
            attempts += 1;
            if (bindConsentApi()) {
                window.clearInterval(poller);
            } else if (attempts >= 120) {
                window.clearInterval(poller);
                console.warn('HouseLearning Analytics did not find the cookie consent API; tracking remains disabled.');
            }
        }, 250);
    }
})();

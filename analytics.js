(function () {
    'use strict';

    var measurementIds = ['G-8YSM87GDVW', 'G-P42LD5XN48'];
    var localPreview = window.location.protocol === 'file:' ||
        /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);
    if (localPreview) return;

    var state = window.HouseLearningAnalytics || {};
    if (state.version === 'sitewide-consent-v2') return;
    state.version = 'sitewide-consent-v2';
    state.initialized = true;
    state.configuredIds = state.configuredIds || {};
    state.pageViewsSent = state.pageViewsSent || {};
    state.lastTrackedUrl = state.lastTrackedUrl || null;
    state.lastTrackedTitle = state.lastTrackedTitle || null;
    window.HouseLearningAnalytics = state;

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
        if (!window._hlConsentDefaultsSet) {
            window.gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                wait_for_update: 500
            });
            window._hlConsentDefaultsSet = true;
        }
        return true;
    }

    function ensureGtagScript() {
        if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return true;
        try {
            var script = document.createElement('script');
            script.async = true;
            script.src = 'https://www.googletagmanager.com/gtag/js?id=G-P42LD5XN48';
            script.setAttribute('data-houselearning-analytics', 'true');
            script.onerror = function () {
                console.error('HouseLearning Analytics could not load the Google tag.');
            };
            (document.head || document.documentElement).appendChild(script);
            return true;
        } catch (error) {
            console.error('HouseLearning Analytics could not insert the Google tag script.', error);
            return false;
        }
    }

    function safePageUrl(value) {
        try {
            var url = new URL(value, window.location.href);
            return url.origin + url.pathname;
        } catch (error) {
            return '';
        }
    }

    function sendPageView(url, title, referrer) {
        if (typeof window.gtag !== 'function') return;

        var pageLocation = safePageUrl(url || window.location.href);
        if (!pageLocation) {
            console.error('HouseLearning Analytics could not create a safe page location.');
            return;
        }
        var pageTitle = title || document.title || 'HouseLearning';
        var pageReferrer = safePageUrl(referrer || state.lastTrackedUrl || document.referrer);
        var pageKey = pageLocation + '\n' + pageTitle;
        state.lastTrackedUrl = pageLocation;
        state.lastTrackedTitle = pageTitle;
        window._hlGaPageViewsSent = window._hlGaPageViewsSent || {};

        measurementIds.forEach(function (measurementId) {
            if (state.pageViewsSent[measurementId] === pageKey) return;
            if (window._hlGaPageViewsSent[measurementId] === pageKey) {
                state.pageViewsSent[measurementId] = pageKey;
                return;
            }
            try {
                window.gtag('event', 'page_view', {
                    send_to: measurementId,
                    page_location: pageLocation,
                    page_title: pageTitle,
                    page_referrer: pageReferrer || undefined
                });
                state.pageViewsSent[measurementId] = pageKey;
                window._hlGaPageViewsSent[measurementId] = pageKey;
            } catch (error) {
                console.error('HouseLearning Analytics could not queue a page view.', error);
            }
        });
    }

    function initializeAnalytics() {
        if (!ensureDataLayer()) return false;

        if (!window._hlGtagInitialized) {
            window.gtag('js', new Date());
            window._hlGtagInitialized = true;
        }

        try {
            measurementIds.forEach(function (measurementId) {
                if (state.configuredIds[measurementId]) return;

                var existingConfig = window.dataLayer.some(function (command) {
                    return command && command[0] === 'config' && command[1] === measurementId;
                });
                if (!existingConfig) {
                    window.gtag('config', measurementId, {
                        send_page_view: false,
                        allow_google_signals: false,
                        allow_ad_personalization_signals: false
                    });
                }
                state.configuredIds[measurementId] = true;
            });
        } catch (error) {
            console.error('HouseLearning Analytics could not configure Google Analytics.', error);
            return false;
        }

        if (!ensureGtagScript()) return false;
        window._gaLoaded = true;
        sendPageView();
        return true;
    }

    function handleConsentChange(consent) {
        if (!ensureDataLayer()) return;
        consent = consent || {};
        window.gtag('consent', 'update', {
            analytics_storage: consent.analytics ? 'granted' : 'denied',
            ad_storage: consent.marketing ? 'granted' : 'denied',
            ad_user_data: consent.marketing ? 'granted' : 'denied',
            ad_personalization: consent.marketing ? 'granted' : 'denied'
        });
        initializeAnalytics();
    }

    function bindConsentApi() {
        if (!window.cookieConsent || typeof window.cookieConsent.onChange !== 'function') {
            return false;
        }
        if (!state.consentListenerBound) {
            window.cookieConsent.onChange(handleConsentChange);
            state.consentListenerBound = true;
        }
        return true;
    }

    function ensureConsentScript() {
        if (document.querySelector('script[src*="cookiebanner.js"]')) return;
        try {
            var script = document.createElement('script');
            script.async = true;
            script.src = 'https://www.houselearning.org/cookiebanner.js?v=consent-choice-v4';
            script.setAttribute('data-houselearning-consent', 'true');
            script.onload = bindConsentApi;
            script.onerror = function () {
                console.error('HouseLearning Analytics could not load the cookie consent script.');
            };
            (document.head || document.documentElement).appendChild(script);
        } catch (error) {
            console.error('HouseLearning Analytics could not load the cookie consent script.', error);
        }
    }

    function onNavigation() {
        initializeAnalytics();
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

    state.initializeAnalytics = initializeAnalytics;
    state.init = initializeAnalytics;
    state.trackVirtualPage = function (url, title, referrer) {
        initializeAnalytics();
        sendPageView(url, title, referrer);
    };
    window.initializeAnalytics = initializeAnalytics;

    installNavigationTracking();
    bindConsentApi();
    ensureConsentScript();
    initializeAnalytics();
})();

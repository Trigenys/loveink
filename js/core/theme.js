const THEME_KEY = 'loveInk_theme';

function normalizeTheme(mode) {
    return mode === 'dark' ? 'dark' : 'light';
}

export function getStoredThemeMode() {
    try {
        const raw = localStorage.getItem(THEME_KEY);
        return normalizeTheme(raw);
    } catch (_) {
        return 'light';
    }
}

export function applyTheme(mode) {
    const normalized = normalizeTheme(mode);
    document.documentElement.setAttribute('data-theme', normalized);
    return normalized;
}

export function setThemeMode(mode, options = {}) {
    const normalized = applyTheme(mode);
    if (options.persist !== false) {
        try {
            localStorage.setItem(THEME_KEY, normalized);
        } catch (_) {
            // Ignore localStorage failures.
        }
    }
    return normalized;
}

export function initTheme() {
    return applyTheme(getStoredThemeMode());
}

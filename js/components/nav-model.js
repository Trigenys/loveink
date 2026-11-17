// nav-model.js - Logique pure de la barre de navigation (sans DOM), testable sous Node.
// Le rendu et le câblage restent dans nav-component.js.

// Le logo mène au fil : pas d'entrée « Accueil » en doublon.
export const NAV_LINKS = Object.freeze([
    Object.freeze({ key: "categories", href: "feed.html#categories", label: "Catégories" }),
    Object.freeze({ key: "messagerie", href: "messagerie.html", label: "Messagerie" })
]);

export const SEARCH_PAGE = "feed.html";
export const SEARCH_PARAM = "q";
export const SEARCH_MAX = 120;

// Entrée à surligner. Sur le fil, « Catégories » ne l'est que si l'on y est vraiment (ancre ou section visible).
export function activeLinkKey(active, { hash = "", categoriesInView = false } = {}) {
    if (active === "feed" || active === "categories") {
        return hash === "#categories" || categoriesInView ? "categories" : null;
    }
    return NAV_LINKS.some((link) => link.key === active) ? active : null;
}

export function normalizeQuery(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX);
}

export function searchHref(query) {
    const q = normalizeQuery(query);
    return q ? `${SEARCH_PAGE}?${SEARCH_PARAM}=${encodeURIComponent(q)}` : SEARCH_PAGE;
}

export function queryFromSearch(search) {
    try {
        return normalizeQuery(new URLSearchParams(String(search || "")).get(SEARCH_PARAM));
    } catch {
        return "";
    }
}

// « / » ouvre la recherche, sauf pendant une saisie ou avec un modificateur.
export function isSearchShortcut(event, targetIsEditable) {
    if (!event || event.key !== "/") return false;
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;
    return !targetIsEditable;
}

export function bellLabel(count) {
    const value = Math.max(0, Math.floor(Number(count) || 0));
    if (!value) return "Notifications";
    const shown = value > 99 ? "plus de 99" : String(value);
    return `Notifications, ${shown} non ${value > 1 ? "lues" : "lue"}`;
}

// Lecture à reprendre : la plus récente qui a un titre connu (format de reading-history.js).
export function resumeTarget(inProgress) {
    const entry = (Array.isArray(inProgress) ? inProgress : []).find((item) => item?.id && item?.meta?.titre);
    if (!entry) return null;
    return {
        href: `histoire.html?id=${encodeURIComponent(entry.id)}`,
        title: String(entry.meta.titre),
        percent: Math.round(Math.min(1, Math.max(0, Number(entry.ratio) || 0)) * 100)
    };
}

// nav-component.js - Barre de navigation et pied de page partagés des pages connectées de Love Ink.
// Styles : css/app.css (référencé statiquement par chaque page pour être versionné au déploiement).
import { initTheme } from "../core/theme.js";
import { applyInitialsAvatar, getAvatarInitials } from "./avatar-initials.js";
import { listInProgress } from "../core/reading-history.js";
import {
    NAV_LINKS, SEARCH_MAX, activeLinkKey, bellLabel, isSearchShortcut, normalizeQuery, queryFromSearch,
    resumeTarget, searchHref
} from "./nav-model.js";

initTheme();

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderLoveInkLogo(href) {
    return `
        <a href="${href}" class="logo-custom li-appnav__logo" aria-label="Love Ink, accueil">
            <span class="logo-icon" aria-hidden="true">
                <i class="fas fa-heart logo-heart"></i>
                <i class="fas fa-hand-paper logo-hand"></i>
                <i class="fas fa-pen-fancy logo-pen"></i>
            </span>
            <span class="logo-text">Love Ink</span>
        </a>
    `;
}

// Les deux variantes historiques ("classic", "feed") partagent désormais le même rendu et les mêmes ids.
function getNavBinding() {
    return {
        trigger: document.getElementById("navUser"),
        dropdown: document.getElementById("navDropdown"),
        openClass: "open"
    };
}

function renderResume(target) {
    if (!target) return "";
    return `
        <a href="${escapeHtml(target.href)}" class="li-appnav__resume" id="navResume" title="Reprendre « ${escapeHtml(target.title)} » (${target.percent} % lu)">
            <i class="fas fa-bookmark" aria-hidden="true"></i><span>Reprendre</span><span class="li-sr-only"> « ${escapeHtml(target.title)} »</span>
        </a>`;
}

function renderSearch(initialQuery) {
    return `
        <form class="li-appnav__search" id="navSearch" role="search" action="feed.html" method="get">
            <label for="navSearchInput" class="li-sr-only">Rechercher une histoire, un auteur, une catégorie</label>
            <i class="fas fa-magnifying-glass li-appnav__search-icon" aria-hidden="true"></i>
            <input id="navSearchInput" name="q" type="search" value="${escapeHtml(initialQuery)}" placeholder="Rechercher une histoire…"
                autocomplete="off" maxlength="${SEARCH_MAX}" enterkeyhint="search">
            <kbd class="li-appnav__kbd" aria-hidden="true" title="Raccourci : /">/</kbd>
        </form>`;
}

function renderNav({ active, showPublish, showUser, showSearch, resume }) {
    const current = activeLinkKey(active, { hash: window.location.hash });
    const links = NAV_LINKS.map(({ key, href, label }) => {
        const attrs = current === key ? ` class="is-active" aria-current="${active === key ? "page" : "location"}"` : "";
        return `<a href="${href}" data-nav-key="${key}"${attrs}>${label}</a>`;
    }).join("");

    return `
        <header class="li-appnav">
            <div class="li-appnav__in">
                ${renderLoveInkLogo("feed.html")}
                <nav class="li-appnav__links" id="navLinks" aria-label="Navigation principale">${links}${renderResume(resume)}</nav>
                ${showSearch ? renderSearch(queryFromSearch(window.location.search)) : ""}
                <div class="li-appnav__actions">
                    ${showSearch ? `
                        <button type="button" class="li-appnav__icon li-appnav__search-toggle" id="navSearchToggle" aria-label="Rechercher" aria-expanded="false" aria-controls="navSearch">
                            <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
                        </button>` : ""}
                    ${showPublish ? `
                        <a href="publier.html" class="li-appnav__publish${active === "publier" ? " is-active" : ""}"${active === "publier" ? ' aria-current="page"' : ""}>
                            <i class="fas fa-feather-pointed" aria-hidden="true"></i><span>Écrire</span>
                        </a>` : ""}
                    ${showUser ? `
                        <a href="notifications.html" class="li-appnav__icon li-nav-bell${active === "notifications" ? " is-active" : ""}" id="navNotifBell" aria-label="Notifications">
                            <i class="fas fa-bell" aria-hidden="true"></i>
                            <span class="li-nav-bell-dot" id="navNotifBellDot"></span>
                        </a>
                        <div class="li-appnav__user">
                            <button type="button" class="li-appnav__user-btn" id="navUser" aria-expanded="false" aria-controls="navDropdown">
                                <span class="li-appnav__avatar">
                                    <img id="navAvatarImg" class="li-nav-avatar-img" alt="">
                                    <span id="navAvatarInitials" class="li-nav-avatar-initials" aria-hidden="true"></span>
                                    <i class="fas fa-user" id="navAvatarIcon" aria-hidden="true"></i>
                                </span>
                                <span class="li-sr-only">Menu du compte</span>
                                <span class="li-appnav__pseudo is-loading" id="userPseudo"></span>
                                <i class="fas fa-chevron-down li-appnav__chev" aria-hidden="true"></i>
                            </button>
                            <div class="li-appnav__menu" id="navDropdown">
                                <a href="profil.html"><i class="fas fa-user" aria-hidden="true"></i> Mon profil</a>
                                <a href="mes-histoires.html"><i class="fas fa-book-open" aria-hidden="true"></i> Mes histoires</a>
                                <a href="notifications.html" class="li-nav-notif-link"><i class="fas fa-bell" aria-hidden="true"></i> Notifications <span id="navNotifBadge" class="li-nav-notif-badge">0</span></a>
                                <a href="parametres.html"><i class="fas fa-sliders-h" aria-hidden="true"></i> Paramètres</a>
                                <button type="button" id="logoutBtn" class="li-appnav__logout"><i class="fas fa-arrow-right-from-bracket" aria-hidden="true"></i> Déconnexion</button>
                            </div>
                        </div>` : ""}
                    <button type="button" class="li-appnav__burger" id="navBurger" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="navLinks">
                        <span></span><span></span>
                    </button>
                </div>
            </div>
        </header>
    `;
}

function renderFooter() {
    const year = new Date().getFullYear();
    return `
        <div class="li-appfoot__in">
            <div class="li-appfoot__brand">
                <span class="li-appfoot__logo">Love Ink</span>
                <span>© ${year} · L'encre des cœurs</span>
            </div>
            <nav class="li-appfoot__links" aria-label="Liens de bas de page">
                <a href="candidature-modo.html"><i class="fas fa-shield-halved" aria-hidden="true"></i> Devenir modérateur</a>
                <a href="conditions.html">Conditions d'utilisation</a>
                <a href="confidentialite.html">Confidentialité</a>
            </nav>
            <p class="li-made-by">Made <em>by</em> <a href="https://trigenys.com" rel="noopener">Trigenys Group</a></p>
        </div>
    `;
}

function mountFooter() {
    if (document.querySelector(".li-appfoot")) return;
    const footer = document.createElement("footer");
    footer.className = "li-appfoot";
    footer.innerHTML = renderFooter();
    document.body.appendChild(footer);
}

function wireBurger(header) {
    const burger = header.querySelector("#navBurger");
    if (!burger) return;
    const setOpen = (open) => {
        header.classList.toggle("is-open", open);
        burger.setAttribute("aria-expanded", String(open));
        burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    };
    burger.addEventListener("click", () => setOpen(!header.classList.contains("is-open")));
    header.querySelectorAll(".li-appnav__links a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
}

function isEditable(target) {
    if (!target || target.nodeType !== 1) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// Recherche globale. Une page qui filtre sur place (le fil) écoute « li:search » et l'annule :
// sinon la recherche mène au fil avec ?q=.
function wireSearch(header) {
    const form = header.querySelector("#navSearch");
    const input = header.querySelector("#navSearchInput");
    const toggle = header.querySelector("#navSearchToggle");
    if (!form || !input) return;

    const dispatch = (query, source) => document.dispatchEvent(
        new CustomEvent("li:search", { detail: { query, source }, cancelable: true })
    );
    const isCollapsed = () => Boolean(toggle) && getComputedStyle(toggle).display !== "none";
    const setOpen = (open) => {
        header.classList.toggle("is-search-open", open);
        toggle?.setAttribute("aria-expanded", String(open));
        if (open) input.focus();
    };

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = normalizeQuery(input.value);
        input.value = query;
        if (!dispatch(query, "submit")) return;
        if (query) window.location.assign(searchHref(query));
    });
    input.addEventListener("input", () => {
        if (!input.value) dispatch("", "clear");
    });
    input.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !isCollapsed()) return;
        setOpen(false);
        toggle.focus();
    });
    toggle?.addEventListener("click", () => setOpen(!header.classList.contains("is-search-open")));
    document.addEventListener("keydown", (event) => {
        if (!isSearchShortcut(event, isEditable(event.target))) return;
        event.preventDefault();
        if (isCollapsed()) setOpen(true);
        else input.focus();
    });
}

// Sur le fil, « Catégories » est surligné tant que la section des genres est à l'écran.
function wireSectionHighlight(header, active) {
    if (active !== "feed" || typeof IntersectionObserver !== "function") return;
    const section = document.getElementById("categories");
    const link = header.querySelector('[data-nav-key="categories"]');
    if (!section || !link) return;
    const apply = (inView) => {
        const on = activeLinkKey(active, { categoriesInView: inView }) === "categories";
        link.classList.toggle("is-active", on);
        if (on) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
    };
    new IntersectionObserver((entries) => {
        entries.forEach((entry) => apply(entry.isIntersecting));
    }, { rootMargin: "-35% 0px -55% 0px" }).observe(section);
}

export function mountAppNav(options = {}) {
    const {
        rootId = "appNavRoot",
        variant = "classic",
        active = "feed",
        showPublish = true,
        showUser = true,
        showSearch = true,
        footer = true
    } = options;

    const root = document.getElementById(rootId);
    if (!root) return null;

    document.body.classList.add("li-app");
    // Sur la page de lecture, la reprise pointerait vers ce qu'on lit déjà.
    const resume = showUser && active !== "histoire" ? resumeTarget(listInProgress()) : null;
    root.innerHTML = renderNav({ active, showPublish, showUser, showSearch, resume });
    const header = root.querySelector(".li-appnav");
    wireBurger(header);
    wireSearch(header);
    wireSectionHighlight(header, active);
    if (footer) mountFooter();
    if (showUser) {
        bindNavSessionSnapshot();
        bindNavNotificationsBadge();
    }
    return { variant };
}

export function setNavPseudo(pseudo) {
    const value = String(pseudo || "").trim() || "Utilisateur";
    const el = document.getElementById("userPseudo");
    if (el) {
        el.textContent = value;
        el.classList.remove("is-loading");
    }

    const initialsEl = document.getElementById("navAvatarInitials");
    if (initialsEl) {
        applyInitialsAvatar(initialsEl, value);
    }

    const img = document.getElementById("navAvatarImg");
    const icon = document.getElementById("navAvatarIcon");
    if (img && icon && initialsEl) {
        const hasImage = Boolean(img.getAttribute("src")) && img.style.display !== "none";
        if (!hasImage && getAvatarInitials(value)) {
            initialsEl.style.display = "inline-flex";
            icon.style.display = "none";
        }
    }
}

export function setNavAvatar(avatarUrl) {
    const img = document.getElementById("navAvatarImg");
    const icon = document.getElementById("navAvatarIcon");
    const initialsEl = document.getElementById("navAvatarInitials");
    if (!img || !icon) return;

    const value = String(avatarUrl || "").trim();
    if (!value) {
        img.style.display = "none";
        img.removeAttribute("src");
        if (initialsEl && initialsEl.textContent.trim()) {
            initialsEl.style.display = "inline-flex";
            icon.style.display = "none";
        } else {
            if (initialsEl) initialsEl.style.display = "none";
            icon.style.display = "";
        }
        return;
    }

    img.src = value;
    img.onerror = function handleAvatarError() {
        img.onerror = null;
        img.style.display = "none";
        img.removeAttribute("src");
        if (initialsEl && initialsEl.textContent.trim()) {
            initialsEl.style.display = "inline-flex";
            icon.style.display = "none";
        } else {
            icon.style.display = "";
        }
    };
    img.style.display = "block";
    if (initialsEl) initialsEl.style.display = "none";
    icon.style.display = "none";
}

function bindNavSessionSnapshot() {
    try {
        const raw = localStorage.getItem("loveInk_user");
        if (!raw) return;

        const session = JSON.parse(raw);
        if (!session || typeof session !== "object") return;
        if (session.pseudo) setNavPseudo(session.pseudo);
        setNavAvatar(session.avatar || "");
    } catch (_) {
        // Ignore malformed session values.
    }
}

export function setNavNotificationsBadge(count) {
    const value = Number(count || 0);

    const badge = document.getElementById("navNotifBadge");
    if (badge) {
        if (value <= 0) {
            badge.style.display = "none";
            badge.textContent = "0";
        } else {
            badge.style.display = "inline-flex";
            badge.textContent = value > 99 ? "99+" : String(value);
        }
    }

    const dot = document.getElementById("navNotifBellDot");
    if (dot) {
        dot.style.display = value > 0 ? "block" : "none";
    }

    const bell = document.getElementById("navNotifBell");
    if (bell) bell.setAttribute("aria-label", bellLabel(value));
}

async function bindNavNotificationsBadge() {
    const badge = document.getElementById("navNotifBadge");
    if (!badge) return;

    let unsubNotif = null;

    try {
        const [{ auth }, { firebaseAPI }, { onAuthStateChanged }] = await Promise.all([
            import("../core/firebase-config.js"),
            import("../core/firebase-data.js"),
            import("https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js")
        ]);

        onAuthStateChanged(auth, (user) => {
            if (unsubNotif) { unsubNotif(); unsubNotif = null; }
            if (!user) {
                setNavNotificationsBadge(0);
                return;
            }
            unsubNotif = firebaseAPI.ecouterNotificationsNonLues(user.uid, (count) => {
                setNavNotificationsBadge(count);
            });
        });
    } catch (error) {
        console.warn("Notification badge indisponible:", error);
        setNavNotificationsBadge(0);
    }
}

export function wireNavInteractions(options = {}) {
    const {
        onLogout = null
    } = options;

    const { trigger, dropdown, openClass } = getNavBinding();
    const logoutBtn = document.getElementById("logoutBtn");

    function closeDropdown() {
        if (dropdown) {
            dropdown.classList.remove(openClass);
            trigger?.setAttribute("aria-expanded", "false");
        }
    }

    function onTriggerClick(event) {
        if (!dropdown) return;
        if (dropdown.contains(event.target)) return;
        event.stopPropagation();
        const open = dropdown.classList.toggle(openClass);
        trigger?.setAttribute("aria-expanded", String(open));
    }

    // Bouton natif : Entrée et Espace ouvrent déjà. Flèche bas ouvre et place le focus sur le premier lien.
    function onTriggerKeydown(event) {
        if (event.key !== "ArrowDown" || !dropdown) return;
        event.preventDefault();
        dropdown.classList.add(openClass);
        trigger?.setAttribute("aria-expanded", "true");
        dropdown.querySelector("a, button")?.focus();
    }

    function onDocumentClick(event) {
        if (!dropdown) return;
        if (trigger?.contains(event.target) || dropdown.contains(event.target)) return;
        closeDropdown();
    }

    function onDocumentKeydown(event) {
        if (event.key !== "Escape" || !dropdown?.classList.contains(openClass)) return;
        const hadFocus = dropdown.contains(document.activeElement);
        closeDropdown();
        if (hadFocus) trigger?.focus();
    }

    // Le menu se referme quand le focus clavier le quitte.
    function onFocusOut(event) {
        const wrapper = trigger?.parentElement;
        if (wrapper && event.relatedTarget && !wrapper.contains(event.relatedTarget)) closeDropdown();
    }

    async function onLogoutClick(event) {
        event.preventDefault();
        if (typeof onLogout === "function") {
            await onLogout(event);
        }
    }

    if (trigger && dropdown) {
        trigger.addEventListener("click", onTriggerClick);
        trigger.addEventListener("keydown", onTriggerKeydown);
        trigger.parentElement?.addEventListener("focusout", onFocusOut);
        document.addEventListener("click", onDocumentClick);
        document.addEventListener("keydown", onDocumentKeydown);
    }

    if (logoutBtn && typeof onLogout === "function") {
        logoutBtn.addEventListener("click", onLogoutClick);
    }

    return function cleanup() {
        if (trigger && dropdown) {
            trigger.removeEventListener("click", onTriggerClick);
            trigger.removeEventListener("keydown", onTriggerKeydown);
            trigger.parentElement?.removeEventListener("focusout", onFocusOut);
            document.removeEventListener("click", onDocumentClick);
            document.removeEventListener("keydown", onDocumentKeydown);
        }

        if (logoutBtn && typeof onLogout === "function") {
            logoutBtn.removeEventListener("click", onLogoutClick);
        }
    };
}

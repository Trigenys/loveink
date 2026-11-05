// nav-component.js - Barre de navigation partagee pour les pages Love Ink
import { initTheme } from "../core/theme.js";
import { applyInitialsAvatar, getAvatarInitials } from "./avatar-initials.js";

initTheme();

function injectSharedNavStyles() {
    if (document.getElementById("li-shared-nav-style")) return;

    const style = document.createElement("style");
    style.id = "li-shared-nav-style";
    style.textContent = `
        .nav-links a.is-active {
            color: #b76e6e !important;
            font-weight: 600;
        }

        .nav .nav-links a.is-active {
            color: var(--rose-deep, #7a3e3e) !important;
            font-weight: 600;
        }

        .li-nav-logout-separator {
            border-top: 1px solid rgba(180,120,120,0.18);
            margin-top: 4px;
        }

        .li-nav-notif-link {
            display: inline-flex !important;
            align-items: center;
            gap: 8px;
        }

        .li-nav-notif-badge {
            min-width: 18px;
            height: 18px;
            border-radius: 999px;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 0 5px;
            font-size: 10px;
            font-weight: 700;
            color: #fff;
            background: #b76e6e;
            line-height: 1;
        }

        .li-nav-bell {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            text-decoration: none;
            color: var(--rose-mid, #b07070);
            transition: background 0.15s;
            flex-shrink: 0;
        }

        .li-nav-bell:hover {
            background: rgba(180,120,120,0.12);
            color: var(--rose-deep, #7a3e3e);
        }

        .li-nav-bell i {
            font-size: 1.05rem;
        }

        .li-nav-bell-dot {
            position: absolute;
            top: 5px;
            right: 5px;
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #b76e6e;
            border: 2px solid #fff;
            display: none;
        }

        html[data-theme="dark"] .li-nav-bell-dot {
            border-color: #251c1c;
        }

        .li-nav-avatar-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
            display: none;
        }

        .li-nav-avatar-initials {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            border: 1px solid transparent;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .nav .li-feed-logo {
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
        }

        .nav .li-feed-logo .logo-icon {
            position: relative;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .nav .li-feed-logo .logo-heart {
            position: absolute;
            font-size: 2.5rem;
            color: #b76e6e;
            animation: li-logo-beat 1.5s ease-in-out infinite;
        }

        .nav .li-feed-logo .logo-hand {
            position: relative;
            font-size: 1.8rem;
            color: #f4d1b9;
            transform: rotate(-15deg);
            margin-top: 5px;
            z-index: 2;
        }

        .nav .li-feed-logo .logo-pen {
            position: absolute;
            font-size: 1.2rem;
            color: #8b5a2b;
            transform: rotate(30deg);
            right: 8px;
            bottom: 8px;
            z-index: 3;
        }

        .nav .li-feed-logo .logo-text {
            font-family: 'Baskerville', serif;
            font-size: 2rem;
            color: #b76e6e;
            letter-spacing: 1px;
        }

        @keyframes li-logo-beat {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }

        html[data-theme="dark"] {
            color-scheme: dark;
            --rose-deep: #e2bcbc;
            --rose-mid: #d1a3a3;
            --rose-soft: #8e6767;
            --rose-pale: #3c2e2e;
            --rose-blush: #2e2323;
            --cream: #1e1717;
            --ink: #f2e5e0;
            --ink-muted: #c8b0b0;
            --ink-faint: #9f8484;
            --border: rgba(214,176,176,0.18);
        }

        html[data-theme="dark"] body {
            background: #1c1515;
            color: #f2e5e0;
        }

        html[data-theme="dark"] .navbar,
        html[data-theme="dark"] .nav {
            background: rgba(37, 28, 28, 0.95) !important;
            border-bottom-color: #473737 !important;
        }
    `;

    document.head.appendChild(style);
}

function linkClass(isActive) {
    return isActive ? "is-active" : "";
}

function renderLoveInkLogo(href, extraClass = "") {
    return `
        <a href="${href}" class="logo-custom ${extraClass}">
            <div class="logo-icon">
                <i class="fas fa-heart logo-heart"></i>
                <i class="fas fa-hand-paper logo-hand"></i>
                <i class="fas fa-pen-fancy logo-pen"></i>
            </div>
            <span class="logo-text">Love Ink</span>
        </a>
    `;
}

function getNavBinding(variant) {
    if (variant === "feed") {
        return {
            trigger: document.getElementById("navUser"),
            dropdown: document.getElementById("navDropdown"),
            openClass: "open"
        };
    }

    return {
        trigger: document.getElementById("userProfile"),
        dropdown: document.getElementById("profileDropdown"),
        openClass: "show"
    };
}

function renderClassicNav({ active, showPublish, showUser }) {
    return `
        <nav class="navbar">
            <div class="container">
                ${renderLoveInkLogo("feed.html")}

                <ul class="nav-links">
                    <li><a class="${linkClass(active === "feed")}" href="feed.html">Accueil</a></li>
                    <li><a class="${linkClass(active === "categories")}" href="feed.html#categories">Categories</a></li>
                    <li><a class="${linkClass(active === "messagerie")}" href="messagerie.html">Messagerie</a></li>
                    <li><a class="${linkClass(active === "decouvrir")}" href="feed.html#categories">Decouvrir</a></li>
                    ${showPublish ? `<li><a class="${linkClass(active === "publier")}" href="publier.html">Publier</a></li>` : ""}
                </ul>

                ${showUser ? `
                    <a href="notifications.html" class="li-nav-bell" id="navNotifBell" aria-label="Notifications">
                        <i class="fas fa-bell"></i>
                        <span class="li-nav-bell-dot" id="navNotifBellDot"></span>
                    </a>
                    <div class="user-profile" id="userProfile">
                        <div class="avatar">
                            <img id="navAvatarImg" class="li-nav-avatar-img" alt="Avatar utilisateur">
                            <span id="navAvatarInitials" class="li-nav-avatar-initials" aria-hidden="true"></span>
                            <i class="fas fa-user-circle" id="navAvatarIcon"></i>
                            <span class="online-indicator"></span>
                        </div>
                        <span id="userPseudo">Chargement...</span>
                        <i class="fas fa-chevron-down"></i>

                        <div class="profile-dropdown" id="profileDropdown">
                            <a href="profil.html"><i class="fas fa-user"></i> Mon profil</a>
                            <a href="mes-histoires.html"><i class="fas fa-book"></i> Mes histoires</a>
                            <a href="notifications.html" class="li-nav-notif-link"><i class="fas fa-bell"></i> Notifications <span id="navNotifBadge" class="li-nav-notif-badge">0</span></a>
                            <a href="parametres.html"><i class="fas fa-cog"></i> Parametres</a>
                            <a href="#" id="logoutBtn" class="li-nav-logout-separator"><i class="fas fa-sign-out-alt"></i> Deconnexion</a>
                        </div>
                    </div>
                ` : ""}
            </div>
        </nav>
    `;
}

function renderFeedNav({ active, showUser }) {
    return `
        <nav class="nav">
            ${renderLoveInkLogo("feed.html", "li-feed-logo")}

            <ul class="nav-links">
                <li><a class="${linkClass(active === "feed")}" href="feed.html">Accueil</a></li>
                <li><a class="${linkClass(active === "categories")}" href="feed.html#categories">Categories</a></li>
                <li><a class="${linkClass(active === "messagerie")}" href="messagerie.html">Messagerie</a></li>
                <li><a class="${linkClass(active === "decouvrir")}" href="feed.html#categories">Decouvrir</a></li>
                <li class="nav-publish">
                    <a class="${linkClass(active === "publier")}" href="publier.html">
                        <i class="fas fa-plus" style="font-size:11px;margin-right:6px"></i>Publier
                    </a>
                </li>
            </ul>

            ${showUser ? `
                <a href="notifications.html" class="li-nav-bell" id="navNotifBell" aria-label="Notifications">
                    <i class="fas fa-bell"></i>
                    <span class="li-nav-bell-dot" id="navNotifBellDot"></span>
                </a>
                <div class="nav-user" id="navUser">
                    <div class="nav-avatar">
                        <img id="navAvatarImg" class="li-nav-avatar-img" alt="Avatar utilisateur">
                        <span id="navAvatarInitials" class="li-nav-avatar-initials" aria-hidden="true"></span>
                        <i class="fas fa-user-circle" id="navAvatarIcon"></i>
                        <span class="online-dot"></span>
                    </div>
                    <span class="nav-username" id="userPseudo">Chargement...</span>
                    <i class="fas fa-chevron-down nav-dropdown-arrow"></i>
                    <div class="nav-dropdown" id="navDropdown">
                        <a href="profil.html"><i class="fas fa-user"></i> Mon profil</a>
                        <a href="mes-histoires.html"><i class="fas fa-book-open"></i> Mes histoires</a>
                        <a href="notifications.html" class="li-nav-notif-link"><i class="fas fa-bell"></i> Notifications <span id="navNotifBadge" class="li-nav-notif-badge">0</span></a>
                        <a href="parametres.html"><i class="fas fa-sliders-h"></i> Parametres</a>
                        <a href="#" id="logoutBtn" class="li-nav-logout-separator"><i class="fas fa-sign-out-alt"></i> Deconnexion</a>
                    </div>
                </div>
            ` : ""}
        </nav>
    `;
}

export function mountAppNav(options = {}) {
    const {
        rootId = "appNavRoot",
        variant = "classic",
        active = "feed",
        showPublish = true,
        showUser = true
    } = options;

    const root = document.getElementById(rootId);
    if (!root) return null;

    injectSharedNavStyles();

    if (variant === "feed") {
        root.innerHTML = renderFeedNav({ active, showUser });
        if (showUser) {
            bindNavSessionSnapshot();
            bindNavNotificationsBadge();
        }
        return { variant: "feed" };
    }

    root.innerHTML = renderClassicNav({ active, showPublish, showUser });
    if (showUser) {
        bindNavSessionSnapshot();
        bindNavNotificationsBadge();
    }
    return { variant: "classic" };
}

export function setNavPseudo(pseudo) {
    const value = String(pseudo || "").trim() || "Utilisateur";
    const el = document.getElementById("userPseudo");
    if (el) {
        el.textContent = value;
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
        variant = "classic",
        onLogout = null
    } = options;

    const { trigger, dropdown, openClass } = getNavBinding(variant);
    const logoutBtn = document.getElementById("logoutBtn");

    function closeDropdown() {
        if (dropdown) {
            dropdown.classList.remove(openClass);
        }
    }

    function onTriggerClick(event) {
        if (!dropdown) return;
        event.stopPropagation();
        dropdown.classList.toggle(openClass);
    }

    function onDocumentClick(event) {
        if (!dropdown) return;
        if (trigger?.contains(event.target) || dropdown.contains(event.target)) return;
        closeDropdown();
    }

    function onDocumentKeydown(event) {
        if (event.key === "Escape") closeDropdown();
    }

    async function onLogoutClick(event) {
        event.preventDefault();
        if (typeof onLogout === "function") {
            await onLogout(event);
        }
    }

    if (trigger && dropdown) {
        trigger.addEventListener("click", onTriggerClick);
        document.addEventListener("click", onDocumentClick);
        document.addEventListener("keydown", onDocumentKeydown);
    }

    if (logoutBtn && typeof onLogout === "function") {
        logoutBtn.addEventListener("click", onLogoutClick);
    }

    return function cleanup() {
        if (trigger && dropdown) {
            trigger.removeEventListener("click", onTriggerClick);
            document.removeEventListener("click", onDocumentClick);
            document.removeEventListener("keydown", onDocumentKeydown);
        }

        if (logoutBtn && typeof onLogout === "function") {
            logoutBtn.removeEventListener("click", onLogoutClick);
        }
    };
}

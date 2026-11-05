// auth-session.js - Session et garde d'authentification partagees.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { firebaseAPI } from './firebase-data.js';
import { setThemeMode } from './theme.js';
import { startUserPresence, stopUserPresence } from './presence.js';

const SESSION_KEY = "loveInk_user";

export function getStoredSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
        console.warn("Session locale invalide:", error);
        return null;
    }
}

export function getUserPseudo(user) {
    if (!user) return "Utilisateur";
    const fromDisplayName = String(user.displayName || "").trim();
    if (fromDisplayName) return fromDisplayName;
    const email = String(user.email || "").trim();
    if (email.includes("@")) return email.split("@")[0];
    return "Utilisateur";
}

export function buildSessionPayload(user, overrides = {}) {
    return {
        uid: user?.uid || "",
        pseudo: getUserPseudo(user),
        email: user?.email || "",
        estConnecte: true,
        ...overrides
    };
}

export function saveUserSession(payload) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    return payload;
}

export function syncUserSession(user, overrides = {}) {
    const payload = buildSessionPayload(user, overrides);
    return saveUserSession(payload);
}

export function clearUserSession() {
    localStorage.removeItem(SESSION_KEY);
}

export function requireAuth(options = {}) {
    const {
        auth,
        redirectTo = "index.html",
        onReady
    } = options;

    if (!auth) throw new Error("requireAuth: l'instance auth est obligatoire.");

    return onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.__loveInkAuthReady = false;
            document.documentElement.dataset.authReady = "0";
            await stopUserPresence({ skipWrite: false });
            clearUserSession();
            window.location.href = redirectTo;
            return;
        }

        // Charger le profil Firestore pour role et statut.
        const profile = await firebaseAPI.getUtilisateur(user.uid);
        if (profile) {
            const statut = profile.statut || 'actif';
            if (statut === 'suspendu' || statut === 'banni') {
                await signOut(auth);
                clearUserSession();
                window.location.href = `index.html?compte=${statut}`;
                return;
            }
        }

        const previousSession = getStoredSession();
        const stickySession = previousSession && previousSession.uid === user.uid
            ? previousSession
            : {};
        // Mode avatar initiales: on neutralise toute URL d'image persistée.
        stickySession.avatar = "";

        // Enrichir la session avec role et statut depuis le profil.
        if (profile) {
            stickySession.role = profile.role || 'user';
            stickySession.statut = profile.statut || 'actif';
            if (profile.preferences && typeof profile.preferences === "object") {
                stickySession.preferences = profile.preferences;
                if (typeof profile.preferences.darkMode === "boolean") {
                    setThemeMode(profile.preferences.darkMode ? "dark" : "light", { persist: true });
                }
            }
        }

        // Presence en ligne (T14): heartbeat + cleanup best effort cote client.
        startUserPresence(user.uid);

        const session = syncUserSession(user, stickySession);
        window.__loveInkAuthReady = true;
        document.documentElement.dataset.authReady = "1";
        document.documentElement.dataset.authUid = String(user.uid || "");
        if (typeof onReady === "function") {
            await onReady(user, { pseudo: session.pseudo, session });
        }
    });
}

export async function logoutAndRedirect(options = {}) {
    const {
        auth,
        redirectTo = "index.html"
    } = options;

    if (!auth) throw new Error("logoutAndRedirect: l'instance auth est obligatoire.");

    await stopUserPresence({ skipWrite: false });
    await signOut(auth);
    clearUserSession();
    window.location.href = redirectTo;
}

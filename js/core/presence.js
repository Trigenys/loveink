// presence.js - Presence utilisateur (mode Spark, sans Cloud Functions)
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const HEARTBEAT_MS = 45 * 1000;
const ONLINE_GRACE_MS = HEARTBEAT_MS * 2 + 15 * 1000;

let tracker = null;

function makeSessionId() {
    try {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    } catch (_) {
        // Fallback below.
    }

    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getPageLabel() {
    try {
        return String(window.location?.pathname || "/").slice(0, 120);
    } catch (_) {
        return "/";
    }
}

async function writePresence(uid, payload) {
    if (!uid) return;
    try {
        await setDoc(doc(db, "utilisateurs", uid), {
            uid,
            ...payload
        }, { merge: true });
    } catch (error) {
        console.warn("Presence write failed:", error?.message || error);
    }
}

async function markOnline(uid, sessionId) {
    await writePresence(uid, {
        enLigne: true,
        lastHeartbeat: serverTimestamp(),
        presenceSessionId: sessionId,
        presencePage: getPageLabel()
    });
}

async function markOffline(uid, sessionId) {
    await writePresence(uid, {
        enLigne: false,
        lastHeartbeat: serverTimestamp(),
        lastSeen: serverTimestamp(),
        presenceSessionId: sessionId || null,
        presencePage: getPageLabel()
    });
}

export function isUserOnline(profile, graceMs = ONLINE_GRACE_MS) {
    if (!profile || profile.enLigne !== true) return false;

    const raw = profile.lastHeartbeat;
    const date = raw?.toDate ? raw.toDate() : new Date(raw || 0);
    if (Number.isNaN(date.getTime())) return false;
    return (Date.now() - date.getTime()) <= Number(graceMs);
}

export function getPresenceMeta(profile, graceMs = ONLINE_GRACE_MS) {
    const online = isUserOnline(profile, graceMs);
    const raw = profile?.lastSeen;
    const lastSeenDate = raw?.toDate ? raw.toDate() : new Date(raw || 0);

    return {
        online,
        lastSeen: Number.isNaN(lastSeenDate.getTime()) ? null : lastSeenDate
    };
}

function cleanupListeners(state) {
    if (!state) return;
    if (state.intervalId) clearInterval(state.intervalId);

    window.removeEventListener("focus", state.onFocus);
    document.removeEventListener("visibilitychange", state.onVisibilityChange);
    window.removeEventListener("pagehide", state.onPageHide, true);
    window.removeEventListener("beforeunload", state.onBeforeUnload, true);
}

export function startUserPresence(uid) {
    const safeUid = String(uid || "").trim();
    if (!safeUid) return;

    if (tracker?.uid === safeUid) return;
    if (tracker) stopUserPresence({ skipWrite: false });

    const sessionId = makeSessionId();
    const state = {
        uid: safeUid,
        sessionId,
        intervalId: null,
        stopped: false,
        onFocus: () => { void markOnline(safeUid, sessionId); },
        onVisibilityChange: () => {
            if (document.visibilityState === "visible") {
                void markOnline(safeUid, sessionId);
            }
        },
        onPageHide: () => {
            if (state.stopped) return;
            state.stopped = true;
            void markOffline(safeUid, sessionId);
        },
        onBeforeUnload: () => {
            if (state.stopped) return;
            state.stopped = true;
            void markOffline(safeUid, sessionId);
        }
    };

    window.addEventListener("focus", state.onFocus);
    document.addEventListener("visibilitychange", state.onVisibilityChange);
    window.addEventListener("pagehide", state.onPageHide, true);
    window.addEventListener("beforeunload", state.onBeforeUnload, true);

    state.intervalId = window.setInterval(() => {
        if (state.stopped) return;
        void markOnline(safeUid, sessionId);
    }, HEARTBEAT_MS);

    tracker = state;
    void markOnline(safeUid, sessionId);
}

export async function stopUserPresence(options = {}) {
    const { skipWrite = false } = options;
    if (!tracker) return;

    const state = tracker;
    tracker = null;
    state.stopped = true;
    cleanupListeners(state);

    if (!skipWrite) {
        await markOffline(state.uid, state.sessionId);
    }
}


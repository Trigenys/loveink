// avatar-initials.js - Utilitaires pour avatars base sur initiales (sans image)

function toSafePseudo(value) {
    return String(value || "").trim();
}

export function getAvatarInitials(pseudo) {
    const safe = toSafePseudo(pseudo);
    if (!safe) return "LI";

    const parts = safe
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (!parts.length) return "LI";
    if (parts.length === 1) {
        const letters = [...parts[0]];
        const first = letters[0] || "L";
        const second = letters[1] || "";
        return (first + second).toUpperCase();
    }

    return ((parts[0][0] || "") + (parts[1][0] || "")).toUpperCase();
}

function hashString(value) {
    let hash = 0;
    for (const char of value) {
        hash = (hash << 5) - hash + char.charCodeAt(0);
        hash |= 0;
    }
    return Math.abs(hash);
}

export function getAvatarPalette(pseudo) {
    const safe = toSafePseudo(pseudo) || "Love Ink";
    const hue = hashString(safe) % 360;

    return {
        background: `hsl(${hue} 48% 86%)`,
        color: `hsl(${hue} 45% 30%)`,
        border: `hsl(${hue} 35% 74%)`
    };
}

export function applyInitialsAvatar(element, pseudo) {
    if (!element) return;
    const initials = getAvatarInitials(pseudo);
    const palette = getAvatarPalette(pseudo);
    element.textContent = initials;
    element.style.background = palette.background;
    element.style.color = palette.color;
    element.style.borderColor = palette.border;
}

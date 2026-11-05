// ui-notify.js - Helper unique pour les notifications UI.

function callModal(type, message, options) {
    if (!window.Modale || typeof window.Modale[type] !== "function") return null;
    return window.Modale[type](message, options);
}

export function notify(type, message, options = {}) {
    const safeType = typeof type === "string" ? type : "info";
    const modalResult = callModal(safeType, message, options);
    if (modalResult) return modalResult;

    if (safeType === "confirm") {
        return Promise.resolve(window.confirm(String(message)));
    }

    window.alert(String(message));
    return Promise.resolve(true);
}

export function notifyInfo(message, options = {}) {
    return notify("info", message, options);
}

export function notifySuccess(message, options = {}) {
    return notify("success", message, options);
}

export function notifyWarning(message, options = {}) {
    return notify("warning", message, options);
}

export function notifyError(message, options = {}) {
    return notify("error", message, options);
}

export function notifyConfirm(message, options = {}) {
    return notify("confirm", message, options);
}

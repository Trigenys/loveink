// modale.js - Petite librairie de modales reutilisable pour Love Ink
(function initModaleLibrary(global) {
    if (global.Modale) return;

    function readVar(name, fallback) {
        try {
            const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return value || fallback;
        } catch {
            return fallback;
        }
    }

    function getThemePalette() {
        return {
            roseDeep: readVar("--rose-deep", "#7a3e3e"),
            roseMid: readVar("--rose-mid", "#b07070"),
            roseSoft: readVar("--rose-soft", "#d4a0a0"),
            rosePale: readVar("--rose-pale", "#f0e0dc"),
            roseBlush: readVar("--rose-blush", "#faf4f2"),
            cream: readVar("--cream", "#fdf8f5"),
            ink: readVar("--ink", "#2a1a1a"),
            inkMuted: readVar("--ink-muted", "#6b4a40"),
            border: readVar("--border", "rgba(180,120,120,0.15)"),
            fontSerif: readVar("--font-serif", "Cormorant Garamond, Georgia, serif"),
            fontSans: readVar("--font-sans", "DM Sans, Century Gothic, sans-serif")
        };
    }

    function getTypeConfig() {
        const palette = getThemePalette();
        return {
            info: { icon: "fa-circle-info", color: palette.roseMid, defaultTitle: "Information" },
            success: { icon: "fa-circle-check", color: "#4b9a6b", defaultTitle: "Succes" },
            warning: { icon: "fa-triangle-exclamation", color: "#c6863a", defaultTitle: "Attention" },
            error: { icon: "fa-circle-xmark", color: "#b35656", defaultTitle: "Erreur" }
        };
    }

    let stylesInjected = false;
    let queue = Promise.resolve();

    function injectStyles() {
        if (stylesInjected) return;
        stylesInjected = true;

        const palette = getThemePalette();
        const style = document.createElement("style");
        style.id = "li-modale-styles";
        style.textContent = `
            .li-modale-overlay {
                position: fixed;
                inset: 0;
                background: rgba(42, 26, 26, 0.45);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2500;
                padding: 20px;
                backdrop-filter: blur(4px);
            }

            .li-modale-card {
                width: min(520px, 100%);
                background: ${palette.cream};
                border-radius: 18px;
                box-shadow: 0 24px 55px rgba(122, 62, 62, 0.2);
                border: 1px solid ${palette.border};
                overflow: hidden;
                color: ${palette.ink};
                font-family: ${palette.fontSans};
            }

            .li-modale-head {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 18px 22px;
                border-bottom: 1px solid ${palette.border};
                background: ${palette.roseBlush};
            }

            .li-modale-icon {
                font-size: 1.15rem;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: ${palette.rosePale};
            }

            .li-modale-title {
                margin: 0;
                font-family: ${palette.fontSerif};
                font-size: 1.9rem;
                font-weight: 600;
                letter-spacing: 0.01em;
                flex: 1;
                color: ${palette.roseDeep};
            }

            .li-modale-close {
                border: none;
                background: transparent;
                color: ${palette.inkMuted};
                font-size: 1.2rem;
                cursor: pointer;
                width: 32px;
                height: 32px;
                border-radius: 8px;
            }

            .li-modale-close:hover {
                background: ${palette.rosePale};
            }

            .li-modale-body {
                padding: 20px 22px 10px;
                line-height: 1.6;
                color: ${palette.inkMuted};
                white-space: pre-wrap;
                font-size: 15px;
            }

            .li-modale-foot {
                padding: 16px 22px 22px;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }

            .li-modale-btn {
                border: none;
                border-radius: 10px;
                font-size: 0.95rem;
                font-weight: 600;
                padding: 10px 18px;
                cursor: pointer;
                transition: filter 0.2s ease;
            }

            .li-modale-btn:hover {
                filter: brightness(0.95);
            }

            .li-modale-btn-secondary {
                background: ${palette.rosePale};
                color: ${palette.roseDeep};
            }

            .li-modale-btn-primary {
                color: #fff;
            }
        `;

        document.head.appendChild(style);
    }

    function enqueue(taskFn) {
        queue = queue.then(taskFn, taskFn);
        return queue;
    }

    function show(options) {
        return enqueue(() => new Promise((resolve) => {
            injectStyles();

            const {
                type = "info",
                title,
                message = "",
                confirmText = "OK",
                cancelText = "Annuler",
                showCancel = false,
                closeOnBackdrop = true,
                closeOnEsc = true
            } = options || {};

            const typeConfig = getTypeConfig();
            const config = typeConfig[type] || typeConfig.info;

            const overlay = document.createElement("div");
            overlay.className = "li-modale-overlay";

            const card = document.createElement("div");
            card.className = "li-modale-card";
            card.setAttribute("role", "dialog");
            card.setAttribute("aria-modal", "true");

            const head = document.createElement("div");
            head.className = "li-modale-head";

            const icon = document.createElement("i");
            icon.className = `fas ${config.icon} li-modale-icon`;
            icon.style.color = config.color;

            const titleEl = document.createElement("h3");
            titleEl.className = "li-modale-title";
            titleEl.textContent = title || config.defaultTitle;

            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.className = "li-modale-close";
            closeBtn.setAttribute("aria-label", "Fermer");
            closeBtn.innerHTML = "&times;";

            head.append(icon, titleEl, closeBtn);

            const body = document.createElement("div");
            body.className = "li-modale-body";
            body.textContent = String(message);

            const foot = document.createElement("div");
            foot.className = "li-modale-foot";

            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.className = "li-modale-btn li-modale-btn-secondary";
            cancelBtn.textContent = cancelText;

            const confirmBtn = document.createElement("button");
            confirmBtn.type = "button";
            confirmBtn.className = "li-modale-btn li-modale-btn-primary";
            confirmBtn.style.background = config.color;
            confirmBtn.textContent = confirmText;

            if (showCancel) {
                foot.appendChild(cancelBtn);
            }
            foot.appendChild(confirmBtn);

            card.append(head, body, foot);
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            const previousOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";

            function cleanup(result) {
                document.removeEventListener("keydown", onKeydown);
                document.body.style.overflow = previousOverflow;
                overlay.remove();
                resolve(result);
            }

            function onKeydown(event) {
                if (closeOnEsc && event.key === "Escape") {
                    cleanup(false);
                }
            }

            overlay.addEventListener("click", (event) => {
                if (closeOnBackdrop && event.target === overlay) {
                    cleanup(false);
                }
            });

            confirmBtn.addEventListener("click", () => cleanup(true));
            cancelBtn.addEventListener("click", () => cleanup(false));
            closeBtn.addEventListener("click", () => cleanup(false));
            document.addEventListener("keydown", onKeydown);

            confirmBtn.focus();
        }));
    }

    const api = {
        show,
        info(message, options = {}) {
            return show({ ...options, type: "info", message, showCancel: false });
        },
        success(message, options = {}) {
            return show({ ...options, type: "success", message, showCancel: false });
        },
        warning(message, options = {}) {
            return show({ ...options, type: "warning", message, showCancel: false });
        },
        error(message, options = {}) {
            return show({ ...options, type: "error", message, showCancel: false });
        },
        confirm(message, options = {}) {
            return show({
                ...options,
                type: options.type || "warning",
                message,
                showCancel: true,
                confirmText: options.confirmText || "Confirmer",
                cancelText: options.cancelText || "Annuler"
            });
        }
    };

    global.Modale = api;
    global.LoveInkModal = api;
})(window);

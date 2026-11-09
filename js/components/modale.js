// modale.js - Petite librairie de modales reutilisable pour Love Ink
(function initModaleLibrary(global) {
    if (global.Modale) return;

    // Charte Love Ink (memes valeurs que css/landing.css). Les tokens sont portes par la
    // modale elle-meme : les pages qui ne chargent pas landing.css (login, register...) ont le
    // meme rendu, et le theme sombre (html[data-theme="dark"]) reste suivi en direct.
    const FONTS_HREF = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,500&family=DM+Sans:wght@400;500;700&display=swap";

    function getTypeConfig() {
        return {
            info: { icon: "fa-feather", defaultTitle: "Information" },
            success: { icon: "fa-heart", defaultTitle: "C'est fait" },
            warning: { icon: "fa-triangle-exclamation", defaultTitle: "Attention" },
            error: { icon: "fa-circle-exclamation", defaultTitle: "Oups" }
        };
    }

    let stylesInjected = false;
    let queue = Promise.resolve();
    let modalCount = 0;

    function ensureFonts() {
        const loaded = Array.from(document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]'))
            .some((link) => /Cormorant\+Garamond/.test(link.href) && /DM\+Sans/.test(link.href));
        if (loaded || document.getElementById("li-modale-fonts")) return;
        const link = document.createElement("link");
        link.id = "li-modale-fonts";
        link.rel = "stylesheet";
        link.href = FONTS_HREF;
        document.head.appendChild(link);
    }

    function injectStyles() {
        if (stylesInjected || document.getElementById("li-modale-styles")) {
            stylesInjected = true;
            return;
        }
        stylesInjected = true;
        ensureFonts();

        const style = document.createElement("style");
        style.id = "li-modale-styles";
        style.textContent = `
            .li-modale-overlay {
                --lm-deep: #7a3e3e; --lm-pale: #f5e6e6; --lm-brand: #b76e6e; --lm-paper: #ffffff;
                --lm-ink: #2a1a1a; --lm-ink-muted: #6b4f4f; --lm-border: rgba(180, 120, 120, 0.2);
                --lm-on-deep: #fdf8f5; --lm-veil: rgba(42, 26, 26, 0.42);
                --lm-serif: 'Cormorant Garamond', 'Baskerville', Georgia, serif;
                --lm-sans: 'DM Sans', system-ui, sans-serif;
                --lm-ease: cubic-bezier(0.22, 1, 0.36, 1);
                position: fixed;
                inset: 0;
                background: var(--lm-veil);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2500;
                padding: 16px;
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                animation: li-modale-fade 0.25s ease both;
            }

            html[data-theme="dark"] .li-modale-overlay {
                --lm-deep: #e2bcbc; --lm-pale: #3c2e2e; --lm-brand: #e2bcbc; --lm-paper: #261d1d;
                --lm-ink: #f2e5e0; --lm-ink-muted: #c8b0b0; --lm-border: rgba(214, 176, 176, 0.18);
                --lm-on-deep: #1e1717; --lm-veil: rgba(0, 0, 0, 0.6);
            }

            .li-modale-card {
                position: relative;
                width: min(440px, 100%);
                max-height: calc(100vh - 32px);
                overflow: auto;
                background: var(--lm-paper);
                border: 1px solid var(--lm-border);
                border-radius: 20px;
                box-shadow: 0 30px 70px -24px rgba(122, 62, 62, 0.45), 0 10px 40px rgba(183, 110, 110, 0.1);
                color: var(--lm-ink);
                font-family: var(--lm-sans);
                text-align: center;
                padding: 40px 36px 30px;
                animation: li-modale-rise 0.45s var(--lm-ease) both;
            }

            .li-modale-card::before {
                content: "";
                position: absolute;
                inset: 0 0 auto 0;
                height: 6px;
                background: linear-gradient(90deg, #e2bcbc, #b76e6e 50%, #e2bcbc);
            }

            .li-modale-head {
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .li-modale-icon {
                width: 72px;
                height: 72px;
                margin: 0 auto 18px;
                border-radius: 50%;
                display: grid;
                place-items: center;
                font-size: 1.6rem;
                color: #7a3e3e;
                background: radial-gradient(circle at 30% 25%, #fff, #e4cfc9);
                box-shadow: 0 12px 30px -12px rgba(183, 110, 110, 0.45), inset 0 0 0 1px rgba(183, 110, 110, 0.18);
            }

            .li-modale-card--warning .li-modale-icon { color: #9e5a5a; background: radial-gradient(circle at 30% 25%, #fff6f3, #f3d9d4); }
            .li-modale-card--error .li-modale-icon { color: #a13a3a; background: radial-gradient(circle at 30% 25%, #fff, #efe3df); }
            .li-modale-card--success .li-modale-icon::before { display: inline-block; animation: li-modale-pop 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) 0.1s both; }

            html[data-theme="dark"] .li-modale-card .li-modale-icon {
                color: #e2bcbc;
                background: radial-gradient(circle at 30% 25%, #3c2e2e, #2e2323);
            }
            html[data-theme="dark"] .li-modale-card--error .li-modale-icon { color: #f0a0a0; }

            .li-modale-title {
                margin: 0;
                font-family: var(--lm-serif);
                font-size: 2rem;
                font-weight: 600;
                line-height: 1.15;
                color: var(--lm-deep);
            }

            .li-modale-head::after {
                content: "";
                width: 56px;
                height: 3px;
                margin: 14px auto 0;
                border-radius: 3px;
                background: linear-gradient(90deg, #b76e6e, #e2bcbc);
            }

            .li-modale-close {
                position: absolute;
                top: 14px;
                right: 14px;
                width: 40px;
                height: 40px;
                border: none;
                border-radius: 50%;
                background: transparent;
                color: var(--lm-ink-muted);
                font-size: 1.6rem;
                line-height: 1;
                cursor: pointer;
                transition: background-color 0.2s, color 0.2s;
            }

            .li-modale-close:hover {
                background: var(--lm-pale);
                color: var(--lm-deep);
            }

            .li-modale-body {
                margin: 18px auto 0;
                max-width: 36ch;
                line-height: 1.65;
                color: var(--lm-ink-muted);
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                font-size: 1rem;
            }

            .li-modale-foot {
                margin-top: 26px;
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 10px;
            }

            .li-modale-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 140px;
                min-height: 44px;
                padding: 12px 28px;
                border: 1px solid transparent;
                border-radius: 999px;
                font-family: var(--lm-sans);
                font-size: 0.95rem;
                font-weight: 500;
                letter-spacing: 0.01em;
                cursor: pointer;
                transition: transform 0.4s var(--lm-ease), box-shadow 0.4s var(--lm-ease), background-color 0.3s;
            }

            .li-modale-btn:active { transform: scale(0.98); }

            .li-modale-btn-primary {
                background: var(--lm-deep);
                color: var(--lm-on-deep);
                box-shadow: 0 14px 30px -14px rgba(122, 62, 62, 0.55);
            }

            .li-modale-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 20px 36px -14px rgba(122, 62, 62, 0.6);
            }

            .li-modale-btn-secondary {
                background: transparent;
                border-color: var(--lm-border);
                color: var(--lm-deep);
            }

            .li-modale-btn-secondary:hover { background: var(--lm-pale); }

            .li-modale-btn:focus-visible,
            .li-modale-close:focus-visible {
                outline: 2px solid var(--lm-brand);
                outline-offset: 3px;
            }

            @keyframes li-modale-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes li-modale-rise { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
            @keyframes li-modale-pop { from { transform: scale(0.4) rotate(-20deg); opacity: 0; } to { transform: none; opacity: 1; } }

            @media (max-width: 480px) {
                .li-modale-card { padding: 36px 22px 24px; border-radius: 18px; }
                .li-modale-title { font-size: 1.7rem; }
                .li-modale-foot { flex-direction: column-reverse; }
                .li-modale-btn { width: 100%; }
            }

            @media (prefers-reduced-motion: reduce) {
                .li-modale-overlay, .li-modale-card, .li-modale-icon::before { animation: none !important; }
                .li-modale-btn { transition: none; }
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

            const uid = `li-modale-${++modalCount}`;
            const card = document.createElement("div");
            card.className = `li-modale-card li-modale-card--${typeConfig[type] ? type : "info"}`;
            card.setAttribute("role", type === "error" || showCancel ? "alertdialog" : "dialog");
            card.setAttribute("aria-modal", "true");
            card.setAttribute("aria-labelledby", `${uid}-title`);
            card.setAttribute("aria-describedby", `${uid}-body`);

            const head = document.createElement("div");
            head.className = "li-modale-head";

            const icon = document.createElement("i");
            icon.className = `fas ${config.icon} li-modale-icon`;
            icon.setAttribute("aria-hidden", "true");

            const titleEl = document.createElement("h3");
            titleEl.className = "li-modale-title";
            titleEl.id = `${uid}-title`;
            titleEl.textContent = title || config.defaultTitle;

            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.className = "li-modale-close";
            closeBtn.setAttribute("aria-label", "Fermer");
            closeBtn.innerHTML = "&times;";

            head.append(icon, titleEl);

            const body = document.createElement("div");
            body.className = "li-modale-body";
            body.id = `${uid}-body`;
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
            confirmBtn.textContent = confirmText;

            if (showCancel) {
                foot.appendChild(cancelBtn);
            }
            foot.appendChild(confirmBtn);

            card.append(closeBtn, head, body, foot);
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            const previousFocus = document.activeElement;
            const previousOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";

            function cleanup(result) {
                document.removeEventListener("keydown", onKeydown);
                document.body.style.overflow = previousOverflow;
                overlay.remove();
                if (previousFocus && typeof previousFocus.focus === "function" && document.contains(previousFocus)) {
                    previousFocus.focus();
                }
                resolve(result);
            }

            function onKeydown(event) {
                if (closeOnEsc && event.key === "Escape") {
                    cleanup(false);
                    return;
                }
                if (event.key === "Tab") {
                    // Le focus reste dans la modale (aria-modal).
                    const focusables = Array.from(card.querySelectorAll("button"));
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    if (!card.contains(document.activeElement)) {
                        event.preventDefault();
                        first.focus();
                    } else if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last.focus();
                    } else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first.focus();
                    }
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

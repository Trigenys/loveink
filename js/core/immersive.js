// immersive.js - comportements d'ambiance partages (charge en defer sur toutes les pages).
// Amelioration progressive : aucune dependance, aucun effet sur la logique metier.
(function () {
    'use strict';
    if (window.__liImmersive) return;
    window.__liImmersive = true;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    // Blocs reveles au defilement. Les elements deja animes par la page (.animate) sont ignores.
    var REVEAL_SELECTOR = [
        '.author-card', '.category-card', '.settings-card', '.candidature-card',
        '.stat-item', '.apropos-card', '.apropos-section', '.ops-section',
        '.section-title', '.categories-section'
    ].join(',');

    function ambient() {
        if (document.querySelector('.li-ambient')) return;
        var layer = document.createElement('div');
        layer.className = 'li-ambient';
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML = '<div class="li-ambient__blob li-ambient__blob--a"></div>' +
            '<div class="li-ambient__blob li-ambient__blob--b"></div>' +
            '<div class="li-ambient__halo"></div>';
        document.body.prepend(layer);

        var grain = document.createElement('div');
        grain.className = 'li-grain';
        grain.setAttribute('aria-hidden', 'true');
        document.body.appendChild(grain);

        if (reduceMotion || !finePointer) return;
        var pending = false, x = 0, y = 0;
        window.addEventListener('pointermove', function (e) {
            x = e.clientX; y = e.clientY;
            if (pending) return;
            pending = true;
            requestAnimationFrame(function () {
                layer.style.setProperty('--li-px', x + 'px');
                layer.style.setProperty('--li-py', y + 'px');
                pending = false;
            });
        }, { passive: true });
    }

    // Noms de transition uniques : un seul element par nom, sinon le navigateur annule la transition.
    function nameTransitions() {
        // Pages publiques : transition "page tournee" sur la racine, pas de morph nav/logo.
        if (document.documentElement.classList.contains('li-public')) return;
        var nav = document.querySelector('.navbar, nav.nav');
        if (nav && !nav.style.viewTransitionName) nav.style.viewTransitionName = 'li-nav';
        var logo = document.querySelector('.logo-custom, .logo');
        if (logo && !logo.style.viewTransitionName) logo.style.viewTransitionName = 'li-logo';
    }

    var io = ('IntersectionObserver' in window && !reduceMotion)
        ? new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0 })
        : null;

    function reveal(root) {
        if (!io) return;
        var nodes = (root || document).querySelectorAll(REVEAL_SELECTOR);
        var batch = 0;
        nodes.forEach(function (el) {
            if (el.dataset.liReveal || el.classList.contains('animate') || el.closest('.animate')) return;
            el.dataset.liReveal = '1';
            el.style.setProperty('--li-delay', Math.min(batch++ * 0.06, 0.36) + 's');
            el.classList.add('li-reveal');
            io.observe(el);
        });
    }

    function scrollState() {
        var nav = null, progress = null, ticking = false;
        var needsJsProgress = !(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'));
        if (/histoire\.html$/.test(location.pathname) || document.getElementById('storyContainer')) {
            progress = document.createElement('div');
            progress.className = 'li-progress';
            progress.setAttribute('aria-hidden', 'true');
            document.body.appendChild(progress);
        }
        function update() {
            ticking = false;
            nav = nav || document.querySelector('.navbar, nav.nav');
            if (nav) nav.classList.toggle('li-scrolled', window.scrollY > 8);
            // Un saut (ancre, scroll rapide) peut depasser un bloc sans qu'il croise la vue : on le revele.
            document.querySelectorAll('.li-reveal:not(.is-in)').forEach(function (el) {
                if (el.getBoundingClientRect().top < window.innerHeight) {
                    el.classList.add('is-in');
                    if (io) io.unobserve(el);
                }
            });
            if (progress && needsJsProgress) {
                var max = document.documentElement.scrollHeight - window.innerHeight;
                progress.style.setProperty('--li-read', max > 0 ? Math.min(window.scrollY / max, 1) : 0);
            }
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    function watchDom() {
        var queued = false;
        new MutationObserver(function () {
            if (queued) return;
            queued = true;
            requestAnimationFrame(function () {
                queued = false;
                nameTransitions();
                reveal(document);
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        ambient();
        nameTransitions();
        reveal(document);
        scrollState();
        watchDom();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

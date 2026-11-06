// Pages légales : révèle chaque chapitre quand il entre dans l'écran (classe is-seen).
(() => {
    const chapters = document.querySelectorAll('.lc-chapter');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        chapters.forEach((c) => c.classList.add('is-seen')); return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-seen'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    chapters.forEach((c) => io.observe(c));
})();

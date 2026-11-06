// Fond « encre » : remplit [data-ink-quill] avec des mots en filigrane et une plume
// qui écrit une phrase à intervalle régulier. Sans dépendance ; respecte prefers-reduced-motion.
(() => {
    const DEFAULT_WORDS = ['Premier amour', 'Coup de foudre', "Lettres d'été", 'Seconde chance', 'Amour à distance', 'Histoires tristes', 'Amour magique', "Jusqu'à l'aube"];
    const DEFAULT_PHRASES = ['Je t’aime', 'À jamais', 'Reviens-moi', 'Pour toujours', 'Si tu savais…', 'Mon cœur', 'Encore une page'];
    const SLOTS = [[4, 9, 9], [58, 16, 6], [12, 31, 7], [55, 41, 8], [2, 52, 6], [50, 63, 7], [8, 74, 8], [48, 86, 6]];

    const parseList = (v, fallback) => (v ? v.split('|').map((s) => s.trim()).filter(Boolean) : fallback);

    function mount(root) {
        const words = parseList(root.dataset.words, DEFAULT_WORDS);
        const phrases = parseList(root.dataset.phrases, DEFAULT_PHRASES);
        root.innerHTML = words.slice(0, SLOTS.length).map((w, i) => {
            const [x, y, s] = SLOTS[i];
            return `<span class="li-ink__word" style="--x:${x}%;--y:${y}%;--s:${s}vw;--f:${-i * 1.7}s">${w}</span>`;
        }).join('') +
            '<div class="li-ink__quill"><svg class="li-ink__script" viewBox="0 0 520 110" preserveAspectRatio="xMinYMid meet"><text x="6" y="78"></text></svg><i class="fas fa-feather-pointed li-ink__nib"></i></div>';

        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const quill = root.querySelector('.li-ink__quill');
        const script = quill.querySelector('text');
        const nib = quill.querySelector('.li-ink__nib');
        let i = Math.floor(Math.random() * phrases.length);
        const write = () => {
            if (document.hidden) return;
            script.textContent = phrases[i++ % phrases.length];
            const len = script.getComputedTextLength();
            quill.style.setProperty('--qx', `${8 + Math.random() * 50}vw`);
            quill.style.setProperty('--qy', `${18 + Math.random() * 60}vh`);
            quill.style.setProperty('--qw', `${quill.clientWidth * Math.min(1, (len + 12) / 520)}px`);
            for (const el of [quill, nib]) { el.classList.remove('is-writing'); void el.offsetWidth; el.classList.add('is-writing'); }
        };
        setTimeout(write, Number(root.dataset.firstDelay || 1500));
        setInterval(write, Number(root.dataset.interval || 11000));
    }

    const init = () => document.querySelectorAll('[data-ink-quill]').forEach(mount);
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();

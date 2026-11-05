// auth-form.js - aides partagees des formulaires d'authentification (register.html, login.html).
// Erreurs sous le champ (aria-invalid + aria-describedby), bouton occupe, affichage du mot de passe,
// messages d'erreur Firebase sans divulgation (on ne dit jamais si une adresse est inscrite).

export const PASSWORD_MIN = 8;

export function fieldError(input, message) {
    if (!input) return;
    const id = `${input.id}-error`;
    let box = document.getElementById(id);
    if (!message) {
        input.removeAttribute('aria-invalid');
        if (box) box.remove();
        const described = (input.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && x !== id);
        if (described.length) input.setAttribute('aria-describedby', described.join(' '));
        else input.removeAttribute('aria-describedby');
        return;
    }
    if (!box) {
        box = document.createElement('p');
        box.id = id;
        box.className = 'form-error';
        box.setAttribute('role', 'alert');
        (input.closest('.pw-field') || input.closest('.form-consent') || input).insertAdjacentElement('afterend', box);
    }
    box.textContent = message;
    input.setAttribute('aria-invalid', 'true');
    const described = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    if (!described.includes(id)) described.push(id);
    input.setAttribute('aria-describedby', described.join(' '));
}

export function clearErrors(form) {
    form.querySelectorAll('[aria-invalid]').forEach((el) => fieldError(el, null));
}

export function focusFirstInvalid(form) {
    const first = form.querySelector('[aria-invalid="true"]');
    if (first) first.focus();
    return Boolean(first);
}

export function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
        button.dataset.label = button.dataset.label || button.textContent;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = busyLabel || button.dataset.label;
    } else {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        if (button.dataset.label) button.textContent = button.dataset.label;
    }
}

export function wirePasswordToggles(root = document) {
    root.querySelectorAll('[data-toggle-password]').forEach((btn) => {
        const input = document.getElementById(btn.dataset.togglePassword);
        if (!input || btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.setAttribute('aria-pressed', String(show));
            btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
            btn.querySelector('i')?.classList.toggle('fa-eye', !show);
            btn.querySelector('i')?.classList.toggle('fa-eye-slash', show);
        });
    });
}

export function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

// Force estimee : longueur d'abord (recommandation NIST), variete ensuite. 0 faible, 1 moyen, 2 fort.
export function passwordStrength(pw, avoid = []) {
    const s = String(pw || '');
    if (s.length < PASSWORD_MIN) return 0;
    const lower = s.toLowerCase();
    if (avoid.some((a) => a && lower.includes(String(a).toLowerCase()))) return 0;
    const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((r) => r.test(s)).length;
    if (s.length >= 14 || (s.length >= 10 && variety >= 3)) return 2;
    return 1;
}

export function wireStrengthMeter(input, meter, getAvoid = () => []) {
    if (!input || !meter) return;
    const LABELS = ['Trop court ou trop previsible', 'Correct', 'Solide'];
    const update = () => {
        const v = input.value;
        if (!v) { meter.hidden = true; return; }
        const level = passwordStrength(v, getAvoid());
        meter.hidden = false;
        meter.dataset.level = String(level);
        meter.querySelector('.pw-meter__label').textContent = LABELS[level];
    };
    input.addEventListener('input', update);
    update();
}

const NETWORK = "Connexion impossible. Verifiez votre acces Internet puis reessayez.";
const GENERIC = "Une erreur est survenue. Reessayez dans un instant.";

export function authErrorMessage(error, context) {
    const code = error?.code || '';
    if (code === 'auth/network-request-failed') {
        return navigator.onLine === false ? "Aucune connexion Internet detectee." : NETWORK;
    }
    if (code === 'auth/too-many-requests') return "Trop de tentatives. Patientez quelques minutes avant de reessayer.";
    if (code === 'auth/unauthorized-domain') return "Ce site n'est pas autorise a se connecter. Contactez l'equipe Love Ink.";
    if (context === 'register') {
        if (code === 'auth/email-already-in-use') {
            return "Impossible de creer un compte avec cette adresse. Si vous avez deja un compte, connectez-vous ou reinitialisez votre mot de passe.";
        }
        if (code === 'auth/invalid-email') return "Adresse e-mail invalide.";
        if (code === 'auth/weak-password') return `Le mot de passe doit faire au moins ${PASSWORD_MIN} caracteres.`;
    }
    if (context === 'login') {
        if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-email', 'auth/invalid-login-credentials'].includes(code)) {
            return "E-mail ou mot de passe incorrect.";
        }
        if (code === 'auth/user-disabled') return "Ce compte est desactive.";
    }
    return GENERIC;
}

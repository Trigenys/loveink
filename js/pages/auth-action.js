// Page de retour des e-mails d'authentification (vérification d'adresse, nouveau mot de passe).
// Reçoit ?mode=verifyEmail|resetPassword&oobCode=…&continueUrl=… (liens Admin SDK ou Firebase).
import {
    applyActionCode, confirmPasswordReset, verifyPasswordResetCode
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { auth } from '../core/firebase-config.js';
import { notify } from '../components/ui-notify.js';
import {
    PASSWORD_MIN, authErrorMessage, clearErrors, fieldError, focusFirstInvalid,
    setBusy, wirePasswordToggles, wireStrengthMeter
} from '../components/auth-form.js';

const f = (id) => document.getElementById(id);
const states = ['stateLoading', 'stateVerified', 'stateReset', 'stateResetDone', 'stateError'];
const show = (id) => states.forEach((s) => { f(s).hidden = s !== id; });

const params = new URLSearchParams(location.search);
const mode = params.get('mode');
const code = params.get('oobCode');

// continueUrl : accepté seulement sur la même origine (évite les redirections ouvertes).
function safeContinue(fallback) {
    try {
        const u = new URL(params.get('continueUrl') || '', location.origin);
        if (u.origin === location.origin && !u.pathname.endsWith('/auth-action.html')) return u.pathname + u.search;
    } catch { /* ignoré */ }
    return fallback;
}

function fail(message) {
    f('errorText').textContent = message;
    show('stateError');
}

async function verifyEmail() {
    try {
        await applyActionCode(auth, code);
        f('verifiedCta').href = safeContinue('feed.html');
        show('stateVerified');
    } catch (error) {
        fail(error?.code === 'auth/invalid-action-code'
            ? 'Ce lien de confirmation a expiré ou a déjà été utilisé. Reconnectez-vous pour en recevoir un nouveau.'
            : authErrorMessage(error, 'login'));
    }
}

async function resetPassword() {
    let email;
    try {
        email = await verifyPasswordResetCode(auth, code);
    } catch {
        f('errorCta').textContent = 'Demander un nouveau lien';
        return fail('Ce lien de réinitialisation a expiré ou a déjà été utilisé. Vous pouvez en demander un nouveau depuis la page de connexion.');
    }
    f('resetAccount').textContent = email;
    show('stateReset');
    const form = f('resetForm');
    wirePasswordToggles(form);
    wireStrengthMeter(f('password'), f('pwMeter'), () => [email.split('@')[0]]);
    f('password').focus();
    let busy = false;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (busy) return;
        clearErrors(form);
        const pw = f('password').value;
        if (pw.length < PASSWORD_MIN) fieldError(f('password'), `Au moins ${PASSWORD_MIN} caractères.`);
        if (f('confirm').value !== pw) fieldError(f('confirm'), 'Les deux mots de passe ne correspondent pas.');
        if (form.querySelector('.form-error')) { focusFirstInvalid(form); return; }

        busy = true;
        setBusy(f('resetSubmit'), true, 'Enregistrement…');
        try {
            await confirmPasswordReset(auth, code, pw);
            show('stateResetDone');
        } catch (error) {
            busy = false;
            setBusy(f('resetSubmit'), false);
            if (error?.code === 'auth/weak-password') { fieldError(f('password'), 'Ce mot de passe est trop faible.'); f('password').focus(); return; }
            await notify('error', authErrorMessage(error, 'register'), { title: 'Nouveau mot de passe' });
        }
    });
}

if (!code || !mode) fail('Ce lien est incomplet. Ouvrez-le depuis l\'e-mail que vous avez reçu.');
else if (mode === 'verifyEmail') verifyEmail();
else if (mode === 'resetPassword') resetPassword();
else fail('Cette action n\'est pas prise en charge.');

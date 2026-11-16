// admin-metrics.js - Calculs purs du tableau de bord admin (sans Firebase : testables sous Node).
// Entrée : profils `utilisateurs` (champs existants : dateInscription, lastSeen, lastHeartbeat, role, statut)
// enrichis par la page (email, nbHistoires). Aucune écriture ici.

import { ROLES } from './roles.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Timestamp Firestore, Date, ISO ou millisecondes -> millisecondes (null si absent ou invalide).
export function toMillis(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    const ms = value instanceof Date ? value.getTime() : (typeof value === 'number' ? value : Date.parse(value));
    return Number.isFinite(ms) ? ms : null;
}

// Dernière activité connue : le plus récent de lastSeen (déconnexion) et lastHeartbeat (présence en cours).
export function lastActivityMs(account) {
    const values = [toMillis(account?.lastSeen), toMillis(account?.lastHeartbeat)].filter((v) => v !== null);
    return values.length ? Math.max(...values) : null;
}

export const accountRole = (account) => (ROLES.includes(account?.role) ? account.role : 'user');
export const accountStatut = (account) => String(account?.statut || 'actif');

// Normalise un compte pour l'affichage, le filtrage et le tri.
export function toAccountRow(account) {
    return {
        uid: String(account?.id || account?.uid || ''),
        pseudo: String(account?.pseudo || ''),
        email: String(account?.email || ''),
        role: accountRole(account),
        statut: accountStatut(account),
        inscription: toMillis(account?.dateInscription),
        derniereActivite: lastActivityMs(account),
        nbHistoires: Number.isFinite(account?.nbHistoires) ? account.nbHistoires : null
    };
}

export function computeAccountKpis(rows, now = Date.now()) {
    const since = (days) => now - days * DAY_MS;
    const parRole = Object.fromEntries(ROLES.map((role) => [role, 0]));
    const parStatut = {};
    let actifs7 = 0; let actifs30 = 0; let nouveaux7 = 0; let nouveaux30 = 0;
    for (const row of rows) {
        parRole[row.role] = (parRole[row.role] || 0) + 1;
        parStatut[row.statut] = (parStatut[row.statut] || 0) + 1;
        if (row.derniereActivite !== null && row.derniereActivite >= since(7)) actifs7 += 1;
        if (row.derniereActivite !== null && row.derniereActivite >= since(30)) actifs30 += 1;
        if (row.inscription !== null && row.inscription >= since(7)) nouveaux7 += 1;
        if (row.inscription !== null && row.inscription >= since(30)) nouveaux30 += 1;
    }
    return { total: rows.length, actifs7, actifs30, nouveaux7, nouveaux30, parRole, parStatut };
}

// Filtres : texte (pseudo, e-mail, uid), rôle, statut, activité ('7j' | '30j' | 'inactif30').
export function filterRows(rows, { texte = '', role = '', statut = '', activite = '' } = {}, now = Date.now()) {
    const needle = String(texte || '').trim().toLowerCase();
    const limit30 = now - 30 * DAY_MS;
    const limit7 = now - 7 * DAY_MS;
    return rows.filter((row) => {
        if (needle && !`${row.pseudo} ${row.email} ${row.uid}`.toLowerCase().includes(needle)) return false;
        if (role && row.role !== role) return false;
        if (statut && row.statut !== statut) return false;
        if (activite === '7j' && !(row.derniereActivite !== null && row.derniereActivite >= limit7)) return false;
        if (activite === '30j' && !(row.derniereActivite !== null && row.derniereActivite >= limit30)) return false;
        if (activite === 'inactif30' && row.derniereActivite !== null && row.derniereActivite >= limit30) return false;
        return true;
    });
}

export const SORT_KEYS = Object.freeze(['pseudo', 'email', 'inscription', 'derniereActivite', 'statut', 'role', 'nbHistoires']);

// Tri stable ; les valeurs absentes vont toujours en fin de liste, quel que soit le sens.
export function sortRows(rows, key = 'inscription', direction = 'desc') {
    if (!SORT_KEYS.includes(key)) return [...rows];
    const factor = direction === 'asc' ? 1 : -1;
    const rank = (row) => (key === 'role' ? ROLES.indexOf(row.role) : row[key]);
    return rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
            const va = rank(a.row); const vb = rank(b.row);
            const emptyA = va === null || va === undefined || va === '';
            const emptyB = vb === null || vb === undefined || vb === '';
            if (emptyA || emptyB) return emptyA === emptyB ? a.index - b.index : (emptyA ? 1 : -1);
            const cmp = typeof va === 'string' ? va.localeCompare(vb, 'fr', { sensitivity: 'base' }) : va - vb;
            return cmp === 0 ? a.index - b.index : cmp * factor;
        })
        .map(({ row }) => row);
}

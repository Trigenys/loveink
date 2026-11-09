// firebase-data.js - Fonctions de donnees Firestore (SDK v9 modulaire)
import { auth, db } from './firebase-config.js';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// ===== HISTOIRES =====

async function publierHistoire(titre, categorie, contenu, auteur, auteurId) {
    try {
        const histoire = {
            titre,
            auteur,
            auteurId,
            categorie,
            contenu,
            extrait: contenu.substring(0, 150) + "...",
            date: serverTimestamp(),
            likes: 0,
            commentaires: 0,
            image: getImageForCategory(categorie),
            statut: "en_attente"
        };

        const docRef = await addDoc(collection(db, 'histoires'), histoire);
        console.log("Histoire publiee avec ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Erreur publication:", error);
        return null;
    }
}

async function getHistoires(page = 1, itemsPerPage = 10, categorie = null, searchTerm = null) {
    try {
        // Cas principal du feed: recuperation limitee cote serveur (plus scalable).
        if ((!searchTerm || searchTerm.trim() === '') && Number(page) === 1) {
            const constraints = [where('statut', '==', 'publie')];
            if (categorie && categorie !== 'Toutes') {
                constraints.push(where('categorie', '==', categorie));
            }
            constraints.push(orderBy('date', 'desc'));
            constraints.push(limit(itemsPerPage));

            const snapshot = await getDocs(query(collection(db, 'histoires'), ...constraints));
            const histoires = snapshot.docs.map((snapshotDoc) => {
                const data = snapshotDoc.data();
                return {
                    id: snapshotDoc.id,
                    ...data,
                    date: data.date?.toDate ? data.date.toDate() : new Date()
                };
            });

            return {
                histoires,
                total: histoires.length,
                totalPages: null,
                currentPage: 1
            };
        }

        // Fallback legacy pour recherche texte locale/pagination non curseur.
        const constraints = [where('statut', '==', 'publie'), orderBy('date', 'desc')];
        if (categorie && categorie !== 'Toutes') {
            constraints.unshift(where('categorie', '==', categorie));
        }

        const snapshot = await getDocs(query(collection(db, 'histoires'), ...constraints));
        let histoires = snapshot.docs.map((snapshotDoc) => {
            const data = snapshotDoc.data();
            return {
                id: snapshotDoc.id,
                ...data,
                date: data.date?.toDate ? data.date.toDate() : new Date()
            };
        });

        if (searchTerm && searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            histoires = histoires.filter((h) =>
                (h.titre || '').toLowerCase().includes(term) ||
                (h.auteur || '').toLowerCase().includes(term) ||
                (h.contenu || '').toLowerCase().includes(term)
            );
        }

        const total = histoires.length;
        const startAt = Math.max(0, (page - 1) * itemsPerPage);
        const pageItems = histoires.slice(startAt, startAt + itemsPerPage);
        const totalPages = total === 0 ? 0 : Math.ceil(total / itemsPerPage);

        return {
            histoires: pageItems,
            total,
            totalPages,
            currentPage: page
        };
    } catch (error) {
        console.error("Erreur recuperation histoires:", error);
        return { histoires: [], total: 0, totalPages: 0, currentPage: page };
    }
}

async function getHistoireById(id) {
    try {
        const snapshotDoc = await getDoc(doc(db, 'histoires', String(id)));
        if (!snapshotDoc.exists()) {
            return null;
        }
        const data = snapshotDoc.data();
        return {
            id: snapshotDoc.id,
            ...data,
            date: data.date?.toDate ? data.date.toDate() : new Date()
        };
    } catch (error) {
        console.error("Erreur recuperation histoire:", error);
        return null;
    }
}

async function getHistoiresAuteur(auteurId, statut = null) {
    const uid = String(auteurId || '');
    if (!uid) return [];
    try {
        const constraints = [where('auteurId', '==', uid)];
        if (statut) constraints.push(where('statut', '==', statut));
        constraints.push(orderBy('date', 'desc'));
        const snapshot = await getDocs(query(collection(db, 'histoires'), ...constraints));
        return snapshot.docs.map((d) => {
            const data = d.data();
            return { id: d.id, ...data, date: data.date?.toDate ? data.date.toDate() : new Date() };
        });
    } catch (error) {
        console.error("Erreur getHistoiresAuteur:", error);
        return [];
    }
}

async function getHistoiresEnAttente(limite = 50) {
    try {
        const snapshot = await getDocs(query(
            collection(db, 'histoires'),
            where('statut', '==', 'en_attente'),
            orderBy('date', 'asc'),
            limit(limite)
        ));
        return snapshot.docs.map((d) => {
            const data = d.data();
            return { id: d.id, ...data, date: data.date?.toDate ? data.date.toDate() : new Date() };
        });
    } catch (error) {
        console.error("Erreur getHistoiresEnAttente:", error);
        return [];
    }
}

async function approuverHistoire(histoireId, moderateurId) {
    try {
        const histoireRef = doc(db, 'histoires', String(histoireId));
        const histoireSnap = await getDoc(histoireRef);
        const auteurId = histoireSnap.exists() ? String(histoireSnap.data()?.auteurId || '') : '';

        await updateDoc(histoireRef, {
            statut: 'publie',
            moderateurId: String(moderateurId),
            dateModeration: serverTimestamp(),
            motifRejet: null
        });
        await creerOpsLog('story_approve', {
            targetStoryId: String(histoireId),
            targetUserId: auteurId,
            message: 'Histoire approuvee'
        });
        return true;
    } catch (error) {
        console.error("Erreur approuverHistoire:", error);
        return false;
    }
}

// Coup de coeur editorial (#14) : marque (date de selection) ou retire ; la page d'accueil statique
// affiche la selection la plus recente au prochain rafraichissement SEO.
async function definirCoupDeCoeur(histoireId, moderateurId, actif) {
    try {
        await updateDoc(doc(db, 'histoires', String(histoireId)), {
            coupDeCoeur: actif ? serverTimestamp() : null,
            coupDeCoeurPar: String(moderateurId)
        });
        await creerOpsLog('story_coup_de_coeur', {
            targetStoryId: String(histoireId),
            message: actif ? 'Coup de coeur attribue' : 'Coup de coeur retire'
        });
        return true;
    } catch (error) {
        console.error("Erreur definirCoupDeCoeur:", error);
        return false;
    }
}

async function rejeterHistoire(histoireId, moderateurId, motif) {
    try {
        const histoireRef = doc(db, 'histoires', String(histoireId));
        const histoireSnap = await getDoc(histoireRef);
        const auteurId = histoireSnap.exists() ? String(histoireSnap.data()?.auteurId || '') : '';

        await updateDoc(histoireRef, {
            statut: 'rejete',
            moderateurId: String(moderateurId),
            dateModeration: serverTimestamp(),
            motifRejet: String(motif || '').substring(0, 1000)
        });
        await creerOpsLog('story_reject', {
            targetStoryId: String(histoireId),
            targetUserId: auteurId,
            message: 'Histoire rejetee',
            metadata: {
                motif: String(motif || '').substring(0, 200)
            }
        });
        return true;
    } catch (error) {
        console.error("Erreur rejeterHistoire:", error);
        return false;
    }
}

async function editerHistoireModeration(histoireId, moderateurId, edits = {}, options = {}) {
    const id = String(histoireId || '').trim();
    const modoId = String(moderateurId || '').trim();
    if (!id || !modoId) return { ok: false, error: 'invalid-args' };

    try {
        const snap = await getDoc(doc(db, 'histoires', id));
        if (!snap.exists()) return { ok: false, error: 'not-found' };

        const current = snap.data();
        if (String(current.statut || '') !== 'en_attente') {
            return { ok: false, error: 'invalid-status' };
        }

        const titre = String(edits.titre || '').trim();
        const categorie = String(edits.categorie || '').trim();
        const contenu = String(edits.contenu || '').trim();
        if (!titre || !categorie || !contenu) {
            return { ok: false, error: 'invalid-content' };
        }

        const shouldApprove = Boolean(options.approuver);
        const original = current.versionOriginale && typeof current.versionOriginale === 'object'
            ? current.versionOriginale
            : {
                titre: String(current.titre || ''),
                categorie: String(current.categorie || ''),
                contenu: String(current.contenu || ''),
                extrait: String(current.extrait || ''),
                image: String(current.image || ''),
                dateSoumission: current.date || null,
                captureParModerationLe: serverTimestamp()
            };

        await updateDoc(doc(db, 'histoires', id), {
            titre,
            categorie,
            contenu,
            extrait: contenu.substring(0, 150) + "...",
            image: getImageForCategory(categorie),
            statut: shouldApprove ? 'publie' : 'en_attente',
            motifRejet: null,
            moderateurId: modoId,
            dateModeration: serverTimestamp(),
            dateEditionModeration: serverTimestamp(),
            versionOriginale: original
        });

        await creerOpsLog('story_edit', {
            targetStoryId: id,
            targetUserId: String(current.auteurId || ''),
            message: shouldApprove ? 'Edition moderation + approbation' : 'Edition moderation en attente'
        });

        return { ok: true, statut: shouldApprove ? 'publie' : 'en_attente' };
    } catch (error) {
        console.error("Erreur editerHistoireModeration:", error);
        return { ok: false, error: error?.code || 'unknown' };
    }
}

// ===== LIKES =====

async function likerHistoire(histoireId, userId) {
    try {
        const histoireRef = doc(db, 'histoires', String(histoireId));
        const likeId = `${String(histoireId)}_${userId}`;
        const likeRef = doc(db, 'likes', likeId);
        const likeSnapshot = await getDoc(likeRef);

        // Like et compteur dans le meme batch : les regles verifient la coherence (existsAfter).
        const batch = writeBatch(db);
        if (!likeSnapshot.exists()) {
            batch.set(likeRef, {
                histoireId: String(histoireId),
                userId,
                date: serverTimestamp()
            });
            batch.update(histoireRef, { likes: increment(1) });
            await batch.commit();
            return { liked: true };
        }

        batch.delete(likeRef);
        batch.update(histoireRef, { likes: increment(-1) });
        await batch.commit();
        return { liked: false };
    } catch (error) {
        console.error("Erreur like:", error);
        return { liked: false, error };
    }
}

async function aLiker(histoireId, userId) {
    try {
        const likeId = `${String(histoireId)}_${userId}`;
        const likeSnapshot = await getDoc(doc(db, 'likes', likeId));
        return likeSnapshot.exists();
    } catch (error) {
        console.error("Erreur verification like:", error);
        return false;
    }
}

// ===== COMMENTAIRES =====

async function ajouterCommentaire(histoireId, auteur, auteurId, contenu) {
    try {
        // Commentaire et compteur dans le meme batch : les regles lient l'increment au commentaire cree.
        const commentRef = doc(collection(db, 'commentaires'));
        const batch = writeBatch(db);
        batch.set(commentRef, {
            histoireId: String(histoireId),
            auteur,
            auteurId,
            contenu,
            date: serverTimestamp(),
            likes: 0
        });
        batch.update(doc(db, 'histoires', String(histoireId)), {
            commentaires: increment(1),
            dernierCommentaireId: commentRef.id
        });
        await batch.commit();

        return true;
    } catch (error) {
        console.error("Erreur commentaire:", error);
        return false;
    }
}

async function getCommentaires(histoireId) {
    try {
        const snapshot = await getDocs(query(
            collection(db, 'commentaires'),
            where('histoireId', '==', String(histoireId)),
            orderBy('date', 'asc')
        ));

        return snapshot.docs.map((snapshotDoc) => {
            const data = snapshotDoc.data();
            return {
                id: snapshotDoc.id,
                ...data,
                date: data.date?.toDate ? data.date.toDate() : new Date()
            };
        });
    } catch (error) {
        console.error("Erreur recuperation commentaires:", error);
        return [];
    }
}

// ===== ABONNEMENTS (FOLLOW) =====

async function suivreAuteur(abonneId, auteurId) {
    try {
        const abonnementId = `${abonneId}_${auteurId}`;
        const abonnementRef = doc(db, 'abonnements', abonnementId);
        const snapshot = await getDoc(abonnementRef);

        if (!snapshot.exists()) {
            await setDoc(abonnementRef, {
                abonneId,
                auteurId,
                date: serverTimestamp()
            });

            return { following: true };
        }

        await deleteDoc(abonnementRef);
        return { following: false };
    } catch (error) {
        console.error("Erreur abonnement:", error);
        return { following: false, error };
    }
}

async function estAbonne(abonneId, auteurId) {
    try {
        const abonnementId = `${abonneId}_${auteurId}`;
        const snapshot = await getDoc(doc(db, 'abonnements', abonnementId));
        return snapshot.exists();
    } catch (error) {
        console.error("Erreur verification abonnement:", error);
        return false;
    }
}

async function getAbonnes(auteurId) {
    try {
        const snapshot = await getDocs(query(
            collection(db, 'abonnements'),
            where('auteurId', '==', auteurId)
        ));
        return snapshot.size;
    } catch (error) {
        console.error("Erreur recuperation abonnes:", error);
        return 0;
    }
}

async function getAbonnements(abonneId) {
    try {
        const snapshot = await getDocs(query(
            collection(db, 'abonnements'),
            where('abonneId', '==', abonneId)
        ));

        const abonnements = await Promise.all(snapshot.docs.map(async (abonnementDoc) => {
            const data = abonnementDoc.data();
            const userSnapshot = await getDoc(doc(db, 'utilisateurs', data.auteurId));
            if (!userSnapshot.exists()) return null;
            return {
                id: userSnapshot.id,
                ...userSnapshot.data()
            };
        }));

        return abonnements.filter(Boolean);
    } catch (error) {
        console.error("Erreur recuperation abonnements:", error);
        return [];
    }
}

// ===== NOTIFICATIONS =====

async function creerNotification(utilisateurId, type, message, histoireId = null) {
    try {
        // Durcissement: la creation de notifications vers d'autres users doit passer par backend fiable.
        if (!auth.currentUser || auth.currentUser.uid !== utilisateurId) {
            return false;
        }

        await addDoc(collection(db, 'notifications'), {
            utilisateurId,
            type,
            message,
            histoireId,
            lu: false,
            date: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Erreur creation notification:", error);
        return false;
    }
}

const MAX_NOTIFICATIONS = 50;

function toSafeString(value) {
    return String(value || '').trim();
}

function toDateValue(value) {
    if (value && typeof value.toDate === 'function') return value.toDate();
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getReadStorageKey(utilisateurId) {
    return `loveInk_notifs_read_${toSafeString(utilisateurId)}`;
}

function getReadMap(utilisateurId) {
    const key = getReadStorageKey(utilisateurId);
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

function saveReadMap(utilisateurId, readMap) {
    const key = getReadStorageKey(utilisateurId);
    try {
        localStorage.setItem(key, JSON.stringify(readMap));
    } catch (_) {
        // storage indisponible: ignore silencieusement
    }
}

function markReadLocally(utilisateurId, notificationId) {
    const uid = toSafeString(utilisateurId);
    const nid = toSafeString(notificationId);
    if (!uid || !nid) return;
    const readMap = getReadMap(uid);
    readMap[nid] = Date.now();
    saveReadMap(uid, readMap);
}

function storyLink(histoireId) {
    const id = toSafeString(histoireId);
    return id ? `histoire.html?id=${encodeURIComponent(id)}` : null;
}

function chunkArray(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

async function getPseudoByIds(userIds) {
    const ids = [...new Set((userIds || []).map(toSafeString).filter(Boolean))];
    const pseudoMap = new Map();
    await Promise.all(ids.map(async (uid) => {
        try {
            const snap = await getDoc(doc(db, 'utilisateurs', uid));
            const pseudo = snap.exists() ? toSafeString(snap.data()?.pseudo) : '';
            pseudoMap.set(uid, pseudo || "Quelqu'un");
        } catch (_) {
            pseudoMap.set(uid, "Quelqu'un");
        }
    }));
    return pseudoMap;
}

function buildNotificationItem(raw) {
    return {
        id: toSafeString(raw.id),
        type: toSafeString(raw.type) || 'system',
        message: toSafeString(raw.message) || 'Notification',
        histoireId: raw.histoireId ? toSafeString(raw.histoireId) : null,
        lien: raw.lien ? toSafeString(raw.lien) : null,
        lu: Boolean(raw.lu),
        date: toDateValue(raw.date),
        _actorId: raw._actorId ? toSafeString(raw._actorId) : '',
        _storyTitle: raw._storyTitle ? toSafeString(raw._storyTitle) : ''
    };
}

async function getNotifications(utilisateurId) {
    const uid = toSafeString(utilisateurId);
    if (!uid) return [];

    try {
        const notifications = [];
        const actorIds = new Set();

        const histoiresSnap = await getDocs(query(
            collection(db, 'histoires'),
            where('auteurId', '==', uid),
            limit(120)
        ));

        const histoires = histoiresSnap.docs.map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data()
        }));

        const histoiresMap = new Map(histoires.map((h) => [h.id, h]));
        const histoiresIds = histoires.map((h) => toSafeString(h.id)).filter(Boolean);

        // 1) Notifications de moderation (publie/rejete) basees sur l'etat des histoires de l'auteur.
        histoires.forEach((histoire) => {
            const statut = toSafeString(histoire.statut);
            if (statut !== 'publie' && statut !== 'rejete') return;

            const titre = toSafeString(histoire.titre) || 'Sans titre';
            if (statut === 'publie') {
                notifications.push(buildNotificationItem({
                    id: `story_status_${histoire.id}_publie`,
                    type: 'publication_approuvee',
                    message: `Votre histoire "${titre}" a ete approuvee et publiee`,
                    histoireId: histoire.id,
                    lien: storyLink(histoire.id),
                    date: histoire.dateModeration || histoire.date
                }));
                return;
            }

            const motif = toSafeString(histoire.motifRejet);
            notifications.push(buildNotificationItem({
                id: `story_status_${histoire.id}_rejete`,
                type: 'rejet',
                message: `Votre histoire "${titre}" a ete rejetee.${motif ? ` Motif: ${motif}` : ''}`,
                histoireId: histoire.id,
                lien: 'profil.html',
                date: histoire.dateModeration || histoire.date
            }));
        });

        // 2) Commentaires + likes sur les histoires de l'auteur.
        const storyChunks = chunkArray(histoiresIds, 10);
        for (const storyChunk of storyChunks) {
            const [commentsSnap, likesSnap] = await Promise.all([
                getDocs(query(
                    collection(db, 'commentaires'),
                    where('histoireId', 'in', storyChunk),
                    limit(200)
                )),
                getDocs(query(
                    collection(db, 'likes'),
                    where('histoireId', 'in', storyChunk),
                    limit(200)
                ))
            ]);

            commentsSnap.docs.forEach((snapshotDoc) => {
                const data = snapshotDoc.data();
                const actorId = toSafeString(data.auteurId);
                if (actorId && actorId === uid) return;

                const histoireId = toSafeString(data.histoireId);
                const storyTitle = toSafeString(histoiresMap.get(histoireId)?.titre) || 'Sans titre';
                const auteur = toSafeString(data.auteur);
                if (actorId) actorIds.add(actorId);

                notifications.push(buildNotificationItem({
                    id: `comment_${snapshotDoc.id}`,
                    type: 'commentaire',
                    message: auteur ? `${auteur} a commente votre histoire "${storyTitle}"` : '',
                    histoireId,
                    lien: storyLink(histoireId),
                    date: data.date,
                    _actorId: actorId,
                    _storyTitle: storyTitle
                }));
            });

            likesSnap.docs.forEach((snapshotDoc) => {
                const data = snapshotDoc.data();
                const actorId = toSafeString(data.userId);
                if (!actorId || actorId === uid) return;
                actorIds.add(actorId);

                const histoireId = toSafeString(data.histoireId);
                const storyTitle = toSafeString(histoiresMap.get(histoireId)?.titre) || 'Sans titre';

                notifications.push(buildNotificationItem({
                    id: `like_${snapshotDoc.id}`,
                    type: 'like',
                    message: '',
                    histoireId,
                    lien: storyLink(histoireId),
                    date: data.date,
                    _actorId: actorId,
                    _storyTitle: storyTitle
                }));
            });
        }

        // 3) Nouveaux abonnes de l'auteur.
        const abonnementsSnap = await getDocs(query(
            collection(db, 'abonnements'),
            where('auteurId', '==', uid),
            limit(200)
        ));

        abonnementsSnap.docs.forEach((snapshotDoc) => {
            const data = snapshotDoc.data();
            const actorId = toSafeString(data.abonneId);
            if (!actorId || actorId === uid) return;
            actorIds.add(actorId);

            notifications.push(buildNotificationItem({
                id: `follow_${snapshotDoc.id}`,
                type: 'follow',
                message: '',
                lien: 'profil.html',
                date: data.date,
                _actorId: actorId
            }));
        });

        // 4) Sanctions recues par l'utilisateur.
        const sanctionsSnap = await getDocs(query(
            collection(db, 'sanctions'),
            where('utilisateurId', '==', uid),
            limit(100)
        ));

        sanctionsSnap.docs.forEach((snapshotDoc) => {
            const data = snapshotDoc.data();
            const actorId = toSafeString(data.censeurId);
            if (actorId) actorIds.add(actorId);

            const type = toSafeString(data.type) || 'sanction';
            const motif = toSafeString(data.motif);

            notifications.push(buildNotificationItem({
                id: `sanction_${snapshotDoc.id}`,
                type: 'sanction',
                message: motif ? `Sanction (${type}). Motif: ${motif}` : `Sanction (${type})`,
                lien: 'notifications.html',
                date: data.dateDebut || data.dateCreation || new Date(),
                _actorId: actorId
            }));
        });

        // 5) Notifications systeme explicites (si presentes en base).
        const dbNotifsSnap = await getDocs(query(
            collection(db, 'notifications'),
            where('utilisateurId', '==', uid),
            limit(100)
        ));

        dbNotifsSnap.docs.forEach((snapshotDoc) => {
            const data = snapshotDoc.data();
            notifications.push(buildNotificationItem({
                id: `db_${snapshotDoc.id}`,
                type: data.type,
                message: data.message,
                histoireId: data.histoireId || null,
                lien: data.lien || null,
                lu: data.lu === true,
                date: data.date
            }));
        });

        const pseudoMap = await getPseudoByIds([...actorIds]);

        notifications.forEach((notification) => {
            if (notification.message) return;
            const actorName = pseudoMap.get(notification._actorId) || "Quelqu'un";

            if (notification.type === 'like') {
                notification.message = `${actorName} a aime votre histoire "${notification._storyTitle || 'Sans titre'}"`;
                return;
            }

            if (notification.type === 'follow') {
                notification.message = `${actorName} a commence a vous suivre`;
                return;
            }

            if (notification.type === 'commentaire') {
                notification.message = `${actorName} a commente votre histoire "${notification._storyTitle || 'Sans titre'}"`;
                return;
            }

            if (notification.type === 'sanction' && notification._actorId) {
                notification.message = `${actorName} a applique une sanction. ${notification.message}`;
            }
        });

        const readMap = getReadMap(uid);
        const uniqueMap = new Map();
        notifications.forEach((notification) => {
            const id = toSafeString(notification.id);
            if (!id) return;

            const merged = {
                ...notification,
                lu: Boolean(notification.lu || readMap[id])
            };
            delete merged._actorId;
            delete merged._storyTitle;

            // Evite les doublons si une source renvoie plusieurs fois le meme identifiant.
            uniqueMap.set(id, merged);
        });

        return [...uniqueMap.values()]
            .sort((a, b) => toDateValue(b.date) - toDateValue(a.date))
            .slice(0, MAX_NOTIFICATIONS);
    } catch (error) {
        console.error("Erreur recuperation notifications:", error);
        return [];
    }
}

async function marquerNotificationLue(notificationId, utilisateurId = null) {
    const uid = toSafeString(utilisateurId || auth.currentUser?.uid);
    const id = toSafeString(notificationId);
    if (!uid || !id) return false;

    try {
        markReadLocally(uid, id);

        if (id.startsWith('db_')) {
            const docId = id.slice(3);
            if (docId) {
                await updateDoc(doc(db, 'notifications', docId), { lu: true });
            }
        }

        return true;
    } catch (error) {
        console.error("Erreur mise a jour notification:", error);
        return false;
    }
}

async function getNotificationsNonLues(utilisateurId) {
    try {
        const notifications = await getNotifications(utilisateurId);
        return notifications.filter((notification) => !notification.lu).length;
    } catch (error) {
        console.error("Erreur comptage notifications:", error);
        return 0;
    }
}

function ecouterNotificationsNonLues(utilisateurId, callback) {
    const uid = toSafeString(utilisateurId);
    if (!uid) return () => {};

    const q = query(
        collection(db, 'notifications'),
        where('utilisateurId', '==', uid),
        where('lu', '==', false)
    );

    return onSnapshot(q, (snap) => {
        callback(snap.size);
    }, (error) => {
        console.error("Erreur ecoute notifications non lues:", error);
        callback(0);
    });
}

// ===== UTILISATEURS =====

async function enregistrerUtilisateur(user) {
    try {
        await setDoc(doc(db, 'utilisateurs', user.uid), {
            uid: user.uid,
            pseudo: user.displayName || user.email.split('@')[0],
            dateInscription: serverTimestamp(),
            bio: "",
            avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
            abonnes: 0,
            histoires: 0,
            role: "user",
            statut: "actif",
            suspensionJusqua: null
        }, { merge: true });

        return true;
    } catch (error) {
        console.error("Erreur enregistrement utilisateur:", error);
        return false;
    }
}

async function getUtilisateur(userId) {
    try {
        const snapshotDoc = await getDoc(doc(db, 'utilisateurs', userId));
        if (!snapshotDoc.exists()) {
            return null;
        }
        return {
            id: snapshotDoc.id,
            ...snapshotDoc.data()
        };
    } catch (error) {
        console.error("Erreur recuperation utilisateur:", error);
        return null;
    }
}

// ===== OPS LOGS =====

async function creerOpsLog(action, payload = {}) {
    const actorId = auth.currentUser?.uid;
    if (!actorId || !action) return false;
    try {
        const logDoc = {
            actorId,
            action: String(action),
            date: serverTimestamp(),
            metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
        };
        if (payload.targetUserId) {
            logDoc.targetUserId = String(payload.targetUserId);
        }
        if (payload.targetStoryId) {
            logDoc.targetStoryId = String(payload.targetStoryId);
        }
        if (payload.message) {
            logDoc.message = String(payload.message).substring(0, 400);
        }
        await addDoc(collection(db, 'ops_logs'), logDoc);
        return true;
    } catch (error) {
        // Les logs ne doivent jamais casser le flux principal.
        console.warn('Ops log ignore (non bloquant):', error?.code || error);
        return false;
    }
}

async function getOpsLogs(maxItems = 120) {
    try {
        const snapshot = await getDocs(query(
            collection(db, 'ops_logs'),
            orderBy('date', 'desc'),
            limit(Math.max(1, Number(maxItems) || 120))
        ));
        return snapshot.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                date: data.date?.toDate ? data.date.toDate() : new Date()
            };
        });
    } catch (error) {
        console.error('Erreur getOpsLogs:', error);
        return [];
    }
}

// ===== SANCTIONS =====

async function creerSanction(utilisateurId, type, motif, dureeHeures = null) {
    const censeurId = auth.currentUser?.uid;
    if (!censeurId || !utilisateurId) return false;
    try {
        const dateDebut = new Date();
        const dateFin = (type === 'suspension_temporaire' && Number(dureeHeures) > 0)
            ? new Date(dateDebut.getTime() + Number(dureeHeures) * 3600 * 1000)
            : null;

        await addDoc(collection(db, 'sanctions'), {
            utilisateurId: String(utilisateurId),
            type,
            motif: String(motif || '').substring(0, 500),
            dateDebut: serverTimestamp(),
            dateFin,
            censeurId,
            actif: true
        });

        // Mise a jour du statut utilisateur
        if (type === 'bannissement') {
            await updateDoc(doc(db, 'utilisateurs', utilisateurId), {
                statut: 'banni',
                suspensionJusqua: null
            });
        } else if (type === 'suspension_temporaire') {
            await updateDoc(doc(db, 'utilisateurs', utilisateurId), {
                statut: 'suspendu',
                suspensionJusqua: dateFin
            });
        }
        // Avertissement : statut inchange

        await creerOpsLog('sanction_apply', {
            targetUserId: String(utilisateurId),
            message: `Sanction appliquee (${String(type)})`,
            metadata: {
                type: String(type),
                dureeHeures: dureeHeures ? Number(dureeHeures) : null,
                motif: String(motif || '').substring(0, 200)
            }
        });

        return true;
    } catch (error) {
        console.error("Erreur creerSanction:", error);
        return false;
    }
}

async function getSanctionsUtilisateur(utilisateurId) {
    try {
        const snapshot = await getDocs(query(
            collection(db, 'sanctions'),
            where('utilisateurId', '==', String(utilisateurId)),
            where('actif', '==', true)
        ));
        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                dateDebut: data.dateDebut?.toDate ? data.dateDebut.toDate() : new Date(),
                dateFin: data.dateFin instanceof Date ? data.dateFin : (data.dateFin?.toDate ? data.dateFin.toDate() : null)
            };
        });
    } catch (error) {
        console.error("Erreur getSanctionsUtilisateur:", error);
        return [];
    }
}

async function desactiverSanction(sanctionId, utilisateurId) {
    try {
        await updateDoc(doc(db, 'sanctions', String(sanctionId)), { actif: false });

        // Reactiver si plus aucune sanction bloquante
        const restantes = await getSanctionsUtilisateur(utilisateurId);
        const actives = restantes.filter(s => s.id !== sanctionId && (s.type === 'bannissement' || s.type === 'suspension_temporaire'));
        if (!actives.length) {
            await updateDoc(doc(db, 'utilisateurs', utilisateurId), {
                statut: 'actif',
                suspensionJusqua: null
            });
        }

        await creerOpsLog('sanction_lift', {
            targetUserId: String(utilisateurId),
            message: 'Sanction levee',
            metadata: { sanctionId: String(sanctionId) }
        });

        return true;
    } catch (error) {
        console.error("Erreur desactiverSanction:", error);
        return false;
    }
}

async function getHistoriqueSanctions(maxItems = 200, actifOnly = false) {
    try {
        const constraints = [];
        if (actifOnly) {
            constraints.push(where('actif', '==', true));
        }
        constraints.push(limit(Math.max(1, Number(maxItems) || 200)));

        const snapshot = await getDocs(query(collection(db, 'sanctions'), ...constraints));
        return snapshot.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                dateDebut: data.dateDebut?.toDate ? data.dateDebut.toDate() : new Date(),
                dateFin: data.dateFin instanceof Date ? data.dateFin : (data.dateFin?.toDate ? data.dateFin.toDate() : null)
            };
        }).sort((a, b) => Number(new Date(b.dateDebut || 0)) - Number(new Date(a.dateDebut || 0)));
    } catch (error) {
        console.error('Erreur getHistoriqueSanctions:', error);
        return [];
    }
}

// ===== OPS ADMIN/CENSEUR =====

async function getCandidaturesModerateur(statut = 'en_attente', maxItems = 100) {
    try {
        const snapshot = await getDocs(query(
            collection(db, 'candidatures_moderateur'),
            orderBy('date', 'desc'),
            limit(Math.max(1, Number(maxItems) || 100))
        ));
        const all = snapshot.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                date: data.date?.toDate ? data.date.toDate() : new Date(),
                dateTraitement: data.dateTraitement?.toDate ? data.dateTraitement.toDate() : null
            };
        });
        if (!statut) return all;
        return all.filter((item) => String(item.statut || '') === String(statut));
    } catch (error) {
        console.error('Erreur getCandidaturesModerateur:', error);
        return [];
    }
}

async function getUtilisateursParRole(role, maxItems = 100) {
    const targetRole = String(role || '').trim();
    if (!targetRole) return [];
    try {
        const snapshot = await getDocs(query(
            collection(db, 'utilisateurs'),
            where('role', '==', targetRole),
            limit(Math.max(1, Number(maxItems) || 100))
        ));
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Erreur getUtilisateursParRole:', error);
        return [];
    }
}

async function promouvoirUtilisateurRole(utilisateurId, nouveauRole = 'moderateur', source = 'ops_panel') {
    const actorId = auth.currentUser?.uid;
    const userId = String(utilisateurId || '').trim();
    const role = String(nouveauRole || '').trim();
    if (!actorId || !userId || !role) return { ok: false, error: 'invalid-args' };

    try {
        const userRef = doc(db, 'utilisateurs', userId);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return { ok: false, error: 'user-not-found' };

        const data = snap.data();
        const oldRole = String(data?.role || 'user');
        const allowed = (
            (oldRole === 'user' && role === 'moderateur') ||
            (oldRole === 'moderateur' && role === 'censeur')
        );
        if (!allowed) return { ok: false, error: 'invalid-transition', from: oldRole, to: role };

        await updateDoc(userRef, {
            role,
            roleUpdatedBy: actorId,
            dateRoleUpdate: serverTimestamp(),
            roleUpdateSource: String(source || 'ops_panel').substring(0, 80)
        });

        await creerOpsLog('role_promotion', {
            targetUserId: userId,
            message: `Promotion ${oldRole} -> ${role}`,
            metadata: { from: oldRole, to: role, source: String(source || 'ops_panel') }
        });

        return { ok: true, from: oldRole, to: role };
    } catch (error) {
        console.error('Erreur promouvoirUtilisateurRole:', error);
        return { ok: false, error: error?.code || 'unknown' };
    }
}

async function traiterCandidatureModerateur(candidatureId, decision = 'approuvee', options = {}) {
    const actorId = auth.currentUser?.uid;
    const id = String(candidatureId || '').trim();
    const verdict = String(decision || '').trim();
    if (!actorId || !id || !['approuvee', 'refusee'].includes(verdict)) {
        return { ok: false, error: 'invalid-args' };
    }

    try {
        const candidatureRef = doc(db, 'candidatures_moderateur', id);
        const snap = await getDoc(candidatureRef);
        if (!snap.exists()) return { ok: false, error: 'not-found' };

        const candidature = snap.data();
        if (String(candidature.statut || '') !== 'en_attente') {
            return { ok: false, error: 'already-processed' };
        }

        const note = String(options.note || '').trim().substring(0, 500);
        const userId = String(candidature.userId || '');
        const targetRole = String(options.promotionRole || 'moderateur');

        if (verdict === 'approuvee') {
            const promotion = await promouvoirUtilisateurRole(userId, targetRole, 'candidature');
            if (!promotion.ok) return promotion;

            await updateDoc(candidatureRef, {
                statut: 'approuvee',
                traitePar: actorId,
                dateTraitement: serverTimestamp(),
                decisionNote: note || null,
                promotionRole: targetRole,
                utilisateurPromuId: userId
            });

            await creerOpsLog('candidature_approuvee', {
                targetUserId: userId,
                message: 'Candidature moderateur approuvee',
                metadata: { candidatureId: id, promotionRole: targetRole }
            });

            return { ok: true, decision: 'approuvee' };
        }

        await updateDoc(candidatureRef, {
            statut: 'refusee',
            traitePar: actorId,
            dateTraitement: serverTimestamp(),
            decisionNote: note || null,
            promotionRole: null,
            utilisateurPromuId: null
        });

        await creerOpsLog('candidature_refusee', {
            targetUserId: userId,
            message: 'Candidature moderateur refusee',
            metadata: { candidatureId: id }
        });

        return { ok: true, decision: 'refusee' };
    } catch (error) {
        console.error('Erreur traiterCandidatureModerateur:', error);
        return { ok: false, error: error?.code || 'unknown' };
    }
}

// ===== UTILITAIRES =====

function getImageForCategory(categorie) {
    const images = {
        "Premier amour": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
        "Amour heureux": "https://images.unsplash.com/photo-1445116572660-236099ec97a0",
        "Amour magique": "https://images.unsplash.com/photo-1517483004871-7d0a3440f1f6",
        "Histoires tristes": "https://images.unsplash.com/photo-1519681393784-d120267933ba",
        "Lettres d'amour": "https://images.unsplash.com/photo-1455390582262-044cdead277a",
        "Poesie d'amour": "https://images.unsplash.com/photo-1474932430478-367dbb6832c1",
        "Aventure estivale": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
        "Rencontres": "https://images.unsplash.com/photo-1522673607200-164d1b6ce486"
    };
    return (images[categorie] || images["Premier amour"]) + "?w=400&h=300&fit=crop";
}

// ===== MESSAGERIE =====

function getConversationId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

async function getOuCreerConversation(monId, autreUserId) {
    try {
        const conversationId = getConversationId(monId, autreUserId);
        const convRef = doc(db, 'conversations', conversationId);
        const snap = await getDoc(convRef);
        if (!snap.exists()) {
            await setDoc(convRef, {
                participants: [monId, autreUserId],
                derniereActivite: serverTimestamp(),
                dernierMessage: ''
            });
        }
        return conversationId;
    } catch (error) {
        console.error("Erreur getOuCreerConversation:", error);
        return null;
    }
}

async function envoyerMessage(conversationId, contenu) {
    try {
        if (!auth.currentUser) return false;
        const expediteurId = auth.currentUser.uid;

        const contenuNettoye = String(contenu || '').trim();
        if (!contenuNettoye) return false;

        const convSnap = await getDoc(doc(db, 'conversations', conversationId));
        if (!convSnap.exists()) return false;
        const participants = convSnap.data().participants;

        await addDoc(collection(db, 'messages'), {
            conversationId,
            expediteurId,
            contenu: contenuNettoye,
            date: serverTimestamp(),
            lu: false,
            participants
        });

        await updateDoc(doc(db, 'conversations', conversationId), {
            dernierMessage: contenuNettoye.substring(0, 100),
            derniereActivite: serverTimestamp(),
            expediteurDernierMessage: expediteurId
        });

        return true;
    } catch (error) {
        console.error("Erreur envoyerMessage:", error);
        return false;
    }
}

function ecouterConversations(userId, callback) {
    const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId),
        orderBy('derniereActivite', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const conversations = snapshot.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                derniereActivite: data.derniereActivite?.toDate ? data.derniereActivite.toDate() : new Date()
            };
        });
        callback(conversations);
    }, (error) => {
        console.error("Erreur ecouterConversations:", error);
    });
}

function ecouterMessages(conversationId, callback) {
    if (!auth.currentUser) return () => {};
    // Le filtre participants est requis : les regles n'autorisent que les messages dont on est participant.
    const q = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        where('participants', 'array-contains', auth.currentUser.uid),
        orderBy('date', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                date: data.date?.toDate ? data.date.toDate() : new Date()
            };
        });
        callback(messages);
    }, (error) => {
        console.error("Erreur ecouterMessages:", error);
    });
}

async function marquerMessagesLus(conversationId, userId) {
    try {
        const snapshot = await getDocs(query(
            collection(db, 'messages'),
            where('conversationId', '==', conversationId),
            where('participants', 'array-contains', userId),
            where('lu', '==', false)
        ));

        const aMarquer = snapshot.docs.filter((d) => d.data().expediteurId !== userId);
        await Promise.all(aMarquer.map((d) => updateDoc(d.ref, { lu: true })));
        return aMarquer.length;
    } catch (error) {
        console.error("Erreur marquerMessagesLus:", error);
        return 0;
    }
}

const firebaseAPI = {
    publierHistoire,
    getHistoires,
    getHistoireById,
    getHistoiresAuteur,
    getHistoiresEnAttente,
    approuverHistoire,
    rejeterHistoire,
    definirCoupDeCoeur,
    editerHistoireModeration,
    likerHistoire,
    aLiker,
    ajouterCommentaire,
    getCommentaires,
    suivreAuteur,
    estAbonne,
    getAbonnes,
    getAbonnements,
    creerSanction,
    getSanctionsUtilisateur,
    desactiverSanction,
    getHistoriqueSanctions,
    getCandidaturesModerateur,
    getUtilisateursParRole,
    promouvoirUtilisateurRole,
    traiterCandidatureModerateur,
    getOpsLogs,
    creerOpsLog,
    creerNotification,
    getNotifications,
    getNotificationsNonLues,
    ecouterNotificationsNonLues,
    marquerNotificationLue,
    enregistrerUtilisateur,
    getUtilisateur,
    getOuCreerConversation,
    envoyerMessage,
    ecouterConversations,
    ecouterMessages,
    marquerMessagesLus
};

window.firebaseAPI = firebaseAPI;

export { firebaseAPI };

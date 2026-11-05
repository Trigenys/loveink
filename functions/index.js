const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

const MAX_NOTIFICATION_MESSAGE = 280;

function toSafeString(value) {
  return String(value || "").trim();
}

function truncateMessage(message) {
  const text = toSafeString(message);
  if (text.length <= MAX_NOTIFICATION_MESSAGE) return text;
  return `${text.slice(0, MAX_NOTIFICATION_MESSAGE - 3)}...`;
}

function storyLink(histoireId) {
  const id = toSafeString(histoireId);
  return id ? `histoire.html?id=${encodeURIComponent(id)}` : null;
}

async function getPseudo(userId) {
  const uid = toSafeString(userId);
  if (!uid) return "Quelqu'un";

  try {
    const snap = await db.collection("utilisateurs").doc(uid).get();
    const pseudo = snap.exists ? toSafeString(snap.get("pseudo")) : "";
    return pseudo || "Quelqu'un";
  } catch (error) {
    logger.warn("getPseudo failed", { userId: uid, error: error.message });
    return "Quelqu'un";
  }
}

async function writeNotification(notificationId, payload) {
  const targetId = toSafeString(payload.utilisateurId);
  if (!targetId) return;

  const docId = toSafeString(notificationId);
  const ref = docId
    ? db.collection("notifications").doc(docId)
    : db.collection("notifications").doc();

  await ref.set({
    utilisateurId: targetId,
    type: payload.type,
    message: truncateMessage(payload.message),
    histoireId: payload.histoireId || null,
    lien: payload.lien || null,
    lu: false,
    date: FieldValue.serverTimestamp()
  }, { merge: false });
}

async function writeNotificationForMany(baseId, userIds, payloadBuilder) {
  const unique = [...new Set((userIds || []).map((id) => toSafeString(id)).filter(Boolean))];
  await Promise.all(unique.map(async (uid) => {
    const payload = payloadBuilder(uid);
    if (!payload || !toSafeString(payload.utilisateurId)) return;
    await writeNotification(`${baseId}_${uid}`, payload);
  }));
}

exports.notifyOnCommentCreated = onDocumentCreated("commentaires/{commentaireId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const histoireId = toSafeString(data.histoireId);
  const auteurId = toSafeString(data.auteurId);
  if (!histoireId || !auteurId) return;

  const histoireSnap = await db.collection("histoires").doc(histoireId).get();
  if (!histoireSnap.exists) return;

  const histoire = histoireSnap.data() || {};
  const storyOwnerId = toSafeString(histoire.auteurId);
  const actorName = toSafeString(data.auteur) || await getPseudo(auteurId);

  const recipients = [];

  if (storyOwnerId && storyOwnerId !== auteurId) {
    recipients.push(storyOwnerId);
  }

  // Scope: also notify followers of the story author for new comments.
  if (storyOwnerId) {
    const followersSnap = await db
      .collection("abonnements")
      .where("auteurId", "==", storyOwnerId)
      .get();

    followersSnap.docs.forEach((docSnap) => {
      const abonneId = toSafeString(docSnap.get("abonneId"));
      if (abonneId && abonneId !== auteurId) {
        recipients.push(abonneId);
      }
    });
  }

  await writeNotificationForMany(event.id, recipients, (uid) => ({
    utilisateurId: uid,
    type: "commentaire",
    message: `${actorName} a commente l'histoire \"${toSafeString(histoire.titre) || "Sans titre"}\"`,
    histoireId,
    lien: storyLink(histoireId)
  }));
});

exports.notifyOnLikeCreated = onDocumentCreated("likes/{likeId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const histoireId = toSafeString(data.histoireId);
  const likerId = toSafeString(data.userId);
  if (!histoireId || !likerId) return;

  const histoireSnap = await db.collection("histoires").doc(histoireId).get();
  if (!histoireSnap.exists) return;

  const histoire = histoireSnap.data() || {};
  const ownerId = toSafeString(histoire.auteurId);
  if (!ownerId || ownerId === likerId) return;

  const likerName = await getPseudo(likerId);

  await writeNotification(`${event.id}_${ownerId}`, {
    utilisateurId: ownerId,
    type: "like",
    message: `${likerName} a aime votre histoire \"${toSafeString(histoire.titre) || "Sans titre"}\"`,
    histoireId,
    lien: storyLink(histoireId)
  });
});

exports.notifyOnFollowCreated = onDocumentCreated("abonnements/{abonnementId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const auteurId = toSafeString(data.auteurId);
  const followerId = toSafeString(data.abonneId);
  if (!auteurId || !followerId || auteurId === followerId) return;

  const followerName = await getPseudo(followerId);

  await writeNotification(`${event.id}_${auteurId}`, {
    utilisateurId: auteurId,
    type: "follow",
    message: `${followerName} a commence a vous suivre`,
    histoireId: null,
    lien: "profil.html?tab=abonnements"
  });
});

exports.notifyOnStoryModeration = onDocumentUpdated("histoires/{histoireId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;

  const beforeStatus = toSafeString(before.statut);
  const afterStatus = toSafeString(after.statut);
  if (!afterStatus || beforeStatus === afterStatus) return;

  // Only moderation transitions should notify the author.
  if (!["publie", "rejete"].includes(afterStatus)) return;

  const auteurId = toSafeString(after.auteurId);
  const histoireId = toSafeString(event.params.histoireId);
  if (!auteurId || !histoireId) return;

  const titre = toSafeString(after.titre) || "Sans titre";

  if (afterStatus === "publie") {
    await writeNotification(`${event.id}_${auteurId}`, {
      utilisateurId: auteurId,
      type: "publication_approuvee",
      message: `Votre histoire \"${titre}\" a ete approuvee et publiee`,
      histoireId,
      lien: storyLink(histoireId)
    });
    return;
  }

  const reason = toSafeString(after.motifRejet);
  const reasonSuffix = reason ? ` Motif: ${reason}` : "";

  await writeNotification(`${event.id}_${auteurId}`, {
    utilisateurId: auteurId,
    type: "rejet",
    message: `Votre histoire \"${titre}\" a ete rejetee.${reasonSuffix}`,
    histoireId,
    lien: "profil.html?tab=histoires&status=rejetees"
  });
});

exports.notifyOnSanctionCreated = onDocumentCreated("sanctions/{sanctionId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const utilisateurId = toSafeString(data.utilisateurId);
  if (!utilisateurId) return;

  const censeurId = toSafeString(data.censeurId);
  const censeurPseudo = censeurId ? await getPseudo(censeurId) : "Un censeur";
  const type = toSafeString(data.type) || "sanction";
  const motif = toSafeString(data.motif);

  await writeNotification(`${event.id}_${utilisateurId}`, {
    utilisateurId,
    type: "sanction",
    message: `${censeurPseudo} a applique une sanction (${type}).${motif ? ` Motif: ${motif}` : ""}`,
    histoireId: null,
    lien: "notifications.html"
  });
});

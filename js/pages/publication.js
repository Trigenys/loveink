// publication.js - Système de publication d'histoires

// Base de données des histoires publiées par les utilisateurs
let histoiresUtilisateurs = JSON.parse(localStorage.getItem('histoiresUtilisateurs')) || [];

// Fonction pour publier une nouvelle histoire
function publierHistoire(titre, categorie, contenu, auteur, auteurId) {
    const nouvelleHistoire = {
        id: Date.now(), // ID unique basé sur le timestamp
        titre: titre,
        auteur: auteur,
        auteurId: auteurId,
        categorie: categorie,
        date: new Date().toISOString().split('T')[0],
        likes: 0,
        commentaires: 0,
        image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=300&fit=crop", // Image par défaut
        extrait: contenu.substring(0, 120) + "...",
        contenu: contenu,
        commentairesListe: [],
        estUtilisateur: true // Marqueur pour les histoires publiées par les utilisateurs
    };
    
    histoiresUtilisateurs.unshift(nouvelleHistoire);
    
    // Sauvegarder dans localStorage
    localStorage.setItem('histoiresUtilisateurs', JSON.stringify(histoiresUtilisateurs));
    
    // Ajouter également à toutesLesHistoires pour qu'elles apparaissent dans le feed
    toutesLesHistoires.unshift(nouvelleHistoire);
    
    return nouvelleHistoire;
}

// Fonction pour récupérer toutes les histoires (officielles + utilisateurs)
function getAllHistoires() {
    return toutesLesHistoires;
}

// Fonction pour récupérer les histoires d'un utilisateur
function getHistoiresByUser(userId) {
    return toutesLesHistoires.filter(h => h.auteurId === userId);
}

// Fonction pour supprimer une histoire (si l'utilisateur est l'auteur)
function supprimerHistoire(histoireId, userId) {
    const index = toutesLesHistoires.findIndex(h => h.id === histoireId && h.auteurId === userId);
    if (index !== -1) {
        toutesLesHistoires.splice(index, 1);
        
        // Supprimer aussi de histoiresUtilisateurs
        const userIndex = histoiresUtilisateurs.findIndex(h => h.id === histoireId);
        if (userIndex !== -1) {
            histoiresUtilisateurs.splice(userIndex, 1);
            localStorage.setItem('histoiresUtilisateurs', JSON.stringify(histoiresUtilisateurs));
        }
        return true;
    }
    return false;
}

// Exporter les fonctions
window.publicationAPI = {
    publierHistoire,
    getAllHistoires,
    getHistoiresByUser,
    supprimerHistoire
};
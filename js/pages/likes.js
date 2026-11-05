// likes.js - Système de likes pour les histoires

// Base de données des likes (simulée)
let likesDB = {
    1: { count: 156, users: [] },
    2: { count: 203, users: [] },
    3: { count: 189, users: [] },
    4: { count: 312, users: [] }
};

// Fonction pour liker une histoire
function likerHistoire(histoireId, userId) {
    if (!likesDB[histoireId]) {
        likesDB[histoireId] = { count: 0, users: [] };
    }
    
    const histoire = likesDB[histoireId];
    
    if (histoire.users.includes(userId)) {
        // Déjà liké : on retire le like
        histoire.count--;
        histoire.users = histoire.users.filter(id => id !== userId);
    } else {
        // Pas encore liké : on ajoute le like
        histoire.count++;
        histoire.users.push(userId);
    }
    
    // Mettre à jour le compteur dans toutesLesHistoires
    const histoireData = toutesLesHistoires.find(h => h.id === histoireId);
    if (histoireData) {
        histoireData.likes = histoire.count;
    }
    
    return {
        liked: histoire.users.includes(userId),
        count: histoire.count
    };
}

// Fonction pour vérifier si un utilisateur a liké
function aLiker(histoireId, userId) {
    return likesDB[histoireId]?.users.includes(userId) || false;
}

// Fonction pour obtenir le nombre de likes
function getLikes(histoireId) {
    return likesDB[histoireId]?.count || 0;
}

// Exporter les fonctions
window.likesAPI = {
    likerHistoire,
    aLiker,
    getLikes
};
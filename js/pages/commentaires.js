// commentaires.js - Gestion des commentaires style Fyctia

// Base de données des commentaires (simulée)
let commentairesDB = {
    1: [ // Histoire ID 1
        {
            id: 101,
            auteur: "Romantique78",
            auteurId: 201,
            avatar: "https://i.pravatar.cc/150?img=1",
            content: "Ça m'a rappelé mon premier amour... Merci pour cette histoire magnifique !",
            date: "2024-03-16T14:30:00",
            likes: 12,
            likedBy: [],
            replies: [
                {
                    id: 1011,
                    auteur: "Claire Beaumont",
                    auteurId: 101,
                    content: "Merci beaucoup ! Ça me touche énormément ❤️",
                    date: "2024-03-16T15:45:00",
                    likes: 3,
                    likedBy: []
                }
            ]
        },
        {
            id: 102,
            auteur: "CoeurBrisé",
            auteurId: 202,
            avatar: "https://i.pravatar.cc/150?img=2",
            content: "Triste mais beau. L'amour vrai laisse toujours une trace.",
            date: "2024-03-17T09:20:00",
            likes: 8,
            likedBy: [],
            replies: []
        },
        {
            id: 103,
            auteur: "MarieL",
            auteurId: 203,
            avatar: "https://i.pravatar.cc/150?img=3",
            content: "J'ai pleuré en lisant ça. Tellement d'émotions en si peu de mots...",
            date: "2024-03-18T18:10:00",
            likes: 15,
            likedBy: [],
            replies: [
                {
                    id: 1031,
                    auteur: "Claire Beaumont",
                    auteurId: 101,
                    content: "Merci Marie, ça me va droit au cœur 💕",
                    date: "2024-03-18T19:30:00",
                    likes: 5,
                    likedBy: []
                },
                {
                    id: 1032,
                    auteur: "MarieL",
                    auteurId: 203,
                    content: "Continuez à écrire, vous avez un don !",
                    date: "2024-03-18T20:15:00",
                    likes: 2,
                    likedBy: []
                }
            ]
        }
    ],
    2: [ // Histoire ID 2
        {
            id: 201,
            auteur: "JardinierRêveur",
            auteurId: 204,
            avatar: "https://i.pravatar.cc/150?img=4",
            content: "Les cerisiers et l'amour, même combat... Magnifique métaphore !",
            date: "2024-03-13T10:15:00",
            likes: 24,
            likedBy: [],
            replies: [
                {
                    id: 2011,
                    auteur: "Marie Delorme",
                    auteurId: 102,
                    content: "Merci ! Les cerisiers ont vraiment une place spéciale dans mon cœur 🌸",
                    date: "2024-03-13T11:30:00",
                    likes: 7,
                    likedBy: []
                }
            ]
        },
        {
            id: 202,
            auteur: "FleurBleue",
            auteurId: 205,
            avatar: "https://i.pravatar.cc/150?img=5",
            content: "J'ai adoré, tellement poétique. On dirait un tableau.",
            date: "2024-03-14T16:45:00",
            likes: 18,
            likedBy: [],
            replies: []
        }
    ],
    3: [ // Histoire ID 3
        {
            id: 301,
            auteur: "BaristaAmoureux",
            auteurId: 206,
            avatar: "https://i.pravatar.cc/150?img=6",
            content: "Je connais ce café ! Rue des Martyrs ? C'est devenu mon QG depuis que j'ai lu votre histoire ☕",
            date: "2024-03-11T08:30:00",
            likes: 31,
            likedBy: [],
            replies: [
                {
                    id: 3011,
                    auteur: "Sophie Martin",
                    auteurId: 103,
                    content: "Oui exactement ! Le meilleur café de Paris 😊",
                    date: "2024-03-11T09:45:00",
                    likes: 12,
                    likedBy: []
                }
            ]
        },
        {
            id: 302,
            auteur: "RomantiqueEndurcie",
            auteurId: 207,
            avatar: "https://i.pravatar.cc/150?img=7",
            content: "J'ai pleuré. C'est tellement beau de trouver l'amour dans les petites choses du quotidien.",
            date: "2024-03-12T20:10:00",
            likes: 27,
            likedBy: [],
            replies: []
        }
    ],
    4: [ // Histoire ID 4
        {
            id: 401,
            auteur: "AncienCombattant",
            auteurId: 208,
            avatar: "https://i.pravatar.cc/150?img=8",
            content: "Merci. Merci pour ce témoignage. Mon grand-père aussi est parti à la guerre... Ces lettres sont des trésors.",
            date: "2024-03-06T14:20:00",
            likes: 45,
            likedBy: [],
            replies: [
                {
                    id: 4011,
                    auteur: "Pierre Lambert",
                    auteurId: 104,
                    content: "Nos grands-pères sont des héros. Leurs mots traversent le temps 🙏",
                    date: "2024-03-06T15:40:00",
                    likes: 23,
                    likedBy: []
                }
            ]
        },
        {
            id: 402,
            auteur: "EmueAuxLarmes",
            auteurId: 209,
            avatar: "https://i.pravatar.cc/150?img=9",
            content: "Je n'ai pas les mots... C'est d'une beauté déchirante.",
            date: "2024-03-07T19:30:00",
            likes: 36,
            likedBy: [],
            replies: []
        }
    ]
};

// Fonction pour obtenir les commentaires d'une histoire
function getCommentairesByHistoireId(histoireId) {
    return commentairesDB[histoireId] || [];
}

// Fonction pour ajouter un commentaire
function ajouterCommentaire(histoireId, auteur, auteurId, contenu) {
    const nouveauCommentaire = {
        id: Date.now(),
        auteur: auteur,
        auteurId: auteurId,
        avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
        content: contenu,
        date: new Date().toISOString(),
        likes: 0,
        likedBy: [],
        replies: []
    };
    
    if (!commentairesDB[histoireId]) {
        commentairesDB[histoireId] = [];
    }
    
    commentairesDB[histoireId].unshift(nouveauCommentaire);
    return nouveauCommentaire;
}

// Fonction pour ajouter une réponse
function ajouterReponse(histoireId, commentaireId, auteur, auteurId, contenu) {
    const commentaire = commentairesDB[histoireId]?.find(c => c.id === commentaireId);
    
    if (commentaire) {
        const nouvelleReponse = {
            id: Date.now(),
            auteur: auteur,
            auteurId: auteurId,
            content: contenu,
            date: new Date().toISOString(),
            likes: 0,
            likedBy: []
        };
        
        commentaire.replies.push(nouvelleReponse);
        return nouvelleReponse;
    }
    return null;
}

// Fonction pour liker un commentaire
function likerCommentaire(histoireId, commentaireId, userId, isReply = false, replyId = null) {
    if (isReply) {
        // Chercher dans les réponses
        const commentaire = commentairesDB[histoireId]?.find(c => c.id === commentaireId);
        if (commentaire) {
            const reply = commentaire.replies.find(r => r.id === replyId);
            if (reply) {
                if (reply.likedBy.includes(userId)) {
                    reply.likes--;
                    reply.likedBy = reply.likedBy.filter(id => id !== userId);
                } else {
                    reply.likes++;
                    reply.likedBy.push(userId);
                }
                return reply.likes;
            }
        }
    } else {
        // Chercher dans les commentaires principaux
        const commentaire = commentairesDB[histoireId]?.find(c => c.id === commentaireId);
        if (commentaire) {
            if (commentaire.likedBy.includes(userId)) {
                commentaire.likes--;
                commentaire.likedBy = commentaire.likedBy.filter(id => id !== userId);
            } else {
                commentaire.likes++;
                commentaire.likedBy.push(userId);
            }
            return commentaire.likes;
        }
    }
    return null;
}

// Fonction pour formater la date
function formatDateAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    if (diffHour < 24) return `il y a ${diffHour} h`;
    if (diffDay === 1) return "hier";
    if (diffDay < 7) return `il y a ${diffDay} jours`;
    
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// Exporter les fonctions
window.commentairesAPI = {
    getCommentairesByHistoireId,
    ajouterCommentaire,
    ajouterReponse,
    likerCommentaire,
    formatDateAgo
};
// script.js - Toute la magie interactive

// Base de données locale des histoires (pour la nostalgie)
const histoiresDatabase = {
    "premier-amour": [
        {
            id: 1,
            titre: "L'été de mes 16 ans",
            auteur: "Claire Beaumont",
            extrait: "Cette année-là, sur la plage de Biarritz, je ne cherchais rien. Et puis je l'ai vu...",
            contenu: `C'était l'été de mes 16 ans. Mes parents avaient loué une petite maison à Biarritz pour les vacances. Moi, je traînais mon ennui adolescent sur la plage, entre deux baignades et trois romans de gare.

    Le troisième jour, je l'ai vu. Il s'appelait Thomas, il avait 17 ans et des yeux couleur océan. Il jouait au volley avec ses cousins, et quand il a couru après le ballon qui roulait vers moi, j'ai senti mon cœur faire un bond étrange.

    "Tu veux jouer avec nous ?" m'a-t-il demandé en souriant.

    Je ne savais pas jouer au volley. J'ai dit oui quand même.

    Les jours suivants, on ne s'est plus quittés. On se retrouvait sur la plage le matin, on déjeunait ensemble de sandwichs trop chers, on se promenait sur la promenade le soir. Il me parlait de ses projets, moi je lui racontais mes peurs. On se découvrait, simplement.

    Le dernier soir, sous un ciel étoilé, il m'a pris la main. Ses doigts ont effleuré les miens avec une timidité qui m'a fait fondre.

    "Je ne veux pas que ça s'arrête," a-t-il murmuré.

    Moi non plus, je ne voulais pas. Mais on habitait à 800 kilomètres l'un de l'autre.

    On a échangé nos adresses mail (oui, à l'époque, on écrivait encore des mails). On s'est promis de s'écrire, de s'appeler, de se retrouver.

    Le lendemain, dans le train du retour, j'ai pleuré tout le trajet. Ma mère croyait que c'était parce que les vacances finissaient. Elle ne savait pas que j'avais laissé mon cœur sur une plage de Biarritz.

    On s'est écrit pendant six mois. Des mails longs, détaillés, passionnés. Puis, petit à petit, les réponses sont devenues plus espacées. Un jour, plus rien.

    Je l'ai revu dix ans plus tard, par hasard, dans un café à Paris. Il était avec une femme, un enfant dans les bras. Il m'a souri, j'ai souri. On n'a rien dit.

    En rentrant chez moi, j'ai rouvert ma vieille boîte mail. Nos échanges étaient toujours là. Je les ai relus en souriant, le cœur serré mais doux.

    Parfois, le premier amour n'est pas fait pour durer. Il est fait pour nous apprendre à aimer.`,
            categorie: "Premier amour",
            date: "2023-06-15",
            note: 4.5,
            commentaires: [
                { pseudo: "Romantique78", message: "Ça m'a rappelé mon premier amour... Merci", date: "2023-06-16" },
                { pseudo: "CoeurBrisé", message: "Triste mais beau", date: "2023-06-17" }
            ]
        },
        {
            id: 2,
            titre: "Sous le cerisier",
            auteur: "Marie Dupont",
            extrait: "Chaque printemps, le cerisier fleurit. Et chaque printemps, je pense à lui...",
            contenu: `Le cerisier du jardin de mes grands-parents était l'arbre le plus magnifique que j'aie jamais vu. Chaque printemps, il se couvrait de fleurs roses si abondantes que les branches ployaient sous leur poids.

    C'est sous ce cerisier que j'ai rencontré Julien. Il était le fils des nouveaux voisins, un garçon silencieux aux yeux rieurs. J'avais 8 ans, il en avait 9. On a construit une cabane dans les branches du cerisier, une cabane secrète où on se réfugiait pour échapper au monde des adultes.

    Les années ont passé. La cabane a grandi avec nous. À 12 ans, on y lisait des BD. À 14, on y écoutait de la musique en cachette. À 16, on s'y est embrassé pour la première fois, un soir d'été où les fleurs du cerisier dansaient autour de nous comme des confettis.

    "Je t'aimerai toujours," m'a-t-il dit.

    Je l'ai cru. On se croyait éternels, immortels, invincibles.

    Puis il est parti étudier à l'étranger. On s'est promis de s'attendre, de s'écrire, de ne jamais s'oublier.

    Les premiers mois, on s'appelait toutes les semaines. Puis toutes les deux semaines. Puis un mois. Les appels devenaient plus courts, plus gênés. On n'avait plus les mêmes références, plus les mêmes amis, plus la même vie.

    Un jour, il m'a dit qu'il avait rencontré quelqu'un. J'ai raccroché, je suis allée m'asseoir sous le cerisier, et j'ai pleuré toutes les larmes de mon corps jusqu'à ce que les fleurs roses se confondent avec mes joues rouges.

    Aujourd'hui, j'ai 30 ans. Je viens d'acheter la maison de mes grands-parents. Le cerisier est toujours là, plus vieux, plus majestueux. Chaque printemps, quand il fleurit, je m'assois en dessous et je repense à Julien.

    Pas avec tristesse. Avec tendresse. Parce que certaines personnes traversent notre vie pour nous apprendre ce qu'est l'amour, même si elles ne restent pas.

    Le cerisier, lui, est toujours là. Et il fleurit chaque printemps, comme pour me rappeler que tout passe, mais que la beauté, elle, revient toujours.`,
            categorie: "Premier amour",
            date: "2023-08-22",
            note: 5,
            commentaires: [
                { pseudo: "JardinierRêveur", message: "Les cerisiers et l'amour, même combat... Magnifique", date: "2023-08-23" }
            ]
        }
    ],
    "amour-heureux": [
        {
            id: 3,
            titre: "Café crème et chocolat chaud",
            auteur: "Sophie Martin",
            extrait: "Il prenait toujours un café crème. Moi, un chocolat chaud. Et pourtant, on était faits l'un pour l'autre...",
            contenu: `Je travaillais dans ce petit café du Marais depuis trois mois quand il est entré pour la première fois. Il pleuvait des cordes ce jour-là, et il s'est précipité à l'intérieur, trempé, essoufflé, avec un sourire désolé.

    "Un café crème, s'il vous plaît. Chaud. Très chaud."

    Je lui ai servi son café. Il s'est installé près de la fenêtre, a sorti un carnet, et s'est mis à écrire. De temps en temps, il levait les yeux, regardait la pluie couler sur la vitre, et souriait.

    Il est revenu le lendemain. Et le surlendemain. Toujours à la même heure, toujours son café crème, toujours son carnet.

    Un jour, j'ai osé lui demander ce qu'il écrivait.

    "Des lettres," m'a-t-il répondu. "Des lettres que je n'envoie jamais."

    J'ai trouvé ça étrange et merveilleux à la fois.

    Les semaines passaient. On a commencé à discuter un peu plus chaque jour. Il s'appelait Antoine, il était écrivain (ou du moins, il essayait de le devenir). Moi, j'étais étudiante en histoire de l'art, je travaillais au café pour payer mes études.

    Un matin, il est arrivé avec un petit paquet.

    "C'est pour vous," m'a-t-il dit, gêné.

    J'ai ouvert. C'était un carnet, exactement comme le sien.

    "Pour que vous écriviez votre propre histoire," a-t-il expliqué.

    Ce jour-là, j'ai servi son café crème, j'ai préparé mon chocolat chaud, et on s'est assis ensemble près de la fenêtre. Chacun avec son carnet, chacun avec sa boisson, mais pour la première fois, côte à côte.

    C'était il y a dix ans. Aujourd'hui, on est mariés, on a deux enfants, et on écrit toujours. Lui des romans (publiés, maintenant !), moi des poèmes. Et le matin, dans notre cuisine, il prend son café crème, je prends mon chocolat chaud, et on écrit côte à côte.

    Parfois, l'amour, c'est juste ça : trouver quelqu'un avec qui partager le silence.`,
            categorie: "Amour heureux",
            date: "2024-01-10",
            note: 5,
            commentaires: [
                { pseudo: "BaristaAmoureux", message: "Je connais ce café ! Quelle belle histoire", date: "2024-01-11" },
                { pseudo: "RomantiqueEndurcie", message: "J'ai pleuré. C'est tellement beau", date: "2024-01-12" }
            ]
        }
    ],
    "histoires-tristes": [
        {
            id: 4,
            titre: "La lettre",
            auteur: "Pierre Lambert",
            extrait: "J'ai trouvé cette lettre dans le grenier de ma grand-mère. Elle datait de 1943...",
            contenu: `C'était une simple enveloppe jaunie par le temps, cachée au fond d'une boîte à chaussures dans le grenier de ma grand-mère. Je vidais la maison après son enterrement, le cœur lourd, quand mes doigts ont effleuré le papier fragile.

    Sur l'enveloppe, une seule phrase, écrite d'une main élégante : "Pour celle que j'aimerai toujours."

    À l'intérieur, une lettre. Je l'ai lue en tremblant.

    "Mon amour,

    Si tu lis ces mots, c'est que je ne suis plus là. Le régiment part à l'aube, et je ne sais pas si je reviendrai. Mais je veux que tu saches, quoi qu'il arrive, que ces deux années passées à tes côtés ont été les plus belles de ma vie.

    Je me souviens de notre première rencontre, à la boulangerie. Tu cherchais du pain, moi je cherchais une raison de sourire. Tu m'as demandé l'heure, j'ai répondu 'l'heure d'aimer'. Tu as ri. Depuis ce jour, ton rire est ma musique préférée.

    Je me souviens de nos promenades le long de la Loire, de tes doigts entrelacés aux miens, du soleil couchant qui rendait tes cheveux encore plus blonds. Je me souviens de nos disputes ridicules, de nos réconciliations passionnées, de nos silences complices.

    Je t'aime. Je t'aime comme on aime la vie quand on sait qu'elle peut s'arrêter demain. Je t'aime de tout mon être, de toute mon âme, de tout ce que je suis.

    Si je ne reviens pas, vis. Vis pleinement, vis intensément, vis pour deux. Trouve quelqu'un qui te rendra heureuse, qui prendra soin de toi, qui méritera ton sourire. Mais n'oublie jamais que quelque part, dans un coin du monde, un homme t'aura aimée plus que tout.

    Je t'embrasse une dernière fois, comme si c'était la première.

    Ton Robert, pour l'éternité."

    La lettre n'était pas signée. Robert, c'était mon grand-père. Il n'est jamais revenu du front.

    Ma grand-mère ne s'est jamais remariée. Elle a gardé cette lettre toute sa vie, sans jamais en parler à personne. Et moi, son petit-fils, je viens de découvrir le plus grand secret de son cœur.

    Aujourd'hui, la lettre est encadrée au-dessus de ma cheminée. Elle me rappelle que l'amour véritable ne meurt jamais. Il attend juste d'être lu, un jour, par quelqu'un qui saura le comprendre.`,
            categorie: "Histoires tristes",
            date: "2023-11-11",
            note: 5,
            commentaires: [
                { pseudo: "AncienCombattant", message: "Merci. Merci pour ce témoignage.", date: "2023-11-12" },
                { pseudo: "EmueAuxLarmes", message: "Je n'ai pas les mots...", date: "2023-11-13" }
            ]
        }
    ]
};

// Liste des catégories
const categories = [
    { nom: "Premier amour", icon: "fa-heart", count: 12, description: "Ces premières fois qui marquent une vie" },
    { nom: "Amour heureux", icon: "fa-smile", count: 8, description: "Des histoires qui finissent bien" },
    { nom: "Histoires tristes", icon: "fa-cloud-rain", count: 6, description: "Quand l'amour fait mal" },
    { nom: "Amour magique", icon: "fa-wand-magic", count: 5, description: "Quand la réalité dépasse la fiction" },
    { nom: "Lettres d'amour", icon: "fa-envelope", count: 4, description: "Correspondances du cœur" },
    { nom: "Poésie d'amour", icon: "fa-feather", count: 7, description: "L'amour en vers" },
    { nom: "Amour virtuel", icon: "fa-globe", count: 3, description: "Rencontres 2.0" },
    { nom: "Aventure estivale", icon: "fa-sun", count: 9, description: "Amours de vacances" },
    { nom: "De l'amitié à l'amour", icon: "fa-handshake", count: 5, description: "Quand les sentiments évoluent" },
    { nom: "Belles histoires", icon: "fa-star", count: 15, description: "Nos coups de cœur" }
];

function showLegacyModal(type, message, options = {}) {
    if (window.Modale && typeof window.Modale[type] === 'function') {
        return window.Modale[type](message, options);
    }
    if (type === 'confirm') {
        return Promise.resolve(window.confirm(message));
    }
    window.alert(message);
    return Promise.resolve(true);
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    console.log("❤️ Bienvenue dans Mon Histoire d'Amour ❤️");
    
    // Charger les catégories
    chargerCategories();
    
    // Charger les histoires récentes
    chargerHistoiresRecentes();
    
    // Charger les catégories dans le select du formulaire
    chargerSelectCategories();
    
    // Initialiser la recherche
    initSearch();
    
    // Vérifier si on est sur une page d'histoire
    if (window.location.pathname.includes('histoire.html')) {
        chargerHistoire();
    }
});

// Charger les catégories
function chargerCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    
    categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.onclick = () => window.location.href = `index.html?categorie=${encodeURIComponent(cat.nom)}`;
        card.innerHTML = `
            <i class="fas ${cat.icon}"></i>
            <h3>${cat.nom}</h3>
            <p>${cat.count} histoires</p>
        `;
        grid.appendChild(card);
    });
}

// Charger les histoires récentes
function chargerHistoiresRecentes() {
    const grid = document.getElementById('recentStories');
    if (!grid) return;
    
    let toutesHistoires = [];
    for (let cat in histoiresDatabase) {
        toutesHistoires = toutesHistoires.concat(histoiresDatabase[cat]);
    }
    
    // Trier par date (plus récentes d'abord)
    toutesHistoires.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Prendre les 6 premières
    const recentes = toutesHistoires.slice(0, 6);
    
    recentes.forEach(histoire => {
        const card = document.createElement('div');
        card.className = 'story-card';
        card.innerHTML = `
            <div class="story-image">
                <i class="fas fa-book-heart"></i>
            </div>
            <div class="story-content">
                <span class="story-category">${histoire.categorie}</span>
                <h3 class="story-title">${histoire.titre}</h3>
                <p class="story-author">par ${histoire.auteur}</p>
                <p class="story-preview">${histoire.extrait}</p>
                <div class="story-footer">
                    <div class="story-rating">
                        ${genererEtoiles(histoire.note)}
                    </div>
                    <a href="histoire.html?id=${histoire.id}" class="read-more">Lire <i class="fas fa-arrow-right"></i></a>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Générer les étoiles de notation
function genererEtoiles(note) {
    let etoiles = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(note)) {
            etoiles += '<i class="fas fa-star"></i>';
        } else if (i - 0.5 <= note) {
            etoiles += '<i class="fas fa-star-half-alt"></i>';
        } else {
            etoiles += '<i class="far fa-star"></i>';
        }
    }
    return etoiles;
}

// Charger les catégories dans le select du formulaire
function chargerSelectCategories() {
    const select = document.getElementById('storyCategory');
    if (!select) return;
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.nom;
        option.textContent = cat.nom;
        select.appendChild(option);
    });
}

// Initialiser la recherche
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.toLowerCase();
            if (query) {
                showLegacyModal('info', `Recherche de "${query}" - Fonctionnalite a implementer avec une vraie base de donnees`);
                // Ici, vous redirigeriez vers une page de résultats
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchBtn.click();
            }
        });
    }
}

// Formulaire de publication d'histoire
const storyForm = document.getElementById('storyForm');
if (storyForm) {
    storyForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const titre = document.getElementById('storyTitle').value;
        const categorie = document.getElementById('storyCategory').value;
        const contenu = document.getElementById('storyContent').value;
        const auteur = document.getElementById('storyAuthor').value;
        
        // Simulation d'envoi
        showLegacyModal('success', `Merci ${auteur} ! Votre histoire "${titre}" a ete recue. Elle sera publiee apres moderation.`);
        
        // Réinitialiser le formulaire
        storyForm.reset();
    });
}

// Charger une histoire spécifique (page histoire.html)
function chargerHistoire() {
    const urlParams = new URLSearchParams(window.location.search);
    const histoireId = parseInt(urlParams.get('id'));
    const container = document.getElementById('storyContainer');
    
    if (!container || !histoireId) {
        if (container) {
            container.innerHTML = '<p class="error">Histoire non trouvée...</p>';
        }
        return;
    }
    
    // Chercher l'histoire dans toutes les catégories
    let histoire = null;
    for (let cat in histoiresDatabase) {
        const found = histoiresDatabase[cat].find(h => h.id === histoireId);
        if (found) {
            histoire = found;
            break;
        }
    }
    
    if (!histoire) {
        container.innerHTML = '<p class="error">Cette histoire n\'existe pas...</p>';
        return;
    }
    
    // Afficher l'histoire
    container.innerHTML = `
        <div class="story-header">
            <h1>${histoire.titre}</h1>
            <div class="story-meta">
                <span><i class="fas fa-user"></i> ${histoire.auteur}</span>
                <span><i class="fas fa-calendar"></i> ${formatDate(histoire.date)}</span>
                <span><i class="fas fa-heart"></i> ${histoire.categorie}</span>
            </div>
            <div class="story-actions">
                <button class="btn btn-favorite" onclick="ajouterFavoris(${histoire.id})">
                    <i class="fas fa-heart"></i> Ajouter aux favoris
                </button>
                <button class="btn btn-share" onclick="partagerHistoire()">
                    <i class="fas fa-share"></i> Partager
                </button>
            </div>
            <div class="story-rating-large">
                ${genererEtoiles(histoire.note)} (${histoire.note}/5)
            </div>
        </div>
        <div class="story-content">
            ${histoire.contenu.split('\n\n').map(para => `<p>${para}</p>`).join('')}
        </div>
    `;
    
    // Charger les commentaires
    chargerCommentaires(histoire);
}

// Charger les commentaires d'une histoire
function chargerCommentaires(histoire) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    if (histoire.commentaires && histoire.commentaires.length > 0) {
        commentsList.innerHTML = histoire.commentaires.map(comment => `
            <div class="comment-card">
                <div class="comment-header">
                    <span>${comment.pseudo}</span>
                    <span class="comment-date">${formatDate(comment.date)}</span>
                </div>
                <div class="comment-text">${comment.message}</div>
            </div>
        `).join('');
    } else {
        commentsList.innerHTML = '<p style="text-align: center; color: #999;">Soyez le premier à commenter...</p>';
    }
}

// Formulaire de commentaire
const commentForm = document.getElementById('commentForm');
if (commentForm) {
    commentForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const pseudo = document.getElementById('commentPseudo').value;
        const message = document.getElementById('commentMessage').value;
        
        showLegacyModal('success', `Merci ${pseudo} ! Votre commentaire a ete ajoute.`);
        
        commentForm.reset();
    });
}

// Ajouter aux favoris
function ajouterFavoris(histoireId) {
    // Récupérer les favoris actuels
    let favoris = JSON.parse(localStorage.getItem('favoris') || '[]');
    
    if (!favoris.includes(histoireId)) {
        favoris.push(histoireId);
        localStorage.setItem('favoris', JSON.stringify(favoris));
        showLegacyModal('success', 'Histoire ajoutee aux favoris ! ❤️');
    } else {
        showLegacyModal('info', 'Cette histoire est deja dans vos favoris.');
    }
}

// Partager une histoire
function partagerHistoire() {
    if (navigator.share) {
        navigator.share({
            title: 'Mon Histoire d\'Amour',
            text: 'Découvre cette belle histoire d\'amour !',
            url: window.location.href
        });
    } else {
        showLegacyModal('info', 'Copiez le lien : ' + window.location.href);
    }
}

// Formater la date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('fr-FR', options);
}

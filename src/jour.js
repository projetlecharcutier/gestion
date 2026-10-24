// Transition de jour : au passage de minuit (changement de state.day), tout
// l'ecran passe au noir quelques secondes avec "Jour N" et une phrase de
// palier (univers zombie / Normandie / pixel art). Masque aussi le petit
// freeze du a la regeneration des forets (regenForets au meme moment).
(function () {
  "use strict";
  var G = window.GAME;

  // Duree totale de l'ecran noir (secondes) et fondu d'entree/sortie.
  G.JOUR_SCREEN_TIME = 3.2;
  G.JOUR_FADE = 0.5;

  // Phrases par palier de jours. Le palier est le plus grand seuil atteint ;
  // dans un palier, la phrase tourne selon le numero du jour (deterministe :
  // tous les clients affichent la meme phrase le meme jour).
  // Univers : zombie, Normandie (paysages, normands, precipitations),
  // pixel art (craft, blocks, sprites 8-bit).
  G.JOUR_QUOTES = [
    { from: 2, lines: [
      "Vous n'y survivrez pas.",
      "Les cops pars les connees sentent l'zombie.",
      "Y'a pus qu'a bouchonner la palissade, m'sieu.",
      "La boue normande aime les semelles fraiches."
    ]},
    { from: 4, lines: [
      "Quelle performance. Pour l'instant.",
      "Le brouillard s'ramasse a la fourche, par ichi.",
      "Faut pas cracher dans l'cidre, il parait qu'y gouttent.",
      "Les zombies preferent le beurre cuit."
    ]},
    { from: 7, lines: [
      "Ca va devenir complique.",
      "Touot le monde savait qu'la dree s'arrêterait ichi.",
      "Un pixel de courage vaut mieux qu'un block de panique.",
      "I n'pleut pus su' nous, i'pleut avec nous."
    ]},
    { from: 10, lines: [
      "Dix jours. Les corbiaux comptent déjà vos pixels.",
      "L'paysan s'défend comme un chartier : a' hache.",
      "Les meules de foin regardent passer les zombies.",
      "V'la t'y pas qu'les morts s'mettent à l'queue leu leu."
    ]},
    { from: 15, lines: [
      "Quinze jours. Le fromage n'attend personne.",
      "La nuit normande est comme un linge noir : y'vous envelloppe.",
      "Mes'ieu, o est pour tuer ou' pour êt' tué.",
      "Les pommiers n'ont jamais vu autant de sang répandu."
    ]},
    { from: 21, lines: [
      "Trois semaines. La Manche entend vos cris, mais e' s'en fiche.",
      "Les zombies byin byin leurs manches, eux, pour march' dans l'fange.",
      "Chaque pixel d'cette terre a bu son p'tit coup d'pus.",
      "O' finira bé, comme o'a commencé : dans l'noi'"
    ]},
    { from: 30, lines: [
      "Un mois. Même l'calvados n'chafe plus le curo.",
      "Les morts marchent pus vite que l'bus de Lisieux, et c'est peu dire.",
      "Il ne reste qu'la foi, le cidre, et deux planches malades.",
      "O'est fini d'rigoler. Enfin, s'i'vous reste l'curo à rire."
    ]},
    { from: 50, lines: [
      "Cinquante jours. Les survivants portent bé des noms d'cassés.",
      "La Normandie n'a jamais rendu ses morts aussi vite.",
      "Un sprite de plus, un sprite de moins... allez, r'garde pas en arrière.",
      "Les cloches sonnent pus. C'est les zombies qui font l'concert."
    ]}
  ];

  // Phrase du jour : palier le plus eleve dont le seuil <= day, puis rotation
  // deterministe dans les lignes du palier.
  G.jourQuote = function (day) {
    var tier = null;
    for (var i = 0; i < G.JOUR_QUOTES.length; i++) {
      if (day >= G.JOUR_QUOTES[i].from) tier = G.JOUR_QUOTES[i];
    }
    if (!tier) return "";
    return tier.lines[(day - tier.from) % tier.lines.length];
  };

  // Etat local de l'ecran de transition.
  var jourTimer = 0;
  var jourDay = 0;

  // A appeler a chaque frame (main.js update) : declenche la transition au
  // passage de minuit (state.day change), en solo comme en multi (le serveur
  // est autorite : applyRemoteState met a jour state.day a 10 Hz).
  G.updateJour = function (dt) {
    var state = G.state;
    if (!state || !state.started || state.gameOver) return;
    if (state.day !== state.lastJourShown) {
      // Premier jour (lancement de partie) : pas d'ecran, on note seulement.
      if (state.lastJourShown == null) { state.lastJourShown = state.day; return; }
      state.lastJourShown = state.day;
      jourTimer = G.JOUR_SCREEN_TIME;
      jourDay = state.day;
    }
    if (jourTimer > 0) jourTimer -= dt;
  };

  // Rendu : voile noir + "Jour N" + phrase, par-dessus TOUT le rendu.
  // Appele en dernier dans render() (apres drawGameOver).
  G.drawJour = function () {
    if (jourTimer <= 0) return;
    var ctx = G.ctx;
    var W = G.canvas.width / (window.devicePixelRatio || 1);
    var H = G.canvas.height / (window.devicePixelRatio || 1);
    var t = jourTimer;
    var total = G.JOUR_SCREEN_TIME;
    // Alpha : fondu entree/sortie symetrique, plein au milieu.
    var a = Math.min(1, t / G.JOUR_FADE, (total - t) / G.JOUR_FADE);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0," + a.toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var cy = H / 2;
    // Titre "Jour N" : or du theme, ombre portee pixel (meme style que le
    // titre du menu, direction artistique retro).
    ctx.font = "bold 46px ui-monospace, 'Cascadia Mono', Consolas, monospace";
    ctx.fillStyle = "rgba(10,8,20," + a.toFixed(3) + ")";
    ctx.fillText("Jour " + jourDay, W / 2 + 3, cy - 30 + 3);
    ctx.fillStyle = "rgba(255,214,110," + a.toFixed(3) + ")";
    ctx.fillText("Jour " + jourDay, W / 2, cy - 30);
    // Phrase de palier : gris clair du theme, en dessous.
    ctx.font = "17px ui-monospace, 'Cascadia Mono', Consolas, monospace";
    ctx.fillStyle = "rgba(190,190,205," + a.toFixed(3) + ")";
    ctx.fillText(G.jourQuote(jourDay), W / 2, cy + 22);
    ctx.restore();
  };
})();

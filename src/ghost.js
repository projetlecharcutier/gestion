// Mode fantôme : après la mort, Espace libère un petit fantôme qui vole
// librement sur la carte (pas de brouillard noir, aucune interaction) et une
// tombe « rip - <nom> » reste à l'endroit du décès. Module partagé client +
// serveur : le serveur fait autorité (création des tombes), le client
// consomme l'état et le dessine.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  var TEX = G.TEXTURES = G.TEXTURES || {};

  // Plafond de tombes conservées (parité avec deadTraces).
  G.GRAVES_MAX = 100;

  // Textures pixel art du petit fantôme (9x12, dessin canvas par cellules).
  TEX.ghost = {
    sprite: [
      "..ggggg..",
      ".ggggggg.",
      "ggggggggg",
      "ggegggegg",
      "ggggggggg",
      "ggggggggg",
      "ggggggggg",
      "ggggggggg",
      "ggggggggg",
      "gg.gg.gg.",
      "g..g..g..",
      "....g...."
    ],
    palette: { g: "rgba(226,232,240,0.85)", e: "#1e293b" },
    // Ombre portée au sol (petite, le fantôme flotte).
    shadow: "rgba(0,0,0,0.25)",
    // Amplitude et vitesse de flottaison (px monde, Hz).
    floatAmp: 6,
    floatSpeed: 1.6
  };

  // Textures de la tombe (pierre grise + épitaphe).
  TEX.grave = {
    stone: "#9ca3af",
    stoneDark: "#6b7280",
    stoneEdge: "#4b5563",
    mound: "#78716c",
    moundDark: "#57534e",
    // Style de l'épitaphe « rip - <nom> ».
    epitaph: "#e2e8f0",
    epitaphStroke: "rgba(0,0,0,0.75)"
  };

  // Crée une tombe à l'endroit du décès d'un joueur (côté serveur / solo).
  // Idempotent par joueur : un joueur ne laisse qu'une tombe (la sienne est
  // remplacée s'il meurt à nouveau après une résurrection).
  G.spawnGrave = function (state, player, name) {
    if (!state) return;
    if (!state.graves) state.graves = [];
    var pid = player ? player.id : undefined;
    for (var i = 0; i < state.graves.length; i++) {
      if (pid !== undefined && state.graves[i].id === pid) {
        state.graves[i].x = Math.round(player.x);
        state.graves[i].y = Math.round(player.y);
        state.graves[i].name = name || state.graves[i].name;
        return state.graves[i];
      }
    }
    var g = {
      id: pid !== undefined ? pid : ("grave" + (state.graves.length + 1)),
      x: Math.round(player ? player.x : (G.WORLD / 2)),
      y: Math.round(player ? player.y : (G.WORLD / 2)),
      name: name || "Joueur"
    };
    state.graves.push(g);
    // Plafond : les plus anciennes disparaissent.
    while (state.graves.length > G.GRAVES_MAX) state.graves.shift();
    return g;
  };
})();

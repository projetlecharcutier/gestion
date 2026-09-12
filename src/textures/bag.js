// Textures du sac (panneau UI) : fond, panneau, titres, stats, icônes arme/objet.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  G.TEXTURES.bag = {
    overlay: "rgba(2,6,23,0.7)",
    panelFill: "#1e293b",
    panelStroke: "#334155",
    title: "#818cf8",
    equipped: "#fbbf24",
    stats: "#94a3b8",
    hint: "#94a3b8",
    empty: "#64748b",
    itemText: "#f1f5f9",
    weaponTag: "#818cf8",
    objectTag: "#64748b",
    equippedHighlight: "rgba(251,191,36,0.16)",
    weaponHandle: "#3b2a1a",
    // Couleur de repli pour un objet sans couleur.
    defaultColor: "#fbbf24"
  };
})();

// Textures du sol : couleurs des tuiles (ville vs hors ville) + bordure de ville.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  G.TEXTURES.ground = {
    town: { fill: "#84c573", stroke: "#7ab568" },
    wild: { fill: "#84c573", stroke: "#7ab568" },
    border: "#8aa0c0", // contour du rectangle de ville
    // Couleur de fond (ciel) selon l'heure.
    skyNight: "#84c573",
    skyDay: "#84c573",
    // Points de couleur au sol (fleurs / pousses) : ~1% de la surface.
    // perTile points de rayon "radius" (unites monde) par tuile TS*TS :
    // couverture = perTile * PI * radius^2 / TS^2 ~ 1% avec 510 points de
    // rayon 2.5 sur des tuiles de 1000. Position et couleur deterministes
    // par tuile (cf. drawGroundSpecks dans render.js), aucun scintillement.
    specks: {
      colors: ["#5a944a", "#4a6b3a", "#ffffff", "#fffabc", "#e8d45f"],
      perTile: 510,
      radius: 2.5,
      alpha: 0.9
    }
  };
})();

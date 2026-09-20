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
    // Taches de couleur au sol (fleurs / pousses) : ~0.5% de la surface.
    // perTile carres de cote "side" (unites monde) par tuile TS*TS, alignes
    // sur les axes ecran (horizontal / vertical, cf. drawGroundSpecks) :
    // couverture = perTile * side^2 / TS^2 ~ 0.5% avec 408 carres de cote
    // 3.5 sur des tuiles de 1000 (30% plus petits que les cercles initiaux
    // de rayon 2.5). Position et couleur deterministes par tuile, aucun
    // scintillement.
    specks: {
      colors: ["#5a944a", "#4a6b3a", "#ffffff", "#fffabc", "#e8d45f"],
      perTile: 408,
      side: 3.5,
      alpha: 0.9
    }
  };
})();

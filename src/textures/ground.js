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
    skyDay: "#84c573"
  };
})();

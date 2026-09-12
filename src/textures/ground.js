// Textures du sol : couleurs des tuiles (ville vs hors ville) + bordure de ville.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  G.TEXTURES.ground = {
    town: { fill: "#3b4a5a", stroke: "#46566a" },
    wild: { fill: "#27452a", stroke: "#33543a" },
    border: "#8aa0c0", // contour du rectangle de ville
    // Couleur de fond (ciel) selon l'heure.
    skyNight: "#0a1020",
    skyDay: "#0e1a30"
  };
})();

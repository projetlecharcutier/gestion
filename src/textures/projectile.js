// Textures des projectiles : couleur de repli, contour et multiplicateur de taille du rayon.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  G.TEXTURES.projectile = {
    defaultColor: "#fff7ad",
    stroke: "rgba(15,23,42,0.6)",
    trailAlpha: 0.6,     // alpha max du début de la traîne
    trailSize: 2,        // rayon de base du début de traîne
    trailSizeStep: 0.4,  // incrément de rayon par élément de traîne
    // Rayon de la tête : radius = sizeBase + dmg * sizePerDmg
    sizeBase: 2,
    sizePerDmg: 0.8,
    trailMax: 8         // longueur max de la traîne
  };
})();

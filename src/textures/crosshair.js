// Texture du viseur (crosshair) : couleur des lignes du réticule.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  G.TEXTURES.crosshair = {
    color: "rgba(129,140,248,0.9)",
    radius: 5,
    gap: 3,
    tick: 9
  };
})();

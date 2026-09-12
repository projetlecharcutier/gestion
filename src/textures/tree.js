// Textures des arbres : tronc, ombre et feuillage par type (town/edge/wild).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  G.TEXTURES.tree = {
    trunk: "#5b3a1f",
    shadow: "rgba(0,0,0,0.28)",
    // Feuillage (clair) et ombre du feuillage (foncé) selon le kind de l'arbre.
    foliage: {
      town: { light: "#2f7d32", dark: "#22611f" },
      edge: { light: "#3b8a3e", dark: "#2d6e2f" },
      wild: { light: "#256b2a", dark: "#1c5020" }
    }
  };
})();

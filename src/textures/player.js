// Textures du joueur : sprite pixel art (6×15) + palette de couleurs.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  // Légendes : h=cheveux, s=peau, b=corps, p=pantalons, f=pieds, .=transparent
  G.TEXTURES.player = {
    sprite: [
      "..hh..", ".hhhh.", ".hhhh.", ".ssss.", ".s..s.", ".ssss.",
      "bbbbbb", "bbbbbb", ".bbbb.", ".pppp.", ".pppp.", ".pppp.",
      ".pppp.", ".p..p.", ".f..f."
    ],
    palette: {
      h: "#3b2a1a", s: "#e8b98a", b: "#6366f1",
      p: "#334155", f: "#1f2937"
    },
    shadow: "rgba(0,0,0,0.4)"
  };
})();

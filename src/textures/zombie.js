// Textures des zombies : sprite pixel art (6×15) + palette de couleurs.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  // Légendes : h=cheveux, s=peau, g=corps, p=pantalons, f=pieds, .=transparent
  G.TEXTURES.zombie = {
    sprite: [
      "..hh..", ".hhhh.", ".hhhh.", ".ssss.", ".s..s.", ".ssss.",
      "gggggg", "gggggg", ".gggg.", ".pppp.", ".pppp.", ".pppp.",
      ".p..p.", ".p..p.", ".f..f."
    ],
    palette: {
      h: "#4b6b3a", s: "#9bbf8a", g: "#5b7a4a",
      p: "#3a4a30", f: "#26331f"
    },
    shadow: "rgba(0,0,0,0.4)"
  };
})();

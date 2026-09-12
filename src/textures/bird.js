// Textures des oiseaux : sprite pixel art + palette + ailes battantes.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};
  // Légendes : b=corps, w=aile, h=head, y=bec, e=oeil, .=transparent
  G.TEXTURES.bird = {
    sprite: [
      "..bbbb..",
      ".bbbbbb.",
      "bbbbbbbb",
      "bhbeyybb",
      "bhhbbb.b",
      ".bbbbbb.",
      ".b....b.",
      "ww....ww"
    ],
    palette: {
      b: "#3b82f6",
      h: "#1e40af",
      y: "#f59e0b",
      e: "#0f172a",
      w: "#60a5fa"
    },
    shadow: "rgba(0,0,0,0.3)"
  };
})();

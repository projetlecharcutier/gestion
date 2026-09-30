// Textures des animaux sauvages (cerf, cochon, vache, mouton) : sprites
// pixel art vus de cote + palette par type. Rendu dans render.js.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};
  // Legendes : b=corps, h=tete, e=oeil/patte sombre, l=patte, a=accessoire,
  // s=tache, .=transparent
  G.TEXTURES.fauna = {
    // Grille commune 10x8 : chaque type fournit sa palette.
    cerf: {
      sprite: [
        "....hh....",
        "...ahhb...",
        "...bbbb...",
        "..bbbbbb..",
        "..bsbbsb..",
        "..bbbbbb..",
        ".l..ll..l.",
        ".l......l."
      ],
      palette: { b: "#b45309", h: "#92400e", a: "#5b2c06", e: "#1c1917", l: "#78350f", s: "#7c3a0d" }
    },
    cochon: {
      sprite: [
        "..........",
        "....hhb...",
        "...bbbse..",
        "..bbbbbb..",
        ".sbbbbbbb.",
        ".bbbbbbbb.",
        ".l..ll..l.",
        ".l......l."
      ],
      palette: { b: "#e8a0a8", h: "#e8a0a8", e: "#1c1917", l: "#c2747e", s: "#f3b8bf" }
    },
    vache: {
      sprite: [
        "....hh....",
        "...hbbse..",
        "..sbbbbb..",
        ".bsbbbsbb.",
        ".bbbsbbbb.",
        ".bbbbbbb..",
        ".l..ll..l.",
        ".l......l."
      ],
      palette: { b: "#f5f5f4", h: "#e7e5e4", e: "#1c1917", l: "#a8a29e", s: "#44403c" }
    },
    mouton: {
      sprite: [
        "..........",
        "....hhb...",
        "...sbsse..",
        "..ssbsss..",
        ".ssbsssss.",
        ".sbbbbbss.",
        ".l..ll..l.",
        ".l......l."
      ],
      palette: { b: "#e7e5e4", h: "#d6d3d1", e: "#1c1917", l: "#a8a29e", s: "#fafaf9" }
    }
  };
})();

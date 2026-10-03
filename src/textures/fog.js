// Texture du brouillard de guerre : couleur et arrêts du dégradé radial (hors ville).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  G.TEXTURES.fog = {
    color: "2,6,23",
    stops: [
      { at: 0,   alpha: 0    },
      { at: 0.5, alpha: 0.75  },
      { at: 1,   alpha: 1     }
    ]
  };
})();

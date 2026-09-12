// Textures des murs : couleurs des faces, du dessus (planche) et des seuils de barre de vie.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  G.TEXTURES.wall = {
    faces: {
      sideX: { fill: "#8a6a3a", stroke: "#5a3e1c" },
      sideY: { fill: "#a07a45", stroke: "#6b4f24" }
    },
    top: { fill: "#caa45f", stroke: "#7a5a2c" },
    // Couleurs de la barre de vie selon le ratio hp/WALL_MAX_HP.
    hpBar: {
      low:   "#ef4444", // < 10 %
      mid:   "#f59e0b", // < 30 %
      high:  "#22c55e"  // sinon
    },
    hpBarBg: "rgba(0,0,0,0.5)"
  };
})();

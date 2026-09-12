// Textures des overlays HUD canvas : barre de vie joueur, horloge, hint build, game over.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  // Barre de vie au-dessus du joueur.
  G.TEXTURES.playerHpBar = {
    width: 28,
    height: 4,
    bg: "rgba(0,0,0,0.6)",
    color: {
      low:  "#ef4444", // < 30 %
      mid:  "#f59e0b", // < 60 %
      high: "#22c55e"
    }
  };

  // Horloge jour/nuit + vague + compteur de jours.
  G.TEXTURES.clock = {
    night: "#1e293b",
    day: "#fef3c7",
    waveColor: "#ef4444",
    dayColor: "#e2e8f0"
  };

  // Hint de construction (mode B).
  G.TEXTURES.buildHint = {
    ok: "rgba(34,197,94,0.9)",
    nok: "rgba(239,68,68,0.9)",
    textColor: "#e2e8f0"
  };

  // Écran de game over.
  G.TEXTURES.gameOver = {
    veil: "rgba(2,6,23,0.8)",
    title: "#ef4444",
    text: "#e2e8f0",
    hint: "#94a3b8"
  };
})();

// Textures des objets au sol : ombre commune + rendu arme vs objet (couleur par défaut).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  G.TEXTURES.item = {
    shadow: "rgba(0,0,0,0.35)",
    stroke: "rgba(0,0,0,0.4)",
    // Pour les objets ronds : reflet pixelisé.
    shine: "rgba(255,255,255,0.5)",
    // Pour les armes : poignée + contour.
    weaponHandle: "#3b2a1a",
    weaponStroke: "#0f172a",
    // Couleur de repli si l'objet n'en définit pas.
    defaultColor: "#fbbf24"
  };
})();

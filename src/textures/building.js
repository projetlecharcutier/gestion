// Textures des bâtiments : couleurs des faces, du toit, de la porte et de son contour.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.TEXTURES = G.TEXTURES || {};

  // Rendu iso d'un bâtiment : 2 faces avant + 1 toit + porte centrale.
  G.TEXTURES.building = {
    faces: {
      sideX: { fill: "#5b6b8a", stroke: "#3b4860" }, // face +x (B,C,Ct,Bt)
      sideY: { fill: "#6b7c9a", stroke: "#46546e" }  // face +y (D,C,Ct,Dt)
    },
    roof: { fill: "#8a99b8", stroke: "#5a6b88" },
    door: { fill: "#3b2a1a", stroke: "#d9a441" }
  };
})();

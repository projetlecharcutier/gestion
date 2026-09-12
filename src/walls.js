// Murs : construction de murs (clavier B + clic) et nettoyage des murs détruits.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Dimensions d'une planche posée. Rotation 0 = horizontale, 1 = verticale.
  G.PLANK_LONG = 120;
  G.PLANK_THICK = 24;

  G.plankDims = function () {
    // Selon state.plankRotation (0 = horizontal, 1 = vertical).
    if (G.state.plankRotation) return { w: G.PLANK_THICK, h: G.PLANK_LONG };
    return { w: G.PLANK_LONG, h: G.PLANK_THICK };
  };

  // Pose une planche au point cliqué. Les planches peuvent se superposer.
  G.tryBuildWall = function (wx, wy) {
    var state = G.state;
    var p = state.player;
    var dx = wx - p.x, dy = wy - p.y;
    if (Math.sqrt(dx * dx + dy * dy) > G.WALL_BUILD_RANGE) return;
    if (state.planks < G.WALL_PLANKS) return;
    var dims = G.plankDims();
    var w = dims.w, h = dims.h;
    var mx = wx - w / 2, my = wy - h / 2;
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (mx < b.x + b.w && mx + w > b.x && my < b.y + b.h && my + h > b.y) return;
    }
    state.planks -= G.WALL_PLANKS;
    state.walls.push({ x: mx, y: my, w: w, h: h, hp: G.WALL_MAX_HP, orient: w > h ? "h" : "v" });
    G.updateHud();
  };

  // Fait tourner la planche de 90° (en mode pose).
  G.rotatePlank = function () {
    G.state.plankRotation = G.state.plankRotation ? 0 : 1;
  };

  // Retire les murs détruits. Appelé depuis update().
  G.cleanupWalls = function () {
    var walls = G.state.walls;
    for (var wj = walls.length - 1; wj >= 0; wj--) {
      if (walls[wj].hp <= 0) walls.splice(wj, 1);
    }
  };
})();

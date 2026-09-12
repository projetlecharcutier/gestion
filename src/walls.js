// Murs : construction de murs (clavier B + clic) et nettoyage des murs détruits.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.tryBuildWall = function (wx, wy) {
    var state = G.state;
    var p = state.player;
    var dx = wx - p.x, dy = wy - p.y;
    if (Math.sqrt(dx * dx + dy * dy) > G.WALL_BUILD_RANGE) return;
    if (state.planks < G.WALL_PLANKS) return;
    var w = 24, h = 24;
    if (Math.abs(wx - p.x) > Math.abs(wy - p.y)) h = 120; else w = 120;
    var mx = wx - w / 2, my = wy - h / 2;
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (mx < b.x + b.w && mx + w > b.x && my < b.y + b.h && my + h > b.y) return;
    }
    for (var j = 0; j < state.walls.length; j++) {
      var m = state.walls[j];
      if (mx < m.x + m.w && mx + w > m.x && my < m.y + m.h && my + h > m.y) return;
    }
    state.planks -= G.WALL_PLANKS;
    state.walls.push({ x: mx, y: my, w: w, h: h, hp: G.WALL_MAX_HP, orient: w > h ? "h" : "v" });
    G.updateHud();
  };

  // Retire les murs détruits. Appelé depuis update().
  G.cleanupWalls = function () {
    var walls = G.state.walls;
    for (var wj = walls.length - 1; wj >= 0; wj--) {
      if (walls[wj].hp <= 0) walls.splice(wj, 1);
    }
  };
})();

// Récolte de planches à la hache : s'équiper de la hache et maintenir
// Espace pendant TREE_CHOP_TIME à proximité d'une forêt ou d'une palissade.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Cherche la forêt (bâtiment isForet) la plus proche à portée de hache
  // du joueur. Les forêts sont des bâtiments ; on filtre sur isForet.
  function nearestChoppableTree() {
    var state = G.state;
    var p = state.player;
    var best = null, bestD = Infinity;
    var blds = state.buildings;
    for (var i = 0; i < blds.length; i++) {
      var t = blds[i];
      if (!t.isForet) continue;
      var cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      var dx = cx - p.x, dy = cy - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < G.AXE_RANGE && d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  // Cherche la planche (built) la plus proche à portée de hache du joueur.
  function nearestChoppableWall() {
    var state = G.state;
    var p = state.player;
    var best = null, bestD = Infinity;
    for (var i = 0; i < state.walls.length; i++) {
      var m = state.walls[i];
      if (!m.built) continue;
      var cx = m.x + m.w / 2, cy = m.y + m.h / 2;
      var dx = cx - p.x, dy = cy - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < G.AXE_RANGE && d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  // Appelé chaque frame depuis update(). Gère le décompte de récolte.
  G.updateChop = function (dt) {
    var state = G.state;
    if (!state.started || state.paused || state.gameOver || state.inBuilding || state.bag.open || state.chestOpen) {
      state.chopTarget = null;
      state.chopTimer = 0;
      return;
    }
    if (!state.axeEquipped) {
      state.chopTarget = null;
      state.chopWall = null;
      state.chopTimer = 0;
      return;
    }
    // Action manuelle : il faut maintenir le clic gauche (actionHeld) pour
    // utiliser la hache.
    if (!state.actionHeld) {
      state.chopTimer = 0;
      return;
    }
    var target = nearestChoppableTree();
    var wall = nearestChoppableWall();
    // Priorité : la planche si elle est plus proche que l'arbre.
    var wallD = wall ? Math.hypot((wall.x + wall.w / 2) - G.state.player.x, (wall.y + wall.h / 2) - G.state.player.y) : Infinity;
    var treeD = target ? Math.hypot((target.x + target.w / 2) - G.state.player.x, (target.y + target.h / 2) - G.state.player.y) : Infinity;
    var isWall = wallD <= treeD;
    var cible = isWall ? wall : target;
    if (!cible) {
      state.chopTarget = null;
      state.chopWall = null;
      state.chopTimer = 0;
      return;
    }
    // Continue le décompte si on vise la même cible, sinon on relance.
    var same = isWall ? (state.chopWall === cible) : (state.chopTarget === cible && !state.chopWall);
    if (!same) {
      state.chopTarget = isWall ? null : cible;
      state.chopWall = isWall ? cible : null;
      state.chopTimer = 0;
    }
    state.chopTimer += dt;
    if (state.chopTimer >= G.TREE_CHOP_TIME) {
      if (isWall) {
        // Destruction de planche : -10 PV, planche retirée si détruite.
        state.chopWall.hp -= G.WALL_AXE_DMG;
        if (state.chopWall.hp <= 0) {
          var wi = state.walls.indexOf(state.chopWall);
          if (wi >= 0) state.walls.splice(wi, 1);
          // Récupère les 4 planches qui formaient la palissade.
          state.planks += G.WALL_PLANKS;
        }
      } else {
        // Récolte : 1 planche, forêt retirée des bâtiments.
        state.planks += 1;
        var idx = state.buildings.indexOf(cible);
        if (idx >= 0) {
          state.buildings.splice(idx, 1);
          if (G.buildingGrid) G.rebuildBuildingGrid();
        }
      }
      state.chopTarget = null;
      state.chopWall = null;
      state.chopTimer = 0;
      G.updateHud();
    }
  };

  // Ratio d'avancement de la récolte (0..1) pour le cercle de décompte, ou -1 si inactif.
  G.chopProgress = function () {
    var state = G.state;
    if (!state.axeEquipped || !state.actionHeld || (!state.chopTarget && !state.chopWall)) return -1;
    return state.chopTimer / G.TREE_CHOP_TIME;
  };
})();

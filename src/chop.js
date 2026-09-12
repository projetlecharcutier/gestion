// Récolte de planches à la hache : rester à côté d'un arbre pendant TREE_CHOP_TIME.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Cherche l'arbre le plus proche à portée de hache du joueur.
  function nearestChoppableTree() {
    var state = G.state;
    var p = state.player;
    var best = null, bestD = Infinity;
    for (var i = 0; i < state.trees.length; i++) {
      var t = state.trees[i];
      var dx = t.x - p.x, dy = t.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < G.AXE_RANGE && d < bestD) { bestD = d; best = t; }
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
      state.chopTimer = 0;
      return;
    }
    var target = nearestChoppableTree();
    if (!target) {
      state.chopTarget = null;
      state.chopTimer = 0;
      return;
    }
    // Continue le décompte si on vise le même arbre, sinon on relance.
    if (state.chopTarget !== target) {
      state.chopTarget = target;
      state.chopTimer = 0;
    }
    state.chopTimer += dt;
    if (state.chopTimer >= G.TREE_CHOP_TIME) {
      // Récolte : 1 planche, arbre retiré.
      state.planks += 1;
      var idx = state.trees.indexOf(target);
      if (idx >= 0) state.trees.splice(idx, 1);
      state.chopTarget = null;
      state.chopTimer = 0;
      G.updateHud();
    }
  };

  // Ratio d'avancement de la récolte (0..1) pour le cercle de décompte, ou -1 si inactif.
  G.chopProgress = function () {
    var state = G.state;
    if (!state.axeEquipped || !state.chopTarget) return -1;
    return state.chopTimer / G.TREE_CHOP_TIME;
  };
})();

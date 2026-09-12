// Murs : construction de murs (clavier B + clic) et nettoyage des murs détruits.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Dimensions d'une planche posée. Rotation 0 = horizontale, 1 = verticale.
  G.PLANK_LONG = 120;
  G.PLANK_THICK = 24;

  // Renvoie les dimensions (longW, thick) d'une palissade adaptées au PNG :
  // longW = longueur de la palissade, thick = épaisseur, en unités monde.
  // Repli sur les constantes si les PNG ne sont pas disponibles.
  G.wallSpriteDims = function () {
    var spH = G.hasSprite("wall", "palissageNESO") ? G.SPRITES.wall.palissageNESO : null;
    var spV = G.hasSprite("wall", "palissageNoSe") ? G.SPRITES.wall.palissageNoSe : null;
    if (spH && spV) {
      // 4x la taille du PNG (comme les bâtiments et arbres). Longueur = dimension
      // la plus grande, épaisseur = dimension la plus petite (palissade fine).
      var longW = Math.max(spH.w, spV.w, spH.h, spV.h) * 2;
      var thick = Math.min(spH.w, spV.w, spH.h, spV.h) * 2 * 0.4;
      return { longW: longW || G.PLANK_LONG, thick: thick || G.PLANK_THICK };
    }
    return { longW: G.PLANK_LONG, thick: G.PLANK_THICK };
  };
  G.plankDims = function () {
    var d = G.wallSpriteDims();
    // Selon state.plankRotation (0 = horizontal, 1 = vertical).
    if (G.state.plankRotation) return { w: d.thick, h: d.longW };
    return { w: d.longW, h: d.thick };
  };

  // Pose une planche au point cliqué. Les planches peuvent se superposer.
  // En mode build le personnage est fige : on peut poser n'importe ou sur la carte.
  G.tryBuildWall = function (wx, wy) {
    var state = G.state;
    var p = state.player;
    // Hors mode build : limite de portee autour du joueur. En mode build : pas de limite.
    if (!state.buildMode) {
      var dx = wx - p.x, dy = wy - p.y;
      if (Math.sqrt(dx * dx + dy * dy) > G.WALL_BUILD_RANGE) return;
    }
    if (state.planks < G.WALL_PLANKS) return;
    var dims = G.plankDims();
    var w = dims.w, h = dims.h;
    var mx = wx - w / 2, my = wy - h / 2;
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (mx < b.x + b.w && mx + w > b.x && my < b.y + b.h && my + h > b.y) return;
    }
    state.planks -= G.WALL_PLANKS;
    // Grace period : la planche ne bloque pas le joueur pendant un court delai
    // apres sa pose, pour eviter qu'il se retrouve coince dessus.
    state.walls.push({ x: mx, y: my, w: w, h: h, hp: G.WALL_MAX_HP, orient: w > h ? "h" : "v", built: true, noBlockUntil: state.time + G.WALL_GRACE });
    G.updateHud();
  };

  // Teste si la boîte (cx,cy,cw,ch) chevauche une planche POSÉE par le joueur (wall.built).
  // Le mur de périmètre (sans `built`) reste traversable.
  // Si forPlayer est vrai, on ignore les planches en grace period (noBlockUntil > state.time)
  // pour ne pas bloquer le joueur sur une planche qu'il vient de poser.
  G.aabbHitsWalls = function (cx, cy, cw, ch, forPlayer) {
    var walls = G.state.walls;
    var now = G.state.time;
    for (var i = 0; i < walls.length; i++) {
      var m = walls[i];
      if (!m.built) continue;
      if (forPlayer && m.noBlockUntil && m.noBlockUntil > now) continue;
      if (cx < m.x + m.w && cx + cw > m.x && cy < m.y + m.h && cy + ch > m.y) return true;
    }
    return false;
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

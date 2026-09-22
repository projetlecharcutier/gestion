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
  // Après la pose, si la palissade chevauche le joueur, on le repousse juste
  // à l'extérieur de la palissade (bord le plus proche) pour éviter qu'il ne
  // se retrouve bloqué dessus à la fin de la grace period.
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
    var wall = { x: mx, y: my, w: w, h: h, hp: G.WALL_MAX_HP, orient: w > h ? "h" : "v", built: true, noBlockUntil: state.time + G.WALL_GRACE };
    state.walls.push(wall);
    // Stats de fin de partie : batiment construit (palissade posee).
    if (G.statsAddBuilt) G.statsAddBuilt();
    // Anti-blocage : si le joueur est à l'intérieur de la palissade, le repousser
    // vers le bord le plus proche, juste à l'extérieur. On tente les 4 bords et
    // on garde la position libre la plus proche.
    G.pushPlayerOutOfWall(wall);
    G.updateHud();
    return true;
  };

  // Repousse le joueur hors d'une palissade s'il s'y trouve coincé. Déplace
  // le joueur vers le bord le plus proche de la palissade, à une marge de
  // PLAYER_HALF + 2 px à l'extérieur. Si aucune des 4 directions n'est libre,
  // cherche une position libre en spirale autour de la palissade.
  G.pushPlayerOutOfWall = function (wall) {
    var p = G.state.player;
    var ph = G.PLAYER_HALF;
    var margin = ph + 2;
    // Le joueur est-il à l'intérieur de la palissade (AABB) ?
    var px = p.x, py = p.y;
    if (px + ph <= wall.x && px - ph >= wall.x + wall.w &&
        py + ph <= wall.y && py - ph >= wall.y + wall.h) return; // non
    if (!(px + ph > wall.x && px - ph < wall.x + wall.w &&
          py + ph > wall.y && py - ph < wall.y + wall.h)) return; // pas de chevauchement
    // 4 positions candidates : juste à l'extérieur de chaque bord.
    var cands = [
      { x: wall.x - margin, y: py },            // gauche
      { x: wall.x + wall.w + margin, y: py },   // droite
      { x: px, y: wall.y - margin },             // haut
      { x: px, y: wall.y + wall.h + margin }    // bas
    ];
    var best = null, bestD = Infinity;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c.x < ph || c.x > G.WORLD - ph || c.y < ph || c.y > G.WORLD - ph) continue;
      // Vérifie que la position est libre (bâtiments + autres murs, en
      // ignorant la grace de la palissade qu'on vient de poser).
      if (G.aabbHitsBuildings(c.x, c.y)) continue;
      if (G.aabbHitsWallsExcluding(c.x - ph, c.y - ph, G.PLAYER_W, G.PLAYER_W, wall)) continue;
      var d = (c.x - px) * (c.x - px) + (c.y - py) * (c.y - py);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) { p.x = best.x; p.y = best.y; return; }
    // Aucun bord libre : recherche en spirale autour du centre de la palissade.
    var cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
    var step = 20, maxR = 400;
    for (var r = margin; r <= maxR; r += step) {
      for (var ang = 0; ang < Math.PI * 2; ang += Math.PI / 6) {
        var nx = cx + Math.cos(ang) * r;
        var ny = cy + Math.sin(ang) * r;
        if (nx < ph || nx > G.WORLD - ph || ny < ph || ny > G.WORLD - ph) continue;
        if (G.aabbHitsBuildings(nx, ny)) continue;
        if (G.aabbHitsWallsExcluding(nx - ph, ny - ph, G.PLAYER_W, G.PLAYER_W, wall)) continue;
        p.x = nx; p.y = ny;
        return;
      }
    }
  };

  // Comme aabbHitsWalls mais ignore une palissade spécifique (excl). Utilisé
  // par pushPlayerOutOfWall pour ne pas être bloqué par la palissade fraîchement
  // posée lors de la recherche d'une position libre.
  G.aabbHitsWallsExcluding = function (cx, cy, cw, ch, excl) {
    var walls = G.state.walls;
    for (var i = 0; i < walls.length; i++) {
      var m = walls[i];
      if (m === excl) continue;
      if (!m.built) continue;
      if (cx < m.x + m.w && cx + cw > m.x && cy < m.y + m.h && cy + ch > m.y) return true;
    }
    return false;
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

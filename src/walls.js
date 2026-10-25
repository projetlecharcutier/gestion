// Murs : construction de murs (clavier B + clic) et nettoyage des murs détruits.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  // === Hash spatial des murs (palissades posees) ===
  // Remplace le scan O(n_murs) de aabbHitsWalls par une requete de grille.
  // Reconstruction incrementale : indexWall apres une pose, unindexWall
  // apres une destruction, rebuildWallGrid apres tout remplacement du
  // tableau state.walls (carte recue, snapshot, reinitialisation).
  // Taille de cellule >= PLANK_LONG (120) : une palissade ne couvre jamais
  // plus que les cellules qu'elle recouvre -> requete sans voisines.
  var WALL_CELL = 128;
  var wallGrid = null; // { "cx,cy": [wall, ...] }
  var wallIndexed = null; // wall -> [cles de cellules couvertes]
  var wallCount = 0;
  function wallCellKey(cx, cy) { return cx + "," + cy; }
  function wallGridAdd(m) {
    var keys = [];
    var x0 = Math.floor(m.x / WALL_CELL), x1 = Math.floor((m.x + m.w) / WALL_CELL);
    var y0 = Math.floor(m.y / WALL_CELL), y1 = Math.floor((m.y + m.h) / WALL_CELL);
    for (var gx = x0; gx <= x1; gx++) {
      for (var gy = y0; gy <= y1; gy++) {
        var k = wallCellKey(gx, gy);
        if (!wallGrid[k]) wallGrid[k] = [];
        wallGrid[k].push(m);
        keys.push(k);
      }
    }
    wallIndexed.set(m, keys);
  }
  G.rebuildWallGrid = function () {
    wallGrid = {};
    wallIndexed = new Map();
    wallCount = 0;
    var walls = G.state.walls;
    if (!walls) return;
    for (var i = 0; i < walls.length; i++) wallGridAdd(walls[i]);
    wallCount = walls.length;
  };
  // Resynchronisation paresseuse : le tableau state.walls peut etre remplace
  // ou mute directement (tests, splice a la main) sans passer par
  // rebuildWallGrid. On detecte la divergence par le nombre d'objets indexes
  // != longueur du tableau et on reconstruit alors -- O(n) rare, pas a
  // chaque requete.
  function wallGridSync() {
    var walls = G.state.walls;
    if (!wallGrid || !wallIndexed || !walls || wallIndexed.size !== walls.length) {
      G.rebuildWallGrid();
    }
  }
  G.indexWall = function (m) {
    if (!wallGrid) { G.rebuildWallGrid(); return; }
    if (wallIndexed.has(m)) return;
    wallGridAdd(m);
    wallCount++;
  };
  G.unindexWall = function (m) {
    if (!wallGrid || !wallIndexed || !wallIndexed.has(m)) return;
    var keys = wallIndexed.get(m);
    for (var i = 0; i < keys.length; i++) {
      var arr = wallGrid[keys[i]];
      if (!arr) continue;
      var j = arr.indexOf(m);
      if (j >= 0) arr.splice(j, 1);
      if (arr.length === 0) delete wallGrid[keys[i]];
    }
    wallIndexed.delete(m);
    wallCount--;
  };
  // Palissades candidates au chevauchement avec la boite (cx,cy,cw,ch).
  // Doublons possibles (mur couvrant plusieurs cellules) : sans consequence
  // pour un test booleen.
  G.wallsNear = function (cx, cy, cw, ch) {
    var out = [];
    wallGridSync();
    var x0 = Math.floor(cx / WALL_CELL), x1 = Math.floor((cx + cw) / WALL_CELL);
    var y0 = Math.floor(cy / WALL_CELL), y1 = Math.floor((cy + ch) / WALL_CELL);
    for (var gx = x0; gx <= x1; gx++) {
      for (var gy = y0; gy <= y1; gy++) {
        var arr = wallGrid[wallCellKey(gx, gy)];
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) out.push(arr[i]);
      }
    }
    return out;
  };
  // Palissades dans un rayon range autour de (x, y) (IA : mur le plus
  // proche, sense, reorientation de foret). Dedupliquees.
  G.wallsInRange = function (x, y, range) {
    var out = [];
    wallGridSync();
    var x0 = Math.floor((x - range) / WALL_CELL), x1 = Math.floor((x + range) / WALL_CELL);
    var y0 = Math.floor((y - range) / WALL_CELL), y1 = Math.floor((y + range) / WALL_CELL);
    for (var gx = x0; gx <= x1; gx++) {
      for (var gy = y0; gy <= y1; gy++) {
        var arr = wallGrid[wallCellKey(gx, gy)];
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) {
          var m = arr[i];
          if (out.indexOf(m) < 0) out.push(m);
        }
      }
    }
    return out;
  };

  // Dimensions d'une planche posée. Rotation 0 = horizontale, 1 = verticale.
  // LA PALISSADE EST LA REFERENCE DE LA GRILLE : sa longueur = G.BUILD_GRID
  // (une palissade occupe exactement une cellule). Le repli (sprites absents,
  // ex. tests sans PNG) garde la grille a sa taille nominale.
  G.PLANK_LONG = (typeof G.BUILD_GRID === "number" && G.BUILD_GRID > 0) ? G.BUILD_GRID : 120;
  G.PLANK_THICK = 24;

  // Renvoie les dimensions (longW, thick) d'une palissade, en unités monde.
  // longW = longueur = cote de la grille de construction (la palissade est la
  // reference du losange), thick = épaisseur. Les PNG des variantes
  // (A/B/C/H/K/X/Z) ne changent pas l'emprise : seule la longueur compte et
  // elle est ancrée sur G.BUILD_GRID.
  G.wallSpriteDims = function () {
    return { longW: G.PLANK_LONG, thick: G.PLANK_THICK };
  };
  G.plankDims = function () {
    var d = G.wallSpriteDims();
    // Selon state.plankRotation (0 = horizontal, 1 = vertical).
    if (G.state.plankRotation) return { w: d.thick, h: d.longW };
    return { w: d.longW, h: d.thick };
  };

  // === Variantes de palissade par contacts de coins ===
  // Le joueur ne choisit que la DIRECTION : "A" (NESO : monde NE<->SO,
  // trait écran NO->SE) ou "B" (NOSE : monde NO<->SE, trait écran
  // NE->SO). La variante (lettre du PNG) est calculee automatiquement a
  // partir des murs presents dans les 8 cellules voisines : chaque coin du
  // losange de la cellule teste s'il est en contact avec un mur voisin.
  //
  // Convention des coins (cote MONDE, losange de la cellule centree en
  // (cx,cy), cote g = G.BUILD_GRID) :
  //   NO = (cx-g/2, cy-g/2)   coin haut    écran (haut,  centre-x)
  //   NE = (cx+g/2, cy-g/2)   coin droit   écran (droite, centre-y)
  //   SE = (cx+g/2, cy+g/2)   coin bas     écran (bas,   centre-x)
  //   SO = (cx-g/2, cy+g/2)   coin gauche  écran (gauche, centre-y)
  // ("supérieur/inférieur" = y monde ; "droit/gauche" = x monde.)
  //
  // Table des variantes (cote joueur) :
  //   A : aucun coin en contact            (mur droit, direction NESO)
  //   B : aucun coin en contact            (mur droit, direction NOSE)
  //   C : coins SE + NE en contact          (branchement cote droit)
  //   H : coins SE + SO + NE en contact      (T : bas + cote droit)
  //   K : coins NE + NO + SE en contact      (T : haut + cote droit)
  //   X : les 4 coins en contact            (croix)
  //   Z : coins SO + NO en contact          (branchement cote gauche, dir. B)
  // Toute autre combinaison retombe sur la direction de base (A ou B).
  G.WALL_VARIANTS = ["A", "B", "C", "H", "K", "X", "Z"];

  // Extremites monde d'une palissade, selon sa direction (A ou B).
  // A (NESO) joint les coins NE et SO de sa cellule.
  // B (NOSE) joint les coins NO et SE de sa cellule.
  G.wallEndpoints = function (m) {
    var g = G.BUILD_GRID;
    var cx = m.x + m.w / 2, cy = m.y + m.h / 2;
    if (m.dir === "B") {
      return [
        { x: cx - g / 2, y: cy - g / 2, corner: "NO" },
        { x: cx + g / 2, y: cy + g / 2, corner: "SE" }
      ];
    }
    return [
      { x: cx + g / 2, y: cy - g / 2, corner: "NE" },
      { x: cx - g / 2, y: cy + g / 2, corner: "SO" }
    ];
  };

  // Calcule la variante ("A".."Z") d'une palissade a partir des murs voisins.
  // Chaque coin du losange de la cellule de m est teste : il est "en contact"
  // si au moins un des DEUX extremites d'un mur voisin (built) coincide avec
  // ce coin a la tolerance eps pres. Ainsi, un mur pose dans une cellule
  // orthogonale ou diagonale qui aboutit sur le coin est detecte, quelle que
  // soit sa propre direction. Les murs du perimetre de ville (non `built`)
  // ne comptent pas comme contacts (ils sont traversables).
  //
  // Les palissades du PERIMETRE de ville sont alignees sur les bords de la
  // ville (pas sur la grille de construction) : leurs extremites sont decalees
  // d'une demi-cellule par rapport aux coins de grille. Pour eux, le contact
  // est teste sur l'AABB elargie du voisin (un coin de la cellule de m a
  // moins de eps d'un bord du voisin = contact) : deux segments consecutifs
  // du perimetre se touchent en bout et changent donc de variante.
  G.computeWallVariant = function (m, walls) {
    var list = walls || G.state.walls;
    var g = G.BUILD_GRID;
    var cx = m.x + m.w / 2, cy = m.y + m.h / 2;
    var c = { NE: false, NO: false, SE: false, SO: false };
    var eps = g * 0.2; // tolerance de contact : un cinquieme de cellule
    var corners = [
      { k: "NE", x: cx + g / 2, y: cy - g / 2 },
      { k: "NO", x: cx - g / 2, y: cy - g / 2 },
      { k: "SE", x: cx + g / 2, y: cy + g / 2 },
      { k: "SO", x: cx - g / 2, y: cy + g / 2 }
    ];
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === m || !o.built) continue;
      var ends = G.wallEndpoints(o);
      for (var e = 0; e < ends.length; e++) {
        var ex = ends[e].x, ey = ends[e].y;
        for (var k = 0; k < corners.length; k++) {
          var pt = corners[k];
          if (c[pt.k]) continue;
          var dx = ex - pt.x, dy = ey - pt.y;
          if (dx * dx + dy * dy <= eps * eps) c[pt.k] = true;
        }
      }
      // Contact par chevauchement d'AABB elargie (perimetre de ville) :
      // le coin de la cellule de m est a moins de eps du rectangle du voisin,
      // MAIS seulement si ce voisin est centre sur une cellule adjacente a
      // celle de m (les palissades posees par le joueur sont snappees sur la
      // grille ; un coin eloigne d'une cellule non voisine ne doit pas
      // declencher de contact, ex. coin NE d'une cellule 3 cellules plus loin
      // dont l'AABB touche ce coin).
      var ocx = o.x + o.w / 2, ocy = o.y + o.h / 2;
      if (Math.abs(ocx - cx) <= g + eps && Math.abs(ocy - cy) <= g + eps) {
        for (var k2 = 0; k2 < corners.length; k2++) {
          var pt2 = corners[k2];
          if (c[pt2.k]) continue;
          var nx = Math.max(o.x - pt2.x, 0, pt2.x - (o.x + o.w));
          var ny = Math.max(o.y - pt2.y, 0, pt2.y - (o.y + o.h));
          if (nx * nx + ny * ny <= eps * eps) c[pt2.k] = true;
        }
      }
    }
    // Resolution par table (les regles du joueur, cote monde) :
    if (c.SE && c.SO && c.NE && c.NO) return "X";
    if (c.SE && c.SO && c.NE) return "H";
    if (c.NE && c.NO && c.SE) return "K";
    if (c.SE && c.NE) return "C";
    if (c.SO && c.NO) return "Z";
    return m.dir === "B" ? "B" : "A";
  };

  // Recalcule la variante d'une palissade (apres pose ou destruction d'un
  // voisin) et la stocke sur l'objet (m.variant), serialisee dans les
  // snapshots : tous les clients voient le meme PNG.
  G.refreshWallVariant = function (m) {
    if (!m || !m.built) return;
    m.variant = G.computeWallVariant(m, G.state.walls);
  };
  // Recalcule les variantes de toutes les palissades (nouvelle carte, join).
  G.refreshAllWallVariants = function () {
    var walls = G.state.walls;
    for (var i = 0; i < walls.length; i++) G.refreshWallVariant(walls[i]);
  };

  // Pose une planche au point cliqué, SNAPPE sur la grille de construction
  // (G.BUILD_GRID, G.snapToGrid dans src/config.js) : le point est arrondi au
  // centre de la cellule la plus proche, la palissade occupe exactement sa
  // cellule en longueur (deux palissades adjacentes se touchent sans trou).
  // Les planches peuvent se superposer. En mode build le personnage est fige :
  // on peut poser n'importe ou sur la carte. Après la pose, si la palissade
  // chevauche le joueur, on le repousse juste à l'extérieur de la palissade
  // (bord le plus proche) pour éviter qu'il ne se retrouve bloqué dessus
  // à la fin de la grace period.
  G.tryBuildWall = function (wx, wy) {
    var state = G.state;
    var p = state.player;
    // Hors mode build : limite de portee autour du joueur. En mode build : pas de limite.
    if (!state.buildMode) {
      var dx = wx - p.x, dy = wy - p.y;
      if (Math.sqrt(dx * dx + dy * dy) > G.WALL_BUILD_RANGE) return;
    }
    if (state.planks < G.WALL_PLANKS) return;
    // Snap grille : toute palissade posee par le joueur est centree sur sa cellule.
    var s = G.snapToGrid ? G.snapToGrid(wx, wy) : [wx, wy];
    wx = s[0]; wy = s[1];
    var dims = G.plankDims();
    var w = dims.w, h = dims.h;
    var mx = wx - w / 2, my = wy - h / 2;
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (mx < b.x + b.w && mx + w > b.x && my < b.y + b.h && my + h > b.y) return;
    }
    // Villes PNG : pas de planche sur une cellule solide d'une ville decorative.
    if (G.aabbHitsVilles && G.aabbHitsVilles(mx, my, w, h)) return;
    state.planks -= G.WALL_PLANKS;
    // Grace period : la planche ne bloque pas le joueur pendant un court delai
    // apres sa pose, pour eviter qu'il se retrouve coince dessus.
    // dir : direction choisie par le joueur ("A" = NESO, "B" = NOSE) via
    // state.plankRotation ; la variante (PNG) est derivee des contacts.
    var dir = state.plankRotation ? "B" : "A";
    var wall = { x: mx, y: my, w: w, h: h, hp: G.WALL_MAX_HP, orient: w > h ? "h" : "v", dir: dir, built: true, noBlockUntil: state.time + G.WALL_GRACE };
    state.walls.push(wall);
    G.indexWall(wall);
    // Variantes : la nouvelle palissade et ses voisins changent de PNG.
    G.refreshWallVariant(wall);
    var near = G.wallsNear(mx - G.BUILD_GRID, my - G.BUILD_GRID, w + 2 * G.BUILD_GRID, h + 2 * G.BUILD_GRID);
    for (var ni = 0; ni < near.length; ni++) G.refreshWallVariant(near[ni]);
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
    var near = G.wallsNear(cx, cy, cw, ch);
    for (var i = 0; i < near.length; i++) {
      var m = near[i];
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
    var near = G.wallsNear(cx, cy, cw, ch);
    var now = G.state.time;
    for (var i = 0; i < near.length; i++) {
      var m = near[i];
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
    var g = G.BUILD_GRID;
    for (var wj = walls.length - 1; wj >= 0; wj--) {
      if (walls[wj].hp <= 0) {
        var dead = walls[wj];
        // Les voisins du mur detruit perdent un contact : variantes a jour.
        var near = G.wallsNear(dead.x - g, dead.y - g, dead.w + 2 * g, dead.h + 2 * g);
        G.unindexWall(dead);
        walls.splice(wj, 1);
        for (var ni = 0; ni < near.length; ni++) G.refreshWallVariant(near[ni]);
      }
    }
  };
})();

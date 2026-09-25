// Flow field des zombies : champ de fleches unique vers la ville.
// Un seul BFS multi-sources (perimetre de la ville) calcule la distance de
// chaque cellule ; chaque cellule precalcule la fleche (vecteur unitaire)
// vers la cellule voisine de distance minimale. Tous les zombies consultent
// la fleche de leur cellule : cout O(1) par zombie, meme pour 5000.
// Recalcule uniquement quand le monde change (rebuildBuildingGrid : foret
// coupee/repoussee, batiment construit/detruit).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Taille d'une cellule du champ (px). 32 px : ~313x313 cellules pour
  // une carte 10000 px, soit ~98k cellules — un BFS reste < 2 ms.
  G.NAV_CELL = 32;
  G.navGrid = null;      // Int32Array dist BFS (-1 = hors champ/poche)
  G.navDirX = null;      // Float32Array composante X de la fleche par cellule
  G.navDirY = null;      // Float32Array composante Y de la fleche par cellule
  G.navCols = 0;
  G.navRows = 0;

  // Recalcule tout le champ : distances BFS puis fleches. Appele par
  // rebuildBuildingGrid (world.js) et apres ensureForetConnectivity.
  G.rebuildNavGrid = function () {
    var cell = G.NAV_CELL;
    var cols = Math.ceil(G.WORLD / cell), rows = Math.ceil(G.WORLD / cell);
    G.navCols = cols; G.navRows = rows;
    var n = cols * rows;
    var blocked = new Uint8Array(n);
    var blds = G.state.buildings;
    // Marge de securite : une cellule est bloquee seulement si l'AABB d'une
    // foret empiete reellement dedans (cellule retrainee de 8 px, l'ordre de
    // grandeur du rayon du chef de groupe). Une cellule que la foret ne fait
    // que toucher en bordure reste franchissable : les couloirs etroits
    // physiquement praticables restent ouverts au champ.
    var margin = 8;
    for (var i = 0; i < blds.length; i++) {
      var b = blds[i];
      if (!b.isForet) continue;
      if (G.foretDepleted(b)) continue;
      var minCx = Math.floor((b.x + margin) / cell), maxCx = Math.floor((b.x + b.w - margin) / cell);
      var minCy = Math.floor((b.y + margin) / cell), maxCy = Math.floor((b.y + b.h - margin) / cell);
      for (var cx = minCx; cx <= maxCx; cx++) {
        for (var cy = minCy; cy <= maxCy; cy++) {
          if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) blocked[cy * cols + cx] = 1;
        }
      }
    }
    // BFS multi-sources depuis le perimetre de la ville (juste au-dela des
    // murs) : toute cellule libre atteignable porte sa distance au but.
    var dist = new Int32Array(n);
    for (var d = 0; d < n; d++) dist[d] = -1;
    var queue = new Int32Array(n);
    var qHead = 0, qTail = 0;
    function seed(cx, cy) {
      if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return;
      var k = cy * cols + cx;
      if (blocked[k] || dist[k] !== -1) return;
      dist[k] = 0; queue[qTail++] = k;
    }
    var pad = 2;
    var tMin = Math.floor((G.TOWN_MIN - 80) / cell), tMax = Math.floor((G.TOWN_MAX + 80) / cell);
    for (var tcx = tMin; tcx <= tMax; tcx++) {
      seed(tcx, tMin + pad); seed(tcx, tMax - pad);
    }
    for (var tcy = tMin; tcy <= tMax; tcy++) {
      seed(tMin + pad, tcy); seed(tMax - pad, tcy);
    }
    while (qHead < qTail) {
      var k2 = queue[qHead++];
      var cx2 = k2 % cols, cy2 = (k2 - cx2) / cols;
      var nd = dist[k2] + 1;
      if (cx2 > 0 && !blocked[k2 - 1] && dist[k2 - 1] === -1) { dist[k2 - 1] = nd; queue[qTail++] = k2 - 1; }
      if (cx2 < cols - 1 && !blocked[k2 + 1] && dist[k2 + 1] === -1) { dist[k2 + 1] = nd; queue[qTail++] = k2 + 1; }
      if (cy2 > 0 && !blocked[k2 - cols] && dist[k2 - cols] === -1) { dist[k2 - cols] = nd; queue[qTail++] = k2 - cols; }
      if (cy2 < rows - 1 && !blocked[k2 + cols] && dist[k2 + cols] === -1) { dist[k2 + cols] = nd; queue[qTail++] = k2 + cols; }
    }
    G.navGrid = dist;
    // Fleches : pour chaque cellule atteignable non but, la fleche pointe
    // vers le voisin 8-connexe de distance minimale (meilleur choix par
    // distance, diagionale permise des qu'elle existe). Les cellules but
    // (dist 0) et hors champ gardent la fleche nulle.
    var dirX = new Float32Array(n);
    var dirY = new Float32Array(n);
    for (var cy3 = 0; cy3 < rows; cy3++) {
      for (var cx3 = 0; cx3 < cols; cx3++) {
        var k3 = cy3 * cols + cx3;
        if (dist[k3] <= 0) continue;
        var bestD = dist[k3], bestK = -1;
        for (var ox = -1; ox <= 1; ox++) {
          for (var oy = -1; oy <= 1; oy++) {
            if (ox === 0 && oy === 0) continue;
            var nx = cx3 + ox, ny = cy3 + oy;
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
            var ndn = dist[ny * cols + nx];
            if (ndn === -1) continue;
            if (ndn < bestD) { bestD = ndn; bestK = ny * cols + nx; }
          }
        }
        if (bestK !== -1) {
          var bx = bestK % cols, by = (bestK - bx) / cols;
          var vx = (bx + 0.5) * cell - ((cx3 + 0.5) * cell);
          var vy = (by + 0.5) * cell - ((cy3 + 0.5) * cell);
          var len = Math.sqrt(vx * vx + vy * vy) || 1;
          dirX[k3] = vx / len; dirY[k3] = vy / len;
        }
      }
    }
    G.navDirX = dirX;
    G.navDirY = dirY;
  };

  // Fleche de la cellule contenant (x, y) : point cible a 32 px dans le
  // sens de la fleche (x, y), distance BFS de la cellule (dist) ou null.
  // O(1) par appel : aucune recherche de voisin a l'appel (contrairement a
  // l'ancien navStep qui rescannait ses 8 voisins a chaque tick par zombie).
  G.navStep = function (x, y) {
    var grid = G.navGrid;
    if (!grid) return null;
    var cell = G.NAV_CELL;
    var cols = G.navCols, rows = G.navRows;
    var cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return null;
    var k = cy * cols + cx;
    var here = grid[k];
    if (here <= 0) return null;
    var dx = G.navDirX[k], dy = G.navDirY[k];
    if (dx === 0 && dy === 0) return null;
    return { x: x + dx * 32, y: y + dy * 32, dist: here, arrowX: dx, arrowY: dy };
  };

  // Garantit qu'aucune "poche fermee" de forets n'existe : une poche est un
  // ensemble de cellules libres inatteignables depuis la ville (le champ BFS
  // les marque -1). Un zombie (ou groupe) qui y spawne resterait prisonnier
  // a vie, incapable d'atteindre la palissade ou la mairie. Solution :
  // retirer iterativement la foret solide la plus proche du centre de chaque
  // poche jusqu'a ce que tout l'espace libre soit connecte a la ville (borne
  // pour garantir la terminaison). Appele apres la generation du monde et
  // apres une repousse de foret (qui peut refermer un passage).
  G.ensureForetConnectivity = function () {
    var cell = G.NAV_CELL;
    var blds = G.state.buildings;
    for (var iter = 0; iter < 40; iter++) {
      if (!G.navGrid) break;
      var cols = G.navCols, rows = G.navRows;
      var pocket = -1;
      for (var k = 0; k < G.navGrid.length; k++) {
        if (G.navGrid[k] === -1) { pocket = k; break; }
      }
      if (pocket === -1) return;
      var px = ((pocket % cols) + 0.5) * cell;
      var py = (Math.floor(pocket / cols) + 0.5) * cell;
      var bestI = -1, bestD = Infinity;
      for (var i = 0; i < blds.length; i++) {
        var b = blds[i];
        if (!b.isForet || G.foretDepleted(b)) continue;
        var dx = b.x + b.w / 2 - px, dy = b.y + b.h / 2 - py;
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; bestI = i; }
      }
      if (bestI === -1) return;
      blds.splice(bestI, 1);
      G.rebuildBuildingGrid();
    }
  };

  // Cap de base du chef vers la ville selon le champ : angle de la fleche
  // de la cellule courante, ou null si hors champ.
  G.navAngle = function (x, y) {
    var grid = G.navGrid;
    if (!grid) return null;
    var cell = G.NAV_CELL;
    var cols = G.navCols, rows = G.navRows;
    var cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return null;
    var k = cy * cols + cx;
    if (grid[k] <= 0) return null;
    var dx = G.navDirX[k], dy = G.navDirY[k];
    if (dx === 0 && dy === 0) return null;
    return Math.atan2(dy, dx);
  };
})();

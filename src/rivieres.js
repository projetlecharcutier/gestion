// Rivières et chemins : réseau lissé (Catmull-Rom échantillonné) généré une
// fois à la création du monde. Les chemins (#FFFABC) relient la ville
// principale, les villes PNG et les amas de maisons de la nature ; les
// rivières (#4093E4) serpentent entre les villes et sous les chemins, avec un
// petit pont gris aux croisements. Les rivières ne bloquent pas le joueur ;
// les chemins accélèrent le déplacement (PATH_SPEED_BONUS).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  // Couleurs du réseau (identiques aux taches jaunes sous les bâtiments).
  G.CHEMIN_COLOR = "#FFFABC";
  G.CHEMIN_HALO = "#E8D99A";
  G.RIVIERE_COLOR = "#4093E4";
  G.PONT_COLOR = "#9CA3AF";
  // Largeur des tracés : fins (max ~1/4 de la ville principale, TOWN = 1000).
  G.CHEMIN_W = 48;
  G.RIVIERE_W = 56;
  // Accélération du joueur sur un chemin.
  G.PATH_SPEED_BONUS = 1.35;

  // Hash entier déterministe (même style que speckRand, render.js) : le
  // réseau est identique entre frames, parties et client/serveur.
  function rhash(a, b, n) {
    var h = (a * 374761393 + b * 668265263 + n * 2246822519) | 0;
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177) | 0;
    h = (h ^ (h >>> 16)) | 0;
    return (h >>> 0) / 4294967296;
  }

  // Catmull-Rom : échantillonne un tronçon entre pts[i+1] et pts[i+2] en
  // `steps` points. Retourne un tableau de {x, y} (sans le point de départ).
  function catmullSeg(p0, p1, p2, p3, steps) {
    var out = [];
    for (var s = 1; s <= steps; s++) {
      var t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
                  (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                  (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
                  (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                  (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
      });
    }
    return out;
  }

  // Échantillonne toute la polyline en une courbe douce (points de contrôle
  // dupliqués aux extrémités). Sortie : liste dense de points par lesquels la
  // courbe passe exactement, tangente continue — aucun angle visible.
  // Retire les points quasi confondus (< 0.5 px) : segments de longueur
  // nulle -> angles indefinis (atan2) et artefacts de demi-tour.
  function dedup(pts) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - out[out.length - 1].x;
      var dy = pts[i].y - out[out.length - 1].y;
      if (dx * dx + dy * dy > 0.25) out.push(pts[i]);
    }
    return out;
  }

  function catmullRom(points, stepsPerSeg) {
    if (points.length < 2) return points.slice();
    var pts = points;
    var out = [{ x: pts[0].x, y: pts[0].y }];
    pts = dedup(pts);
    var n = pts.length;
    for (var i = 0; i < n - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)];
      var p1 = pts[i], p2 = pts[i + 1];
      var p3 = pts[Math.min(n - 1, i + 2)];
      var seg = catmullSeg(p0, p1, p2, p3, stepsPerSeg);
      for (var s = 0; s < seg.length; s++) out.push(seg[s]);
    }
    return out;
  }
  G.catmullRom = catmullRom;

  // Points intermédiaires d'un chemin entre deux villes : un point de dérive
  // aléatoire (déterministe par paire) au milieu, pour un tracé qui ondule
  // doucement sans jamais couper un angle.
  function waypointsBetween(ax, ay, bx, by, seed) {
    var mx = (ax + bx) / 2, my = (ay + by) / 2;
    var dx = bx - ax, dy = by - ay;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Perpendiculaire normalisée.
    var px = -dy / len, py = dx / len;
    // Dérive latérale aléatoire : +-28% de la longueur.
    var k = (rhash(ax | 0, by | 0, seed) - 0.5) * 0.56 * len;
    // Deux points intermédiaires pour plus d'ondulation.
    var t1 = 0.3 + rhash(bx | 0, ay | 0, seed + 11) * 0.12;
    var t2 = 0.58 + rhash(ax | 0, ay | 0, seed + 23) * 0.12;
    var k1 = k * (0.6 + rhash(ax | 0, ax | 0, seed + 31) * 0.8);
    var k2 = k * (0.6 + rhash(by | 0, by | 0, seed + 43) * 0.8);
    return [
      { x: ax, y: ay },
      { x: ax + dx * t1 + px * k1, y: ay + dy * t1 + py * k1 },
      { x: mx + px * k, y: my + py * k },
      { x: ax + dx * t2 + px * k2, y: ay + dy * t2 + py * k2 },
      { x: bx, y: by }
    ];
  }

  // Écart minimal (px) entre un point et une polyline de points.
  function distToPolyline(x, y, pts) {
    var best = Infinity;
    for (var i = 0; i < pts.length - 1; i++) {
      var ax = pts[i].x, ay = pts[i].y, bx = pts[i + 1].x, by = pts[i + 1].y;
      var dx = bx - ax, dy = by - ay;
      var l2 = dx * dx + dy * dy;
      var t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
      if (t < 0) t = 0; if (t > 1) t = 1;
      var qx = ax + dx * t - x, qy = ay + dy * t - y;
      var d = qx * qx + qy * qy;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  // Grille spatiale des points échantillonnés des chemins, pour un test
  // "le joueur est-il sur un chemin ?" en O(1) par frame.
  var PATH_CELL = 128;
  var pathGrid = null;

  function gridAdd(grid, p) {
    var k = Math.floor(p.x / PATH_CELL) + "," + Math.floor(p.y / PATH_CELL);
    if (!grid[k]) grid[k] = [];
    grid[k].push(p);
  }

  // Construit les index de requête depuis les polylines échantillonnées.
  function indexNetwork() {
    pathGrid = {};
    var chemins = (G.state && G.state.chemins) || [];
    for (var c = 0; c < chemins.length; c++) {
      var pts = chemins[c].pts;
      for (var i = 0; i < pts.length; i++) gridAdd(pathGrid, pts[i]);
    }
  }

  // Le point (x, y) est-il sur un chemin ? (tolérance = largeur/2 + marge
  // joueur). Requête sur les 9 cellules autour du point.
  G.onChemin = function (x, y) {
    if (!pathGrid) return false;
    var cx = Math.floor(x / PATH_CELL), cy = Math.floor(y / PATH_CELL);
    var tol = G.CHEMIN_W / 2 + G.PLAYER_W;
    for (var gx = cx - 1; gx <= cx + 1; gx++) {
      for (var gy = cy - 1; gy <= cy + 1; gy++) {
        var cell = pathGrid[gx + "," + gy];
        if (!cell) continue;
        for (var i = 0; i < cell.length; i++) {
          var dx = cell[i].x - x, dy = cell[i].y - y;
          if (dx * dx + dy * dy <= tol * tol) return true;
        }
      }
    }
    return false;
  };

  // Vitesse effective du joueur : bonus sur un chemin.
  G.playerSpeed = function () {
    var p = G.state && G.state.player;
    if (p && G.onChemin(p.x, p.y)) return G.SPEED * G.PATH_SPEED_BONUS;
    return G.SPEED;
  };

  // Centre d'un bâtiment (les entrées de la liste sont des boîtes x/y/w/h).
  function centerOf(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }

  // Le segment de boîte (bx, by, bw, bh) intersecte-t-il une polyline ?
  function segHitsBox(pts, bx, by, bw, bh) {
    for (var i = 0; i < pts.length - 1; i++) {
      var x0 = pts[i].x, y0 = pts[i].y, x1 = pts[i + 1].x, y1 = pts[i + 1].y;
      var sx0 = Math.min(x0, x1), sx1 = Math.max(x0, x1);
      var sy0 = Math.min(y0, y1), sy1 = Math.max(y0, y1);
      if (sx1 < bx || sx0 > bx + bw || sy1 < by || sy0 > by + bh) continue;
      // Échantillon dense (6 px) : les segments sont courts.
      var len = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
      var steps = Math.max(1, Math.ceil(len / 6));
      for (var s = 0; s <= steps; s++) {
        var t = s / steps;
        var px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
        if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) return true;
      }
    }
    return false;
  }

  // La polyline traverse-t-elle une forêt (isForet) ou une palissade (walls) ?
  // Nombre d'obstacles (forêts + palissades) touchés par le tracé, pour
  // choisir le MEILLEUR essai quand aucun n'est parfaitement libre (couloirs
  // de forêts plus étroits que 2x pad : un tracé 100% libre est impossible).
  function countBlocked(pts, pad) {
    var state = G.state;
    var n = 0;
    var bl = state.buildings || [];
    for (var b = 0; b < bl.length; b++) {
      var bb = bl[b];
      if (!bb.isForet) continue;
      if (segHitsBox(pts, bb.x - pad, bb.y - pad, bb.w + 2 * pad, bb.h + 2 * pad)) n++;
    }
    var wl = state.walls || [];
    for (var w = 0; w < wl.length; w++) {
      var ww = wl[w];
      if (segHitsBox(pts, ww.x - pad, ww.y - pad, ww.w + 2 * pad, ww.h + 2 * pad)) n++;
    }
    return n;
  }

  function blockedByForetOrWall(pts, pad) {
    var state = G.state;
    var xs = Infinity, ys = Infinity, xe = -Infinity, ye = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i].x < xs) xs = pts[i].x;
      if (pts[i].x > xe) xe = pts[i].x;
      if (pts[i].y < ys) ys = pts[i].y;
      if (pts[i].y > ye) ye = pts[i].y;
    }
    var bl = state.buildings || [];
    for (var b = 0; b < bl.length; b++) {
      var bb = bl[b];
      if (!bb.isForet) continue;
      if (bb.x > xe + pad || bb.x + bb.w < xs - pad) continue;
      if (bb.y > ye + pad || bb.y + bb.h < ys - pad) continue;
      if (segHitsBox(pts, bb.x - pad, bb.y - pad, bb.w + 2 * pad, bb.h + 2 * pad)) return true;
    }
    var wl = state.walls || [];
    for (var w = 0; w < wl.length; w++) {
      var ww = wl[w];
      if (ww.x > xe + pad || ww.x + ww.w < xs - pad) continue;
      if (ww.y > ye + pad || ww.y + ww.h < ys - pad) continue;
      if (segHitsBox(pts, ww.x - pad, ww.y - pad, ww.w + 2 * pad, ww.h + 2 * pad)) return true;
    }
    return false;
  }

  // Trouve l'obstacle (forêt / palissade) le plus proche d'un point sur le
  // segment [p -> but], à moins de `look` px devant. Retourne l'obstacle
  // (boite x/y/w/h) ou rien si libre.
  function obstacleAhead(px, py, dirX, dirY, look, pad) {
    var state = G.state;
    var probeX = px + dirX * look, probeY = py + dirY * look;
    var bs = state.buildings || [];
    var best = null, bestD = Infinity;
    function consider(x, y, w, h) {
      var cx = x + w / 2, cy = y + h / 2;
      if (probeX >= x - pad && probeX <= x + w + pad &&
          probeY >= y - pad && probeY <= y + h + pad) {
        var d = (cx - px) * (cx - px) + (cy - py) * (cy - py);
        if (d < bestD) { bestD = d; best = { x: x, y: y, w: w, h: h }; }
      }
    }
    for (var b = 0; b < bs.length; b++) {
      var bb = bs[b];
      if (!bb.isForet) continue;
      consider(bb.x, bb.y, bb.w, bb.h);
    }
    var wl = state.walls || [];
    for (var w = 0; w < wl.length; w++) consider(wl[w].x, wl[w].y, wl[w].w, wl[w].h);
    return best;
  }

  // Liste tous les obstacles durs du monde (forêts non épuisées,
  // palissades) sous forme de boîtes gonflées du pad. Cache pour la durée
  // d'une génération : le même pad est réutilisé par beaucoup de tracés.
  var _obstCache = null, _obstPad = -1;
  function obstacleBoxes(pad) {
    if (_obstCache && _obstPad === pad) return _obstCache;
    var state = G.state;
    var out = [];
    var bs = state.buildings || [];
    for (var b = 0; b < bs.length; b++) {
      var bb = bs[b];
      // Tous les bâtiments solides : forêts ET maisons/bâtiments de ville.
      // Une forêt épuisée (s4) reste écartée : le chemin ne doit pas
      // se déplacer quand une forêt est coupée en cours de partie.
      if (bb.isTorche) continue;
      out.push({ x: bb.x - pad, y: bb.y - pad, w: bb.w + 2 * pad, h: bb.h + 2 * pad });
    }
    var wl = state.walls || [];
    var wallBoxes = [];
    for (var w = 0; w < wl.length; w++) {
      var ww = wl[w];
      wallBoxes.push({ x: ww.x, y: ww.y, w: ww.w, h: ww.h });
    }
    // Fusion des boites de mur QUI SE TOUCHENT (partagent un bord) en
    // strips longs : sans cela, le routeur saute de coin en coin chaque
    // segment de 40 px du perimetre (zigzag en epingle). Les boites de part
    // et d'autre du trou (gap 40 px) NE se touchent PAS : le trou survit.
    var merged = true;
    while (merged) {
      merged = false;
      for (var i = 0; i < wallBoxes.length && !merged; i++) {
        for (var j = i + 1; j < wallBoxes.length && !merged; j++) {
          var A = wallBoxes[i], B = wallBoxes[j];
          var touchX = A.x <= B.x + B.w + 0.5 && B.x <= A.x + A.w + 0.5;
          var touchY = A.y <= B.y + B.h + 0.5 && B.y <= A.y + A.h + 0.5;
          var sameRow = Math.abs(A.y - B.y) < 0.5 && Math.abs(A.h - B.h) < 0.5;
          var sameCol = Math.abs(A.x - B.x) < 0.5 && Math.abs(A.w - B.w) < 0.5;
          if ((sameRow && touchX) || (sameCol && touchY)) {
            var nx = Math.min(A.x, B.x), ny = Math.min(A.y, B.y);
            var nx2 = Math.max(A.x + A.w, B.x + B.w), ny2 = Math.max(A.y + A.h, B.y + B.h);
            wallBoxes.splice(j, 1);
            wallBoxes[i] = { x: nx, y: ny, w: nx2 - nx, h: ny2 - ny };
            merged = true;
          }
        }
      }
    }
    for (var w2 = 0; w2 < wallBoxes.length; w2++) {
      var mb = wallBoxes[w2];
      out.push({ x: mb.x - pad, y: mb.y - pad, w: mb.w + 2 * pad, h: mb.h + 2 * pad });
    }
    _obstCache = out; _obstPad = pad;
    return out;
  }

  // La boîte touche-t-elle le segment [p, q] ? (test échantillonné tous
  // les 20 px, assez fin vu la taille des obstacles.)
  function boxHitsSeg(box, px, py, qx, qy) {
    var dx = qx - px, dy = qy - py;
    var len = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(1, Math.ceil(len / 20));
    for (var s = 0; s <= steps; s++) {
      var t = s / steps;
      var x = px + dx * t, y = py + dy * t;
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return true;
    }
    return false;
  }

  // Premier obstacle touché par le segment [p, q] (le plus proche de p),
  // ou rien si le segment est libre.
  function firstObstacleOnSeg(boxes, px, py, qx, qy) {
    var best = null, bestT = Infinity;
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      if (!boxHitsSeg(box, px, py, qx, qy)) continue;
      // Paramètre t approx d'entrée dans la boîte (par échantillonnage).
      var dx = qx - px, dy = qy - py;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var steps = Math.max(1, Math.ceil(len / 20));
      for (var s = 0; s <= steps; s++) {
        var t = s / steps;
        var x = px + dx * t, y = py + dy * t;
        if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
          if (t < bestT) { bestT = t; best = box; }
          break;
        }
      }
    }
    return best;
  }

  // Détour par les coins : pour contourner une boîte entre A et B, on
  // choisit les deux coins (parmi les 4) qui forment le chemin le plus
  // court A -> coin1 -> coin2 -> B sans recouper la boîte. Les obstacles
  // successifs sont traités un à un jusqu'à ligne libre.
  // Segments [p, q] et [r, s] se croisent-ils ? (exclusion stricte des
  // extremites) — sert au routeur par visibilite.
  function segsCross(px, py, qx, qy, rx, ry, sx, sy) {
    function d(a, b, c) { return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]); }
    var A = [px, py], B = [qx, qy], C = [rx, ry], D = [sx, sy];
    return d(A, B, C) !== d(A, B, D) && d(C, D, A) !== d(C, D, B);
  }

  // Le segment [p, q] passe-t-il a travers une boîte (interieur strict) ?
  function segThroughBoxes(boxes, px, py, qx, qy) {
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      var bx0 = b.x, by0 = b.y, bx1 = b.x + b.w, by1 = b.y + b.h;
      // Rejet rapide par bounding boxes.
      if (Math.max(px, qx) < bx0 || Math.min(px, qx) > bx1) continue;
      if (Math.max(py, qy) < by0 || Math.min(py, qy) > by1) continue;
      // Croisement avec les 4 cotes.
      if (segsCross(px, py, qx, qy, bx0, by0, bx1, by0) ||
          segsCross(px, py, qx, qy, bx1, by0, bx1, by1) ||
          segsCross(px, py, qx, qy, bx1, by1, bx0, by1) ||
          segsCross(px, py, qx, qy, bx0, by1, bx0, by0)) return true;
      // Segment entierement a l'interieur.
      if (px > bx0 && px < bx1 && py > by0 && py < by1) return true;
      if (qx > bx0 && qx < bx1 && qy > by0 && qy < by1) return true;
    }
    return false;
  }

  // String-pulling : apres le routage glouton, retire tout point
  // intermediaire devenu inutile (le segment [i-1, i+1] est libre). Un
  // zigzag de coins devient la polyline minimale, sans epingle.
  function pullTaut(pts, boxes) {
    var out = pts.slice(0);
    var changed = true;
    while (changed && out.length > 2) {
      changed = false;
      for (var i = 1; i < out.length - 1; i++) {
        if (!segThroughBoxes(boxes, out[i - 1].x, out[i - 1].y, out[i + 1].x, out[i + 1].y)) {
          out.splice(i, 1);
          changed = true;
        }
      }
    }
    return out;
  }

  // Lissage local des angles vifs residuels : un sommet interieur dont la
  // deviation depasse `lim` (radians) est remplace par la moyenne de ses
  // voisins, jusqu'a convergence. Les extremites (n oeuds) restent fixes.
  function smoothKinks(pts, lim) {
    var out = pts.slice(0);
    for (var pass = 0; pass < 24; pass++) {
      var worst = 0, worstI = -1;
      for (var i = 1; i < out.length - 1; i++) {
        var a1 = Math.atan2(out[i].y - out[i - 1].y, out[i].x - out[i - 1].x);
        var a2 = Math.atan2(out[i + 1].y - out[i].y, out[i + 1].x - out[i].x);
        var d = Math.abs(a2 - a1);
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (d > worst) { worst = d; worstI = i; }
      }
      if (worst <= lim) break;
      var m = out[worstI];
      out[worstI] = { x: (out[worstI - 1].x + out[worstI + 1].x) / 2,
                     y: (out[worstI - 1].y + out[worstI + 1].y) / 2 };
      // Un point quasi confondu avec un voisin cree une deviation trompeuse.
      if (Math.abs(out[worstI].x - m.x) + Math.abs(out[worstI].y - m.y) < 0.01) break;
    }
    return out;
  }

  // Boites bloquant le segment [p, q] (liste, pas juste booleen) : sert au
  // routeur pour ne considerer que les coins des obstacles REELLEMENT sur
  // le trajet (sinon O(nb boites^2) appels de segThroughBoxes).
  function boxesOnSeg(boxes, px, py, qx, qy) {
    var out = [];
    for (var i = 0; i < boxes.length; i++) {
      if (segThroughBoxes([boxes[i]], px, py, qx, qy)) out.push(boxes[i]);
    }
    return out;
  }

  // Routeur par visibilite (glouton, best-first simple) : depuis la
  // position courante, rejoindre le BUT s'il est visible ; sinon sauter au
  // coin d'obstacle visible qui rapproche le plus du but (distance
  // coin -> but + penalite). Les coins deja visites sont exclus.
  // Converge toujours (chaque saut reduit l'ensemble des candidats).
  function routeAround(ax, ay, bx, by, pad) {
    var all = obstacleBoxes(pad);
    // Les nœuds (mairie, centres de villes, amas de maisons) sont POSÉS
    // au milieu d'obstacles gonflés (les maisons du cluster, pad 40) : un
    // segment partant du nœud traverse toujours la boîte qui le contient
    // et aucun coin n'est visible. On retire les boîtes CONTENANT le
    // départ ou le but : le chemin y entre/sort par l'ouverture la plus
    // proche, le garde-fou final (countBlocked) juge le résultat réel.
    var boxes = [];
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      var hasA = ax > b.x && ax < b.x + b.w && ay > b.y && ay < b.y + b.h;
      var hasB = bx > b.x && bx < b.x + b.w && by > b.y && by < b.y + b.h;
      if (!hasA && !hasB) boxes.push(b);
    }
    var pts = [{ x: ax, y: ay }];
    var cx = ax, cy = ay;
    var visited = {};
    var guard = 0;
    while (guard++ < 48) {
      if (!segThroughBoxes(boxes, cx, cy, bx, by)) break;
      // Coins candidats : uniquement des obstacles qui coupent la ligne
      // directe courante -> but (les autres sont inutiles et coutent cher).
      var cands = [];
      var blockers = boxesOnSeg(boxes, cx, cy, bx, by);
      // Corridor autour du segment direct : les detours en chaine peuvent
      // avoir besoin d'un coin hors de la ligne directe, mais TOUJOURS dans
      // son voisinage (les obstacles presents ailleurs ne servent a rien).
      var mx = Math.min(cx, bx) - 250, Mx = Math.max(cx, bx) + 250;
      var my = Math.min(cy, by) - 250, My = Math.max(cy, by) + 250;
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        var near = b.x < Mx && b.x + b.w > mx && b.y < My && b.y + b.h > my;
        if (!near && blockers.indexOf(b) < 0) continue;
        var corners = [
          [b.x - 4, b.y - 4], [b.x + b.w + 4, b.y - 4],
          [b.x + b.w + 4, b.y + b.h + 4], [b.x - 4, b.y + b.h + 4]
        ];
        for (var c = 0; c < 4; c++) {
          var kx = corners[c][0], ky = corners[c][1];
          if (kx < 20 || ky < 20 || kx > G.WORLD - 20 || ky > G.WORLD - 20) continue;
          var key = Math.round(kx) + "," + Math.round(ky);
          if (visited[key]) continue;
          // Le coin doit etre visible depuis la position courante.
          if (segThroughBoxes(boxes, cx, cy, kx, ky)) continue;
          var dToBut = Math.sqrt((bx - kx) * (bx - kx) + (by - ky) * (by - ky));
          // Penalise un coin qui fait revenir EN ARRIERE par rapport a la
          // direction globale depart -> but : sans cela, deux coins de part
          // et d'autre d'un couloir creent une epingle a cheveux.
          var gdx = bx - ax, gdy = by - ay;
          var gl = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
          var dot = ((kx - cx) * gdx + (ky - cy) * gdy) / gl;
          var pen = dot < 0 ? -dot * 3 : 0;
          cands.push({ x: kx, y: ky, d: dToBut + pen, key: key });
        }
      }
      if (!cands.length) break;
      cands.sort(function (a2, b2) { return a2.d - b2.d; });
      var next = cands[0];
      // Ne rajoute pas un point quasi identique au precedent (coins de
      // boites voisines) : le tracé ferait demi-tour sur place.
      var lastP = pts[pts.length - 1];
      var ddx = next.x - lastP.x, ddy = next.y - lastP.y;
      if (ddx * ddx + ddy * ddy < 9) { visited[next.key] = 1; continue; }
      pts.push({ x: next.x, y: next.y });
      visited[next.key] = 1;
      cx = next.x; cy = next.y;
    }
    pts.push({ x: bx, y: by });
    return pullTaut(pts, boxes);
  }

  // Lissage Chaikin : chaque coin est remplacé par deux points au quart
  // et aux trois quarts du segment — la déviation angulaire est (presque)
  // divisée par deux à chaque itération. Appliqué 3 fois avant le Catmull-
  // Rom, un contournement à angle droit devient une suite d'arcs doux.
  function chaikin(pts, iter) {
    var cur = pts;
    for (var it = 0; it < iter; it++) {
      if (cur.length < 3) break;
      var out = [cur[0]];
      for (var i = 0; i < cur.length - 1; i++) {
        var p = cur[i], q = cur[i + 1];
        out.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 });
        out.push({ x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 });
      }
      out.push(cur[cur.length - 1]);
      cur = out;
    }
    return cur;
  }

  // Génère le réseau. Appelé par buildWorld APRÈS la pose des forêts/murs
  // (les tracés évitent les obstacles déjà en place). Déterministe : le
  // serveur et le client solo génèrent le même réseau à partir de la même
  // carte ; en mode réseau, le réseau est envoyé dans msg.map.
  G.buildRivieres = function () {
    var state = G.state;
    var c = G.WORLD / 2;
    // Nœuds : mairie (centre), villes PNG, amas de maisons (isDecor hors
    // ville principale), poteaux de torche (repères de villages).
    var nodes = [];
    // Nœud mairie : on ancre sur l'ENTREE nord de la ville (le seul trou
    // de la palissade) pour que tout chemin sortant de la ville passe par
    // l'ouverture au lieu de traverser les palissades.
    var gapX = G.TOWN_MIN + G.TOWN / 2;
    nodes.push({ x: c, y: c, key: "mairie" });
    nodes.push({ x: gapX, y: G.TOWN_MIN - 90, key: "porte" });
    var villes = state.villes || [];
    for (var v = 0; v < villes.length; v++) {
      nodes.push({ x: villes[v].x + villes[v].w / 2, y: villes[v].y + villes[v].h / 2, key: "ville" + v });
    }
    var bl = state.buildings || [];
    var clusters = [];
    for (var b = 0; b < bl.length; b++) {
      var bb = bl[b];
      // Maisons décoratives hors de la ville principale : regroupées en
      // amas par proximité (60 px) pour ne poser qu'un nœud par groupe.
      if (!bb.houseSpriteName) continue;
      var ctr = centerOf(bb);
      if (G.inTown(ctr.x, ctr.y)) continue;
      var merged = false;
      for (var cl = 0; cl < clusters.length; cl++) {
        var dx = clusters[cl].x - ctr.x, dy = clusters[cl].y - ctr.y;
        if (dx * dx + dy * dy < 220 * 220) {
          clusters[cl].x = (clusters[cl].x + ctr.x) / 2;
          clusters[cl].y = (clusters[cl].y + ctr.y) / 2;
          merged = true; break;
        }
      }
      if (!merged) clusters.push({ x: ctr.x, y: ctr.y });
    }
    for (var k = 0; k < clusters.length; k++) nodes.push({ x: clusters[k].x, y: clusters[k].y, key: "clus" + k });

    // --- Chemins : arbre couvrant (Prim) sur les nœuds, tracés lissés. ---
    var chemins = [];
    // Liaison mairie -> porte : segment DIRECT vertical par l'ouverture de
    // la palissade (gapX). routeAround ne peut pas passer un trou de 40 px
    // avec le pad standard : ce segment traverse le mur par son ouverture
    // voulue, aucun detour n'est necessaire.
    chemins.push({ pts: catmullRom(chaikin([
      { x: c, y: c }, { x: gapX, y: G.TOWN_MIN - 90 }
    ], 3), 12), a: 0, b: 1 });
    // Prim part de la PORTE : toutes les liaisons sortantes (villes,
    // amas de maisons) partent de l'ouverture, jamais à travers la palissade.
    var inTree = [1];
    var connected = [];
    connected[0] = true; connected[1] = true;
    while (inTree.length < nodes.length) {
      var bestI = -1, bestJ = -1, bestD = Infinity;
      for (var ti = 0; ti < inTree.length; ti++) {
        for (var j = 0; j < nodes.length; j++) {
          if (connected[j]) continue;
          var ddx = nodes[inTree[ti]].x - nodes[j].x;
          var ddy = nodes[inTree[ti]].y - nodes[j].y;
          var dd = ddx * ddx + ddy * ddy;
          if (dd < bestD) { bestD = dd; bestI = inTree[ti]; bestJ = j; }
        }
      }
      if (bestJ < 0) break;
      var a = nodes[bestI], bb2 = nodes[bestJ];
      // Ondulation naturelle UNIQUEMENT sur les longs segments droits du
      // contournement (sinon elle crée des zigzags raides), puis lissage
      // Catmull-Rom. Si la courbe lissée retouche un obstacle (le Catmull-
      // Rom déborde légèrement des points de passage), on re-route avec un
      // pad plus grand.
      var pad = 40, pts = null, bestN = Infinity;
      for (var attempt = 0; attempt < 5; attempt++) {
        var raw = routeAround(a.x, a.y, bb2.x, bb2.y, pad);
        var wpts = [];
        for (var wi = 0; wi < raw.length; wi++) {
          wpts.push(raw[wi]);
          if (wi < raw.length - 1) {
            var nx2 = raw[wi + 1].x - raw[wi].x, ny2 = raw[wi + 1].y - raw[wi].y;
            var nl = Math.sqrt(nx2 * nx2 + ny2 * ny2) || 1;
            var farFromTown = raw[wi].x < G.TOWN_MIN - 300 || raw[wi].x > G.TOWN_MAX + 300 ||
                              raw[wi].y < G.TOWN_MIN - 300 || raw[wi].y > G.TOWN_MAX + 300;
            if (nl > 120 && attempt === 0 && farFromTown) {
              var off = (rhash(a.x | 0, bb2.y | 0, wi * 31) - 0.5) * 24;
              wpts.push({ x: raw[wi].x + nx2 / 2 - (ny2 / nl) * off,
                         y: raw[wi].y + ny2 / 2 + (nx2 / nl) * off });
            }
          }
        }
        var cand = smoothKinks(catmullRom(chaikin(wpts, attempt === 0 ? 3 : 2), 12), 24 * Math.PI / 180);
        var nBlocked = countBlocked(cand, 26);
        if (nBlocked < bestN) { bestN = nBlocked; pts = cand; }
        if (nBlocked === 0) break;
        pad += 40;
      }
      chemins.push({ pts: pts, a: bestI, b: bestJ });
      connected[bestJ] = true;
      inTree.push(bestJ);
    }

    // --- Rivières : serpents longs qui traversent la carte en passant à
    // proximité des villes (elles "se relient" aux étendues d'eau des villes
    // en longeant leurs bords), sans bloquer le joueur. ---
    var rivieres = [];
    if (villes.length >= 2) {
      for (var rv = 0; rv < villes.length; rv++) {
        var v1 = villes[rv];
        var v2 = villes[(rv + 1) % villes.length];
        // Ancrage : bord des emprises (point du côté de l'autre ville).
        var c1x = v1.x + v1.w / 2, c1y = v1.y + v1.h / 2;
        var c2x = v2.x + v2.w / 2, c2y = v2.y + v2.h / 2;
        var ang = Math.atan2(c2y - c1y, c2x - c1x);
        var r1 = Math.max(v1.w, v1.h) / 2 + 60;
        var r2 = Math.max(v2.w, v2.h) / 2 + 60;
        var pad2 = 40, pts2 = null, bestN2 = Infinity;
        for (var attempt2 = 0; attempt2 < 5; attempt2++) {
          var raw2 = routeAround(
            c1x + Math.cos(ang) * r1, c1y + Math.sin(ang) * r1,
            c2x - Math.cos(ang) * r2, c2y - Math.sin(ang) * r2,
            pad2
          );
          // Serpentin : méandres doux uniquement sur les longs segments.
          var wpts2 = [];
          for (var ri2 = 0; ri2 < raw2.length; ri2++) {
            wpts2.push(raw2[ri2]);
            if (ri2 < raw2.length - 1) {
              var rx2 = raw2[ri2 + 1].x - raw2[ri2].x, ry2 = raw2[ri2 + 1].y - raw2[ri2].y;
              var rl = Math.sqrt(rx2 * rx2 + ry2 * ry2) || 1;
              if (rl > 120 && attempt2 === 0) {
                var off2 = Math.sin(ri2 * 1.7 + rv) * 26;
                wpts2.push({ x: raw2[ri2].x + rx2 / 2 - (ry2 / rl) * off2,
                             y: raw2[ri2].y + ry2 / 2 + (rx2 / rl) * off2 });
              }
            }
          }
          var cand2 = smoothKinks(catmullRom(chaikin(wpts2, attempt2 === 0 ? 3 : 2), 12), 24 * Math.PI / 180);
          var nB2 = countBlocked(cand2, 26);
          if (nB2 < bestN2) { bestN2 = nB2; pts2 = cand2; }
          if (nB2 === 0) break;
          pad2 += 40;
        }
        rivieres.push({ pts: pts2 });
      }
    }

    // --- Ponts : croisements chemin × rivière, dessinés en gris par le
    // client à partir de cette liste de points de croisement. ---
    var ponts = [];
    for (var ci = 0; ci < chemins.length; ci++) {
      var cp = chemins[ci].pts;
      for (var ri = 0; ri < rivieres.length; ri++) {
        var rp = rivieres[ri].pts;
        // Échantillonne le chemin à ~30 px et teste la distance à la
        // rivière (un point de pont par passage, dédupliqué à 80 px).
        for (var pi = 0; pi < cp.length; pi += 6) {
          if (distToPolyline(cp[pi].x, cp[pi].y, rp) < G.RIVIERE_W / 2 + 8) {
            var dup = false;
            for (var qi = 0; qi < ponts.length; qi++) {
              var ddx2 = ponts[qi].x - cp[pi].x, ddy2 = ponts[qi].y - cp[pi].y;
              if (ddx2 * ddx2 + ddy2 * ddy2 < 80 * 80) { dup = true; break; }
            }
            if (!dup) {
              // Direction du chemin au point de croisement (pour orienter
              // le pont perpendiculairement à la rivière).
              var pi2 = Math.min(pi + 3, cp.length - 1);
              ponts.push({ x: cp[pi].x, y: cp[pi].y, dx: cp[pi2].x - cp[pi].x, dy: cp[pi2].y - cp[pi].y });
            }
          }
        }
      }
    }

    state.chemins = chemins;
    state.rivieres = rivieres;
    state.ponts = ponts;
    indexNetwork();
  };

  // Sérialisation réseau compacte : polylines arrondies à 2 px (le tracé
  // Catmull-Rom reste lisse à cette précision).
  G.rivieresSnapshot = function () {
    var st = G.state;
    function pack(list) {
      return list.map(function (l) {
        var arr = [];
        for (var i = 0; i < l.pts.length; i++) {
          arr.push(Math.round(l.pts[i].x * 2) / 2, Math.round(l.pts[i].y * 2) / 2);
        }
        return arr;
      });
    }
    return {
      chemins: pack(st.chemins || []),
      rivieres: pack(st.rivieres || []),
      ponts: (st.ponts || []).map(function (p) {
        return { x: Math.round(p.x), y: Math.round(p.y), dx: Math.round(p.dx), dy: Math.round(p.dy) };
      })
    };
  };

  // Application côté client (msg.map.chemins) : reconstruit les polylines.
  G.applyRivieres = function (net) {
    var st = G.state;
    function unpack(arrs) {
      return (arrs || []).map(function (a) {
        var pts = [];
        for (var i = 0; i + 1 < a.length; i += 2) pts.push({ x: a[i], y: a[i + 1] });
        return { pts: pts };
      });
    }
    st.chemins = unpack(net.chemins);
    st.rivieres = unpack(net.rivieres);
    st.ponts = net.ponts || [];
    indexNetwork();
  };
})();

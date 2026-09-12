// Génération du monde : bâtiments, murs de périmètre, objets, arbres.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Crée un bâtiment décoratif (maison) à partir d'un sprite de maison (H1, H2, ...).
  // Non cliquable, sans rôle. Le PNG donne la taille de l'objet sur la carte.
  // Réduit l'emprise de collision d'un bâtiment à la bounding box opaque réelle
  // du PNG (le rendu reste sur la boîte totale). Le PNG est ancré bas-centre :
  // en monde la boîte opaque va de cx ± w*(x1-x0)/2 en X, et de
  // (y_base - h*y1) à (y_base - h*y0) en Y où y_base = centre.y + h/2.
  // Modifie b.x/y/w/h en place pour ne créer qu'une seule zone de collision.
  function shrinkToOpaque(b, ent, frame) {
    var bd = G.spriteBounds(ent, frame);
    if (!bd) return;
    var cx = b.x + b.w / 2, by = b.y + b.h / 2;
    var fw = bd.x1 - bd.x0, fh = bd.y1 - bd.y0;
    if (fw <= 0 || fh <= 0) return;
    b.w = b.w * fw; b.h = b.h * fh;
    b.x = cx - b.w / 2; b.y = by - b.h / 2;
  }

  G.makeHouse = function (x, y, sprite) {
    var side = sprite.w * 2;
    var b = {
      x: x - side / 2, y: y - side / 2, w: side, h: side,
      name: "Maison", msg: "", height: sprite.h,
      isDecor: true, houseSprite: sprite,
      door: { x: x, y: y + side / 2 }
    };
    return b;
  };
  G.makeBuilding = function (x, y, w, h, name, msg, height) {
    var b = {
      x: x, y: y, w: w, h: h,
      name: name, msg: msg, height: height || 350,
      door: { x: x + w / 2, y: y + h }
    };
    if (name === "Mairie") {
      b.isMairie = true;
      b.hp = G.MAIRIE_MAX_HP;
      b.maxHp = G.MAIRIE_MAX_HP;
    } else if (name === "Eglise") {
      b.isChurch = true;
    }
    // Si un sprite PNG est disponible, le PNG donne la taille de l'objet sur la carte :
    // on redimensionne l'emprise sol (w = h = largeur du PNG / 2, en unités monde)
    // et on dérive la hauteur visuelle du ratio du PNG.
    var sp = null;
    if (b.isMairie && G.hasSprite("building", "mairie")) sp = G.SPRITES.building.mairie;
    else if (b.isChurch && G.hasSprite("church", "church")) sp = G.SPRITES.church.church;
    else if (G.hasSprite("building", "generic")) sp = G.SPRITES.building.generic;
    if (sp) {
      var side = sp.w * 2;
      b.w = side; b.h = side;
      b.x = x - side / 2; b.y = y - side / 2;
      b.door = { x: b.x + b.w / 2, y: b.y + b.h };
      b.height = sp.h;
      // Réduit la collision à la zone opaque réelle du PNG.
      if (b.isMairie) shrinkToOpaque(b, "building", "mairie");
      else if (b.isChurch) shrinkToOpaque(b, "church", "church");
      else shrinkToOpaque(b, "building", "generic");
    }
    return b;
  };

  G.nearBuilding = function (x, y, pad) {
    for (var i = 0; i < G.state.buildings.length; i++) {
      var b = G.state.buildings[i];
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
    }
    return false;
  };

  // Grille spatiale des arbres pour les collisions en O(1) (40000+ arbres).
  // Construite après le spawn des arbres via buildTreeGrid().
  G.treeGrid = null;
  G.TREE_CELL = 200;
  G.buildTreeGrid = function () {
    var cell = G.TREE_CELL;
    var grid = {};
    var trees = G.state.trees;
    for (var i = 0; i < trees.length; i++) {
      var t = trees[i];
      var key = Math.floor(t.x / cell) + "," + Math.floor(t.y / cell);
      if (!grid[key]) grid[key] = [];
      grid[key].push(t);
    }
    G.treeGrid = grid;
  };
  // Calcule la zone de collision d'un arbre basée sur le contenu opaque réel
  // du PNG (et non sa boîte totale, souvent 98% transparente en pixel art).
  // Le rendu dessine le PNG ancré bas-centre : largeur monde = sp.w*2,
  // hauteur monde = sp.h*2. Le contenu opaque occupe la fraction
  // [x0..x1]×[y0..y1] du PNG. On en déduit :
  //   - rad : demi-largeur monde du contenu opaque (rayon du losange).
  //   - cy  : centre Y monde (le PNG est ancré bas à t.y, donc le centre du
  //           contenu opaque est à t.y - (1 - (y0+y1)/2) * sp.h*2).
  // Retourne {rad, cy} ou null si pas de sprite.
  G.treeBounds = function (kind) {
    if (!G.hasSprite("tree", kind)) return null;
    var sp = G.SPRITES.tree[kind];
    var b = G.spriteBounds("tree", kind) || { x0: 0, y0: 0, x1: 1, y1: 1 };
    var opaqueW = (b.x1 - b.x0) * sp.w * 2;
    var opaqueH = (b.y1 - b.y0) * sp.h * 2;
    return { rad: Math.max(opaqueW, opaqueH) / 2, cy: -(1 - (b.y0 + b.y1) / 2) * sp.h * 2 };
  };
  // Teste si la boîte centrée (x,y) de demi-côté half chevauche un arbre.
  // La zone non-marchable = losange (distance de Manhattan) centré sur le
  // contenu opaque réel du PNG (t.cx, t.y+t.cy) de rayon t.rad.
  // Utilise la grille spatiale : ne vérifie que les arbres des cellules voisines.
  G.hitsTree = function (x, y, half) {
    var grid = G.treeGrid;
    if (!grid) return false;
    var cell = G.TREE_CELL;
    var gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    for (var ix = -1; ix <= 1; ix++) {
      for (var iy = -1; iy <= 1; iy++) {
        var arr = grid[(gx + ix) + "," + (gy + iy)];
        if (!arr) continue;
        for (var n = 0; n < arr.length; n++) {
          var t = arr[n];
          if (t.rad) {
            // Losange centré (t.x, t.y + t.cy) de rayon t.rad vs boîte demi-côté half.
            var ddx = Math.max(Math.abs(t.x - x) - half, 0);
            var ddy = Math.max(Math.abs((t.y + t.cy) - y) - half, 0);
            if (ddx + ddy < t.rad) return true;
          } else {
            // Repli (pas de PNG) : cercle (t.x, t.y, t.r).
            var cx = Math.max(Math.abs(t.x - x) - half, 0);
            var cy = Math.max(Math.abs(t.y - y) - half, 0);
            if (cx * cx + cy * cy < t.r * t.r) return true;
          }
        }
      }
    }
    return false;
  };

  // Fait poper `total` arbres de type `kind` hors de la ville, regroupés en
  // clusters de 1 à 10 arbres. Les arbres d'un même cluster sont proches mais
  // ne se superposent pas (distance minimale entre troncs = somme des rayons).
  G.spawnTreeClusters = function (state, total, kind) {
    // Grille spatiale pour vérifier la proximité en O(1) (gère 48000+ arbres).
    var cell = 150;
    var grid = {};
    function gkey(cx, cy) { return Math.floor(cx / cell) + "," + Math.floor(cy / cell); }
    function nearTree(tx, ty, r) {
      var gx = Math.floor(tx / cell), gy = Math.floor(ty / cell);
      for (var ix = -1; ix <= 1; ix++) {
        for (var iy = -1; iy <= 1; iy++) {
          var key = (gx + ix) + "," + (gy + iy);
          var arr = grid[key];
          if (!arr) continue;
          for (var n = 0; n < arr.length; n++) {
            var o = arr[n];
            var dx = tx - o.x, dy = ty - o.y;
            if (Math.sqrt(dx * dx + dy * dy) < (r + o.r) * 0.2) return true;
        }
        }
      }
      return false;
    }
    function addTree(tx, ty, r) {
      var b = G.treeBounds(kind);
      var o = { x: tx, y: ty, r: r };
      var key = gkey(tx, ty);
      if (!grid[key]) grid[key] = [];
      grid[key].push(o);
      state.trees.push({
        x: tx, y: ty, r: r, kind: kind, hp: 2,
        rad: b ? b.rad : 0, cy: b ? b.cy : 0
      });
    }
    var placed = 0;
    var guard = 0;
    while (placed < total && guard < total * 6) {
      guard++;
      var gx, gy;
      if (Math.random() < 0.5) {
        gx = G.rand(0, G.WORLD);
        gy = Math.random() < 0.5 ? G.rand(0, G.TOWN_MIN - 40) : G.rand(G.TOWN_MAX + 40, G.WORLD);
      } else {
        gx = Math.random() < 0.5 ? G.rand(0, G.TOWN_MIN - 40) : G.rand(G.TOWN_MAX + 40, G.WORLD);
        gy = G.rand(0, G.WORLD);
      }
      var count = G.randi(1, 10);
      for (var j = 0; j < count && placed < total; j++) {
        var r = G.rand(72, 144);
        var ang = Math.random() * Math.PI * 2;
        var dist = Math.random() * 16;
        var tx = gx + Math.cos(ang) * dist;
        var ty = gy + Math.sin(ang) * dist;
        if (tx < 0 || tx > G.WORLD || ty < 0 || ty > G.WORLD) continue;
        if (G.inTown(tx, ty)) continue;
        if (nearTree(tx, ty, r)) continue;
        addTree(tx, ty, r);
        placed++;
      }
    }
    };

  G.buildPerimeterWall = function () {
    var state = G.state;
    state.walls = [];
    // Perimetre = barricades (memes objets que celles du joueur : built:true, bloquent joueur+zombies).
    // Dimensions identiques aux planches du joueur : meme apparence et taille visuelle.
    var wd = G.wallSpriteDims();
    var seg = wd.longW;
    var thick = wd.thick;
    var pad = 6;
    function addWall(w) { state.walls.push(w); }
    // Trou d'une palissade de largeur dans le mur nord : on omet un segment
    // pour créer une entrée dans la ville au démarrage.
    var gapIndex = Math.floor((G.TOWN_MAX - G.TOWN_MIN) / seg / 2);
    var i = 0;
    for (var x = G.TOWN_MIN; x < G.TOWN_MAX; x += seg) {
      if (i !== gapIndex) {
        addWall({ x: x, y: G.TOWN_MIN - pad, w: seg, h: thick, hp: G.WALL_MAX_HP, orient: "h", built: true });
      }
      addWall({ x: x, y: G.TOWN_MAX + pad - thick, w: seg, h: thick, hp: G.WALL_MAX_HP, orient: "h", built: true });
      i++;
    }
    for (var y = G.TOWN_MIN; y < G.TOWN_MAX; y += seg) {
      addWall({ x: G.TOWN_MIN - pad, y: y, w: thick, h: seg, hp: G.WALL_MAX_HP, orient: "v", built: true });
      addWall({ x: G.TOWN_MAX + pad - thick, y: y, w: thick, h: seg, hp: G.WALL_MAX_HP, orient: "v", built: true });
    }
  };

  G.buildWorld = function () {
    var state = G.state;
    var c = G.WORLD / 2;
    state.buildings = [
      G.makeBuilding(c - 60, c - 60, 120, 120, "Mairie", "Vous êtes à la mairie. Tout semble calme.", 76),
      G.makeBuilding(c - 150, c + 320, 90, 90, "Eglise", "L'église est silencieuse et fraîche.", 88),
    ];

    G.buildPerimeterWall();

    // Maisons décoratives (non cliquables) : 20 à 55 maisons, réparties en petits
    // tas (clusters de 2-5) en ville ET hors ville. Choisies parmi les PNG H1, H2, ...
    // Maisons décoratives (non cliquables) en petits tas, en ville ET hors ville.
    // En ville : 8x plus qu'avant. Hors ville : ~100 maisons.
    var houseNames = G.houseNames();
    if (houseNames.length > 0) {
      // Tente de placer une maison à (hx, hy). Refuse si superposition.
      function placeHouseAt(hx, hy, inTown) {
        var frame = houseNames[G.randi(0, houseNames.length - 1)];
        var sp = G.SPRITES.house[frame];
        if (!sp) return false;
        var side = sp.w * 2;
        if (hx < 20 || hx > G.WORLD - 20 || hy < 20 || hy > G.WORLD - 20) return false;
        for (var bi3 = 0; bi3 < state.buildings.length; bi3++) {
          var ob = state.buildings[bi3];
          if (hx - side / 2 < ob.x + ob.w && hx + side / 2 > ob.x &&
              hy - side / 2 < ob.y + ob.h && hy + side / 2 > ob.y) return false;
        }
        if (inTown !== undefined && G.inTown(hx, hy) !== inTown) return false;
        var h = G.makeHouse(hx, hy, sp);
        shrinkToOpaque(h, "house", frame);
        state.buildings.push(h);
        return true;
      }
      // Tente de coller une maison contre un bâtiment existant (4 côtés possibles).
      function placeAdjacent(houses, inTown) {
        for (var t = 0; t < 20; t++) {
          var anchor = houses[G.randi(0, houses.length - 1)];
          var frame = houseNames[G.randi(0, houseNames.length - 1)];
          var sp = G.SPRITES.house[frame];
          if (!sp) continue;
          var side = sp.w * 2;
          var sideA = anchor.w;
          var dir = G.randi(0, 3); // 0=haut, 1=bas, 2=gauche, 3=droite
          var hx, hy;
          if (dir === 0) { hx = anchor.x + sideA / 2; hy = anchor.y - side / 2; }
          else if (dir === 1) { hx = anchor.x + sideA / 2; hy = anchor.y + anchor.h + side / 2; }
          else if (dir === 2) { hx = anchor.x - side / 2; hy = anchor.y + sideA / 2; }
          else { hx = anchor.x + anchor.w + side / 2; hy = anchor.y + sideA / 2; }
          if (placeHouseAt(hx, hy, inTown)) return true;
        }
        return false;
      }
      function spawnHouses(total, inTown) {
        var placed = 0, guard = 0;
        var houses = [];
        while (placed < total && guard < total * 60) {
          guard++;
          // 15% : bâtiment isolé (position aléatoire). 85% : collé à un existant.
          var isolated = houses.length === 0 || Math.random() < 0.15;
          var ok = false;
          if (isolated) {
            var gx, gy;
            if (inTown) {
              gx = G.rand(G.TOWN_MIN + 30, G.TOWN_MAX - 30);
              gy = G.rand(G.TOWN_MIN + 30, G.TOWN_MAX - 30);
            } else {
              gx = Math.random() < 0.5 ? G.rand(40, G.TOWN_MIN - 60) : G.rand(G.TOWN_MAX + 60, G.WORLD - 40);
              gy = Math.random() < 0.5 ? G.rand(40, G.TOWN_MIN - 60) : G.rand(G.TOWN_MAX + 60, G.WORLD - 40);
            }
            ok = placeHouseAt(gx, gy, inTown);
          } else {
            ok = placeAdjacent(houses, inTown);
          }
          if (ok) { houses.push(state.buildings[state.buildings.length - 1]); placed++; }
        }
      }
      spawnHouses(G.randi(24, 66), true);
      // Petits villages éparpillés à l'extérieur de la ville : chaque village
      // est un cluster de 5 à 8 maisons collées, dispersé sur la carte.
      var numVillages = G.randi(6, 10);
      for (var v = 0; v < numVillages; v++) {
        // Centre du village hors ville, suffisamment loin des murs.
        var vx = Math.random() < 0.5 ? G.rand(80, G.TOWN_MIN - 200) : G.rand(G.TOWN_MAX + 200, G.WORLD - 80);
        var vy = Math.random() < 0.5 ? G.rand(80, G.TOWN_MIN - 200) : G.rand(G.TOWN_MAX + 200, G.WORLD - 80);
        // Place une première maison au centre, puis colle les autres autour.
        var vHouses = [];
        var first = placeHouseAt(vx, vy, false);
        if (first) vHouses.push(state.buildings[state.buildings.length - 1]);
        var vCount = G.randi(5, 8);
        for (var vc = 1; vc < vCount; vc++) {
          if (placeAdjacent(vHouses, false)) vHouses.push(state.buildings[state.buildings.length - 1]);
        }
      }
    }
    state.items = [
      // Équipement de départ en ville.
      { x: c - 60, y: c - 40, taken: false, name: "Pistolet", color: "#94a3b8", kind: "arme" },
      { x: c + 60, y: c - 40, taken: false, name: "Hache", color: "#b45309", kind: "outil" },
      { x: c - 80, y: c + 20, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c + 90, y: c - 60, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c - 200, y: c - 180, taken: false, name: "Potion", color: "#ef4444", kind: "objet" },
      { x: c + 40, y: c + 240, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c - 320, y: c + 80, taken: false, name: "Gemme", color: "#22d3ee", kind: "objet" },
      { x: c + 340, y: c - 140, taken: false, name: "Parchemin", color: "#fde68a", kind: "objet" },
      { x: c - 120, y: c - 260, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c + 220, y: c + 120, taken: false, name: "Clé", color: "#eab308", kind: "objet" },
      { x: G.TOWN_MIN - 440, y: c + 60, taken: false, name: "Pistolet", color: "#94a3b8", kind: "arme" },
      { x: G.TOWN_MAX + 360, y: c - 120, taken: false, name: "Couteau", color: "#cbd5e1", kind: "arme" },
      { x: c - 220, y: G.TOWN_MAX + 380, taken: false, name: "Bâton", color: "#7c5e3c", kind: "arme" },
      { x: c + 240, y: G.TOWN_MIN - 420, taken: false, name: "Arc", color: "#a16207", kind: "arme" },
      { x: G.TOWN_MIN - 1200, y: G.TOWN_MIN - 800, taken: false, name: "Fusil", color: "#64748b", kind: "arme" },
      { x: G.TOWN_MAX + 1400, y: G.TOWN_MAX + 1000, taken: false, name: "Pistolet", color: "#94a3b8", kind: "arme" },
      { x: c, y: G.TOWN_MIN - 1600, taken: false, name: "Fusil", color: "#64748b", kind: "arme" },
      { x: c + 1800, y: c - 2400, taken: false, name: "Arc", color: "#a16207", kind: "arme" },
      { x: G.TOWN_MIN - 2800, y: c + 3000, taken: false, name: "Couteau", color: "#cbd5e1", kind: "arme" },
      { x: G.TOWN_MIN - 1200, y: G.TOWN_MIN - 800, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: G.TOWN_MAX + 1400, y: G.TOWN_MAX + 1000, taken: false, name: "Cristal", color: "#38bdf8", kind: "objet" },
      { x: c + 1800, y: c - 2400, taken: false, name: "Potion", color: "#ef4444", kind: "objet" },
      // Haches : disponibles uniquement en dehors de la ville.
      { x: G.TOWN_MIN - 700, y: c + 360, taken: false, name: "Hache", color: "#b45309", kind: "outil" },
      { x: G.TOWN_MAX + 840, y: c - 440, taken: false, name: "Hache", color: "#b45309", kind: "outil" },
      { x: c - 1400, y: G.TOWN_MAX + 1200, taken: false, name: "Hache", color: "#b45309", kind: "outil" }
    ];

    state.trees = [];
    var i, tx, ty, tries;
    for (i = 0; i < 5; i++) {
      tries = 0;
      do {
        tx = G.rand(G.TOWN_MIN + 40, G.TOWN_MAX - 40);
        ty = G.rand(G.TOWN_MIN + 40, G.TOWN_MAX - 40);
        tries++;
      } while (G.nearBuilding(tx, ty, 30) && tries < 12);
      if (tries < 12) {
        var tb = G.treeBounds("town");
        state.trees.push({ x: tx, y: ty, r: G.rand(56, 88), kind: "town", hp: 2, rad: tb ? tb.rad : 0, cy: tb ? tb.cy : 0 });
      }
    }
    // Forêt hors ville : les arbres wild popent par groupes de 1 à 10,
    // regroupés spatialement et sans se superposer.
    G.spawnTreeClusters(state, 2400, "wild");
    for (i = 0; i < 5; i++) {
      var side = G.randi(0, 3);
      if (side === 0) { tx = G.rand(G.TOWN_MIN, G.TOWN_MAX); ty = G.rand(G.TOWN_MIN - 280, G.TOWN_MIN - 20); }
      else if (side === 1) { tx = G.rand(G.TOWN_MIN, G.TOWN_MAX); ty = G.rand(G.TOWN_MAX + 20, G.TOWN_MAX + 280); }
      else if (side === 2) { tx = G.rand(G.TOWN_MIN - 280, G.TOWN_MIN - 20); ty = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      else { tx = G.rand(G.TOWN_MAX + 20, G.TOWN_MAX + 280); ty = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      var eb = G.treeBounds("edge");
      state.trees.push({ x: tx, y: ty, r: G.rand(64, 112), kind: "edge", hp: 2, rad: eb ? eb.rad : 0, cy: eb ? eb.cy : 0 });
    }

    state.zombies = [];
    G.buildTreeGrid();
  };
})();

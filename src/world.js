// Génération du monde : bâtiments, murs de périmètre, objets, arbres.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Crée un bâtiment décoratif (maison) à partir d'un sprite de maison (H1, H2, ...).
  // Non cliquable, sans rôle. Le PNG donne la taille de l'objet sur la carte.
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
  // Teste si la boîte (x,y,half) chevauche le tronc d'un arbre (cercle de rayon r).
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
          // Cercle (t.x, t.y, t.r) vs boîte centrée (x, y) de demi-côté half.
          var ddx = Math.max(Math.abs(t.x - x) - half, 0);
          var ddy = Math.max(Math.abs(t.y - y) - half, 0);
          if (ddx * ddx + ddy * ddy < t.r * t.r) return true;
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
      var o = { x: tx, y: ty, r: r };
      var key = gkey(tx, ty);
      if (!grid[key]) grid[key] = [];
      grid[key].push(o);
      state.trees.push({ x: tx, y: ty, r: r, kind: kind, hp: 2 });
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
    for (var x = G.TOWN_MIN; x < G.TOWN_MAX; x += seg) {
      state.walls.push({ x: x, y: G.TOWN_MIN - pad, w: seg, h: thick, hp: G.WALL_MAX_HP, orient: "h", built: true });
      state.walls.push({ x: x, y: G.TOWN_MAX + pad - thick, w: seg, h: thick, hp: G.WALL_MAX_HP, orient: "h", built: true });
    }
    for (var y = G.TOWN_MIN; y < G.TOWN_MAX; y += seg) {
      state.walls.push({ x: G.TOWN_MIN - pad, y: y, w: thick, h: seg, hp: G.WALL_MAX_HP, orient: "v", built: true });
      state.walls.push({ x: G.TOWN_MAX + pad - thick, y: y, w: thick, h: seg, hp: G.WALL_MAX_HP, orient: "v", built: true });
    }
  };

  G.buildWorld = function () {
    var state = G.state;
    var c = G.WORLD / 2;
    state.buildings = [
      G.makeBuilding(c - 60, c - 60, 120, 120, "Mairie", "Vous êtes à la mairie. Tout semble calme.", 76),
      G.makeBuilding(c + 280, c - 400, 110, 110, "Auberge", "L'auberge sent la soupe chaude. Repos bien mérité.", 66),
      G.makeBuilding(c - 400, c + 260, 110, 110, "Forge", "La forge résonne du bruit de l'enclume.", 72),
      G.makeBuilding(c + 300, c + 280, 120, 100, "Marché", "Le marché grouille de marchandises.", 60),
      G.makeBuilding(c - 150, c + 320, 90, 90, "Eglise", "L'église est silencieuse et fraîche.", 88),
      G.makeBuilding(c + 120, c - 300, 90, 110, "Tour", "La vue depuis la tour couvre toute la ville.", 120),
      G.makeBuilding(c - 380, c + 300, 120, 100, "Hôpital", "Hôpital : payez une pièce d'or pour retrouver toute votre vie.", 84)
    ];

    G.buildPerimeterWall();

    // Maisons décoratives (non cliquables) : 20 à 55 maisons, réparties en petits
    // tas (clusters de 2-5) en ville ET hors ville. Choisies parmi les PNG H1, H2, ...
    // Maisons décoratives (non cliquables) en petits tas, en ville ET hors ville.
    // En ville : 8x plus qu'avant. Hors ville : ~100 maisons.
    var houseNames = G.houseNames();
    if (houseNames.length > 0) {
      function placeHouseAt(hx, hy, inTown) {
        var frame = houseNames[G.randi(0, houseNames.length - 1)];
        var sp = G.SPRITES.house[frame];
        if (!sp) return false;
        var side = sp.w * 2;
        for (var bi3 = 0; bi3 < state.buildings.length; bi3++) {
          var ob = state.buildings[bi3];
          if (hx - side / 2 < ob.x + ob.w && hx + side / 2 > ob.x &&
              hy - side / 2 < ob.y + ob.h && hy + side / 2 > ob.y) return false;
        }
        if (inTown !== undefined && G.inTown(hx, hy) !== inTown) return false;
        state.buildings.push(G.makeHouse(hx, hy, sp));
        return true;
      }
      function spawnClusters(total, inTown, clusterR) {
        var placed = 0, guard = 0;
        while (placed < total && guard < total * 50) {
          guard++;
          var gx, gy;
          if (inTown) {
            gx = G.rand(G.TOWN_MIN + 30, G.TOWN_MAX - 30);
            gy = G.rand(G.TOWN_MIN + 30, G.TOWN_MAX - 30);
          } else {
            gx = Math.random() < 0.5 ? G.rand(40, G.TOWN_MIN - 60) : G.rand(G.TOWN_MAX + 60, G.WORLD - 40);
            gy = Math.random() < 0.5 ? G.rand(40, G.TOWN_MIN - 60) : G.rand(G.TOWN_MAX + 60, G.WORLD - 40);
          }
          if (G.nearBuilding(gx, gy, 10)) continue;
          var n = G.randi(2, 5);
          for (var h = 0; h < n && placed < total; h++) {
            var ang = Math.random() * Math.PI * 2;
            var dist = Math.random() * clusterR;
            var hx = gx + Math.cos(ang) * dist;
            var hy = gy + Math.sin(ang) * dist;
            if (hx < 20 || hx > G.WORLD - 20 || hy < 20 || hy > G.WORLD - 20) continue;
            if (placeHouseAt(hx, hy, inTown)) placed++;
          }
        }
      }
      spawnClusters(G.randi(160, 440), true, 20);
      spawnClusters(100, false, 20);
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
      if (tries < 12) state.trees.push({ x: tx, y: ty, r: G.rand(56, 88), kind: "town", hp: 2 });
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
      state.trees.push({ x: tx, y: ty, r: G.rand(64, 112), kind: "edge", hp: 2 });
    }

    state.zombies = [];
    G.buildTreeGrid();
  };
})();

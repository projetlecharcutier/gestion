// Génération du monde : bâtiments, murs de périmètre, objets, forêts.
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

  // Crée une forêt : objet de type bâtiment (isForet:true, isDecor:true,
  // isChoppable:true) avec la même logique de collision qu'un bâtiment :
  // emprise sol = largeur du PNG * 2 (ancré bas-centre), réduite à la boîte
  // opaque réelle du PNG via shrinkToOpaque. Les forêts vont dans
  // state.buildings[] : elles collident donc comme n'importe quel bâtiment.
  // Repli dimension 128 si pas de sprite (côté serveur sans PNG).
  G.makeForet = function (x, y, frame) {
    var sp = G.SPRITES.foret && G.SPRITES.foret[frame];
    var side = sp ? sp.w * 2 : 128;
    var b = {
      x: x - side / 2, y: y - side / 2, w: side, h: side,
      name: "Forêt", msg: "", height: sp ? sp.h : 80,
      isForet: true, isDecor: true, isChoppable: true,
      hp: 2, maxHp: 2, foretFrame: frame,
      door: { x: x, y: y + side / 2 }
    };
    if (sp) shrinkToOpaque(b, "foret", frame);
    return b;
  };

  // Grille spatiale des bâtiments (forêts + maisons + mairie) pour des
  // collisions en O(1) avec plusieurs milliers de forêts. Construite après
  // buildWorld() via rebuildBuildingGrid().
  G.buildingGrid = null;
  G.BUILDING_CELL = 256;
  G.rebuildBuildingGrid = function () {
    var cell = G.BUILDING_CELL;
    var grid = {};
    var blds = G.state.buildings;
    for (var i = 0; i < blds.length; i++) {
      var b = blds[i];
      var minCx = Math.floor(b.x / cell), maxCx = Math.floor((b.x + b.w) / cell);
      var minCy = Math.floor(b.y / cell), maxCy = Math.floor((b.y + b.h) / cell);
      for (var cx = minCx; cx <= maxCx; cx++) {
        for (var cy = minCy; cy <= maxCy; cy++) {
          var key = cx + "," + cy;
          if (!grid[key]) grid[key] = [];
          grid[key].push(b);
        }
      }
    }
    G.buildingGrid = grid;
  };

  // Teste si la boîte centrée (x,y) de demi-côté half chevauche une forêt
  // (bâtiment avec isForet). AABB standard, identique à aabbHitsBuildings
  // mais filtré sur les forêts uniquement (les zombies traversent les
  // autres bâtiments pour atteindre la mairie).
  G.aabbHitsForets = function (x, y, half) {
    var grid = G.buildingGrid;
    if (!grid) return false;
    var cell = G.BUILDING_CELL;
    var minCx = Math.floor((x - half) / cell), maxCx = Math.floor((x + half) / cell);
    var minCy = Math.floor((y - half) / cell), maxCy = Math.floor((y + half) / cell);
    for (var cx = minCx; cx <= maxCx; cx++) {
      for (var cy = minCy; cy <= maxCy; cy++) {
        var arr = grid[cx + "," + cy];
        if (!arr) continue;
        for (var n = 0; n < arr.length; n++) {
          var b = arr[n];
          if (!b.isForet) continue;
          if (x + half > b.x && x - half < b.x + b.w &&
              y + half > b.y && y - half < b.y + b.h) return true;
        }
      }
    }
    return false;
  };

  // Fait poper `total` forêts, regroupées en clusters de 1 à 10 (même
  // distribution que l'ancien système d'arbres). Les forêts vont dans
  // state.buildings[] avec isForet. Si inTown est vrai, elles sont placées
  // en ville ; sinon hors ville. Les forêts d'un même cluster sont proches
  // mais ne se superposent pas.
  G.spawnForets = function (state, total, inTown) {
    var names = G.foretNames();
    if (names.length === 0) return;
    // Grille spatiale pour vérifier la superposition en O(1).
    var cell = 200;
    var grid = {};
    function gkey(cx, cy) { return Math.floor(cx / cell) + "," + Math.floor(cy / cell); }
    // Pré-remplit la grille avec les bâtiments existants (mairie, église,
    // maisons) pour éviter qu'une forêt ne se superpose à ceux-ci.
    for (var bi0 = 0; bi0 < state.buildings.length; bi0++) {
      var ob0 = state.buildings[bi0];
      var k0 = gkey(ob0.x, ob0.y);
      if (!grid[k0]) grid[k0] = [];
      grid[k0].push(ob0);
    }
    function nearForet(tx, ty, half) {
      var minCx = Math.floor((tx - half) / cell), maxCx = Math.floor((tx + half) / cell);
      var minCy = Math.floor((ty - half) / cell), maxCy = Math.floor((ty + half) / cell);
      for (var cx = minCx; cx <= maxCx; cx++) {
        for (var cy = minCy; cy <= maxCy; cy++) {
          var arr = grid[cx + "," + cy];
          if (!arr) continue;
          for (var n = 0; n < arr.length; n++) {
            var o = arr[n];
            if (tx + half > o.x && tx - half < o.x + o.w &&
                ty + half > o.y && ty - half < o.y + o.h) return true;
          }
        }
      }
      return false;
    }
    function addForet(tx, ty, frame) {
      var f = G.makeForet(tx, ty, frame);
      var key = gkey(f.x, f.y);
      if (!grid[key]) grid[key] = [];
      grid[key].push(f);
      state.buildings.push(f);
    }
    var placed = 0;
    var guard = 0;
    while (placed < total && guard < total * 8) {
      guard++;
      var gx, gy;
      if (inTown) {
        gx = G.rand(G.TOWN_MIN + 40, G.TOWN_MAX - 40);
        gy = G.rand(G.TOWN_MIN + 40, G.TOWN_MAX - 40);
      } else if (Math.random() < 0.5) {
        gx = G.rand(40, G.WORLD - 40);
        gy = Math.random() < 0.5 ? G.rand(40, G.TOWN_MIN - 40) : G.rand(G.TOWN_MAX + 40, G.WORLD - 40);
      } else {
        gx = Math.random() < 0.5 ? G.rand(40, G.TOWN_MIN - 40) : G.rand(G.TOWN_MAX + 40, G.WORLD - 40);
        gy = G.rand(40, G.WORLD - 40);
      }
      var count = G.randi(1, 10);
      for (var j = 0; j < count && placed < total; j++) {
        var frame = names[G.randi(0, names.length - 1)];
        var sp = G.SPRITES.foret && G.SPRITES.foret[frame];
        var side = sp ? sp.w * 2 : 128;
        var half = side / 2;
        var ang = Math.random() * Math.PI * 2;
        var dist = Math.random() * Math.max(side * 0.6, 20);
        var tx = gx + Math.cos(ang) * dist;
        var ty = gy + Math.sin(ang) * dist;
        if (tx < half || tx > G.WORLD - half || ty < half || ty > G.WORLD - half) continue;
        if (!inTown && G.inTown(tx, ty)) continue;
        if (nearForet(tx, ty, half)) continue;
        addForet(tx, ty, frame);
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
      // Zone tampon autour de l'ouverture de la muraille (nord) : aucun bâtiment
      // ne doit bloquer l'entrée de la ville.
      var gapCx = G.TOWN_MIN + G.TOWN / 2;
      var gapCy = G.TOWN_MIN;
      var GATE_M = 160; // marge autour de l'ouverture
      function nearGate(hx, hy, side) {
        // L'ouverture est au nord (y = TOWN_MIN). Zone tampon = bande de
        // GATE_M de large autour de gapCx, sur GATE_M de profondeur vers le sud.
        if (hy + side / 2 < G.TOWN_MIN - 20) return false; // hors de la zone nord
        if (hy - side / 2 > G.TOWN_MIN + GATE_M) return false; // trop au sud
        if (Math.abs(hx - gapCx) > GATE_M + side / 2) return false;
        return true;
      }

      // Marge entre les bâtiments et la muraille de la ville (en unités monde).
      // Les bâtiments en ville ne doivent pas toucher le mur de périmètre.
      var WALL_MARGIN = 30;
      function placeHouseAt(hx, hy, inTown) {
        var frame = houseNames[G.randi(0, houseNames.length - 1)];
        var sp = G.SPRITES.house[frame];
        if (!sp) return false;
        var side = sp.w * 2;
        if (hx < 20 || hx > G.WORLD - 20 || hy < 20 || hy > G.WORLD - 20) return false;
        // Empêche les bâtiments de bloquer l'ouverture de la muraille.
        if (nearGate(hx, hy, side)) return false;
        // Distance minimale entre les bâtiments et la muraille de la ville.
        if (inTown) {
          if (hx - side / 2 < G.TOWN_MIN + WALL_MARGIN) return false;
          if (hx + side / 2 > G.TOWN_MAX - WALL_MARGIN) return false;
          if (hy - side / 2 < G.TOWN_MIN + WALL_MARGIN) return false;
          if (hy + side / 2 > G.TOWN_MAX - WALL_MARGIN) return false;
        }
        for (var bi3 = 0; bi3 < state.buildings.length; bi3++) {
          var ob = state.buildings[bi3];
          // Écart de 1 px entre bâtiments : on gonfle la boîte de l'obstacle
          // de 1 px de chaque côté avant le test AABB.
          if (hx - side / 2 < ob.x + ob.w + 1 && hx + side / 2 > ob.x - 1 &&
              hy - side / 2 < ob.y + ob.h + 1 && hy + side / 2 > ob.y - 1) return false;
        }
        if (inTown !== undefined && G.inTown(hx, hy) !== inTown) return false;
        var h = G.makeHouse(hx, hy, sp);
        shrinkToOpaque(h, "house", frame);
        state.buildings.push(h);
        return true;
      }
      // Tente de placer une maison près d'un bâtiment existant (4 côtés),
      // avec 1 px d'écart pour qu'ils se touchent sans se superposer.
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
          // GAP = 1 px d'écart entre les bâtiments (bord à bord + 1 px).
          var GAP = 1;
          if (dir === 0) { hx = anchor.x + sideA / 2; hy = anchor.y - side / 2 - GAP; }
          else if (dir === 1) { hx = anchor.x + sideA / 2; hy = anchor.y + anchor.h + side / 2 + GAP; }
          else if (dir === 2) { hx = anchor.x - side / 2 - GAP; hy = anchor.y + sideA / 2; }
          else { hx = anchor.x + anchor.w + side / 2 + GAP; hy = anchor.y + sideA / 2; }
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

    // Forêts : mêmes règles de distribution que l'ancien système d'arbres
    // (clusters de 1 à 10, ~5 en ville, 2400 hors ville, 5 en lisière), mais
    // comme bâtiments (isForet) avec collision identique aux bâtiments.
    G.spawnForets(state, 5, true);
    G.spawnForets(state, 2400, false);
    // Lisière : quelques forêts juste autour des murs (4 côtés).
    var names = G.foretNames();
    for (var fi = 0; fi < 5 && names.length > 0; fi++) {
      var fs = G.randi(0, 3);
      var ftx, fty;
      if (fs === 0) { ftx = G.rand(G.TOWN_MIN, G.TOWN_MAX); fty = G.rand(G.TOWN_MIN - 280, G.TOWN_MIN - 20); }
      else if (fs === 1) { ftx = G.rand(G.TOWN_MIN, G.TOWN_MAX); fty = G.rand(G.TOWN_MAX + 20, G.TOWN_MAX + 280); }
      else if (fs === 2) { ftx = G.rand(G.TOWN_MIN - 280, G.TOWN_MIN - 20); fty = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      else { ftx = G.rand(G.TOWN_MAX + 20, G.TOWN_MAX + 280); fty = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      if (!G.nearBuilding(ftx, fty, 10)) state.buildings.push(G.makeForet(ftx, fty, names[G.randi(0, names.length - 1)]));
    }

    state.zombies = [];
    G.rebuildBuildingGrid();
  };
})();

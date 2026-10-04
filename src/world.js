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

  // Maison decorative. `sprite` est l'entree G.SPRITES.house (client : PNG
  // charge ; serveur : stub {w,h} sans image). `name` est le nom de la frame
  // (H1, H2...) : il permet de retrouver le sprite cote client apres transfert
  // reseau (le serveur ne serialise PAS l'objet sprite, qui contiendrait un
  // stub sans image -> drawImage(null) cote client).
  G.makeHouse = function (x, y, sprite, name) {
    var side = sprite.w * 2;
    var b = {
      x: x - side / 2, y: y - side / 2, w: side, h: side,
      name: "Maison", msg: "", height: sprite.h,
      isDecor: true, houseSprite: sprite, houseSpriteName: name || null,
      door: { x: x, y: y + side / 2 }
    };
    return b;
  };
  // Poteau de torche : petit decor interactif pose pres des villes/villages.
  // isDecor le rend non cliquable par le flux batiment standard, le clic est
  // gere par un bloc dedie dans input.js (rayon de portee + equip torche).
  // L'emprise au sol est TORCHE_SIDE (pas la largeur du PNG) pour rester un
  // petit obstacle coherent quelle que soit la taille du PNG depose.
  G.makeTorche = function (x, y) {
    var sp = (G.SPRITES && G.SPRITES.torche && G.SPRITES.torche.idle) || null;
    var side = G.TORCHE_SIDE || 24;
    return {
      x: x - side / 2, y: y - side / 2, w: side, h: side,
      name: "Poteau de torche", msg: "", height: sp ? sp.h : 48,
      isDecor: true, isTorche: true,
      torcheSprite: sp, door: { x: x, y: y + side / 2 }
    };
  };
  // Tente de poser un poteau de torche a (x, y) : evite batiments, murs,
  // forets et villes PNG. Retourne true si pose.
  G.placeTorche = function (x, y) {
    var state = G.state;
    var side = G.TORCHE_SIDE || 24;
    var half = side / 2;
    if (x < half + 20 || x > G.WORLD - half - 20 || y < half + 20 || y > G.WORLD - half - 20) return false;
    if (G.nearBuilding && G.nearBuilding(x, y, 12)) return false;
    if (G.villeBoxHits && G.villeBoxHits(x - half, y - half, side, side)) return false;
    if (!G.villeBoxHits && G.villeAt && G.villeAt(x, y, 0)) return false;
    if (G.aabbHitsWalls && G.aabbHitsWalls(x - half, y - half, side, side, true)) return false;
    for (var i = 0; i < state.buildings.length; i++) {
      var ob = state.buildings[i];
      if (x - half < ob.x + ob.w + 2 && x + half > ob.x - 2 &&
          y - half < ob.y + ob.h + 2 && y + half > ob.y - 2) return false;
    }
    state.buildings.push(G.makeTorche(x, y));
    return true;
  };
  // Pose un poteau de torche a proximite d'un point (ville, village) :
  // cherche une position libre autour de (cx, cy) en s'ecartant
  // progressivement (anneaux de 40 px, 16 angles par anneau). r0 = rayon de
  // depart (par defaut 40) : pour les grandes villes PNG (Minas : cote 1334,
  // bbox VISUELLE ~2000 px du centre), il faut commencer HORS de cette bbox
  // sinon tous les premiers anneaux sont rejetes par villeBoxHits.
  G.placeTorcheNear = function (cx, cy, r0) {
    var start = r0 || 40;
    for (var ring = 0; ring < 30; ring++) {
      var r = start + ring * 40;
      for (var a = 0; a < 16; a++) {
        var ang = a * Math.PI / 8;
        var tx = cx + Math.cos(ang) * r;
        var ty = cy + Math.sin(ang) * r;
        if (G.placeTorche(tx, ty)) return true;
      }
    }
    return false;
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
      // Mairie 1.4x plus grande que l'emprise brute du PNG ; les autres
      // batiments (eglise, generic) gardent le facteur standard x2.
      var scale = b.isMairie ? (G.MAIRIE_SCALE || 1.4) : 1;
      var side = sp.w * 2 * scale;
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

  // Élément de décor PNG (assets/sprites/elementdecord/) : objet de type
  // bâtiment isDecor, exactement comme une forêt/maison.
  //   mode "bloquant"    : collision normale (AABB zone opaque, shrinkToOpaque).
  //   mode "nonbloquant" : decorPassable -> ignoré par aabbHitsBuildings
  //                        (le joueur circule par-dessus), trié normalement.
  //   mode "dessous"     : decorPassable ET decorSous -> le joueur passe SOUS
  //                        la texture : dessiné après le joueur (depth max).
  // Le PNG donne la taille (largeur * 2), comme pour les maisons/forêts.
  G.makeDecor = function (x, y, frame, mode) {
    var sp = (G.SPRITES && G.SPRITES.elementdecord && G.SPRITES.elementdecord[frame]) || null;
    var side = sp ? sp.w * 2 : 96;
    var b = {
      x: x - side / 2, y: y - side / 2, w: side, h: side,
      name: "Décor", msg: "", height: sp ? sp.h : 64,
      isDecor: true, decorSpriteName: frame,
      door: { x: x, y: y + side / 2 }
    };
    if (mode === "bloquant") {
      if (sp) shrinkToOpaque(b, "elementdecord", frame);
    } else {
      b.decorPassable = true;
      if (mode === "dessous") b.decorSous = true;
    }
    return b;
  };
  // Table de génération des éléments de décor : [dossier/nom PNG, mode, nombre].
  // bloquant = collision ; nonbloquant = traversable, trié par profondeur ;
  // dessous = traversable, le joueur passe sous la texture (éolienne, cerf).
  // Exposée sur G : src/assets.js s'en sert pour charger les PNG clients.
  G.DECOR_SPECS = [
    ["Dessous/eolienne", "dessous", 18],
    ["Dessous/certgeant", "dessous", 2],
    ["bloquant/montagne", "bloquant", 4],
    ["bloquant/moulin", "bloquant", 32],
    ["bloquant/poulailler", "bloquant", 10],
    ["bloquant/Sprite-0133", "bloquant", 4],
    ["bloquant/Abord rémalard-2", "bloquant", 4],
    ["bloquant/Abord rémalard-3", "bloquant", 16],
    ["bloquant/citerne", "bloquant", 30],
    ["bloquant/eglise brevedent", "bloquant", 4],
    ["bloquant/fermepomme", "bloquant", 8],
    ["bloquant/LE BOULAY", "bloquant", 2],
    ["bloquant/Lisieux- eglise saint jacque", "bloquant", 4],
    ["bloquant/deuxmaison", "bloquant", 2],
    ["bloquant/maison de la serre", "bloquant", 2],
    ["nonbloquant/buisson1", "nonbloquant", 90],
    ["nonbloquant/buisson2", "nonbloquant", 90],
    ["nonbloquant/Totoro", "nonbloquant", 4],
    ["nonbloquant/Sprite-0120", "nonbloquant", 6],
    ["nonbloquant/herbebotte", "nonbloquant", 36],
    ["nonbloquant/cinema", "nonbloquant", 2],
    ["nonbloquant/CIMETIERE", "nonbloquant", 2],
    ["nonbloquant/LE BOULAY", "nonbloquant", 2],
    ["nonbloquant/Panneaux solaires", "nonbloquant", 2],
    // Champs (tous les PNG champ/CHAMP) : chacun au moins 10 fois.
    ["nonbloquant/champ", "nonbloquant", 18],
    ["nonbloquant/champ2", "nonbloquant", 18],
    ["nonbloquant/champ3", "nonbloquant", 18],
    ["nonbloquant/champ4", "nonbloquant", 18],
    ["nonbloquant/champ5", "nonbloquant", 18],
    ["nonbloquant/champ6", "nonbloquant", 18],
    ["nonbloquant/champ7", "nonbloquant", 18],
    ["nonbloquant/champ8", "nonbloquant", 18],
    ["nonbloquant/champ9", "nonbloquant", 18],
    ["nonbloquant/champ10", "nonbloquant", 18],
    ["nonbloquant/champ11", "nonbloquant", 18],
    ["nonbloquant/champ12", "nonbloquant", 18],
    ["nonbloquant/champ13", "nonbloquant", 18],
    ["nonbloquant/champ14", "nonbloquant", 18],
    ["nonbloquant/champ15", "nonbloquant", 18],
    ["nonbloquant/champ16", "nonbloquant", 18],
    ["nonbloquant/CHAMP BLE", "nonbloquant", 18],
    ["nonbloquant/CHAMP BLE 2", "nonbloquant", 18],
    ["nonbloquant/CHAMP BLE E", "nonbloquant", 18],
    ["nonbloquant/CHAMP FOIN", "nonbloquant", 18],
    ["nonbloquant/CHAMP VACHE", "nonbloquant", 18]
  ];
  // Boîte (x, y, w, h) chevauche-t-elle un bâtiment existant (avec marge px) ?
  function decorBoxHitsBuildings(state, bx, by, bw, bh, pad) {
    for (var i = 0; i < state.buildings.length; i++) {
      var ob = state.buildings[i];
      if (bx < ob.x + ob.w + pad && bx + bw > ob.x - pad &&
          by < ob.y + ob.h + pad && by + bh > ob.y - pad) return true;
    }
    return false;
  }
  // Pose tous les éléments de décor, hors de la ville (campagne), en évitant
  // bâtiments, forêts, villes PNG et palissades. Tolérant : si les sprites du
  // dossier elementdecord sont absents, rien n'est posé (comme les maisons).
  G.spawnDecor = function (state) {
    if (!G.SPRITES || !G.SPRITES.elementdecord) return;
    // Marge autour de la ville : les décors restent en campagne.
    var townPad = 160;
    // Emprise VISUELLE d'un décor (rectangle écran à zoom 1) : la texture
    // PNG est ancrée bas-centre sur le coin sud du losange et déborde vers
    // le nord de sa hauteur (drawBuilding : dh = dw * h/w). Deux décors dont
    // les AABB au sol ne se touchent pas peuvent quand même se recouvrir
    // visuellement (moulin vs champ, éolienne vs buisson...). Le placement
    // interdit tout chevauchement de ces rectangles entre décors.
    function decorVisRect(bx, by, side, sp) {
      var dw = side;
      var dh = dw * (sp ? sp.h / sp.w : 1);
      var cx = (bx - by) / 2;
      var groundY = (bx + by) / 4 + side / 2;
      return { x0: cx - dw / 2, x1: cx + dw / 2, y0: groundY - dh, y1: groundY };
    }
    function visRectsHit(a, b) {
      return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    }
    var visRects = [];
    for (var si = 0; si < G.DECOR_SPECS.length; si++) {
      var frame = G.DECOR_SPECS[si][0], mode = G.DECOR_SPECS[si][1], total = G.DECOR_SPECS[si][2];
      var sp = G.SPRITES.elementdecord[frame];
      if (!sp) continue;
      var side = sp.w * 2;
      var placed = 0, guard = 0;
      // Garde plus large pour les gros éléments (l'église du Lisieux fait
      // 800 px : trouver une place libre demande plus d'essais).
      var maxGuard = total * (200 + side * 2) + 1600;
      while (placed < total && guard < maxGuard) {
        guard++;
        // Position hors ville : un axe proche du bord aléatoire, l'autre libre.
        // Les très gros éléments (église 1600 px de côté) passent presque
        // toujours ce filtre : échantillonnage uniforme sur toute la carte
        // hors rectangle de ville, sinon la bande proche de la ville gaspille
        // des essais sur une carte dense en forêts.
        var big = side > 800;
        var gx, gy;
        if (big) {
          gx = G.rand(80, G.WORLD - 80);
          gy = G.rand(80, G.WORLD - 80);
          var inTownRect = gx > G.TOWN_MIN - townPad - side / 2 && gx < G.TOWN_MAX + townPad + side / 2 &&
                           gy > G.TOWN_MIN - townPad - side / 2 && gy < G.TOWN_MAX + townPad + side / 2;
          if (inTownRect) continue;
        } else if (Math.random() < 0.5) {
          gx = Math.random() < 0.5 ? G.rand(80, G.TOWN_MIN - townPad) : G.rand(G.TOWN_MAX + townPad, G.WORLD - 80);
          gy = G.rand(80, G.WORLD - 80);
        } else {
          gx = G.rand(80, G.WORLD - 80);
          gy = Math.random() < 0.5 ? G.rand(80, G.TOWN_MIN - townPad) : G.rand(G.TOWN_MAX + townPad, G.WORLD - 80);
        }
        var bx = gx - side / 2, by = gy - side / 2;
        if (bx < 60 || by < 60 || bx + side > G.WORLD - 60 || by + side > G.WORLD - 60) continue;
        // Villes PNG : emprise visuelle interdite.
        if (G.villeBoxHits && G.villeBoxHits(bx, by, side, side)) continue;
        if (!G.villeBoxHits && G.villeAt && G.villeAt(gx, gy, side / 2)) continue;
        // Écart avec les bâtiments/forêts : plus grand pour les bloquants.
        var pad = mode === "bloquant" ? 6 : 2;
        if (decorBoxHitsBuildings(state, bx, by, side, side, pad)) continue;
        // Bloquants : pas non plus sur la palissade ni près de la muraille.
        if (mode === "bloquant" && G.aabbHitsWalls &&
            G.aabbHitsWalls(bx, by, side, side, true)) continue;
        // Chevauchement visuel avec les décors déjà posés : interdit.
        var candRect = decorVisRect(bx, by, side, sp);
        var hitsVis = false;
        for (var vr = 0; vr < visRects.length; vr++) {
          if (visRectsHit(candRect, visRects[vr])) { hitsVis = true; break; }
        }
        if (hitsVis) continue;
        visRects.push(candRect);
        state.buildings.push(G.makeDecor(gx, gy, frame, mode));
        placed++;
      }
    }
  };
  G.nearBuilding = function (x, y, pad) {
    for (var i = 0; i < G.state.buildings.length; i++) {
      var b = G.state.buildings[i];
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
    }
    return false;
  };

  // Crée une forêt : objet de type bâtiment (isForet, isDecor, isChoppable)
  // avec EXACTEMENT la même logique de collision qu'un bâtiment : emprise sol
  // = largeur du PNG * 2 (ancré bas-centre), réduite à la zone opaque réelle
  // du PNG via shrinkToOpaque. Le rendu et la collision partagent la même
  // boîte : drawBuilding dessine le sprite sur (b.x, b.y, b.w, b.h) ancré
  // bas-centre, comme pour la mairie/eglise/maison. Repli 128 sans sprite (serveur).
  G.makeForet = function (x, y, frame) {
    var sp = G.SPRITES.foret && G.SPRITES.foret[frame];
    var stage0 = G.SPRITES.foret && G.SPRITES.foret[frame + "s0"];
    var ref = stage0 || sp;
    var side = ref ? ref.w * 2 : 128;
    var b = {
      x: x - side / 2, y: y - side / 2, w: side, h: side,
      name: "Forêt", msg: "", height: ref ? ref.h : 80,
      isForet: true, isDecor: true, isChoppable: true,
      hp: 2, maxHp: 2, foretFrame: frame, foretStage: 0,
      door: { x: x, y: y + side / 2 }
    };
    if (ref) shrinkToOpaque(b, "foret", stage0 ? frame + "s0" : frame);
    return b;
  };

  // Recalcule l'emprise de collision d'une forêt selon l'état de coupe courant
  // (foretStage) : le sprite d'affichage change de taille entre s0 et s4, donc
  // la zone opaque (shrinkToOpaque) doit être recalculée pour que rendu et
  // collision restent alignés à chaque état. Reconstruit le centre du losange
  // complet (side = sprite de l'état * 2) puis applique shrinkToOpaque sur le
  // sprite de cet état. Préserve le centre monde (x + w/2, y + h/2).
  G.refitForet = function (b) {
    if (!b || !b.isForet) return;
    var frame = b.foretFrame;
    if (!frame) return;
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var stage = b.foretStage || 0;
    var key = G.foretStageFrame(frame, stage);
    var sp = key && G.hasSprite("foret", key) ? G.SPRITES.foret[key] : (G.SPRITES.foret && G.SPRITES.foret[frame]);
    if (!sp) return;
    var side = sp.w * 2;
    b.w = side; b.h = side;
    b.x = cx - side / 2; b.y = cy - side / 2;
    b.height = sp.h;
    shrinkToOpaque(b, "foret", key && G.hasSprite("foret", key) ? key : frame);
  };

  // Nom du sprite selon l'état de coupe : "<base>s<stage>" si disponible,
  // sinon repli sur le sprite de base. Le stage 0 = forêt pleine.
  G.foretStageFrame = function (foretFrame, stage) {
    if (foretFrame == null) return null;
    var key = foretFrame + "s" + stage;
    if (G.hasSprite("foret", key)) return key;
    return foretFrame;
  };

  // Vrai si la forêt est à l'état final (entièrement coupée) : non récoltable
  // et traversable.
  G.foretDepleted = function (b) {
    return !!(b && b.isForet && (b.foretStage || 0) >= (G.FORET_STAGES - 1));
  };

  // Régénération quotidienne : chaque forêt remonte d'un état de coupe vers
  // s0. À appeler au passage de minuit (changement de jour). Reconstruit la
  // grille de collision si une forêt épuisée repousse (redevient bloquante).
  G.regenForets = function () {
    var state = G.state;
    if (!state || !state.buildings) return;
    var regrowSolid = false;
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (!b.isForet) continue;
      if ((b.foretStage || 0) > 0) {
        b.foretStage = (b.foretStage || 0) - 1;
        if (G.refitForet) G.refitForet(b);
        if ((b.foretStage || 0) < (G.FORET_STAGES - 1)) regrowSolid = true;
      }
    }
    if (regrowSolid && G.rebuildBuildingGrid) G.rebuildBuildingGrid();
    if (regrowSolid && G.ensureForetConnectivity) G.ensureForetConnectivity();
  };

  // Repopulation nocturne des reliques : RELIQUES_PER_NIGHT nouvelles reliques
  // apparaissent hors de la ville a chaque nouveau jour (elles restent
  // ramassables tant que personne ne les prend). Evite les batiments pour ne
  // pas apparaitre dans une maison/foret.
  G.spawnNightReliques = function () {
    var state = G.state;
    if (!state || !state.items) return;
    for (var i = 0; i < G.RELIQUES_PER_NIGHT; i++) {
      var rx, ry, tries = 0;
      do {
        rx = Math.random() < 0.5 ? G.rand(60, G.TOWN_MIN - 80) : G.rand(G.TOWN_MAX + 80, G.WORLD - 60);
        ry = Math.random() < 0.5 ? G.rand(60, G.TOWN_MIN - 80) : G.rand(G.TOWN_MAX + 80, G.WORLD - 60);
      } while ((G.nearBuilding(rx, ry, 40) || (G.villeAt && G.villeAt(rx, ry, 0))) && ++tries < 20);
      state.items.push({ x: rx, y: ry, taken: false, name: "Relique", color: "#a855f7", kind: "objet" });
    }
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
    if (G.rebuildNavGrid) G.rebuildNavGrid();
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
          if (G.foretDepleted(b)) continue;
          if (x + half > b.x && x - half < b.x + b.w &&
              y + half > b.y && y - half < b.y + b.h) return true;
        }
      }
    }
    return false;
  };

  // Renvoie la foret (batiment isForet non epuisee) dont l'AABB contient le
  // point (x, y), ou null. Sert a extraire les zombies pris a l'interieur
  // d'un massif : la collision traite une foret comme un bloc plein, donc
  // aucune position interieure n'est valide et il faut marcher vers le bord.
  G.foretAt = function (x, y) {
    var grid = G.buildingGrid;
    if (!grid) return null;
    var cell = G.BUILDING_CELL;
    var cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    var arr = grid[cx + "," + cy];
    if (!arr) return null;
    for (var n = 0; n < arr.length; n++) {
      var b = arr[n];
      if (!b.isForet) continue;
      if (G.foretDepleted(b)) continue;
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
    }
    return null;
  };

  // Bbox VISUELLE monde d'une foret : le sprite PNG (ancré bas-centre sur le
  // bord sud de l'emprise, hauteur dessinée = losW * h/w) déborde vers le
  // NORD de son AABB au sol quand h/w > 1/2 (ex. foret1 : 52x37). Projeter
  // les 4 coins du PNG (zoom 1, cf. ville.js/villeSetup) donne la vraie zone
  // couverte à l'écran : c'est ELLE qui doit éviter les villes, sinon le
  // feuillage se dessine par-dessus le PNG de la ville.
  G.foretVisualBox = function (b) {
    var sp = G.SPRITES.foret && G.SPRITES.foret[b.foretFrame + "s" + (b.foretStage || 0)];
    if (!sp && G.SPRITES.foret) sp = G.SPRITES.foret[b.foretFrame];
    var iw = sp ? sp.w : 0, ih = sp ? sp.h : 0;
    if (!iw || !ih) return { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
    var losW = (b.w + b.h) / 2;
    var cx0 = (b.x - b.y) / 2;
    var groundY0 = (b.x + b.y + b.w + b.h) / 2 / 2;
    var drawnH = losW * ih / iw;
    var xs = [], ys = [];
    for (var ci = 0; ci < 4; ci++) {
      var px = (ci % 2) * iw, py = (ci < 2 ? 0 : ih);
      var sx = cx0 - losW / 2 + (px / iw) * losW;
      var sy = groundY0 - drawnH + (py / ih) * drawnH;
      xs.push(sx + 2 * sy);
      ys.push(2 * sy - sx);
    }
    return {
      x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs),
      y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys)
    };
  };

  // Vrai si la boîte monde (bx, by, bw, bh) touche l'anneau de palissades du
  // perimètre de la ville, avec la marge G.FORET_WALL_GAP de chaque cote :
  // les forets de l'init ne doivent pas coller aux murs. L'anneau est un
  // rectangle creux (bande autour de TOWN_MIN..TOWN_MAX), pas un rectangle
  // plein : une foret au centre de la ville reste valide.
  G.foretNearTownWall = function (bx, by, bw, bh) {
    var m = G.FORET_WALL_GAP || 0;
    if (bx - m > G.TOWN_MAX || bx + bw + m < G.TOWN_MIN) return false;
    if (by - m > G.TOWN_MAX || by + bh + m < G.TOWN_MIN) return false;
    // Intersection avec le rectangle plein : si la boite est entierement a
    // l'interieur (marge comprise), elle ne touche aucun des 4 murs.
    if (bx - m >= G.TOWN_MIN && bx + bw + m <= G.TOWN_MAX &&
        by - m >= G.TOWN_MIN && by + bh + m <= G.TOWN_MAX) return false;
    return true;
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
      // Le batiment est enregistre dans TOUTES les cellules qu il couvre
      // (un decor de 484 px s etend sur plusieurs cellules de 200 px : une
      // seule cellule d origine laissait les forets se glisser dedans).
      var cx0 = Math.floor(ob0.x / cell), cx1 = Math.floor((ob0.x + ob0.w) / cell);
      var cy0 = Math.floor(ob0.y / cell), cy1 = Math.floor((ob0.y + ob0.h) / cell);
      for (var gx0 = cx0; gx0 <= cx1; gx0++) {
        for (var gy0 = cy0; gy0 <= cy1; gy0++) {
          var k0 = gx0 + "," + gy0;
          if (!grid[k0]) grid[k0] = [];
          grid[k0].push(ob0);
        }
      }
    }
    // Vrai si la boîte (tx, ty, half) touche la palissade de perimetre (avec
    // la marge G.FORET_WALL_GAP) : les forets ne doivent pas coller aux murs.
    function nearTownWall(tx, ty, half) {
      return G.foretNearTownWall(tx - half, ty - half, half * 2, half * 2);
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
            if (tx + half > o.x - 6 && tx - half < o.x + o.w + 6 &&
                ty + half > o.y - 6 && ty - half < o.y + o.h + 6) return true;
          }
        }
      }
      return false;
    }
    function addForet(tx, ty, frame) {
      var f = G.makeForet(tx, ty, frame);
      var ax0 = Math.floor(f.x / cell), ax1 = Math.floor((f.x + f.w) / cell);
      var ay0 = Math.floor(f.y / cell), ay1 = Math.floor((f.y + f.h) / cell);
      for (var gx0 = ax0; gx0 <= ax1; gx0++) {
        for (var gy0 = ay0; gy0 <= ay1; gy0++) {
          var key = gx0 + "," + gy0;
          if (!grid[key]) grid[key] = [];
          grid[key].push(f);
        }
      }
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
        if (nearTownWall(tx, ty, half)) continue;
        // Villes PNG : aucune foret dont la bbox VISUELLE (le sprite deborde
        // vers le nord de son AABB au sol) touche la bbox visuelle d'une
        // ville decorative. L'ancien test AABB-sol laissait le feuillage se
        // dessiner par-dessus le PNG de la ville.
        var cand = G.makeForet(tx, ty, frame);
        var vbox = G.foretVisualBox(cand);
        if (G.villeBoxHits && G.villeBoxHits(vbox.x0, vbox.y0, vbox.x1 - vbox.x0, vbox.y1 - vbox.y0)) continue;
        if (!G.villeBoxHits && G.villeAt && G.villeAt(tx, ty, half)) continue;
        if (nearForet(tx, ty, half)) continue;
        addForet(tx, ty, frame);
        placed++;
      }
    }
  };

  G.buildPerimeterWall = function () {
    var state = G.state;
    state.walls = [];
    G.rebuildWallGrid();
    // Perimetre = barricades (memes objets que celles du joueur : built:true, bloquent joueur+zombies).
    // Dimensions identiques aux planches du joueur : meme apparence et taille visuelle.
    var wd = G.wallSpriteDims();
    var seg = wd.longW;
    var thick = wd.thick;
    var pad = 6;
    function addWall(w) { state.walls.push(w); G.indexWall(w); }
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
    // Villes decoratives PNG : posees en premier pour que la generation
    // (maisons, forets, objets) les evite (villeAt) et que les grilles de
    // collision soient pretes avant tout placement.
    if (G.villeSetup) G.villeSetup(state);
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
        // Villes PNG : aucune maison dans la bbox VISUELLE d'une ville
        // decorative (boite-contre-boite, pas juste le centre).
        if (G.villeBoxHits && G.villeBoxHits(hx - side / 2, hy - side / 2, side, side)) return false;
        if (!G.villeBoxHits && G.villeAt && G.villeAt(hx, hy, side / 2)) return false;
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
        var h = G.makeHouse(hx, hy, sp, frame);
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
        // Garde : si la premiere maison n'a pas pu etre posee (zone occupee
        // par une foret/village voisin), le village est abandonne —
        // placeAdjacent sur une liste vide ferait crash (anchor undefined).
        var vCount = G.randi(5, 8);
        if (vHouses.length > 0) {
          for (var vc = 1; vc < vCount; vc++) {
            if (placeAdjacent(vHouses, false)) vHouses.push(state.buildings[state.buildings.length - 1]);
          }
          // Un poteau de torche par village : pose a proximite du centre du
          // regroupement de maisons (anneaux progressifs autour du centroide).
          var vcx = 0, vcy = 0;
          for (var vh = 0; vh < vHouses.length; vh++) {
            vcx += vHouses[vh].x + vHouses[vh].w / 2;
            vcy += vHouses[vh].y + vHouses[vh].h / 2;
          }
          G.placeTorcheNear(vcx / vHouses.length, vcy / vHouses.length);
        }
      }
    }
    // Poteaux de torche : un pres de chaque ville decorative PNG + un pres
    // de la porte nord de la ville principale (Ville de l'Est), quelle que
    // soit la disponibilite des sprites de maison.
    var villesPng = state.villes || [];
    for (var vt = 0; vt < villesPng.length; vt++) {
      var vv = villesPng[vt];
      // Rayon de depart : hors de la bbox VISUELLE du PNG (le feuillage
      // deborde loin de l'emprise au sol, cf. villeSetup vx0..vy1).
      var rv = 40;
      if (vv.vx0 !== undefined) {
        rv = Math.max(vv.vx1 - vv.vx0, vv.vy1 - vv.vy0) / 2 + 80;
      }
      G.placeTorcheNear(vv.x + vv.w / 2, vv.y + vv.h / 2, rv);
    }
    G.placeTorcheNear(G.TOWN_MIN + G.TOWN / 2, G.TOWN_MIN);
    state.items = [
      // Équipement de départ en ville.
      { x: c - 60, y: c - 40, taken: false, name: "Pistolet", color: "#94a3b8", kind: "arme" },
      { x: c + 60, y: c - 40, taken: false, name: "Hache", color: "#b45309", kind: "outil" },
      { x: c + 180, y: c - 40, taken: false, name: "Lance-flammes", color: "#fb923c", kind: "arme" },
      { x: c - 80, y: c + 20, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c + 90, y: c - 60, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c - 200, y: c - 180, taken: false, name: "Potion", color: "#ef4444", kind: "objet" },
      { x: c + 40, y: c + 240, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c - 320, y: c + 80, taken: false, name: "Gemme", color: "#22d3ee", kind: "objet" },
      { x: c + 340, y: c - 140, taken: false, name: "Parchemin", color: "#fde68a", kind: "objet" },
      { x: c - 120, y: c - 260, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c + 220, y: c + 120, taken: false, name: "Clé", color: "#eab308", kind: "objet" },
      { x: c - 260, y: c - 100, taken: false, name: "Nourriture", color: "#f59e0b", kind: "objet" },
      { x: c + 150, y: c + 180, taken: false, name: "Nourriture", color: "#f59e0b", kind: "objet" },
      { x: c - 360, y: c + 220, taken: false, name: "Nourriture", color: "#f59e0b", kind: "objet" },
      { x: G.TOWN_MIN - 520, y: c + 240, taken: false, name: "Nourriture", color: "#f59e0b", kind: "objet" },
      { x: G.TOWN_MAX + 620, y: c - 280, taken: false, name: "Nourriture", color: "#f59e0b", kind: "objet" },
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
      { x: G.TOWN_MIN - 2600, y: G.TOWN_MAX + 700, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: G.TOWN_MIN - 3400, y: G.TOWN_MIN - 2200, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: G.TOWN_MAX + 3200, y: G.TOWN_MIN - 2400, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: c + 3000, y: G.TOWN_MAX + 3400, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: c - 3400, y: G.TOWN_MAX + 3000, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: c - 100, y: c + 330, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: G.TOWN_MAX + 2200, y: G.TOWN_MIN - 600, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: c - 800, y: G.TOWN_MAX + 2600, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: G.TOWN_MAX + 600, y: G.TOWN_MAX + 2400, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: G.TOWN_MAX + 1400, y: G.TOWN_MAX + 1000, taken: false, name: "Cristal", color: "#38bdf8", kind: "objet" },
      { x: c + 1800, y: c - 2400, taken: false, name: "Potion", color: "#ef4444", kind: "objet" },
      // Haches : disponibles uniquement en dehors de la ville.
      { x: G.TOWN_MIN - 700, y: c + 360, taken: false, name: "Hache", color: "#b45309", kind: "outil" },
      { x: G.TOWN_MAX + 840, y: c - 440, taken: false, name: "Hache", color: "#b45309", kind: "outil" },
      { x: c - 1400, y: G.TOWN_MAX + 1200, taken: false, name: "Hache", color: "#b45309", kind: "outil" }
];

    // Pièces d'or initiales : GOLD_ITEMS_START pièces pré-posées hors ville
    // (récolte → coffre de la mairie), éloignées des bâtiments.
    for (var gi = 0; gi < G.GOLD_ITEMS_START; gi++) {
      var gx, gy, tries = 0;
      do {
        gx = Math.random() < 0.5 ? G.rand(60, G.TOWN_MIN - 80) : G.rand(G.TOWN_MAX + 80, G.WORLD - 60);
        gy = Math.random() < 0.5 ? G.rand(60, G.TOWN_MIN - 80) : G.rand(G.TOWN_MAX + 80, G.WORLD - 60);
      } while ((G.nearBuilding(gx, gy, 40) || (G.villeAt && G.villeAt(gx, gy, 0))) && ++tries < 20);
      state.items.push({ x: gx, y: gy, taken: false, name: "Pièce", color: "#fbbf24", kind: "or" });
    }

    // Forêts : mêmes règles de distribution que l'ancien système d'arbres
    // (clusters de 1 à 10, ~5 en ville, 2400 hors ville, 5 en lisière), mais
    // comme bâtiments (isForet) avec collision identique aux bâtiments.

    // Lisière : quelques forêts juste autour des murs (4 côtés).
    var names = G.foretNames();
    for (var fi = 0; fi < 5 && names.length > 0; fi++) {
      var fs = G.randi(0, 3);
      var ftx, fty;
      if (fs === 0) { ftx = G.rand(G.TOWN_MIN, G.TOWN_MAX); fty = G.rand(G.TOWN_MIN - 280, G.TOWN_MIN - 20); }
      else if (fs === 1) { ftx = G.rand(G.TOWN_MIN, G.TOWN_MAX); fty = G.rand(G.TOWN_MAX + 20, G.TOWN_MAX + 280); }
      else if (fs === 2) { ftx = G.rand(G.TOWN_MIN - 280, G.TOWN_MIN - 20); fty = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      else { ftx = G.rand(G.TOWN_MAX + 20, G.TOWN_MAX + 280); fty = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      var fFrame = names[G.randi(0, names.length - 1)];
      var fSp = G.SPRITES.foret && G.SPRITES.foret[fFrame];
      var fSide = (fSp ? fSp.w : 64) * 2;
      if (!G.nearBuilding(ftx, fty, 10) &&
          (function () {
            var fb2 = G.makeForet(ftx, fty, fFrame);
            return fb2.x < 60 || fb2.y < 60 || fb2.x + fb2.w > G.WORLD - 60 ||
                   fb2.y + fb2.h > G.WORLD - 60 || G.nearBuilding(ftx, fty, fb2.w / 2 + 8);
          })() === false &&
          !(G.villeBoxHits && (function () {
            var fc = G.makeForet(ftx, fty, fFrame);
            var fb = G.foretVisualBox(fc);
            return G.villeBoxHits(fb.x0, fb.y0, fb.x1 - fb.x0, fb.y1 - fb.y0);
          })()) &&
          !(G.villeAt && G.villeAt(ftx, fty, fSide / 2)) &&
          !G.foretNearTownWall(ftx - fSide / 2, fty - fSide / 2, fSide, fSide)) {
        state.buildings.push(G.makeForet(ftx, fty, fFrame));
      }
    }

    // Éléments de décor PNG (moulins, églises, champs, buissons...) : posés
    // AVANT les forêts (primeauté sur l espace libre pour les gros bloquants),
    // avant la grille de collisions.
    G.spawnDecor(state);
    G.spawnForets(state, 5, true);
    G.spawnForets(state, 3600, false);
    state.zombies = [];
    G.rebuildBuildingGrid();
    // L'Anneau Unique : pose sur la tache #5a944a la plus au nord du PNG de
    // Minas, apres toute la generation (jamais deplace, position constante).
    if (G.placeAnneauUnique) G.placeAnneauUnique(state);
    // Camp romain : les 50 legionnaires patrouillent autour, et le glaive
    // d'or est pose au milieu du camp (vendable 500 or a l'eglise).
    if (G.spawnSoldats) G.spawnSoldats(state);
    if (G.placeGlaiveOr) G.placeGlaiveOr(state);
    // La generation aleatoire des forets peut refermer des enclaves : retire
    // les massifs qui enferment des poches inaccessibles, pour que chaque
    // point de spawn hors ville garde un chemin vers la palissade.
    if (G.ensureForetConnectivity) G.ensureForetConnectivity();
    // Le lance-flammes de depart etait pose a une position FIXE (c+180, c-40)
    // qui tombait parfois DANS une foret/maison de la ville aleatoire : il
    // etait invisible sous le sprite et impossible a ramasser. On le deplace
    // au premier emplacement libre autour de sa cible (spirale), APRES la
    // pose des forets qui est la derniere a remplir la ville. 40 px d'ecart
    // minimum avec les autres items (la hache est a c+60, c-40).
    var lfItem = null;
    for (var lfi = 0; lfi < state.items.length; lfi++) {
      if (state.items[lfi].name === "Lance-flammes") { lfItem = state.items[lfi]; break; }
    }
    if (lfItem) {
      var placedLf = false;
      for (var lfr = 0; lfr <= 400 && !placedLf; lfr += 40) {
        for (var lfa = 0; lfa < Math.PI * 2; lfa += Math.PI / 6) {
          var lfx = (c + 180) + Math.cos(lfa) * lfr;
          var lfy = (c - 40) + Math.sin(lfa) * lfr;
          if (G.nearBuilding(lfx, lfy, 25)) continue;
          var tooClose = false;
          for (var lfo = 0; lfo < state.items.length; lfo++) {
            var lo = state.items[lfo];
            if (lo === lfItem || lo.taken) continue;
            var lod = (lo.x - lfx) * (lo.x - lfx) + (lo.y - lfy) * (lo.y - lfy);
            if (lod < 40 * 40) { tooClose = true; break; }
          }
          if (!tooClose) {
            lfItem.x = lfx; lfItem.y = lfy;
            placedLf = true;
            break;
          }
        }
      }
    }
  };
})();

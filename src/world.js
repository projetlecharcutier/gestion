// Génération du monde : bâtiments, murs de périmètre, objets, arbres.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

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

  G.buildPerimeterWall = function () {
    var state = G.state;
    state.walls = [];
    var seg = 25;
    var pad = 6;
    var thick = 4;
    // Perimetre = barricades (memes objets que celles du joueur : built:true, bloquent joueur+zombies).
    for (var x = G.TOWN_MIN; x < G.TOWN_MAX; x += seg) {
      state.walls.push({ x: x, y: G.TOWN_MIN - pad, w: seg, h: thick, hp: G.WALL_MAX_HP, orient: "h", built: true });
    }
    for (var x = G.TOWN_MIN; x < G.TOWN_MAX; x += seg) {
      state.walls.push({ x: x, y: G.TOWN_MAX + pad - thick, w: seg, h: thick, hp: G.WALL_MAX_HP, orient: "h", built: true });
    }
    for (var y = G.TOWN_MIN; y < G.TOWN_MAX; y += seg) {
      state.walls.push({ x: G.TOWN_MIN - pad, y: y, w: thick, h: seg, hp: G.WALL_MAX_HP, orient: "v", built: true });
    }
    for (var y = G.TOWN_MIN; y < G.TOWN_MAX; y += seg) {
      state.walls.push({ x: G.TOWN_MAX + pad - thick, y: y, w: thick, h: seg, hp: G.WALL_MAX_HP, orient: "v", built: true });
    }
  };

  G.buildWorld = function () {
    var state = G.state;
    var c = G.WORLD / 2;
    state.buildings = [
      G.makeBuilding(c - 420, c - 420, 120, 120, "Mairie", "Vous êtes à la mairie. Tout semble calme.", 76),
      G.makeBuilding(c + 280, c - 400, 110, 110, "Auberge", "L'auberge sent la soupe chaude. Repos bien mérité.", 66),
      G.makeBuilding(c - 400, c + 260, 110, 110, "Forge", "La forge résonne du bruit de l'enclume.", 72),
      G.makeBuilding(c + 300, c + 280, 120, 100, "Marché", "Le marché grouille de marchandises.", 60),
      G.makeBuilding(c - 150, c + 320, 90, 90, "Temple", "Le temple est silencieux et frais.", 88),
      G.makeBuilding(c + 120, c - 300, 90, 110, "Tour", "La vue depuis la tour couvre toute la ville.", 120),
      G.makeBuilding(c - 380, c + 300, 120, 100, "Hôpital", "Hôpital : payez une pièce d'or pour retrouver toute votre vie.", 84)
    ];

    G.buildPerimeterWall();

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
      if (tries < 12) state.trees.push({ x: tx, y: ty, r: G.rand(14, 22), kind: "town", hp: 2 });
    }
    for (i = 0; i < 80; i++) {
      var edge = Math.random() < 0.5;
      if (edge) {
        tx = G.rand(0, G.WORLD);
        ty = Math.random() < 0.5 ? G.rand(0, G.TOWN_MIN - 40) : G.rand(G.TOWN_MAX + 40, G.WORLD);
      } else {
        tx = Math.random() < 0.5 ? G.rand(0, G.TOWN_MIN - 40) : G.rand(G.TOWN_MAX + 40, G.WORLD);
        ty = G.rand(0, G.WORLD);
      }
      state.trees.push({ x: tx, y: ty, r: G.rand(18, 36), kind: "wild", hp: 2 });
    }
    for (i = 0; i < 25; i++) {
      var side = G.randi(0, 3);
      if (side === 0) { tx = G.rand(G.TOWN_MIN, G.TOWN_MAX); ty = G.rand(G.TOWN_MIN - 280, G.TOWN_MIN - 20); }
      else if (side === 1) { tx = G.rand(G.TOWN_MIN, G.TOWN_MAX); ty = G.rand(G.TOWN_MAX + 20, G.TOWN_MAX + 280); }
      else if (side === 2) { tx = G.rand(G.TOWN_MIN - 280, G.TOWN_MIN - 20); ty = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      else { tx = G.rand(G.TOWN_MAX + 20, G.TOWN_MAX + 280); ty = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      state.trees.push({ x: tx, y: ty, r: G.rand(16, 28), kind: "edge", hp: 2 });
    }

    state.zombies = [];
  };
})();

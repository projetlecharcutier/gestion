// Génération du monde : bâtiments, murs de périmètre, objets, arbres.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.makeBuilding = function (x, y, w, h, name, msg, height) {
    return {
      x: x, y: y, w: w, h: h,
      name: name, msg: msg, height: height || 350,
      door: { x: x + w / 2, y: y + h }
    };
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
    var seg = 250;
    var pad = 60;
    for (var x = G.TOWN_MIN; x < G.TOWN_MAX; x += seg) {
      state.walls.push({ x: x, y: G.TOWN_MIN - pad, w: seg, h: 24, hp: G.WALL_MAX_HP, orient: "h" });
    }
    for (var x = G.TOWN_MIN; x < G.TOWN_MAX; x += seg) {
      state.walls.push({ x: x, y: G.TOWN_MAX + pad - 24, w: seg, h: 24, hp: G.WALL_MAX_HP, orient: "h" });
    }
    for (var y = G.TOWN_MIN; y < G.TOWN_MAX; y += seg) {
      state.walls.push({ x: G.TOWN_MIN - pad, y: y, w: 24, h: seg, hp: G.WALL_MAX_HP, orient: "v" });
    }
    for (var y = G.TOWN_MIN; y < G.TOWN_MAX; y += seg) {
      state.walls.push({ x: G.TOWN_MAX + pad - 24, y: y, w: 24, h: seg, hp: G.WALL_MAX_HP, orient: "v" });
    }
  };

  G.buildWorld = function () {
    var state = G.state;
    var c = 50000;
    state.buildings = [
      G.makeBuilding(c - 2100, c - 2100, 700, 700, "Mairie", "Vous êtes à la mairie. Tout semble calme.", 380),
      G.makeBuilding(c + 1400, c - 2000, 650, 650, "Auberge", "L'auberge sent la soupe chaude. Repos bien mérité.", 330),
      G.makeBuilding(c - 2000, c + 1300, 650, 650, "Forge", "La forge résonne du bruit de l'enclume.", 360),
      G.makeBuilding(c + 1500, c + 1400, 700, 600, "Marché", "Le marché grouille de marchandises.", 300),
      G.makeBuilding(c - 750, c + 1600, 550, 450, "Temple", "Le temple est silencieux et frais.", 440),
      G.makeBuilding(c + 600, c - 1500, 500, 550, "Tour", "La vue depuis la tour couvre toute la ville.", 600),
      G.makeBuilding(c - 1900, c + 1500, 600, 500, "Hôpital", "Hôpital : payez une pièce d'or pour retrouver toute votre vie.", 420)
    ];

    G.buildPerimeterWall();

    state.items = [
      { x: c - 400, y: c + 100, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c + 450, y: c - 300, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c - 1000, y: c - 900, taken: false, name: "Potion", color: "#ef4444", kind: "objet" },
      { x: c + 200, y: c + 1200, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c - 1600, y: c + 400, taken: false, name: "Gemme", color: "#22d3ee", kind: "objet" },
      { x: c + 1700, y: c - 700, taken: false, name: "Parchemin", color: "#fde68a", kind: "objet" },
      { x: c - 600, y: c - 1300, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c + 1100, y: c + 600, taken: false, name: "Clé", color: "#eab308", kind: "objet" },
      { x: G.TOWN_MIN - 2200, y: c + 300, taken: false, name: "Pistolet", color: "#94a3b8", kind: "arme" },
      { x: G.TOWN_MAX + 1800, y: c - 600, taken: false, name: "Couteau", color: "#cbd5e1", kind: "arme" },
      { x: c - 1100, y: G.TOWN_MAX + 1900, taken: false, name: "Bâton", color: "#7c5e3c", kind: "arme" },
      { x: c + 1200, y: G.TOWN_MIN - 2100, taken: false, name: "Arc", color: "#a16207", kind: "arme" },
      { x: G.TOWN_MIN - 6000, y: G.TOWN_MIN - 4000, taken: false, name: "Fusil", color: "#64748b", kind: "arme" },
      { x: G.TOWN_MAX + 7000, y: G.TOWN_MAX + 5000, taken: false, name: "Pistolet", color: "#94a3b8", kind: "arme" },
      { x: c, y: G.TOWN_MIN - 8000, taken: false, name: "Fusil", color: "#64748b", kind: "arme" },
      { x: c + 9000, y: c - 12000, taken: false, name: "Arc", color: "#a16207", kind: "arme" },
      { x: G.TOWN_MIN - 14000, y: c + 15000, taken: false, name: "Couteau", color: "#cbd5e1", kind: "arme" },
      { x: G.TOWN_MIN - 6000, y: G.TOWN_MIN - 4000, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: G.TOWN_MAX + 7000, y: G.TOWN_MAX + 5000, taken: false, name: "Cristal", color: "#38bdf8", kind: "objet" },
      { x: c + 9000, y: c - 12000, taken: false, name: "Potion", color: "#ef4444", kind: "objet" },
      // Haches : disponibles uniquement en dehors de la ville.
      { x: G.TOWN_MIN - 3500, y: c + 1800, taken: false, name: "Hache", color: "#b45309", kind: "outil" },
      { x: G.TOWN_MAX + 4200, y: c - 2200, taken: false, name: "Hache", color: "#b45309", kind: "outil" },
      { x: c - 7000, y: G.TOWN_MAX + 6000, taken: false, name: "Hache", color: "#b45309", kind: "outil" }
    ];

    state.trees = [];
    var i, tx, ty, tries;
    for (i = 0; i < 25; i++) {
      tries = 0;
      do {
        tx = G.rand(G.TOWN_MIN + 200, G.TOWN_MAX - 200);
        ty = G.rand(G.TOWN_MIN + 200, G.TOWN_MAX - 200);
        tries++;
      } while (G.nearBuilding(tx, ty, 150) && tries < 12);
      if (tries < 12) state.trees.push({ x: tx, y: ty, r: G.rand(70, 110), kind: "town", hp: 2 });
    }
    for (i = 0; i < 700; i++) {
      var edge = Math.random() < 0.5;
      if (edge) {
        tx = G.rand(0, G.WORLD);
        ty = Math.random() < 0.5 ? G.rand(0, G.TOWN_MIN - 200) : G.rand(G.TOWN_MAX + 200, G.WORLD);
      } else {
        tx = Math.random() < 0.5 ? G.rand(0, G.TOWN_MIN - 200) : G.rand(G.TOWN_MAX + 200, G.WORLD);
        ty = G.rand(0, G.WORLD);
      }
      state.trees.push({ x: tx, y: ty, r: G.rand(90, 180), kind: "wild", hp: 2 });
    }
    for (i = 0; i < 200; i++) {
      var side = G.randi(0, 3);
      if (side === 0) { tx = G.rand(G.TOWN_MIN, G.TOWN_MAX); ty = G.rand(G.TOWN_MIN - 1400, G.TOWN_MIN - 100); }
      else if (side === 1) { tx = G.rand(G.TOWN_MIN, G.TOWN_MAX); ty = G.rand(G.TOWN_MAX + 100, G.TOWN_MAX + 1400); }
      else if (side === 2) { tx = G.rand(G.TOWN_MIN - 1400, G.TOWN_MIN - 100); ty = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      else { tx = G.rand(G.TOWN_MAX + 100, G.TOWN_MAX + 1400); ty = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      state.trees.push({ x: tx, y: ty, r: G.rand(80, 140), kind: "edge", hp: 2 });
    }

    state.zombies = [];
  };
})();

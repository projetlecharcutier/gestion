// Oiseaux : volent en ligne droite, rebondissent à 90° sur les bords de la carte,
// ne sont bloqués par aucun objet, tués par les projectiles, droppent un objet aléatoire.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Spawn un oiseau avec une direction aléatoire (4 axes cardinaux).
  G.spawnBird = function () {
    var ang = G.randi(0, 3) * (Math.PI / 2); // 0, 90, 180, 270 deg
    var b = {
      x: G.rand(G.BIRD_HALF, G.WORLD - G.BIRD_HALF),
      y: G.rand(G.BIRD_HALF, G.WORLD - G.BIRD_HALF),
      vx: Math.cos(ang) * G.BIRD_SPEED,
      vy: Math.sin(ang) * G.BIRD_SPEED,
      hp: G.BIRD_HP,
      wing: 0
    };
    return b;
  };

  G.spawnBirds = function () {
    G.state.birds = [];
    for (var i = 0; i < G.BIRD_COUNT; i++) G.state.birds.push(G.spawnBird());
  };

  // Met à jour les oiseaux : déplacement, rebond 90° sur les bords, animation des ailes.
  G.updateBirds = function (dt) {
    var state = G.state;
    for (var i = 0; i < state.birds.length; i++) {
      var b = state.birds[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // Rebond 90° sur les bords de la carte : inverse un seul axe selon le bord touché.
      if (b.x < G.BIRD_HALF) {
        b.x = G.BIRD_HALF;
        if (b.vx < 0) b.vx = -b.vx;
      } else if (b.x > G.WORLD - G.BIRD_HALF) {
        b.x = G.WORLD - G.BIRD_HALF;
        if (b.vx > 0) b.vx = -b.vx;
      }
      if (b.y < G.BIRD_HALF) {
        b.y = G.BIRD_HALF;
        if (b.vy < 0) b.vy = -b.vy;
      } else if (b.y > G.WORLD - G.BIRD_HALF) {
        b.y = G.WORLD - G.BIRD_HALF;
        if (b.vy > 0) b.vy = -b.vy;
      }
      b.wing += dt * 12;
    }
  };

  // Dépose un objet aléatoire à la position d'un oiseau tué.
  G.birdDrop = function (x, y) {
    var drop = G.BIRD_DROPS[G.randi(0, G.BIRD_DROPS.length - 1)];
    G.state.items.push({
      x: x, y: y, taken: false,
      name: drop.name, color: drop.color, kind: drop.kind
    });
  };

  // Retire les oiseaux morts. Appelé depuis update().
  G.cleanupBirds = function () {
    var state = G.state;
    for (var i = state.birds.length - 1; i >= 0; i--) {
      if (state.birds[i].hp <= 0) state.birds.splice(i, 1);
    }
  };
})();

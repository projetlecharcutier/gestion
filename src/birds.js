// Oiseaux : volent en ligne droite, rebondissent à 90° sur les bords de la carte,
// ne sont bloqués par aucun objet, tués par les projectiles, droppent un objet aléatoire.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Spawn un oiseau avec une direction aléatoire (4 axes cardinaux).
  G.spawnBird = function () {
    // 4 directions diagonales (45, 135, 225, 315 deg) pour matcher les PNG dispo.
    var ang = G.randi(0, 3) * (Math.PI / 2) + Math.PI / 4;
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

  // Spawn un oiseau depuis un bord de la carte, se dirigeant vers l'interieur.
  G.spawnBirdFromEdge = function () {
    var side = G.randi(0, 3); // 0=haut, 1=bas, 2=gauche, 3=droite
    var x, y, ang;
    if (side === 0) {
      x = G.rand(G.BIRD_HALF, G.WORLD - G.BIRD_HALF); y = G.BIRD_HALF;
      ang = G.rand(Math.PI * 0.25, Math.PI * 0.75); // vers le bas
    } else if (side === 1) {
      x = G.rand(G.BIRD_HALF, G.WORLD - G.BIRD_HALF); y = G.WORLD - G.BIRD_HALF;
      ang = G.rand(-Math.PI * 0.75, -Math.PI * 0.25); // vers le haut
    } else if (side === 2) {
      x = G.BIRD_HALF; y = G.rand(G.BIRD_HALF, G.WORLD - G.BIRD_HALF);
      ang = G.rand(-Math.PI * 0.25, Math.PI * 0.25); // vers la droite
    } else {
      x = G.WORLD - G.BIRD_HALF; y = G.rand(G.BIRD_HALF, G.WORLD - G.BIRD_HALF);
      ang = G.rand(Math.PI * 0.75, Math.PI * 1.25); // vers la gauche
    }
    return {
      x: x, y: y,
      vx: Math.cos(ang) * G.BIRD_SPEED,
      vy: Math.sin(ang) * G.BIRD_SPEED,
      hp: G.BIRD_HP,
      wing: 0
    };
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

  // Retire les oiseaux morts et en respawne un depuis le bord pour maintenir
  // BIRD_COUNT oiseaux en permanence. Appelé depuis update().
  G.cleanupBirds = function () {
    var state = G.state;
    for (var i = state.birds.length - 1; i >= 0; i--) {
      if (state.birds[i].hp <= 0) {
        state.birds.splice(i, 1);
        // Maintient 20 oiseaux en permanence : un nouveau pop depuis le bord.
        if (state.birds.length < G.BIRD_COUNT) state.birds.push(G.spawnBirdFromEdge());
      }
    }
  };
})();

// Animaux sauvages (cerf, cochon, vache, mouton) : errent librement hors
// ville, changes de direction de temps en temps, tues par les projectiles,
// droppent de la Nourriture. Repop chaque matin (nouveau jour) pour
// maintenir FAUNA_COUNT animaux sur toute la carte.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Tire un type d'animal selon FAUNA_WEIGHTS (poids relaties).
  function pickType() {
    var total = 0, k;
    for (k in G.FAUNA_WEIGHTS) {
      if (G.FAUNA_WEIGHTS.hasOwnProperty(k)) total += G.FAUNA_WEIGHTS[k];
    }
    var roll = Math.random() * total;
    for (k in G.FAUNA_WEIGHTS) {
      if (!G.FAUNA_WEIGHTS.hasOwnProperty(k)) continue;
      roll -= G.FAUNA_WEIGHTS[k];
      if (roll <= 0) return k;
    }
    return "cerf";
  }

  // Spawn un animal a une position aleatoire hors ville (la ville reste
  // reservee aux joueurs/zombies : les betes se baladent dans la nature).
  G.spawnFauna = function () {
    var type = pickType();
    var def = G.FAUNA_TYPES[type];
    // Position hors de la ville : re-tirage tant que dans le carre ville.
    var x, y, guard = 0;
    do {
      x = G.rand(50, G.WORLD - 50);
      y = G.rand(50, G.WORLD - 50);
      guard++;
    } while (Math.abs(x - G.WORLD / 2) < G.TOWN + 200 &&
             Math.abs(y - G.WORLD / 2) < G.TOWN + 200 && guard < 40);
    // Direction initiale aleatoire.
    var ang = Math.random() * Math.PI * 2;
    return {
      type: type,
      x: x, y: y,
      vx: Math.cos(ang) * def.speed,
      vy: Math.sin(ang) * def.speed,
      hp: def.hp,
      wanderT: G.rand(1, 5)
    };
  };

  // Spawn initial : FAUNA_COUNT animaux repartis sur la carte.
  G.spawnFaunaAll = function () {
    G.state.fauna = [];
    for (var i = 0; i < G.FAUNA_COUNT; i++) G.state.fauna.push(G.spawnFauna());
  };

  // Deplacement d'un animal : avance tout droit, change de direction
  // (angle aleatoire) quand wanderT expire, rebondit sur les bords.
  function moveOne(a, dt) {
    a.wanderT -= dt;
    if (a.wanderT <= 0) {
      var ang = Math.random() * Math.PI * 2;
      var def = G.FAUNA_TYPES[a.type];
      var spd = def ? def.speed : 70;
      a.vx = Math.cos(ang) * spd;
      a.vy = Math.sin(ang) * spd;
      a.wanderT = G.rand(2, 8);
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (a.x < 20) { a.x = 20; a.vx = Math.abs(a.vx); }
    else if (a.x > G.WORLD - 20) { a.x = G.WORLD - 20; a.vx = -Math.abs(a.vx); }
    if (a.y < 20) { a.y = 20; a.vy = Math.abs(a.vy); }
    else if (a.y > G.WORLD - 20) { a.y = G.WORLD - 20; a.vy = -Math.abs(a.vy); }
  }

  // Met a jour tous les animaux (deplacement libre).
  G.updateFauna = function (dt) {
    var fa = G.state.fauna || [];
    for (var i = 0; i < fa.length; i++) moveOne(fa[i], dt);
  };

  // Drop d'un animal tue : de la Nourriture a sa position (ramassable,
  // mangeable depuis le sac pour soigner).
  G.faunaDrop = function (a) {
    if (!a) return;
    G.state.items.push({
      x: a.x, y: a.y, taken: false,
      name: G.FAUNA_FOOD.name, color: G.FAUNA_FOOD.color, kind: G.FAUNA_FOOD.kind
    });
  };

  // Repop du matin : complete jusqu'a FAUNA_COUNT animaux (les tues la
  // veille sont remplaces). Appelee a chaque changement de jour.
  G.repopFauna = function () {
    if (!G.state.fauna) G.state.fauna = [];
    while (G.state.fauna.length < G.FAUNA_COUNT) {
      G.state.fauna.push(G.spawnFauna());
    }
  };

  // Retire les animaux morts (hp <= 0). Le repop attend le matin suivant.
  G.cleanupFauna = function () {
    var fa = G.state.fauna;
    if (!fa) return;
    for (var i = fa.length - 1; i >= 0; i--) {
      if (fa[i].hp <= 0) fa.splice(i, 1);
    }
  };
})();

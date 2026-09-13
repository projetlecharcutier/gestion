// Armes & projectiles : stats de l'arme équipée et tir du joueur.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.equippedStats = function () {
    var name = G.state.equipped || "Mains nues";
    return G.WEAPON_STATS[name] || G.WEAPON_STATS["Mains nues"];
  };

  // Gère le tir quand le clic gauche est maintenu (actionHeld). Appelé depuis
  // update(). shootCd est décrémenté une fois par update() dans main.js.
  G.handleShooting = function () {
    var state = G.state;
    if (state.inBuilding || state.paused || state.bag.open || state.chestOpen || state.gameOver || state.buildMode) return;
    if (!state.equipped) return; // pas de tir sans arme équipée
    if (!state.actionHeld || state.shootCd > 0) return;
    var p = state.player;
    var tx = state.mouse.wx, ty = state.mouse.wy;
    var st = G.equippedStats();
    state.shootCd = st.cd;
    if (G.playSfx) G.playSfx("shoot");
    var ax = tx - p.x, ay = ty - p.y;
    var ang = Math.atan2(ay, ax);
    var sp = (Math.random() * 2 - 1) * st.spread;
    ang += sp;
    state.projectiles.push({
      x: p.x, y: p.y - G.PLAYER_H * 0.5,
      vx: Math.cos(ang) * st.speed,
      vy: Math.sin(ang) * st.speed,
      life: st.life,
      dmg: st.dmg,
      color: st.color,
      trail: []
    });
    if (state.projectiles.length > 120) state.projectiles.shift();
  };

  // Déplacement des projectiles + collisions avec zombies et oiseaux. Appelé depuis update().
  G.updateProjectiles = function (dt) {
    var state = G.state;
    for (var i = state.projectiles.length - 1; i >= 0; i--) {
      var pr = state.projectiles[i];
      pr.trail.push([pr.x, pr.y]);
      if (pr.trail.length > 8) pr.trail.shift();
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      var hitZ = false;
      for (var zi = 0; zi < state.zombies.length; zi++) {
        var z = state.zombies[zi];
        var zdx = pr.x - z.x, zdy = pr.y - z.y;
        if (Math.sqrt(zdx * zdx + zdy * zdy) < 14) {
          z.hp -= pr.dmg;
          hitZ = true;
          break;
        }
      }
      // Collision avec un oiseau : le tue et dropppe un objet.
      if (!hitZ) {
        for (var bi = 0; bi < state.birds.length; bi++) {
          var b = state.birds[bi];
          var bdx = pr.x - b.x, bdy = pr.y - b.y;
          if (Math.sqrt(bdx * bdx + bdy * bdy) < G.BIRD_HIT_R) {
            b.hp -= pr.dmg;
            if (b.hp <= 0) G.birdDrop(b.x, b.y);
            hitZ = true;
            break;
          }
        }
      }
      if (hitZ || pr.life <= 0 || pr.x < 0 || pr.x > G.WORLD || pr.y < 0 || pr.y > G.WORLD) {
        state.projectiles.splice(i, 1);
      }
    }
  };
})();

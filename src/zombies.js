// Zombies : vagues nocturnes, petits groupes qui fusionnent, IA (cible joueur/mur, attaque).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.spawnWave = function () {
    var state = G.state;
    var count = G.ZOMBIE_PER_WAVE_BASE * Math.pow(G.ZOMBIE_WAVE_GROWTH, state.day);
    state.waveCount = Math.round(count);
    var side = G.randi(0, 3);
    var nbGroups = Math.ceil(count / G.GROUP_SIZE);
    state.zombieGroups = [];
    for (var g = 0; g < nbGroups; g++) {
      var lx, ly;
      if (side === 0) { lx = G.rand(G.TOWN_MIN, G.TOWN_MAX); ly = G.clamp(G.TOWN_MIN - G.rand(30, 220), 0, G.WORLD); }
      else if (side === 1) { lx = G.rand(G.TOWN_MIN, G.TOWN_MAX); ly = G.clamp(G.TOWN_MAX + G.rand(30, 220), 0, G.WORLD); }
      else if (side === 2) { lx = G.clamp(G.TOWN_MIN - G.rand(30, 220), 0, G.WORLD); ly = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      else { lx = G.clamp(G.TOWN_MAX + G.rand(30, 220), 0, G.WORLD); ly = G.rand(G.TOWN_MIN, G.TOWN_MAX); }
      var grp = { x: lx, y: ly, members: [] };
      state.zombieGroups.push(grp);
      var n = Math.min(G.GROUP_SIZE, count - g * G.GROUP_SIZE);
      for (var k = 0; k < n; k++) {
        var ang = (k / n) * Math.PI * 2 + G.rand(0, 1);
        var dist = G.GROUP_FORMATION * (0.3 + Math.random() * 0.7);
        var zx = lx + Math.cos(ang) * dist;
        var zy = ly + Math.sin(ang) * dist;
        var z = { x: zx, y: zy, hp: G.ZOMBIE_HP, atkCd: 0, wallCd: 0, group: grp, slotAng: ang, slotDist: dist };
        grp.members.push(z);
        state.zombies.push(z);
      }
    }
  };

  G.mergeGroups = function () {
    var groups = G.state.zombieGroups;
    var merged = true;
    var guard = 0;
    while (merged && guard < 50) {
      merged = false;
      guard++;
      for (var a = 0; a < groups.length; a++) {
        for (var b = a + 1; b < groups.length; b++) {
          var ga = groups[a], gb = groups[b];
          var dx = ga.x - gb.x, dy = ga.y - gb.y;
          if (Math.sqrt(dx * dx + dy * dy) < G.GROUP_MERGE_DIST) {
            var big = ga.members.length >= gb.members.length ? ga : gb;
            var small = big === ga ? gb : ga;
            for (var m = 0; m < small.members.length; m++) {
              var z = small.members[m];
              z.group = big;
              var idx = big.members.length;
              var total = big.members.length + 1;
              var ang = (idx / total) * Math.PI * 2 + G.rand(0, 0.5);
              z.slotAng = ang;
              z.slotDist = G.GROUP_FORMATION * (0.3 + Math.random() * 0.7);
              big.members.push(z);
            }
            var idx2 = groups.indexOf(small);
            groups.splice(idx2, 1);
            merged = true;
            break;
          }
        }
        if (merged) break;
      }
    }
  };

  G.updateZombies = function (dt) {
    var state = G.state;
    if (!state.waveActive) {
      if (state.elapsed >= state.nextWaveAt) {
        G.spawnWave();
        state.waveActive = true;
        state.waveLeaveAt = state.elapsed + G.WAVE_LEAVE;
        state.groupMergeTimer = 0;
      }
    } else {
      if (state.elapsed >= state.waveLeaveAt) {
        state.zombies = [];
        state.zombieGroups = [];
        state.waveActive = false;
        state.nextWaveAt = state.elapsed + G.WAVE_EVERY;
      }
    }

    if (state.waveActive && state.zombieGroups) {
      state.groupMergeTimer = (state.groupMergeTimer || 0) + dt;
      if (state.groupMergeTimer >= G.GROUP_MERGE_INTERVAL) {
        state.groupMergeTimer = 0;
        G.mergeGroups();
      }
    }

    var p = state.player;
    // La mairie est la cible principale des zombies (centre-ville).
    var mairie = null;
    for (var mi0 = 0; mi0 < state.buildings.length; mi0++) {
      if (state.buildings[mi0].isMairie) { mairie = state.buildings[mi0]; break; }
    }
    if (state.zombieGroups) {
      for (var gi = 0; gi < state.zombieGroups.length; gi++) {
        var grp = state.zombieGroups[gi];
        var cible = null;
        var pdx = p.x - grp.x, pdy = p.y - grp.y;
        var distP = Math.sqrt(pdx * pdx + pdy * pdy);
        if (distP < G.ZOMBIE_ATTACK_RANGE) {
          cible = { x: p.x, y: p.y, isPlayer: true };
        } else if (mairie) {
          // Cible la mairie ; attaque aussi les murs rencontrés sur le chemin.
          // La cible d'un mur est le point du bord le plus proche du groupe,
          // pour que le zombie attaqué quand il est collé au mur.
          var best = null, bestD = Infinity, bestPt = null;
          for (var j = 0; j < state.walls.length; j++) {
            var m = state.walls[j];
            var clx = Math.max(m.x, Math.min(grp.x, m.x + m.w));
            var cly = Math.max(m.y, Math.min(grp.y, m.y + m.h));
            var md = Math.sqrt((clx - grp.x) * (clx - grp.x) + (cly - grp.y) * (cly - grp.y));
            if (md < bestD) { bestD = md; best = m; bestPt = { x: clx, y: cly }; }
          }
          if (best && bestD < 40) {
            cible = { x: bestPt.x, y: bestPt.y, isPlayer: false, wall: best };
          } else {
            cible = { x: mairie.x + mairie.w / 2, y: mairie.y + mairie.h / 2, isPlayer: false, mairie: mairie };
          }
        } else {
          cible = { x: G.WORLD / 2, y: G.WORLD / 2, isPlayer: false };
        }
        var ldx = cible.x - grp.x, ldy = cible.y - grp.y;
        var ld = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
        if (ld > 10) {
          grp.x += (ldx / ld) * G.ZOMBIE_SPEED * dt;
          grp.y += (ldy / ld) * G.ZOMBIE_SPEED * dt;
        }
        for (var mi = 0; mi < grp.members.length; mi++) {
          var z = grp.members[mi];
          var tx = grp.x + Math.cos(z.slotAng) * z.slotDist;
          var ty = grp.y + Math.sin(z.slotAng) * z.slotDist;
          var zdx = cible.x - z.x, zdy = cible.y - z.y;
          var zd = Math.sqrt(zdx * zdx + zdy * zdy);
          if (z.atkCd > 0) z.atkCd -= dt;
          if (z.wallCd > 0) z.wallCd -= dt;
          if (zd < 14) {
            if (cible.isPlayer && z.atkCd <= 0) {
              z.atkCd = G.ZOMBIE_ATTACK_CD;
              p.hp -= G.ZOMBIE_PLAYER_DMG;
              if (p.hp <= 0) { p.hp = 0; state.gameOver = true; state.gameOverCause = "player"; }
            } else if (!cible.isPlayer && cible.wall && z.wallCd <= 0) {
              z.wallCd = G.ZOMBIE_WALL_CD;
              cible.wall.hp -= G.ZOMBIE_WALL_DMG;
            } else if (!cible.isPlayer && cible.mairie && z.wallCd <= 0) {
              z.wallCd = G.ZOMBIE_WALL_CD;
              cible.mairie.hp -= G.ZOMBIE_WALL_DMG;
              if (cible.mairie.hp <= 0) { cible.mairie.hp = 0; state.gameOver = true; state.gameOverCause = "mairie"; }
            }
          } else {
            var sx = tx - z.x, sy = ty - z.y;
            var sd = Math.sqrt(sx * sx + sy * sy) || 1;
            if (sd > 4) {
              // Sous-pas : ne pas traverser une planche fine en un seul pas.
              var zs = G.ZOMBIE_HALF;
              var zStep = 8;
              var zMove = G.ZOMBIE_SPEED * dt;
              var done = 0;
              while (done < zMove - 0.001) {
                var inc = Math.min(zStep, zMove - done);
                var stepX = z.x + (sx / sd) * inc;
                var stepY = z.y + (sy / sd) * inc;
                var blocked = true;
                if (!G.aabbHitsWalls(stepX - zs, z.y - zs, G.ZOMBIE_W, G.ZOMBIE_W) && !G.hitsTree(stepX, z.y, zs)) { z.x = stepX; blocked = false; }
                if (!G.aabbHitsWalls(z.x - zs, stepY - zs, G.ZOMBIE_W, G.ZOMBIE_W) && !G.hitsTree(z.x, stepY, zs)) { z.y = stepY; blocked = false; }
                if (blocked) break;
                done += inc;
              }
            }
          }
        }
      }
    }
  };

  // Retire les zombies morts (et de leur groupe) + groupes vides. Appelé depuis update().
  G.cleanupZombies = function () {
    var state = G.state;
    for (var zj = state.zombies.length - 1; zj >= 0; zj--) {
      if (state.zombies[zj].hp <= 0) {
        var dz = state.zombies[zj];
        if (G.playSfx) G.playSfx("zombie_die");
        if (dz.group && dz.group.members) {
          var idx = dz.group.members.indexOf(dz);
          if (idx >= 0) dz.group.members.splice(idx, 1);
        }
        state.zombies.splice(zj, 1);
      }
    }
    if (state.zombieGroups) {
      for (var gj = state.zombieGroups.length - 1; gj >= 0; gj--) {
        if (!state.zombieGroups[gj].members || state.zombieGroups[gj].members.length === 0) {
          state.zombieGroups.splice(gj, 1);
        }
      }
    }
  };
})();

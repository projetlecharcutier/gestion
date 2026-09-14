// Zombies : vagues nocturnes, spawn depuis les 4 bords de la carte,
// convergence vers la mairie, attaque des murs/joueurs sur le chemin,
// séparation (1 px d'écart entre zombies).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Spawn d'une vague de zombies : répartis sur les 4 bords de la carte,
  // de toutes parts. Chaque groupe arrive d'un côté différent pour converger
  // vers la mairie au centre.
  G.spawnWave = function () {
    var state = G.state;
    var count = G.ZOMBIE_PER_WAVE_BASE * Math.pow(G.ZOMBIE_WAVE_GROWTH, state.day);
    state.waveCount = Math.round(count);
    var nbGroups = Math.ceil(count / G.GROUP_SIZE);
    state.zombieGroups = [];
    for (var g = 0; g < nbGroups; g++) {
      // Chaque groupe vient d'un bord aléatoire de la carte (au-delà de la
      // ville), réparti sur les 4 côtés pour une convergence de toutes parts.
      var side = g % 4;
      var lx, ly;
      var edge = G.rand(40, 200);
      if (side === 0) { lx = G.rand(0, G.WORLD); ly = edge; }
      else if (side === 1) { lx = G.rand(0, G.WORLD); ly = G.WORLD - edge; }
      else if (side === 2) { lx = edge; ly = G.rand(0, G.WORLD); }
      else { lx = G.WORLD - edge; ly = G.rand(0, G.WORLD); }
      var grp = { x: lx, y: ly, members: [] };
      state.zombieGroups.push(grp);
      var n = Math.min(G.GROUP_SIZE, count - g * G.GROUP_SIZE);
      for (var k = 0; k < n; k++) {
        var ang = (k / n) * Math.PI * 2 + G.rand(0, 1);
        var dist = G.GROUP_FORMATION * (0.3 + Math.random() * 0.7);
        var zx = lx + Math.cos(ang) * dist;
        var zy = ly + Math.sin(ang) * dist;
        // Caractère propre à chaque zombie pour un mouvement vivant :
        // speedFactor = vitesse relative (±ZOMBIE_SPEED_VAR), wanderPhase/Freq =
        // phase et fréquence d'oscillation du cap ("drunken walk"), hesitate =
        // décompte d'une pause en cours (0 = aucun).
        var sf = 1 + G.rand(-G.ZOMBIE_SPEED_VAR, G.ZOMBIE_SPEED_VAR);
        var z = {
          x: zx, y: zy, hp: G.ZOMBIE_HP, atkCd: 0, wallCd: 0, group: grp,
          slotAng: ang, slotDist: dist,
          speedFactor: G.clamp(sf, 0.4, 1.6),
          wanderPhase: Math.random() * Math.PI * 2,
          wanderFreq: G.ZOMBIE_WANDER_FREQ * (0.7 + Math.random() * 0.6),
          hesitate: 0,
          blockedSides: 0
        };
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
    // Cycle jour/nuit : les vagues sont pilotees par l'horloge (minuit = spawn,
    // 8h = retraite), pas par un simple timer d'elapsed.
    var prevClock = state.clock - (12 / G.DAY_SECONDS) * dt;
    if (prevClock < 0) prevClock += 24;
    // Minuit (passage a 0h) : spawn d'une nouvelle vague + message.
    var crossedMidnight = prevClock > 22 && state.clock < 2;
    if (crossedMidnight && !state.waveSpawnedForDay) {
      G.spawnWave();
      state.waveActive = true;
      state.waveSpawnedForDay = true;
      state.zombieMode = "attack";
      state.groupMergeTimer = 0;
      state.waveMsgTimer = 8; // message "Vague de zombies" affiche 8 s
    }
    if (state.waveMsgTimer > 0) state.waveMsgTimer -= dt;
    // 8h : les zombies se retirent loin de la ville (n'attaquent plus la mairie)
    // et on rearme le drapeau de vague pour la nuit suivante.
    var crossedMorning = prevClock < 8 && state.clock >= 8;
    if (crossedMorning) {
      if (state.waveActive) state.zombieMode = "retreat";
      state.waveSpawnedForDay = false;
    }

    if (state.waveActive && state.zombieGroups) {
      state.groupMergeTimer = (state.groupMergeTimer || 0) + dt;
      if (state.groupMergeTimer >= G.GROUP_MERGE_INTERVAL) {
        state.groupMergeTimer = 0;
        G.mergeGroups();
      }
    }

    // Détection du bruit des coups de feu : un tir nouvellement apparu
    // (le nombre de projectiles augmente) attire les groupes proches pendant
    // ZOMBIE_NOISE_TIME s. On garde la position du dernier tir récent.
    var lastShot = state.lastShot || null;
    var projN = state.projectiles ? state.projectiles.length : 0;
    var prevN = state._prevProjN || 0;
    if (projN > prevN && projN > 0) {
      var fresh = state.projectiles[projN - 1];
      lastShot = { x: fresh.x, y: fresh.y, t: state.time };
    }
    state._prevProjN = projN;
    if (lastShot && (state.time - lastShot.t) > G.ZOMBIE_NOISE_TIME) lastShot = null;
    state.lastShot = lastShot;

    var p = state.player;
    // La mairie est la cible principale des zombies (centre-ville).
    var mairie = null;
    for (var mi0 = 0; mi0 < state.buildings.length; mi0++) {
      if (state.buildings[mi0].isMairie) { mairie = state.buildings[mi0]; break; }
    }
    // Grille spatiale temporaire pour la séparation entre zombies (O(1)).
    var zGrid = null;
    var zCell = 32;
    function zGridKey(x, y) { return Math.floor(x / zCell) + "," + Math.floor(y / zCell); }
    if (state.waveActive) {
      zGrid = {};
      for (var zi = 0; zi < state.zombies.length; zi++) {
        var zz = state.zombies[zi];
        var zk = zGridKey(zz.x, zz.y);
        if (!zGrid[zk]) zGrid[zk] = [];
        zGrid[zk].push(zz);
      }
    }
    // Répousse un zombie hors de ses voisins trop proches (séparation 1 px).
    function separate(z) {
      if (!zGrid) return;
      var zs = G.ZOMBIE_HALF;
      var minD = zs * 2 + 1; // 1 px d'écart
      var gx = Math.floor(z.x / zCell), gy = Math.floor(z.y / zCell);
      for (var ix = -1; ix <= 1; ix++) {
        for (var iy = -1; iy <= 1; iy++) {
          var arr = zGrid[(gx + ix) + "," + (gy + iy)];
          if (!arr) continue;
          for (var n = 0; n < arr.length; n++) {
            var o = arr[n];
            if (o === z) continue;
            var dx = z.x - o.x, dy = z.y - o.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < minD && d > 0.01) {
              var push = (minD - d) / 2;
              z.x += (dx / d) * push;
              z.y += (dy / d) * push;
            } else if (d <= 0.01) {
              // Superposition exacte : pousse dans une direction aléatoire.
              z.x += G.rand(-1, 1);
              z.y += G.rand(-1, 1);
            }
          }
        }
      }
    }
    if (state.zombieGroups) {
      var retreating = state.zombieMode === "retreat";
      for (var gi = 0; gi < state.zombieGroups.length; gi++) {
        var grp = state.zombieGroups[gi];
        var cible = null;
        var pdx = p.x - grp.x, pdy = p.y - grp.y;
        var distP = Math.sqrt(pdx * pdx + pdy * pdy);
        if (distP < G.ZOMBIE_ATTACK_RANGE) {
          cible = { x: p.x, y: p.y, isPlayer: true };
        } else if (retreating) {
          // Mode retraite (apres 8h) : s'eloigne de la ville, n'attaque pas la
          // mairie. Cible un point a ZOMBIE_RETREAT_DIST hors de la ville, dans
          // la direction opposee au centre-ville.
          var tcx = (G.TOWN_MIN + G.TOWN_MAX) / 2;
          var rdx = grp.x - tcx, rdy = grp.y - tcx;
          var rlen = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
          cible = { x: tcx + (rdx / rlen) * (G.TOWN / 2 + G.ZOMBIE_RETREAT_DIST),
                    y: tcx + (rdy / rlen) * (G.TOWN / 2 + G.ZOMBIE_RETREAT_DIST),
                    isPlayer: false, retreat: true };
        } else if (mairie) {
          // Cible la mairie ; attaque aussi les murs rencontrés sur le chemin.
          // La cible d'un mur est le point du bord le plus proche du groupe,
          // pour que le zombie attaque quand il est collé au mur.
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
        // Attraction par le bruit : un tir récent dévie la cible des groupes
        // à portée vers la position du tir (sans écraser un joueur proche ni
        // un mur immédiat — ceux-ci restent prioritaires). Incite à la discrétion.
        if (lastShot && !cible.isPlayer && !cible.wall) {
          var nsx = lastShot.x - grp.x, nsy = lastShot.y - grp.y;
          var nsd = Math.sqrt(nsx * nsx + nsy * nsy);
          if (nsd < G.ZOMBIE_NOISE_RANGE) {
            cible = { x: lastShot.x, y: lastShot.y, isPlayer: false, noise: true };
          }
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
            // Décompte des hésitations : si en cours, on ne bouge pas ce tick.
            if (z.hesitate > 0) {
              z.hesitate -= dt;
            } else if (sd > 4) {
              // Démarrage aléatoire d'une hésitation (le zombie s'arrête,
              // comme s'il flaireit l'air).
              if (Math.random() < G.ZOMBIE_HESITATE_RATE * dt) {
                z.hesitate = G.ZOMBIE_HESITATE_TIME * (0.6 + Math.random() * 0.8);
              } else {
                // Cap de marche perturbé par une oscillation lente propre au
                // zombie ("drunken walk") : on dérive le cap de ±ZOMBIE_WANDER_AMP
                // autour de la direction cible.
                var baseAng = Math.atan2(sy, sx);
                var wob = Math.sin(state.time * z.wanderFreq + z.wanderPhase) * G.ZOMBIE_WANDER_AMP;
                var mvAng = baseAng + wob;
                var mvx = Math.cos(mvAng), mvy = Math.sin(mvAng);
                // Sous-pas : ne pas traverser une planche fine en un seul pas.
                var zs = G.ZOMBIE_HALF;
                var zStep = 8;
                var zMove = G.ZOMBIE_SPEED * z.speedFactor * dt;
                var done = 0;
                var hitWall = false;
                while (done < zMove - 0.001) {
                  var inc = Math.min(zStep, zMove - done);
                  var stepX = z.x + mvx * inc;
                  var stepY = z.y + mvy * inc;
                  var blocked = true;
                  if (!G.aabbHitsWalls(stepX - zs, z.y - zs, G.ZOMBIE_W, G.ZOMBIE_W) && !G.aabbHitsForets(stepX, z.y, zs)) { z.x = stepX; blocked = false; }
                  if (!G.aabbHitsWalls(z.x - zs, stepY - zs, G.ZOMBIE_W, G.ZOMBIE_W) && !G.aabbHitsForets(z.x, stepY, zs)) { z.y = stepY; blocked = false; }
                  if (blocked) { hitWall = true; break; }
                  done += inc;
                }
                // Contournement : si bloqué par un mur, on glisse le long plutôt
                // que de s'enliser. On alterne côté selon le temps pour laisser
                // la chance de passer des deux bords.
                if (hitWall) {
                  z.blockedSides = (z.blockedSides || 0) + 1;
                  var slideDir = (((Math.floor(state.time * 2 + z.wanderPhase) % 2) === 0) ? 1 : -1);
                  var perpX = -mvy, perpY = mvx;
                  var slide = G.ZOMBIE_WALL_SLIDE * dt * slideDir;
                  var sxs = z.x + perpX * slide, sys = z.y + perpY * slide;
                  if (!G.aabbHitsWalls(sxs - zs, z.y - zs, G.ZOMBIE_W, G.ZOMBIE_W) && !G.aabbHitsForets(sxs, z.y, zs)) z.x = sxs;
                  if (!G.aabbHitsWalls(z.x - zs, sys - zs, G.ZOMBIE_W, G.ZOMBIE_W) && !G.aabbHitsForets(z.x, sys, zs)) z.y = sys;
                } else {
                  z.blockedSides = 0;
                }
              }
            }
          }
          // Séparation : repousse le zombie hors de ses voisins trop proches
          // (1 px d'écart) pour éviter le chevauchement.
          separate(z);
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

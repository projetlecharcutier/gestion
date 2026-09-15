// Zombies : vagues nocturnes, spawn depuis les 4 bords de la carte,
// convergence vers la mairie, attaque des murs/joueurs sur le chemin,
// séparation (1 px d'écart entre zombies).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Spawn d'une vague de zombies : répartis sur les 4 bords de la carte,
  // de toutes parts. Chaque groupe arrive d'un côté différent pour converger
  // vers la mairie au centre.
  // Calcule la position de slot cible (ang, dist) du zombie d'index i dans
  // un groupe de n membres, selon la formation du groupe et son mode (horde,
  // retraite). Formations : 0=anneau, 1=ligne, 2=coin, 3="V". Renvoie {ang,dist}.
  // Ce helper est partagé : utilisé à l'apparition, à la fusion et au tick
  // pour animer la convergence des slots.
  G.zombieSlot = function (grp, i, n) {
    var form = grp.formation || 0;
    var dense = 1, scale = 1, noise = 0;
    if (grp.isHorde) dense = G.ZOMBIE_HORDE_DENSE;
    if (grp.retreat) {
      scale = G.ZOMBIE_RETREAT_SLOT_SCALE;
      noise = G.ZOMBIE_RETREAT_SLOT_NOISE;
    }
    var base = G.GROUP_FORMATION * dense * scale;
    var ang, dist;
    if (form === 1) {
      // Ligne : perpendiculaire au mouvement, étagée en profondeur.
      var cols = Math.ceil(Math.sqrt(n));
      var row = Math.floor(i / cols), col = i % cols;
      ang = (col / Math.max(1, cols - 1) - 0.5) * Math.PI; // gauche/droite
      dist = base * (0.5 + row * 0.4);
    } else if (form === 2) {
      // Coin : quart de cercle dans un quadrant.
      ang = (i / n) * (Math.PI / 2) + grp.formPhase;
      dist = base * (0.3 + (i / n) * 0.7);
    } else if (form === 3) {
      // "V" : deux bras en éventail autour du leader.
      var side = i % 2 === 0 ? 1 : -1;
      var depth = Math.floor((i + 1) / 2);
      ang = side * (0.3 + depth * 0.18) + grp.formPhase;
      dist = base * (0.3 + depth * 0.35);
    } else {
      // Anneau : répartition circulaire par défaut.
      ang = (i / n) * Math.PI * 2 + grp.formPhase;
      dist = base * (0.4 + Math.random() * 0.5);
    }
    if (noise) dist += G.rand(-noise, noise);
    return { ang: ang, dist: dist };
  };

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
      var grp = { x: lx, y: ly, members: [], hasRaider: false,
                  formation: Math.floor(Math.random() * 4),
                  formPhase: Math.random() * Math.PI * 2,
                  isHorde: false, retreat: false, hordeMsgShown: false };
      state.zombieGroups.push(grp);
      var n = Math.min(G.GROUP_SIZE, count - g * G.GROUP_SIZE);
      for (var k = 0; k < n; k++) {
        var slot = G.zombieSlot(grp, k, n);
        var ang = slot.ang, dist = slot.dist;
        var zx = lx + Math.cos(ang) * dist;
        var zy = ly + Math.sin(ang) * dist;
        // Caractère propre à chaque zombie pour un mouvement vivant :
        // speedFactor = vitesse relative (±ZOMBIE_SPEED_VAR), wanderPhase/Freq =
        // phase et fréquence d'oscillation du cap ("drunken walk"), hesitate =
        // décompte d'une pause en cours (0 = aucun).
        // Rôles d'attaque : harasser (éclaireur qui harcèle le joueur de loin),
        // raider (pilleur qui pousse son groupe vers les planches construites).
        // slotAng/slotDist = position de slot actuelle (animée), slotAngT/
        // slotDistT = cible (recalculée selon formation/mode, lerpée pour la
        // fusion animée). isLeader = zombie d'index 0 (mène la marche).
        var sf = 1 + G.rand(-G.ZOMBIE_SPEED_VAR, G.ZOMBIE_SPEED_VAR);
        var z = {
          x: zx, y: zy, hp: G.ZOMBIE_HP, atkCd: 0, wallCd: 0, group: grp,
          slotAng: ang, slotDist: dist, slotAngT: ang, slotDistT: dist,
          speedFactor: G.clamp(sf, 0.4, 1.6),
          wanderPhase: Math.random() * Math.PI * 2,
          wanderFreq: G.ZOMBIE_WANDER_FREQ * (0.7 + Math.random() * 0.6),
          hesitate: 0,
          blockedSides: 0,
          harasser: Math.random() < G.ZOMBIE_HARASS_RATIO,
          raider: Math.random() < G.ZOMBIE_RAIDER_RATIO,
          wallBreaker: Math.random() < G.ZOMBIE_BREAKER_RATIO,
          seekDir: 0, // sens de longe du mur pour les fouisseurs (+1/-1)
          lunge: 0, lungeDx: 0, lungeDy: 0,
          isLeader: k === 0
        };
        if (z.raider) grp.hasRaider = true;
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
              if (z.raider) big.hasRaider = true;
              big.members.push(z);
            }
            // Nouvelle formation pour le groupe fusionné : on recalcule les
            // cibles de slots de tous les membres (la formation/n changent).
            // Les slots actuels (slotAng/slotDist) restent inchangés : ils
            // convergeront vers les cibles au tick via un lerp (fusion animée).
            big.formation = Math.floor(Math.random() * 4);
            big.formPhase = Math.random() * Math.PI * 2;
            var nn = big.members.length;
            for (var r = 0; r < nn; r++) {
              var s = G.zombieSlot(big, r, nn);
              big.members[r].slotAngT = s.ang;
              big.members[r].slotDistT = s.dist;
              big.members[r].isLeader = (r === 0);
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
    var prevClock = state.clock - (12 / G.DAY_SECONDS) * G.TIME_SCALE * dt;
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
    if (state.hordeMsgTimer > 0) state.hordeMsgTimer -= dt;
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
    // Bonus de dégâts de meute : compte les voisins zombies à portée de
    // regroupement et renvoie un bonus croissant (capé) — effet de coups
    // frappés ensemble par une meute collée au même mur/mairie.
    function swarmBonus(z) {
      if (!zGrid) return 0;
      var count = 0;
      var gx = Math.floor(z.x / zCell), gy = Math.floor(z.y / zCell);
      var rad = G.ZOMBIE_SWARM_RADIUS;
      for (var ix = -1; ix <= 1; ix++) {
        for (var iy = -1; iy <= 1; iy++) {
          var arr = zGrid[(gx + ix) + "," + (gy + iy)];
          if (!arr) continue;
          for (var n = 0; n < arr.length; n++) {
            if (arr[n] === z) continue;
            var dx = z.x - arr[n].x, dy = z.y - arr[n].y;
            if (dx * dx + dy * dy < rad * rad) count++;
          }
        }
      }
      if (count > G.ZOMBIE_SWARM_CAP) count = G.ZOMBIE_SWARM_CAP;
      return count * G.ZOMBIE_SWARM_BONUS;
    }
    if (state.zombieGroups) {
      var retreating = state.zombieMode === "retreat";
      for (var gi = 0; gi < state.zombieGroups.length; gi++) {
        var grp = state.zombieGroups[gi];
        // Mise à jour des modes du groupe : horde (assez de membres) et retraite.
        // En mode horde, formation resserrée + vitesse accrue + message HUD.
        var wasHorde = grp.isHorde;
        grp.isHorde = grp.members.length >= G.ZOMBIE_HORDE_THRESHOLD;
        grp.retreat = retreating;
        if (grp.isHorde && !wasHorde && !grp.hordeMsgShown) {
          grp.hordeMsgShown = true;
          state.hordeMsgTimer = 6;
        }
        // Recalcule les cibles de slots selon la formation/mode courants et
        // anime la convergence (lerp) des slots actuels vers les cibles —
        // rend la fusion et les changements de mode progressifs.
        var gn = grp.members.length;
        var lerpF = Math.min(1, G.ZOMBIE_SLOT_LERP * dt);
        for (var si = 0; si < gn; si++) {
          var sz = grp.members[si];
          var st = G.zombieSlot(grp, si, gn);
          sz.slotAngT = st.ang; sz.slotDistT = st.dist;
          sz.isLeader = (si === 0);
          sz.slotAng += (sz.slotAngT - sz.slotAng) * lerpF;
          sz.slotDist += (sz.slotDistT - sz.slotDist) * lerpF;
        }
        var cible = null;
        var pdx = p.x - grp.x, pdy = p.y - grp.y;
        var distP = Math.sqrt(pdx * pdx + pdy * pdy);
        if (distP < G.ZOMBIE_ATTACK_RANGE) {
          cible = { x: p.x, y: p.y, isPlayer: true };
        } else if (retreating) {
          // Mode retraite (apres 8h) : s'eloigne de la ville, n'attaque pas la
          // mairie. MAIS attaque les murs à proximité (de nuit comme de jour,
          // un mur collé reste attaqué avant de fuir). On cherche d'abord un
          // mur à portée ; s'il y en a un, on le cible, sinon on fuit.
          var nearWall = null, nearWallD = Infinity, nearWallPt = null;
          for (var wj = 0; wj < state.walls.length; wj++) {
            var wm = state.walls[wj];
            var wlx = Math.max(wm.x, Math.min(grp.x, wm.x + wm.w));
            var wly = Math.max(wm.y, Math.min(grp.y, wm.y + wm.h));
            var wmd = Math.sqrt((wlx - grp.x) * (wlx - grp.x) + (wly - grp.y) * (wly - grp.y));
            if (wmd < nearWallD) { nearWallD = wmd; nearWall = wm; nearWallPt = { x: wlx, y: wly }; }
          }
          if (nearWall && nearWallD < 40) {
            cible = { x: nearWallPt.x, y: nearWallPt.y, isPlayer: false, wall: nearWall };
          } else {
            var tcx = (G.TOWN_MIN + G.TOWN_MAX) / 2;
            var rdx = grp.x - tcx, rdy = grp.y - tcx;
            var rlen = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
            cible = { x: tcx + (rdx / rlen) * (G.TOWN / 2 + G.ZOMBIE_RETREAT_DIST),
                      y: tcx + (rdy / rlen) * (G.TOWN / 2 + G.ZOMBIE_RETREAT_DIST),
                      isPlayer: false, retreat: true };
          }
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
            // Pilleurs : un groupe contenant des raiders dévie sa cible vers
            // les planches construites par le joueur (built) à portée, menaçant
            // directement le travail du joueur plutôt que la mairie.
            var raiderCible = null;
            if (grp.hasRaider) {
              var rb = null, rbD = Infinity, rbPt = null;
              for (var rj = 0; rj < state.walls.length; rj++) {
                var rw = state.walls[rj];
                if (!rw.built) continue;
                var rclx = Math.max(rw.x, Math.min(grp.x, rw.x + rw.w));
                var rcly = Math.max(rw.y, Math.min(grp.y, rw.y + rw.h));
                var rmd = Math.sqrt((rclx - grp.x) * (rclx - grp.x) + (rcly - grp.y) * (rcly - grp.y));
                if (rmd < rbD) { rbD = rmd; rb = rw; rbPt = { x: rclx, y: rcly }; }
              }
              if (rb && rbD < G.ZOMBIE_RAID_RANGE) {
                raiderCible = { x: rbPt.x, y: rbPt.y, isPlayer: false, wall: rb };
              }
            }
            cible = raiderCible || { x: mairie.x + mairie.w / 2, y: mairie.y + mairie.h / 2, isPlayer: false, mairie: mairie };
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
        // Bonus de vitesse en mode horde : le groupe avance plus vite.
        var grpSpeed = grp.isHorde ? G.ZOMBIE_SPEED * (1 + G.ZOMBIE_HORDE_SPEED_BONUS) : G.ZOMBIE_SPEED;
        if (ld > 10) {
          grp.x += (ldx / ld) * grpSpeed * dt;
          grp.y += (ldy / ld) * grpSpeed * dt;
        }
        for (var mi = 0; mi < grp.members.length; mi++) {
          var z = grp.members[mi];
          // Cible effective de ce zombie. Un harceleur se détache du groupe
          // pour traquer le joueur seul s'il le détecte à portée (crée une
          // escouade divergente qui harcèle le joueur pendant que le reste du
          // groupe fonce sur la mairie/murs).
          var zcible = cible;
          if (z.harasser) {
            var hpdx = p.x - z.x, hpdy = p.y - z.y;
            if (Math.sqrt(hpdx * hpdx + hpdy * hpdy) < G.ZOMBIE_HARASS_RANGE) {
              zcible = { x: p.x, y: p.y, isPlayer: true };
            }
          }
          // Détection de mur individuelle : chaque zombie cherche le mur le
          // plus proche de LUI-MÊME (pas du groupe) à portée ZOMBIE_WALL_SENSE.
          // Cela évite qu'un zombie collé à un mur reste passif parce que le
          // groupe vise la mairie ou un point de slot éloigné. Un mur détecté
          // devient la cible effective : le zombie l'attaque ou le longe.
          var zNearWall = null, zNearWallD = Infinity, zNearWallPt = null;
          for (var zw = 0; zw < state.walls.length; zw++) {
            var zwl = state.walls[zw];
            var zclx = Math.max(zwl.x, Math.min(z.x, zwl.x + zwl.w));
            var zcly = Math.max(zwl.y, Math.min(z.y, zwl.y + zwl.h));
            var zwd = Math.sqrt((zclx - z.x) * (zclx - z.x) + (zcly - z.y) * (zcly - z.y));
            if (zwd < zNearWallD) { zNearWallD = zwd; zNearWall = zwl; zNearWallPt = { x: zclx, y: zcly }; }
          }
          if (zNearWall && zNearWallD < G.ZOMBIE_WALL_SENSE && !zcible.isPlayer) {
            // Démolisseur : fonce droit sur le point le plus proche du mur.
            // Fouisseur : longe le mur dans un sens fixe pour chercher une
            // faille (un trou dans la palissade) jusqu'à pouvoir passer.
            if (z.wallBreaker) {
              zcible = { x: zNearWallPt.x, y: zNearWallPt.y, isPlayer: false, wall: zNearWall };
            } else {
              var alongX = zNearWall.w >= zNearWall.h ? 1 : 0;
              var alongY = zNearWall.w >= zNearWall.h ? 0 : 1;
              if (!z.seekDir) z.seekDir = (Math.random() < 0.5 ? 1 : -1);
              var seekPt = {
                x: zNearWallPt.x + alongX * z.seekDir * 60,
                y: zNearWallPt.y + alongY * z.seekDir * 60
              };
              zcible = { x: seekPt.x, y: seekPt.y, isPlayer: false, wall: zNearWall, seeking: true };
            }
          }
          var tx = grp.x + Math.cos(z.slotAng) * z.slotDist;
          var ty = grp.y + Math.sin(z.slotAng) * z.slotDist;
          var zdx = zcible.x - z.x, zdy = zcible.y - z.y;
          var zd = Math.sqrt(zdx * zdx + zdy * zdy);
          if (z.atkCd > 0) z.atkCd -= dt;
          if (z.wallCd > 0) z.wallCd -= dt;
          if (z.lunge > 0) z.lunge -= dt;
          var nightFast = G.isNight(state.clock) ? G.ZOMBIE_NIGHT_ATTACK_FASTER : 1;
          var wallHit = zcible.wall && !zcible.seeking && zd < G.ZOMBIE_WALL_HIT;
          if (zd < 14) {
            if (zcible.isPlayer && z.atkCd <= 0) {
              z.atkCd = G.ZOMBIE_ATTACK_CD;
              p.hp -= G.ZOMBIE_PLAYER_DMG;
              // Lunge / télégraphie : élan visuel vers le joueur.
              z.lunge = G.ZOMBIE_LUNGE_TIME;
              z.lungeDx = zdx / (zd || 1); z.lungeDy = zdy / (zd || 1);
              if (p.hp <= 0) { p.hp = 0; state.gameOver = true; state.gameOverCause = "player"; }
            } else if (!zcible.isPlayer && zcible.wall && z.wallCd <= 0) {
              z.wallCd = G.ZOMBIE_WALL_CD / nightFast;
              // Attaque de meute : bonus de dégâts par assaillant proche du
              // mur (impression de coups frappés ensemble).
              zcible.wall.hp -= G.ZOMBIE_WALL_DMG + swarmBonus(z);
              z.lunge = G.ZOMBIE_LUNGE_TIME;
              z.lungeDx = zdx / (zd || 1); z.lungeDy = zdy / (zd || 1);
            } else if (!zcible.isPlayer && zcible.mairie && z.wallCd <= 0) {
              z.wallCd = G.ZOMBIE_WALL_CD / nightFast;
              zcible.mairie.hp -= G.ZOMBIE_WALL_DMG + swarmBonus(z);
              if (zcible.mairie.hp <= 0) { zcible.mairie.hp = 0; state.gameOver = true; state.gameOverCause = "mairie"; }
              z.lunge = G.ZOMBIE_LUNGE_TIME;
              z.lungeDx = zdx / (zd || 1); z.lungeDy = zdy / (zd || 1);
            }
          } else if (wallHit) {
            if (z.wallCd <= 0) {
              z.wallCd = G.ZOMBIE_WALL_CD / nightFast;
              zcible.wall.hp -= G.ZOMBIE_WALL_DMG + swarmBonus(z);
              z.lunge = G.ZOMBIE_LUNGE_TIME;
              z.lungeDx = zdx / (zd || 1); z.lungeDy = zdy / (zd || 1);
            }
          } else {
            var sx = (zcible.isPlayer ? zcible.x : tx) - z.x;
            var sy = (zcible.isPlayer ? zcible.y : ty) - z.y;
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
                var zMove = grpSpeed * z.speedFactor * dt;
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
                  // Distingue le blocage par forêt (contourner pour atteindre
                  // le mur) du blocage par mur (glisser le long).
                  var blockedByForet = G.aabbHitsForets(z.x, z.y, zs) ||
                    G.aabbHitsForets(z.x + mvx * zStep, z.y + mvy * zStep, zs);
                  if (blockedByForet) {
                    // Réoriente vers le mur le plus proche (contournement
                    // dirigé de la forêt) pour rejoindre la palissade.
                    var reWall = null, reD = G.ZOMBIE_FORET_REORIENT, rePt = null;
                    for (var rw2 = 0; rw2 < state.walls.length; rw2++) {
                      var rwm = state.walls[rw2];
                      var rlx2 = Math.max(rwm.x, Math.min(z.x, rwm.x + rwm.w));
                      var rly2 = Math.max(rwm.y, Math.min(z.y, rwm.y + rwm.h));
                      var rmd2 = Math.sqrt((rlx2 - z.x) * (rlx2 - z.x) + (rly2 - z.y) * (rly2 - z.y));
                      if (rmd2 < reD) { reD = rmd2; reWall = rwm; rePt = { x: rlx2, y: rly2 }; }
                    }
                    if (reWall && rePt) {
                      var rdx2 = rePt.x - z.x, rdy2 = rePt.y - z.y;
                      var rlen2 = Math.sqrt(rdx2 * rdx2 + rdy2 * rdy2) || 1;
                      var fStep = G.ZOMBIE_WALL_SLIDE * dt;
                      var fsx = z.x + (rdx2 / rlen2) * fStep;
                      var fsy = z.y + (rdy2 / rlen2) * fStep;
                      if (!G.aabbHitsForets(fsx, z.y, zs) && !G.aabbHitsWalls(fsx - zs, z.y - zs, G.ZOMBIE_W, G.ZOMBIE_W)) z.x = fsx;
                      if (!G.aabbHitsForets(z.x, fsy, zs) && !G.aabbHitsWalls(z.x - zs, fsy - zs, G.ZOMBIE_W, G.ZOMBIE_W)) z.y = fsy;
                    } else {
                      // Pas de mur proche : glisse le long de la forêt.
                      var fsd = (((Math.floor(state.time * 2 + z.wanderPhase) % 2) === 0) ? 1 : -1);
                      var fperpX = -mvy, fperpY = mvx;
                      var fsl = G.ZOMBIE_WALL_SLIDE * dt * fsd;
                      var fxs = z.x + fperpX * fsl, fys = z.y + fperpY * fsl;
                      if (!G.aabbHitsForets(fxs, z.y, zs) && !G.aabbHitsWalls(fxs - zs, z.y - zs, G.ZOMBIE_W, G.ZOMBIE_W)) z.x = fxs;
                      if (!G.aabbHitsForets(z.x, fys, zs) && !G.aabbHitsWalls(z.x - zs, fys - zs, G.ZOMBIE_W, G.ZOMBIE_W)) z.y = fys;
                    }
                  } else {
                    // Blocage par mur : glisse le long pour contourner.
                    var slideSpd = zcible.seeking ? G.ZOMBIE_SEEK_SLIDE : G.ZOMBIE_WALL_SLIDE;
                    var slideDir = zcible.seeking && z.seekDir ? z.seekDir :
                      (((Math.floor(state.time * 2 + z.wanderPhase) % 2) === 0) ? 1 : -1);
                    var perpX = -mvy, perpY = mvx;
                    var slide = slideSpd * dt * slideDir;
                    var sxs = z.x + perpX * slide, sys = z.y + perpY * slide;
                    if (!G.aabbHitsWalls(sxs - zs, z.y - zs, G.ZOMBIE_W, G.ZOMBIE_W) && !G.aabbHitsForets(sxs, z.y, zs)) z.x = sxs;
                    if (!G.aabbHitsWalls(z.x - zs, sys - zs, G.ZOMBIE_W, G.ZOMBIE_W) && !G.aabbHitsForets(z.x, sys, zs)) z.y = sys;
                  }
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

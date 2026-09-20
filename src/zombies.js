// Zombies : vagues nocturnes, spawn depuis les 4 bords de la carte,
// convergence vers la mairie, attaque des murs/joueurs sur le chemin,
// séparation (1 px d'écart entre zombies).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Spawn d'une vague de zombies : les directions d'arrivée sont tirées au
  // hasard par vague (1, 2 ou 4 bords de la carte). Chaque groupe arrive
  // depuis une des directions tirées et converge vers la mairie au centre.
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

  // Tire le schéma de directions d'une vague : 1, 2 ou 4 bords de la carte
  // (1/3 chacun). Pré-tiré à chaque réarmement matinal dans
  // state.pendingWave { sides, count } : la montgolfière peut annoncer la
  // vague de la nuit suivante AVANT 22h ; spawnWave consomme le tirage.
  // Facteur de montée en difficulté : les nuits où la vague atteint le
  // plafond ZOMBIE_WAVE_MAX, les stats des zombies montent de +10% par nuit
  // (dégâts/s, PV, vitesse), capées à +50%. waveCount est le nombre de
  // zombies de la vague en cours (plafonné) : ramp = nuits de dépassement.
  G.zombieRamp = function () {
    var r = G.state.zombieRamp;
    return (typeof r === "number" && r >= 1) ? r : 1;
  };

  G.rollWave = function (day) {
    var state = G.state;
    var count = G.ZOMBIE_PER_WAVE_BASE * Math.pow(G.ZOMBIE_WAVE_GROWTH, day);
    // Plafond : le nombre de zombies par nuit est capé a ZOMBIE_WAVE_MAX.
    // Chaque nuit ou la vague demandee depasse le plafond monte la difficulte
    // des zombies (deja en jeu comme futurs spawns) de +10% sur degats/s, PV
    // et vitesse, capé a +50% (cf. state.zombieRamp ci-dessous).
    var raw = count;
    if (G.ZOMBIE_WAVE_MAX && raw > G.ZOMBIE_WAVE_MAX) raw = G.ZOMBIE_WAVE_MAX;
    var scheme = Math.random();
    var sides;
    if (scheme < 1 / 3) {
      sides = [Math.floor(Math.random() * 4)];
    } else if (scheme < 2 / 3) {
      var s1 = Math.floor(Math.random() * 4);
      var s2 = (s1 + 1 + Math.floor(Math.random() * 3)) % 4;
      sides = [s1, s2];
    } else {
      sides = [0, 1, 2, 3];
    }
    state.pendingWave = { sides: sides, count: Math.round(raw), rawCount: Math.round(count) };
    return state.pendingWave;
  };

  G.spawnWave = function () {
    var state = G.state;
    // Consomme le pré-tirage de la vague (rollWave au réveil matinal) ;
    // s'il n'existe pas (test, première nuit), tire maintenant. Le prétirage
    // est effacé : la montgolfière ne doit pas ressasser une vague passée.
    var pending = state.pendingWave || G.rollWave(state.day);
    state.pendingWave = null;
    var count = pending.count;
    state.waveCount = Math.round(count);
    // Montee en difficulte : chaque nuit ou la vague demandee depasse le
    // plafond ZOMBIE_WAVE_MAX augmente les degats/s, les PV et la vitesse des
    // zombies de +10% (capé a +50%). Le ramp se cumule nuit apres nuit tant
    // que la croissance demande plus de zombies que le plafond.
    state.zombieRamp = 1;
    if (G.ZOMBIE_WAVE_MAX && (pending.rawCount || count) > G.ZOMBIE_WAVE_MAX) {
      var overNights = Math.ceil(((pending.rawCount || count) - G.ZOMBIE_WAVE_MAX) / G.ZOMBIE_WAVE_MAX);
      var rampNights = Math.min(overNights, Math.ceil(G.ZOMBIE_RAMP_MAX / G.ZOMBIE_RAMP_STEP));
      state.zombieRamp = 1 + rampNights * G.ZOMBIE_RAMP_STEP;
    }
    var sides = pending.sides;
    state.waveSides = sides;
    var nbGroups = Math.ceil(count / G.GROUP_SIZE);
    state.zombieGroups = [];
    for (var g = 0; g < nbGroups; g++) {
      // Chaque groupe vient d'un des bords tirés pour cette vague (au-delà
      // de la ville), réparti sur les directions du schéma.
      var side = sides[g % sides.length];
      var lx, ly;
      var edge = G.rand(40, 200);
      if (side === 0) { lx = G.rand(0, G.WORLD); ly = edge; }
      else if (side === 1) { lx = G.rand(0, G.WORLD); ly = G.WORLD - edge; }
      else if (side === 2) { lx = edge; ly = G.rand(0, G.WORLD); }
      else { lx = G.WORLD - edge; ly = G.rand(0, G.WORLD); }
      var grp = { x: lx, y: ly, members: [], hasRaider: false, spawnSide: side,
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
        // Pres d'un bord de la carte, la formation peut deborder : on clampe
        // le spawn a l'interieur de la carte (le zombie rejoint sa formation
        // en marchant, il ne doit pas apparaitre hors du monde).
        zx = G.clamp(zx, 12, G.WORLD - 12);
        zy = G.clamp(zy, 12, G.WORLD - 12);
        // Ne spawne pas a l'interieur d'une foret : la collision la traite
        // comme un bloc plein, le zombie y serait prisonnier. On pousse le
        // point de spawn hors du massif en s'ecartant du centre du groupe.
        if (G.foretAt && G.foretAt(zx, zy)) {
          for (var pf = 1; pf <= 16; pf++) {
            var pfd = dist + pf * 20;
            var pfx = lx + Math.cos(ang) * pfd;
            var pfy = ly + Math.sin(ang) * pfd;
            if (!G.foretAt(pfx, pfy)) { zx = pfx; zy = pfy; break; }
          }
        }
        // Caractère propre à chaque zombie pour un mouvement vivant :
        // speedFactor = vitesse relative (±ZOMBIE_SPEED_VAR), wanderPhase/Freq =
        // phase et fréquence d'oscillation du cap ("drunken walk").
        // Rôles d'attaque : harasser (éclaireur qui harcèle le joueur de loin),
        // raider (pilleur qui pousse son groupe vers les planches construites).
        // slotAng/slotDist = position de slot actuelle (animée), slotAngT/
        // slotDistT = cible (recalculée selon formation/mode, lerpée pour la
        // fusion animée). isLeader = zombie d'index 0 (mène la marche).
        var sf = 1 + G.rand(-G.ZOMBIE_SPEED_VAR, G.ZOMBIE_SPEED_VAR);
        var z = {
          x: zx, y: zy, hp: Math.max(1, Math.round(G.ZOMBIE_HP * G.zombieRamp())), atkCd: 0, wallCd: 0, group: grp,
          slotAng: ang, slotDist: dist, slotAngT: ang, slotDistT: dist,
          speedFactor: G.clamp(sf, 0.4, 1.6),
          wanderPhase: Math.random() * Math.PI * 2,
          wanderFreq: G.ZOMBIE_WANDER_FREQ * (0.7 + Math.random() * 0.6),
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
    // Cycle jour/nuit : les vagues sont pilotees par l'horloge (22h = spawn,
    // lever du jour = rearmement), pas par un simple timer d'elapsed.
    var prevClock = state.clock - (12 / G.DAY_SECONDS) * G.TIME_SCALE * dt;
    if (prevClock < 0) prevClock += 24;
    // 22h (NIGHT_WAVE_HOUR) : spawn d'une nouvelle vague + message.
    var waveHour = (G.NIGHT_WAVE_HOUR !== undefined) ? G.NIGHT_WAVE_HOUR : 22;
    var crossedWaveHour = prevClock < waveHour && state.clock >= waveHour;
    // Nuit de tranquillite (amelioration universite) : la vague de cette nuit
    // est annulee, le drapeau de vague reste armee pour la nuit suivante.
    if (state.peacefulNight) {
      if (crossedWaveHour && !state.waveSpawnedForDay) {
        state.peacefulNight = false;
        state.waveSpawnedForDay = true;
        state.waveMsgTimer = 8;
        if (G.addFloater) G.addFloater("Nuit de tranquillite : pas de vague cette nuit");
      }
      var crossedMorningP = prevClock < 8 && state.clock >= 8;
      if (crossedMorningP) {
        state.waveSpawnedForDay = false;
        G.rollWave(state.day + 1);
      }
      state.waveActive = false;
    }
    if (crossedWaveHour && !state.waveSpawnedForDay && !state.peacefulNight) {
      G.spawnWave();
      state.waveActive = true;
      state.waveSpawnedForDay = true;
      state.zombieMode = "attack";
      state.groupMergeTimer = 0;
      state.waveMsgTimer = 8; // message "Vague de zombies" affiche 8 s
    }
    if (state.waveMsgTimer > 0) state.waveMsgTimer -= dt;
    if (state.hordeMsgTimer > 0) state.hordeMsgTimer -= dt;
    // 8h : on rearme le drapeau de vague pour la nuit suivante. Les zombies
    // restent en mode attaque (agressifs autant le jour que la nuit).
    var crossedMorning = prevClock < 8 && state.clock >= 8;
    if (crossedMorning) {
      state.waveSpawnedForDay = false;
      // Pré-tire la vague de la nuit suivante (volume + directions) pour que
      // la montgolfière puisse l'annoncer dès le matin.
      G.rollWave(state.day + 1);
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
    // Seuls les tirs des JOUEURS font du bruit : les fléches des tours sont
    // tirées en continu et rafraîchiraient lastShot à chaque tick, collant
    // les groupes indéfiniment sur un point sans rien attaquer.
    var projN = 0, lastPlayerProj = null;
    if (state.projectiles) {
      for (var ppi = 0; ppi < state.projectiles.length; ppi++) {
        var ppr = state.projectiles[ppi];
        if (ppr.owner === "tour") continue;
        projN++;
        lastPlayerProj = ppr;
      }
    }
    var prevN = state._prevProjN || 0;
    if (projN > prevN && projN > 0 && lastPlayerProj) {
      lastShot = { x: lastPlayerProj.x, y: lastPlayerProj.y, t: state.time };
    }
    state._prevProjN = projN;
    if (lastShot && (state.time - lastShot.t) > G.ZOMBIE_NOISE_TIME) lastShot = null;
    state.lastShot = lastShot;

    var p = state.player;
    // Cibles vivantes : en mode serveur ce sont les vrais joueurs
    // (state.players) ; en local, le joueur unique (state.player). Sans cette
    // distinction, les zombies du serveur couraient vers le joueur fantingue
    // du centre du monde et les vrais joueurs n'etaient jamais attaques.
    var preys = [];
    if (state.players && state.players.length > 0) {
      for (var pri = 0; pri < state.players.length; pri++) {
        if (state.players[pri].alive) preys.push(state.players[pri]);
      }
    }
    if (preys.length === 0) preys.push(p);
    function nearestPrey(x, y) {
      var best = preys[0], bestD = Infinity;
      for (var pri2 = 0; pri2 < preys.length; pri2++) {
        var pr = preys[pri2];
        var prd = (pr.x - x) * (pr.x - x) + (pr.y - y) * (pr.y - y);
        if (prd < bestD) { bestD = prd; best = pr; }
      }
      return best;
    }
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
              var nx = z.x + (dx / d) * push;
              var ny = z.y + (dy / d) * push;
              // Ne pousse pas a l'interieur d'une foret : la collision la
              // traite comme un bloc plein, le zombie y resterait piege.
              if (!G.aabbHitsForets(nx, z.y, zs) || G.aabbHitsForets(z.x, z.y, zs)) z.x = nx;
              if (!G.aabbHitsForets(z.x, ny, zs) || G.aabbHitsForets(z.x, z.y, zs)) z.y = ny;
            } else if (d <= 0.01) {
              // Superposition exacte : pousse dans une direction aléatoire
              // (sans entrer dans une foret).
              var rx = z.x + G.rand(-1, 1), ry = z.y + G.rand(-1, 1);
              if (!G.aabbHitsForets(rx, z.y, zs) || G.aabbHitsForets(z.x, z.y, zs)) z.x = rx;
              if (!G.aabbHitsForets(z.x, ry, zs) || G.aabbHitsForets(z.x, z.y, zs)) z.y = ry;
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
        var preyG = nearestPrey(grp.x, grp.y);
        var pdx = preyG.x - grp.x, pdy = preyG.y - grp.y;
        var distP = Math.sqrt(pdx * pdx + pdy * pdy);
        if (distP < G.ZOMBIE_ATTACK_RANGE) {
          cible = { x: preyG.x, y: preyG.y, isPlayer: true, prey: preyG };
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
          // Objectif principal : la mairie. Le mur n'est ciblé que s'il
          // barre réellement la route (mur le plus proche à moins de 40 px).
          // Quand la planche attaquée tombe, la brèche rend le mur suivant
          // plus loin que la mairie : le groupe re-vise la mairie au lieu de
          // ronger toute la palissade planche par planche.
          var mairieD = Infinity;
          var mCx = mairie.x + mairie.w / 2, mCy = mairie.y + mairie.h / 2;
          var mdx2 = mCx - grp.x, mdy2 = mCy - grp.y;
          mairieD = Math.sqrt(mdx2 * mdx2 + mdy2 * mdy2);
          if (best && bestD < 40 && bestD <= mairieD) {
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
          // Bruit consommé : une fois le groupe arrivé sur le point de tir,
          // il n'y a plus rien à attaquer — il reprend son objectif principal
          // (mairie/mur/tour) au lieu de rester parqué en formation sur place.
          if (nsd < G.ZOMBIE_NOISE_RANGE && nsd > 60) {
            cible = { x: lastShot.x, y: lastShot.y, isPlayer: false, noise: true };
          }
        }
        var ldx = cible.x - grp.x, ldy = cible.y - grp.y;
        var ld = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
        // Bonus de vitesse en mode horde : le groupe avance plus vite.
        var grpSpeed = (grp.isHorde ? G.ZOMBIE_SPEED * (1 + G.ZOMBIE_HORDE_SPEED_BONUS) : G.ZOMBIE_SPEED) * G.zombieRamp();
        // Chef pris a l'interieur d'une foret : la collision la traite comme
        // un bloc plein, aucune position interieure n'est valide. Il marche
        // vers le bord du massif situe dans la direction de sa cible (repli :
        // bord le plus proche) pour en sortir, puis reprend sa route.
        var grpIn = G.foretAt && G.foretAt(grp.x, grp.y);
        if (grpIn) {
          var eCx = grpIn.x + grpIn.w / 2, eCy = grpIn.y + grpIn.h / 2;
          var eDx = grp.x - eCx, eDy = grp.y - eCy;
          var eLen = Math.sqrt(eDx * eDx + eDy * eDy) || 1;
          var eStep = grpSpeed * dt;
          // Point de sortie : projette la direction cible sur le bord de
          // l'AABB de la foret (premiere arete coupee), sinon le bord le plus
          // proche du chef. Sortir vers la cible evite de se pieger dans un
          // coin de carte (bord le plus proche = pire endroit).
          var outX = 0, outY = 0, outFound = false;
          var cDx = cible.x - grp.x, cDy = cible.y - grp.y;
          var cLen = Math.sqrt(cDx * cDx + cDy * cDy) || 1;
          var cUx = cDx / cLen, cUy = cDy / cLen;
          if (cUx > 0.001) { var tR = (grpIn.x + grpIn.w - grp.x) / cUx; if (tR > 0) { var yR = grp.y + cUy * tR; if (yR >= grpIn.y && yR <= grpIn.y + grpIn.h) { outX = grpIn.x + grpIn.w; outY = yR; outFound = true; } } }
          if (!outFound && cUx < -0.001) { var tL = (grpIn.x - grp.x) / cUx; if (tL > 0) { var yL = grp.y + cUy * tL; if (yL >= grpIn.y && yL <= grpIn.y + grpIn.h) { outX = grpIn.x; outY = yL; outFound = true; } } }
          if (!outFound && cUy > 0.001) { var tB = (grpIn.y + grpIn.h - grp.y) / cUy; if (tB > 0) { var xB = grp.x + cUx * tB; if (xB >= grpIn.x && xB <= grpIn.x + grpIn.w) { outX = xB; outY = grpIn.y + grpIn.h; outFound = true; } } }
          if (!outFound && cUy < -0.001) { var tT = (grpIn.y - grp.y) / cUy; if (tT > 0) { var xT = grp.x + cUx * tT; if (xT >= grpIn.x && xT <= grpIn.x + grpIn.w) { outX = xT; outY = grpIn.y; outFound = true; } } }
          var exitDx, exitDy;
          if (outFound) {
            exitDx = outX - grp.x; exitDy = outY - grp.y;
          } else {
            exitDx = eDx; exitDy = eDy;
          }
          var exitLen = Math.sqrt(exitDx * exitDx + exitDy * exitDy) || 1;
          grp.x += (exitDx / exitLen) * eStep;
          grp.y += (exitDy / exitLen) * eStep;
        } else if (ld > 10) {
          // Le chef trace la route en evitant les forets (sous-pas + glissement
          // le long du contour) : sans cela il traverse les arbres, ses slots
          // se retrouvent en pleine foret et les membres s'enlisent contre les
          // arbres sans jamais atteindre la palissade ou la mairie.
          // Pilotage "whisker" avec memoire de cap : si le cap direct est
          // bloque par une foret, on essaie des caps de plus en plus devies
          // (15 a 180 degres des deux cotes, sens preferentiel fixe par
          // groupe). Le premier cap libre devient le cap courant MEMORISE :
          // aux ticks suivants on re-essaie d'abord de se rapprocher du cap
          // direct (retour de trajectoire des qu'une ebauche de passage
          // existe), ce qui produit un vrai contournement du massif plutot
          // qu'un enlisement au bord.
          if (!grp.foretSeekDir) grp.foretSeekDir = (Math.random() < 0.5 ? 1 : -1);
          // Cap de base : suit le champ de navigation (BFS vers la ville)
          // quand il est disponible — il contourne les massifs par le chemin
          // le plus court. Repli sur la ligne droite si la cellule est hors
          // champ (poche fermee : l'evasion locale prend le relais).
          var navPt = G.navStep ? G.navStep(grp.x, grp.y) : null;
          var gBaseAng = navPt ? Math.atan2(navPt.y - grp.y, navPt.x - grp.x) : Math.atan2(ldy, ldx);
          var gStep = 16;
          var gMove = grpSpeed * dt;
          var gDone = 0;
          var gHalf = 6;
          while (gDone < gMove - 0.001) {
            var gInc = Math.min(gStep, gMove - gDone);
            var gMoved = false;
            // Retour de trajectoire : apres un contournement, reessaie le cap
            // direct en priorite et efface la memoire s'il est libre.
            if (grp.foretCurAng !== undefined) {
              var rvx = Math.cos(gBaseAng), rvy = Math.sin(gBaseAng);
              var rsx = grp.x + rvx * gInc, rsy = grp.y + rvy * gInc;
              var rBx = rsx > 12 && rsx < G.WORLD - 12 && !G.aabbHitsForets(rsx, grp.y, gHalf);
              var rBy = rsy > 12 && rsy < G.WORLD - 12 && !G.aabbHitsForets(grp.x, rsy, gHalf);
              if (rBx || rBy) {
                if (rBx) grp.x = rsx;
                if (rBy) grp.y = rsy;
                grp.foretCurAng = undefined;
                gMoved = true;
              }
            }
            for (var wTry = 0; wTry <= 12 && !gMoved; wTry++) {
              var wDev = (wTry === 0) ? 0 : (Math.PI / 12) * wTry * (wTry % 2 === 1 ? 1 : -1) * grp.foretSeekDir;
              var wAng = (grp.foretCurAng !== undefined ? grp.foretCurAng : gBaseAng) + wDev;
              var wvx = Math.cos(wAng), wvy = Math.sin(wAng);
              var wsx = grp.x + wvx * gInc;
              var wsy = grp.y + wvy * gInc;
              var wBx = false, wBy = false;
              if (wsx > 12 && wsx < G.WORLD - 12 && !G.aabbHitsForets(wsx, grp.y, gHalf)) { grp.x = wsx; wBx = true; }
              if (wsy > 12 && wsy < G.WORLD - 12 && !G.aabbHitsForets(grp.x, wsy, gHalf)) { grp.y = wsy; wBy = true; }
              if (wBx || wBy) {
                gMoved = true;
                if (grp.foretCurAng === undefined) grp.foretCurAng = wAng;
              }
            }
            if (!gMoved) {
              // Tous les caps bloques (cul-de-sac) : inverse le sens de longe.
              grp.foretSeekDir = -grp.foretSeekDir;
              grp.foretCurAng = undefined;
            }
            gDone += gInc;
          }
        }
        for (var mi = 0; mi < grp.members.length; mi++) {
          var z = grp.members[mi];
          // Cible effective de ce zombie. Un harceleur se détache du groupe
          // pour traquer le joueur seul s'il le détecte à portée (crée une
          // escouade divergente qui harcèle le joueur pendant que le reste du
          // groupe fonce sur la mairie/murs).
          var zcible = cible;
          if (z.harasser) {
            var preyH = nearestPrey(z.x, z.y);
            var hpdx = preyH.x - z.x, hpdy = preyH.y - z.y;
            if (Math.sqrt(hpdx * hpdx + hpdy * hpdy) < G.ZOMBIE_HARASS_RANGE) {
              zcible = { x: preyH.x, y: preyH.y, isPlayer: true, prey: preyH };
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
          } else if (state.towers && state.towers.length > 0 && !zcible.isPlayer) {
            // Priorite 2 : tour accessible (palissade absente a portee).
            // Le zombie fonce sur la tour la plus proche a portee de sense et
            // l'attaque comme une palissade (memes degats/cooldown). N.B. : on
            // est dans le "else" du mur a portee : un mur hors de portee de
            // sense ne doit PAS masquer la tour (zNearWall garde le mur le plus
            // proche du monde entier, toujours defini s'il existe des murs).
            var zNearTower = null, zNearTowerD = Infinity, zNearTowerPt = null;
            for (var zt = 0; zt < state.towers.length; zt++) {
              var ztw = state.towers[zt];
              var ztlx = Math.max(ztw.x, Math.min(z.x, ztw.x + ztw.w));
              var ztly = Math.max(ztw.y, Math.min(z.y, ztw.y + ztw.h));
              var ztd = Math.sqrt((ztlx - z.x) * (ztlx - z.x) + (ztly - z.y) * (ztly - z.y));
              if (ztd < zNearTowerD) { zNearTowerD = ztd; zNearTower = ztw; zNearTowerPt = { x: ztlx, y: ztly }; }
            }
            if (zNearTower && zNearTowerD < G.ZOMBIE_WALL_SENSE) {
              zcible = { x: zNearTowerPt.x, y: zNearTowerPt.y, isPlayer: false, tower: zNearTower };
            }
          }
          var tx = grp.x + Math.cos(z.slotAng) * z.slotDist;
          var ty = grp.y + Math.sin(z.slotAng) * z.slotDist;
          var zdx = zcible.x - z.x, zdy = zcible.y - z.y;
          var zd = Math.sqrt(zdx * zdx + zdy * zdy);
          if (z.atkCd > 0) z.atkCd -= dt;
          if (z.wallCd > 0) z.wallCd -= dt;
          if (z.lunge > 0) z.lunge -= dt;
          var wallHit = zcible.wall && !zcible.seeking && zd < G.ZOMBIE_WALL_HIT;
          var towerHit = zcible.tower && zd < G.ZOMBIE_WALL_HIT;
          if (zd < 14) {
            if (zcible.isPlayer && z.atkCd <= 0) {
              z.atkCd = G.ZOMBIE_ATTACK_CD;
              var tgt = zcible.prey || p;
              tgt.hp -= Math.round(G.ZOMBIE_PLAYER_DMG * G.zombieRamp());
              // Lunge / télégraphie : élan visuel vers le joueur.
              z.lunge = G.ZOMBIE_LUNGE_TIME;
              z.lungeDx = zdx / (zd || 1); z.lungeDy = zdy / (zd || 1);
              if (tgt.hp <= 0) {
                tgt.hp = 0;
                if (tgt !== p && state.players) {
                  // Vrai joueur (serveur) : il meurt, la partie continue tant
                  // qu'il reste un survivant.
                  tgt.alive = false;
                  var anyAlive = false;
                  for (var pai = 0; pai < state.players.length; pai++) {
                    if (state.players[pai].alive) { anyAlive = true; break; }
                  }
                  if (!anyAlive) { state.gameOver = true; state.gameOverCause = "player"; }
                } else {
                  state.gameOver = true; state.gameOverCause = "player";
                }
              }
            } else if (!zcible.isPlayer && zcible.wall && z.wallCd <= 0) {
              z.wallCd = G.ZOMBIE_WALL_CD;
              // Attaque de meute : bonus de dégâts par assaillant proche du
              // mur (impression de coups frappés ensemble).
              zcible.wall.hp -= Math.round(G.ZOMBIE_WALL_DMG * G.zombieRamp()) + swarmBonus(z);
              z.lunge = G.ZOMBIE_LUNGE_TIME;
              z.lungeDx = zdx / (zd || 1); z.lungeDy = zdy / (zd || 1);
            } else if (!zcible.isPlayer && zcible.tower && z.wallCd <= 0) {
              // Attaque de tour : memes regles que les palissades (degats +
              // bonus de meute, cooldown partage wallCd).
              z.wallCd = G.ZOMBIE_WALL_CD;
              zcible.tower.hp -= Math.round(G.ZOMBIE_WALL_DMG * G.zombieRamp()) + swarmBonus(z);
              z.lunge = G.ZOMBIE_LUNGE_TIME;
              z.lungeDx = zdx / (zd || 1); z.lungeDy = zdy / (zd || 1);
            } else if (!zcible.isPlayer && zcible.mairie && z.wallCd <= 0) {
              z.wallCd = G.ZOMBIE_WALL_CD;
              zcible.mairie.hp -= Math.round(G.ZOMBIE_WALL_DMG * G.zombieRamp()) + swarmBonus(z);
              if (zcible.mairie.hp <= 0) { zcible.mairie.hp = 0; state.gameOver = true; state.gameOverCause = "mairie"; }
              z.lunge = G.ZOMBIE_LUNGE_TIME;
              z.lungeDx = zdx / (zd || 1); z.lungeDy = zdy / (zd || 1);
            }
          } else if (wallHit || towerHit) {
            if (z.wallCd <= 0) {
              z.wallCd = G.ZOMBIE_WALL_CD;
              var hitTarget = wallHit ? zcible.wall : zcible.tower;
              hitTarget.hp -= Math.round(G.ZOMBIE_WALL_DMG * G.zombieRamp()) + swarmBonus(z);
              z.lunge = G.ZOMBIE_LUNGE_TIME;
              z.lungeDx = zdx / (zd || 1); z.lungeDy = zdy / (zd || 1);
            } else {
              // Collé à la cible mais en cooldown : il ne reste pas figé,
              // il continue de presser/frapper la cible (élan visuel).
              z.lunge = G.ZOMBIE_LUNGE_TIME;
              z.lungeDx = zdx / (zd || 1); z.lungeDy = zdy / (zd || 1);
            }
          } else {
            var sx = (zcible.isPlayer ? zcible.x : tx) - z.x;
            var sy = (zcible.isPlayer ? zcible.y : ty) - z.y;
            var sd = Math.sqrt(sx * sx + sy * sy) || 1;
            // Groupe arrivé sur son objectif (chef à l'arrêt à portée de
            // mur/tour/mairie, ou mur/tour détecté individuellement) : le
            // zombie ne reste pas en orbite autour du chef en formation — il
            // pousse en continu vers le point d'attaque tant qu'il n'est pas
            // à portée de coup. Le signal est stable (condition de groupe,
            // pas de position de slot) : pas d'oscillation slot/objectif.
            var arrive = !zcible.isPlayer &&
                (zcible.wall || zcible.tower || zcible.mairie) &&
                (ld <= G.ZOMBIE_WALL_SENSE ||
                 (zNearWall && zNearWallD < G.ZOMBIE_WALL_SENSE) ||
                 (zcible.tower && zd < G.ZOMBIE_WALL_SENSE * 2)) &&
                zd > (zcible.seeking ? 14 : zcible.mairie ? 13 : G.ZOMBIE_WALL_HIT);
            if (arrive) {
              sx = zcible.x - z.x; sy = zcible.y - z.y;
              sd = Math.sqrt(sx * sx + sy * sy) || 1;
            }
            if (sd > 4) {
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
                    if (G.aabbHitsForets(z.x, z.y, zs)) {
                      // Zombie a l'interieur d'une foret (spawn bord de carte,
                      // repoussement de separation) : la collision traite le
                      // massif comme un bloc plein, aucune position interieure
                      // n'est valide. Il marche droit vers le bord le plus
                      // proche pour en sortir avant tout autre chose.
                      var zF = G.foretAt ? G.foretAt(z.x, z.y) : null;
                      if (zF) {
                        var fCx = zF.x + zF.w / 2, fCy = zF.y + zF.h / 2;
                        var eDx = z.x - fCx, eDy = z.y - fCy;
                        var eLen = Math.sqrt(eDx * eDx + eDy * eDy) || 1;
                        var eStep = grpSpeed * z.speedFactor * dt;
                        z.x += (eDx / eLen) * eStep;
                        z.y += (eDy / eLen) * eStep;
                      }
                    } else {
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
                      var fsMoved = false;
                      if (!G.aabbHitsForets(fsx, z.y, zs) && !G.aabbHitsWalls(fsx - zs, z.y - zs, G.ZOMBIE_W, G.ZOMBIE_W)) { z.x = fsx; fsMoved = true; }
                      if (!G.aabbHitsForets(z.x, fsy, zs) && !G.aabbHitsWalls(z.x - zs, fsy - zs, G.ZOMBIE_W, G.ZOMBIE_W)) { z.y = fsy; fsMoved = true; }
                      if (!fsMoved) reWall = null;
                    }
                    if (!reWall) {
                      // Pas de mur proche ou direction du mur bloquee : glisse le long de la forêt dans
                      // un sens fixe propre au zombie (le sens n'est inversé
                      // que si le passage est bouché) — l'alternance rapide
                      // faisait osciller le zombie sur place au bord du massif.
                      if (!z.foretSeekDir) z.foretSeekDir = (Math.random() < 0.5 ? 1 : -1);
                      var fperpX = -mvy * z.foretSeekDir, fperpY = mvx * z.foretSeekDir;
                      var fsl = G.ZOMBIE_WALL_SLIDE * dt;
                      var fxs = z.x + fperpX * fsl, fys = z.y + fperpY * fsl;
                      var fMoved = false;
                      if (!G.aabbHitsForets(fxs, z.y, zs) && !G.aabbHitsWalls(fxs - zs, z.y - zs, G.ZOMBIE_W, G.ZOMBIE_W)) { z.x = fxs; fMoved = true; }
                      if (!G.aabbHitsForets(z.x, fys, zs) && !G.aabbHitsWalls(z.x - zs, fys - zs, G.ZOMBIE_W, G.ZOMBIE_W)) { z.y = fys; fMoved = true; }
                      if (!fMoved && z.blockedSides > 8) {
                        z.foretSeekDir = -z.foretSeekDir;
                        z.blockedSides = 0;
                        // Coin de massif (les deux sens de longe bloqués) :
                        // s'échappe en s'écartant du centre de la forêt — le
                        // glissement reprend ensuite le long d'une autre
                        // face au lieu de rester planté au coin.
                        var cf = G.foretAt ? G.foretAt(z.x, z.y) : null;
                        if (!cf) {
                          var nearF = null, nfD = 40;
                          for (var nfx = -1; nfx <= 1; nfx++) {
                            for (var nfy = -1; nfy <= 1; nfy++) {
                              var cf2 = G.foretAt(z.x + nfx * 12, z.y + nfy * 12);
                              if (cf2) { nearF = cf2; break; }
                            }
                            if (nearF) break;
                          }
                          cf = nearF;
                        }
                        if (cf) {
                          var ccx = cf.x + cf.w / 2, ccy = cf.y + cf.h / 2;
                          var cex = z.x - ccx, cey = z.y - ccy;
                          var cel = Math.sqrt(cex * cex + cey * cey) || 1;
                          var esc = G.ZOMBIE_WALL_SLIDE * dt * 2;
                          var esx = z.x + (cex / cel) * esc, esy = z.y + (cey / cel) * esc;
                          if (!G.aabbHitsForets(esx, z.y, zs) && esx > 12 && esx < G.WORLD - 12) z.x = esx;
                          if (!G.aabbHitsForets(z.x, esy, zs) && esy > 12 && esy < G.WORLD - 12) z.y = esy;
                        }
                      }
                    }
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
                    // Fouisseur patient épuisé : le contournement ne trouve
                    // pas de faille (palissade fermée), il ne reste pas
                    // inactif — il attaque le mur qu'il longe.
                    if (z.blockedSides > 12 && z.wallCd <= 0) {
                      var atkWall = zNearWall || zcible.wall;
                      if (atkWall) {
                        z.wallCd = G.ZOMBIE_WALL_CD;
                        atkWall.hp -= Math.round(G.ZOMBIE_WALL_DMG * G.zombieRamp()) + swarmBonus(z);
                        z.lunge = G.ZOMBIE_LUNGE_TIME;
                        z.lungeDx = mvx; z.lungeDy = mvy;
                        z.blockedSides = 0;
                      }
                    }
                  }
                } else {
                  z.blockedSides = 0;
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
        // Trace au sol : laisse une marque la ou le zombie est mort. La variante
        // est tiree aleatoirement dans une plage large (le client applique un
        // modulo sur le nombre reel de PNG disponibles au rendu, donc cote
        // serveur aucune connaissance des PNG n'est necessaire). Coordonnees
        // legeres, broadcastees a 10 Hz. Une legere rotation aleatoire casse
        // la repetition.
        if (state.deadTraces) {
          state.deadTraces.push({
            x: Math.round(dz.x), y: Math.round(dz.y),
            v: Math.floor(Math.random() * 100),
            r: Math.round(Math.random() * 360 - 180)
          });
          // Plafonne le nombre de traces pour eviter une croissance infinie
          // (snapshot + rendu) sur les longues parties : on garde les plus recentes.
          if (state.deadTraces.length > G.DEAD_TRACES_MAX) {
            state.deadTraces.splice(0, state.deadTraces.length - G.DEAD_TRACES_MAX);
          }
        }
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

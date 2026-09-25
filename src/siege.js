// Tour de siège (cf. docs/siege.md) : ennemi nocturne qui avance vers la
// palissade à mi-vitesse des zombies, s'y colle, s'ouvre et libère 100
// zombies de l'autre côté. Nuit 1 : aucune. Nuit 2 : une. Nuits suivantes :
// suit la croissance des vagues (une par doublement), plafonné à 10.
// Module partagé client + serveur : chargé AVANT zombies.js (les zombies
// ignorent les tours de siège : elles ne sont pas une cible de l'IA).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Directions de déplacement d'une tour de siège (les 4 diagonales de la
  // carte) : [dx, dy, clé sprite, nom lisible]. Les cartes de ce jeu sont
  // encoordonnées monde x Est, y Sud ; les dossiers de sprites sont nommés
  // par le sens de marche (ex. sud-est -> nord-ouest).
  G.SIEGE_DIRS = [
    { key: "sud-est-vers-nord-ouest", dx: -1, dy: -1, label: "du sud-est" },
    { key: "sud-ouest-vers-nord-est", dx: 1, dy: -1, label: "du sud-ouest" },
    { key: "nord-est-vers-sud-ouest", dx: -1, dy: 1, label: "du nord-est" },
    { key: "nord-ouest-vers-sud-est", dx: 1, dy: 1, label: "du nord-ouest" }
  ];

  // Direction de déplacement d'une tour à partir de son vecteur de
  // déplacement (normalisé). Renvoie l'entrée SIEGE_DIRS correspondante,
  // repli sur la première diagonale.
  G.siegeDirFromVector = function (dx, dy) {
    var negX = dx < 0, negY = dy < 0;
    for (var i = 0; i < G.SIEGE_DIRS.length; i++) {
      var d = G.SIEGE_DIRS[i];
      if ((d.dx < 0) === negX && (d.dy < 0) === negY) return d;
    }
    return G.SIEGE_DIRS[0];
  };

  // Nombre de tours de siège prévues pour la nuit du jour `day` (0-indexé :
  // day 0 = première nuit) : nuit 1 -> 0, nuit 2 -> 1, puis la même croissance
  // que les vagues de zombies (x2 par nuit : 1, 2, 4, 8, 16...), plafonné à
  // SIEGE_MAX_TOWERS. Le plafond est atteint dès la nuit 6.
  G.siegeCountForDay = function (day) {
    if (day < 1) return 0;
    var n = Math.pow(G.ZOMBIE_WAVE_GROWTH, day - 1);
    return Math.min(Math.round(n), G.SIEGE_MAX_TOWERS);
  };

  // Losange de collision d'une tour : la base isométrique du PNG, inscrite
  // dans les SIEGE_COLLIDE_BOTTOM % les plus bas de sa hauteur. Demi-largeur
  // = celle du sprite rendu (cf. drawSiegeTower : s.w / 2 de large),
  // demi-hauteur = la moitié de la bande basse. Beaucoup plus étroit qu'un
  // bloc rectangulaire plein : la pointe avant du losange s'insinue en
  // diagonale entre les forêts et longe les obstacles sans se coincer.
  G.siegeDiamond = function (s) {
    var dh = s.h * G.SIEGE_COLLIDE_BOTTOM;
    return { cx: s.x, cy: s.y - dh / 2, a: (s.w * 0.5) / 2, b: dh / 2 };
  };

  // AABB de bruissage du losange de base (tests de contact, écrasement).
  G.siegeFootprint = function (s) {
    var d = G.siegeDiamond(s);
    return { x: d.cx - d.a, y: d.cy - d.b, w: d.a * 2, h: d.b * 2 };
  };

  // Test EXACT losange (centre cx,cy, demi-largeur a, demi-hauteur b) contre
  // une boîte : une boîte est un produit cartésien, la minimisation de
  // |x-cx|/a + |y-cy|/b se sépare par axe.
  G.diamondHitsBox = function (d, x, y, w, h) {
    var gx = Math.max(0, x - d.cx, d.cx - (x + w));
    var gy = Math.max(0, y - d.cy, d.cy - (y + h));
    return gx / d.a + gy / d.b <= 1;
  };

  // Test EXACT losange contre losange (SAT : les deux normales d'arête
  // distinctes de chaque losange suffisent comme axes de séparation).
  G.diamondHitsDiamond = function (d1, d2) {
    function axesOf(d) {
      var l = Math.sqrt(d.a * d.a + d.b * d.b) || 1;
      return [[d.b / l, d.a / l], [d.b / l, -d.a / l]];
    }
    var axes = axesOf(d1).concat(axesOf(d2));
    var v1 = [[d1.cx - d1.a, d1.cy], [d1.cx + d1.a, d1.cy],
              [d1.cx, d1.cy - d1.b], [d1.cx, d1.cy + d1.b]];
    var v2 = [[d2.cx - d2.a, d2.cy], [d2.cx + d2.a, d2.cy],
              [d2.cx, d2.cy - d2.b], [d2.cx, d2.cy + d2.b]];
    for (var i = 0; i < axes.length; i++) {
      var n = axes[i];
      var min1 = Infinity, max1 = -Infinity, min2 = Infinity, max2 = -Infinity;
      for (var j = 0; j < 4; j++) {
        var p1 = v1[j][0] * n[0] + v1[j][1] * n[1];
        if (p1 < min1) min1 = p1;
        if (p1 > max1) max1 = p1;
        var p2 = v2[j][0] * n[0] + v2[j][1] * n[1];
        if (p2 < min2) min2 = p2;
        if (p2 > max2) max2 = p2;
      }
      if (max1 < min2 || max2 < min1) return false;
    }
    return true;
  };

  // Teste si une boîte (cx,cy,cw,ch) chevauche le losange de base d'une
  // tour de siège. Utilisé par les zombies ET le joueur.
  function hitsSiegeFoot(cx, cy, cw, ch) {
    var sieges = G.state.sieges || [];
    for (var i = 0; i < sieges.length; i++) {
      var s = sieges[i];
      if (s.hp <= 0) continue;
      if (G.diamondHitsBox(G.siegeDiamond(s), cx, cy, cw, ch)) return s;
    }
    return null;
  }
  G.hitsSiegeFoot = hitsSiegeFoot;

  // Comme hitsSiegeFoot mais ignore une tour précise (excl) : recherche de
  // position libre quand le joueur est repoussé hors d'une tour.
  G.hitsSiegeFootExcluding = function (cx, cy, cw, ch, excl) {
    var sieges = G.state.sieges || [];
    for (var i = 0; i < sieges.length; i++) {
      var s = sieges[i];
      if (s === excl || s.hp <= 0) continue;
      if (G.diamondHitsBox(G.siegeDiamond(s), cx, cy, cw, ch)) return s;
    }
    return null;
  };

  // Le joueur (boîte centrée) heurte-t-il une tour de siège ?
  // Sert au mouvement du joueur (repli : le joueur glisse le long).
  G.aabbHitsSieges = function (x, y) {
    return !!hitsSiegeFoot(x - G.PLAYER_HALF, y - G.PLAYER_HALF, G.PLAYER_W, G.PLAYER_W);
  };

  // Crée une tour de siège à (x, y) avec la direction dir (entrée
  // SIEGE_DIRS). PV = SIEGE_HP (cf. config.js : 100 x les PV d'un zombie
  // de référence). hp = maxHp pour la barre de vie.
  G.makeSiegeTower = function (x, y, dir) {
    return {
      x: x, y: y, w: G.SIEGE_SIDE, h: G.SIEGE_SIDE,
      dir: dir.key, dx: dir.dx, dy: dir.dy,
      hp: G.SIEGE_HP, maxHp: G.SIEGE_HP,
      open: false, released: false,
      state: "move",
      isSiege: true
    };
  };

  // Spawn des tours de siège de la nuit : appelé par updateSieges au
  // passage de l'heure de vague (22h), UNE fois par jour
  // (siegeSpawnedForDay). Nombre : siegeCountForDay(state.day). Chaque tour
  // arrive par la direction qui correspond à son point de départ (bord
  // opposé), en diagonale de la carte vers la ville, à une distance
  // aléatoire du bord cohérente avec les vagues de zombies.
  G.spawnSieges = function () {
    var state = G.state;
    var n = G.siegeCountForDay(state.day);
    for (var i = 0; i < n; i++) {
      var d = G.SIEGE_DIRS[Math.floor(Math.random() * G.SIEGE_DIRS.length)];
      var edge = G.rand(40, 200);
      var x, y;
      if (d.dx < 0) x = G.WORLD - edge; else x = edge;
      if (d.dy < 0) y = G.WORLD - edge; else y = edge;
      // Décale chaque tour pour éviter les empilements au même point.
      var off = (i - (n - 1) / 2) * 160;
      if (d.dx === d.dy) x += off; else y += off;
      x = G.clamp(x, 60, G.WORLD - 60);
      y = G.clamp(y, 60, G.WORLD - 60);
      var s = G.makeSiegeTower(x, y, d);
      state.sieges.push(s);
    }
    return n;
  };

  // Libère les zombies "de l'autre côté de la palissade" : 100 zombies
  // spawner en éventail côté ville (autour de l'axe tour -> point de
  // libération, jamais derrière lui), regroupés en groupes standard
  // (GROUP_SIZE membres) comme les vagues : l'IA zombie les anime et les
  // fait attaquer exactement comme n'importe quel zombie. Chaque
  // point est re-projeté hors des murs et des forêts.
  G.siegeReleaseZombies = function (s) {
    var state = G.state;
    var cx = s.x + (s.releaseDx || 0);
    var cy = s.y + (s.releaseDy || 0);
    var base = Math.atan2(cy - s.y, cx - s.x);
    var zs = G.ZOMBIE_W / 2;
    var total = G.SIEGE_RELEASE_COUNT;
    var nbGroups = Math.ceil(total / G.GROUP_SIZE);
    if (!state.zombieGroups) state.zombieGroups = [];
    for (var gi = 0; gi < nbGroups; gi++) {
      // Le groupe se forme autour du point de libération, côté ville.
      var grp = { x: cx, y: cy, members: [], hasRaider: false, spawnSide: -1,
                  formation: Math.floor(Math.random() * 4),
                  formPhase: Math.random() * Math.PI * 2,
                  isHorde: false, retreat: false, hordeMsgShown: false,
                  releasedBySiege: true };
      state.zombieGroups.push(grp);
      var n = Math.min(G.GROUP_SIZE, total - gi * G.GROUP_SIZE);
      for (var i = 0; i < n; i++) {
      var zx = cx, zy = cy, ok = false;
      for (var a = 0; a < 8 && !ok; a++) {
        // Éventail ±80° autour de l'axe de libération : chaque point est
        // au moins aussi avancé que le point de libération, donc du côté
        // ville du mur. Les retries resserrent l'éventail et s'éloignent.
        var ang = base + (a === 0 ? G.rand(-1.4, 1.4) : G.rand(-0.6, 0.6));
        var dist = (a === 0) ? G.rand(10, 90) : G.rand(30, 120);
        zx = cx + Math.cos(ang) * dist;
        zy = cy + Math.sin(ang) * dist;
        ok = zx > 12 && zx < G.WORLD - 12 && zy > 12 && zy < G.WORLD - 12 &&
          !G.aabbHitsWalls(zx - zs, zy - zs, G.ZOMBIE_W, G.ZOMBIE_W) &&
          !(G.aabbHitsForets && G.aabbHitsForets(zx, zy, zs)) &&
          !(G.foretAt && G.foretAt(zx, zy));
      }
      if (!ok) { zx = cx; zy = cy; }
      var slot = G.zombieSlot(grp, i, n);
      var sf = 1 + G.rand(-G.ZOMBIE_SPEED_VAR, G.ZOMBIE_SPEED_VAR);
      var z = {
        x: zx, y: zy,
        hp: Math.max(1, Math.round(G.ZOMBIE_HP * G.zombieRamp())),
        atkCd: 0, wallCd: 0,
        group: grp,
        slotAng: slot.ang, slotDist: slot.dist,
        slotAngT: slot.ang, slotDistT: slot.dist,
        speedFactor: G.clamp(sf, 0.4, 1.6),
        wanderPhase: Math.random() * Math.PI * 2,
        wanderFreq: G.ZOMBIE_WANDER_FREQ * (0.7 + Math.random() * 0.6),
        blockedSides: 0,
        harasser: Math.random() < G.ZOMBIE_HARASS_RATIO,
        raider: Math.random() < G.ZOMBIE_RAIDER_RATIO,
        wallBreaker: Math.random() < G.ZOMBIE_BREAKER_RATIO,
        seekDir: 0,
        lunge: 0, lungeDx: 0, lungeDy: 0,
        isLeader: i === 0,
        releasedBySiege: true
      };
      if (z.raider) grp.hasRaider = true;
      grp.members.push(z);
      state.zombies.push(z);
    }
    }
  };

  // Vrai si le losange de base de la tour est à SIEGE_CONTACT_GAP du mur
  // cible (écart AABB de bruissage sur les deux axes). Un mur est fin : le
  // déplacement diagonal ne bloque jamais les deux axes à la fois, on
  // mesure donc l'écart au mur visé plutôt qu'un éventuel blocage des deux
  // axes. Le contact est losange-vs-boîte exact au-delà du gap.
  function siegeTouchingWall(s, target) {
    if (!target || !target.wall) return false;
    var m = target.wall;
    var d = G.siegeDiamond(s);
    var fp = { x: d.cx - d.a, y: d.cy - d.b, w: d.a * 2, h: d.b * 2 };
    var gapX = Math.max(m.x - (fp.x + fp.w), fp.x - (m.x + m.w));
    var gapY = Math.max(m.y - (fp.y + fp.h), fp.y - (m.y + m.h));
    return gapX <= G.SIEGE_CONTACT_GAP && gapY <= G.SIEGE_CONTACT_GAP;
  }

  // Le losange de base (déplacé en cx,cy) heurte-t-il un bâtiment solide ?
  // Les FORÊTS ne comptent PAS comme obstacle : la tour de siège passe
  // dessus sans collision et les aplatit à l'état coupé (cf.
  // flattenForetsUnder). Seuls les vrais bâtiments l'arrêtent.
  function diamondHitsBuildings(d) {
    var buildings = G.state.buildings || [];
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (b.isForet) continue;
      if (G.diamondHitsBox(d, b.x, b.y, b.w, b.h)) return true;
    }
    return false;
  }

  // Le losange de base (déplacé en cx,cy) heurte-t-il une palissade posée ?
  function diamondHitsWalls(d) {
    var walls = G.state.walls || [];
    for (var i = 0; i < walls.length; i++) {
      var m = walls[i];
      if (!m.built) continue;
      if (G.diamondHitsBox(d, m.x, m.y, m.w, m.h)) return true;
    }
    return false;
  }

  // Le losange de base (déplacé en cx,cy) heurte-t-il le losange d'une
  // AUTRE tour de siège (les tours ne se traversent pas) ?
  function diamondHitsSieges(d, self) {
    var sieges = G.state.sieges || [];
    for (var i = 0; i < sieges.length; i++) {
      var o = sieges[i];
      if (o === self || o.hp <= 0) continue;
      if (G.diamondHitsDiamond(d, G.siegeDiamond(o))) return true;
    }
    return false;
  }

  // Le losange de base déplacé en (cx, cy) est-il libre ? (murs, bâtiments,
  // autres tours).
  function diamondFree(cx, cy, self) {
    var d = G.siegeDiamond(self);
    d.cx = cx; d.cy = cy;
    return !diamondHitsWalls(d) && !diamondHitsBuildings(d) &&
      !diamondHitsSieges(d, self);
  }

  // Avance une tour de siège vers sa cible (le mur le plus proche, sinon le
  // centre-ville) à SIEGE_SPEED (moitié de ZOMBIE_SPEED). Sous-pas axe par
  // axe sur le losange de base : la tour est bloquée par les murs, les
  // bâtiments/forêts et les autres tours (glissement le long de l'obstacle
  // axe par axe). Coin d'obstacle (les deux axes bloqués) : contournement
  // perpendiculaire persistant (s.detour = ±1), comme les fouisseurs le
  // long des murs. Renvoie true dès que la tour est collée au mur cible.
  function moveSiege(s, dt) {
    var target = findWallTarget(s);
    if (!target) return false; // aucune cible : reste immobile
    if (siegeTouchingWall(s, target)) return true;
    var dx = target.x - s.x, dy = target.y - s.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var step = G.SIEGE_SPEED * G.zombieRamp() * dt;
    var sub = Math.max(1, Math.ceil(step / 4));
    var inc = step / sub;
    var blocked = false;
    for (var k = 0; k < sub; k++) {
      var nx = s.x + (dx / len) * inc;
      var ny = s.y + (dy / len) * inc;
      // Axes séparés pour glisser le long de l'obstacle.
      var canX = diamondFree(nx, s.y, s);
      var canY = diamondFree(s.x, ny, s);
      if (canX) s.x = nx;
      if (canY) s.y = ny;
      if (!canX && !canY) {
        // Coin : contournement perpendiculaire persistant (le sens est
        // mémorisé pour longer l'obstacle au lieu d'osciller sur place).
        blocked = true;
        if (!s.detour) s.detour = (Math.random() < 0.5 ? 1 : -1);
        var pdx = -dy / len, pdy = dx / len; // perpendiculaire unitaire
        var bx = s.x + pdx * s.detour * inc;
        var by = s.y + pdy * s.detour * inc;
        var bCanX = diamondFree(bx, s.y, s);
        var bCanY = diamondFree(s.x, by, s);
        if (bCanX) s.x = bx;
        if (bCanY) s.y = by;
        // Cul-de-sac des deux côtés : inverse le sens du contournement.
        // L'écrasement des forêts bloquantes est géré au niveau du tick
        // (cf. updateSieges) : une tour de siège n'est définitivement
        // stoppée que par un mur.
        if (!bCanX && !bCanY) {
          s.detour = -s.detour;
          s.stuck = (s.stuck || 0) + inc;
        }
      } else {
        blocked = false;
        s.detour = s.detour || 0;
      }
      if (siegeTouchingWall(s, target)) return true;
    }
    return false;
  }

  // Aplatit TOUTES les forêts chevauchées par le losange de base de la
  // tour : chacune passe DIRECTEMENT à l'état coupé final (foretStage 4,
  // sprite "<fichier>s4" — souche traversable), comme si un joueur l'avait
  // coupée à la hache jusqu'au bout. Elle repousse ensuite normalement
  // (regenForets à chaque nouveau jour). La tour passe dessus SANS
  // collision : seuls les bâtiments l'arrêtent.
  function flattenForetsUnder(s) {
    var buildings = G.state.buildings || [];
    if (buildings.length === 0) return;
    var d = G.siegeDiamond(s);
    var flattened = false;
    for (var fb = 0; fb < buildings.length; fb++) {
      var b = buildings[fb];
      if (!b.isForet || G.foretDepleted(b)) continue;
      if (!G.diamondHitsBox(d, b.x, b.y, b.w, b.h)) continue;
      b.foretStage = (G.FORET_STAGES || 5) - 1;
      if (G.refitForet) G.refitForet(b);
      flattened = true;
    }
    if (flattened) {
      if (G.rebuildBuildingGrid) G.rebuildBuildingGrid();
      if (G.playSfx) G.playSfx("chop");
    }
  }

  // Mur le plus proche du point le plus proche de la tour (le sens de
  // marche reste inchangé). Renvoie { x, y, wall } du point de contact, ou
  // null s'il n'y a aucun mur.
  function findWallTarget(s) {
    var state = G.state;
    var best = null, bestD = Infinity, bestPt = null;
    for (var i = 0; i < state.walls.length; i++) {
      var m = state.walls[i];
      if (!m.built) continue;
      var clx = Math.max(m.x, Math.min(s.x, m.x + m.w));
      var cly = Math.max(m.y, Math.min(s.y, m.y + m.h));
      var dd = Math.sqrt((clx - s.x) * (clx - s.x) + (cly - s.y) * (cly - s.y));
      if (dd < bestD) { bestD = dd; best = m; bestPt = { x: clx, y: cly }; }
    }
    if (!best) {
      // Aucun mur : vise le centre-ville (la mairie est au centre).
      return { x: G.WORLD / 2, y: G.WORLD / 2, wall: null };
    }
    return { x: bestPt.x, y: bestPt.y, wall: best };
  }

  // Mise à jour des tours de siège (appelée depuis update/tick, APRÈS
  // updateZombies : elles attaquent "en même temps que les zombies", la
  // nuit uniquement).
  G.updateSieges = function (dt) {
    var state = G.state;
    // Spawn à l'heure de vague, une fois par jour (la 1re nuit n'a aucune
    // tour ; siegeCountForDay renvoie 0 pour day < 2).
    var prevClock = state.clock - (12 / G.DAY_SECONDS) * G.TIME_SCALE * dt;
    if (prevClock < 0) prevClock += 24;
    var waveHour = (G.NIGHT_WAVE_HOUR !== undefined) ? G.NIGHT_WAVE_HOUR : 22;
    var crossedWaveHour = prevClock < waveHour && state.clock >= waveHour;
    if (crossedWaveHour && !state.siegeSpawnedForDay) {
      state.siegeSpawnedForDay = true;
      var n = G.spawnSieges();
      if (n > 0) {
        state.siegeMsgTimer = 8;
        if (G.addFloater) G.addFloater("Siege : " + n + " tour(s) de siège approchent !");
      }
    }
    var crossedMorning = prevClock < 8 && state.clock >= 8;
    if (crossedMorning) {
      state.siegeSpawnedForDay = false;
    }
    if (state.siegeMsgTimer > 0) state.siegeMsgTimer -= dt;

    // Déplacement uniquement la nuit (même fenêtre que les vagues).
    var night = state.clock >= waveHour || state.clock < 8;
    for (var i = 0; i < state.sieges.length; i++) {
      var s = state.sieges[i];
      if (s.hp <= 0) continue;
      if (s.state === "open") continue;
      if (!night) continue;
      var touched = moveSiege(s, dt);
      // Aplatit les forêts traversées : la tour ne collisionne PAS avec les
      // forêts, toute forêt sous son losange de base passe directement à
      // l'état coupé final (elle repousse ensuite comme une forêt coupée
      // par un joueur). Seuls les bâtiments l'arrêtent.
      flattenForetsUnder(s);
      if (touched) {
        // Point de libération : de l'autre côté du mur, côté ville.
        var target = findWallTarget(s);
        if (target && target.wall) {
          var m = target.wall;
          var tcx = m.x + m.w / 2, tcy = m.y + m.h / 2;
          var rdx = tcx - s.x, rdy = tcy - s.y;
          var rlen = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
          // Point de libération : 30 px au-delà du mur depuis son centre,
          // le long de l'axe tour -> mur, côté ville.
          var over = (m.w + m.h) * 0.5 + 30;
          s.releaseDx = rdx + (rdx / rlen) * over;
          s.releaseDy = rdy + (rdy / rlen) * over;
        } else {
          s.releaseDx = 0; s.releaseDy = 0;
        }
        s.state = "open";
        s.open = true;
        // Libère les zombies dès le contact (une seule fois : released).
        s.released = true;
        G.siegeReleaseZombies(s);
        // Son cote client uniquement (le serveur emet l'evenement siegeOpen
        // pour les clients a portee, comme tourCasse).
        if (typeof window !== "undefined" && window.document && G.playSfx) {
          G.playSfx("siegeOpen");
        }
        if (G.addFloater) G.addFloater("Une tour de siège libère " + G.SIEGE_RELEASE_COUNT + " zombies !");
      }
    }
  };

  // Retire les tours de siège détruites (hp <= 0) : laisse une trace au sol
  // (PNG destruction, non-collisionnable) et un son de destruction.
  G.cleanupSieges = function () {
    var state = G.state;
    for (var i = state.sieges.length - 1; i >= 0; i--) {
      if (state.sieges[i].hp <= 0) {
        var s = state.sieges[i];
        state.siegeTraces.push({
          x: Math.round(s.x), y: Math.round(s.y),
          v: Math.floor(Math.random() * 100)
        });
        state.sieges.splice(i, 1);
        if (typeof window !== "undefined" && window.document && G.playSfx) {
          G.playSfx("siegeCasse");
        }
      }
    }
  };
})();

// Scierie & tours d'attaque (cf. docs/towers.md).
// Module partagé client + serveur : pose, chantier, combat, rendu des données.
// Chargé AVANT zombies.js (l'IA zombie lit l'état des tours).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // --- Construction ---

  // Emprise sol d'un bâtiment de tour derivee du PNG (reduite de 30% par
  // rapport aux bâtiments), repli sur fallbackSide si le PNG n'est pas
  // charge (serveur sans assets).
  G.towerSide = function (level) {
    var stats = G.TOWER_STATS[level] || G.TOWER_STATS.bois;
    var side = stats.fallbackSide;
    var sp = (G.hasSprite && G.hasSprite("tour", "idle")) ? G.SPRITES.tour.idle : null;
    if (sp) side = sp.w * 1.4;
    return side;
  };

  // Indice de frame d'une anim de chantier : un seul tour complet sur la
  // durée TOWER_BUILD_TIME, figé sur la dernière frame ensuite (clippé).
  G.chantierFrame = function (sprite, builtAt, now, frames) {
    var n = frames || G.animCount(sprite);
    if (n <= 1) return 0;
    var dur = G.TOWER_BUILD_TIME || 10;
    var p = ((now || 0) - (builtAt || 0)) / dur;
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    var fi = Math.floor(p * n);
    if (fi > n - 1) fi = n - 1;
    return fi;
  };

  // Crée le bâtiment de ville `id` du registre TOWN_BUILDINGS (unique) à la
  // position cliquée. Même modèle pour tous : emprise carrée `side`, posé
  // dans state[def.stateField] + state.buildings, chantier puis chantierDone.
  G.makeTownBuilding = function (id, x, y) {
    var def = G.TOWN_BUILDINGS[id];
    var side = def.side;
    var b = {
      x: x - side / 2, y: y - side / 2, w: side, h: side,
      name: def.label, msg: def.msg,
      isScierie: id === "scierie", isUniversite: id === "universite",
      isMontgolfiere: id === "montgolfiere", isDecor: false,
      townBuilding: id,
      height: 120,
      door: { x: x, y: y + side / 2 },
      builtAt: G.state.time,
      chantierDone: false
    };
    return b;
  };

  // Crée le bâtiment scierie (unique) à la position cliquée.
  G.makeScierie = function (x, y) {
    return G.makeTownBuilding("scierie", x, y);
  };

  // Crée une tour du niveau donné (ex. "bois") à la position cliquée.
  G.makeTower = function (x, y, level) {
    var stats = G.TOWER_STATS[level];
    var side = G.towerSide(level);
    return {
      x: x - side / 2, y: y - side / 2, w: side, h: side,
      level: level,
      hp: stats.hp, maxHp: stats.hp,
      builtAt: G.state.time,
      chantierDone: false,
      cdL: 0, cdR: 0,
      animL: 0, animR: 0,
      isTower: true
    };
  };

  // Vérifie qu'un rectangle (mx,my,w,h) ne chevauche ni bâtiment ni mur.
  G.towerSpotFree = function (mx, my, w, h) {
    var state = G.state;
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (mx < b.x + b.w && mx + w > b.x && my < b.y + b.h && my + h > b.y) return false;
    }
    for (var wi = 0; wi < state.walls.length; wi++) {
      var m = state.walls[wi];
      if (!m.built) continue;
      if (mx < m.x + m.w && mx + w > m.x && my < m.y + m.h && my + h > m.y) return false;
    }
    return true;
  };

  // Liste les bâtiments constructibles (menu ouvert avec Z) : palissade
  // toujours, bâtiments de ville du registre (tech débloquée + pas encore
  // posés), tours (tous les niveaux de TOWER_STATS, futurs niveaux
  // automatiques) si la scierie est construite.
  G.buildMenu = function () {
    var state = G.state;
    var menu = [{ id: "palissade", label: "Palissade (mur)", costPlanks: G.WALL_PLANKS, costGold: 0 }];
    for (var tb in G.TOWN_BUILDINGS) {
      if (!G.TOWN_BUILDINGS.hasOwnProperty(tb)) continue;
      var tdef = G.TOWN_BUILDINGS[tb];
      if (state[tdef.unlockedField] && !state[tdef.stateField]) {
        menu.push({ id: tb, label: tdef.label, costPlanks: 0, costGold: 0 });
      }
    }
    if (state.scierie && state.scierie.chantierDone) {
      for (var level in G.TOWER_STATS) {
        if (!G.TOWER_STATS.hasOwnProperty(level)) continue;
        var st = G.TOWER_STATS[level];
        menu.push({ id: "tour:" + level, label: st.label, costPlanks: st.cost.planks, costGold: st.cost.gold });
      }
    }
    return menu;
  };

  // Pose le bâtiment sélectionné dans le menu (buildSel : "palissade",
  // "tour:bois", ... "scierie"). Renvoie true si posé. Le paiement de la
  // scierie se fait au déverrouillage tech ; la tour se paie ici (coffre
  // mairie : or commun + planches du joueur).
  G.placeFromBuildMenu = function (wx, wy) {
    var state = G.state;
    var sel = state.buildSel;
    if (!sel) return false;

    if (sel === "palissade") {
      // La sélection palissade reste active : on peut poser plusieurs murs
      // d'affilée (clic droit / Échap / Z pour annuler).
      return G.tryBuildWall(wx, wy);
    }

    if (G.TOWN_BUILDINGS[sel]) {
      // Batiment de ville (scierie, universite, montgolfiere...) : unique,
      // en ville uniquement, deja paye au deblocage tech.
      var tdef = G.TOWN_BUILDINGS[sel];
      if (state[tdef.stateField]) return false;
      if (!G.inTown(wx, wy)) return false;
      var side = tdef.side;
      var sx = wx - side / 2, sy = wy - side / 2;
      if (!G.towerSpotFree(sx, sy, side, side)) return false;
      var b = G.makeTownBuilding(sel, wx, wy);
      state[tdef.stateField] = b;
      state.buildings.push(b);
      G.pushPlayerOutOfWall(b);
      state.buildSel = null;
      return true;
    }

    if (sel.indexOf("tour:") === 0) {
      var level = sel.slice(5);
      var stats = G.TOWER_STATS[level];
      if (!stats) return false;
      // Les tours ne sont constructibles qu'apres la pose de la scierie
      // (batiment construit, pas seulement la tech debloquee).
      if (!state.scierie || !state.scierie.chantierDone) return false;
      if ((state.mairieGold || 0) < stats.cost.gold) return false;
      if ((state.planks || 0) < stats.cost.planks) return false;
      var tSide = G.towerSide(level);
      var tx = wx - tSide / 2, ty = wy - tSide / 2;
      if (!G.towerSpotFree(tx, ty, tSide, tSide)) return false;
      var tower = G.makeTower(wx, wy, level);
      if (G.pushPlayerOutOfWall) {
        // Anti-blocage : repousse le joueur s'il est sur l'emprise.
        G.pushPlayerOutOfWall({ x: tower.x, y: tower.y, w: tower.w, h: tower.h });
      }
      state.mairieGold -= stats.cost.gold;
      state.planks -= stats.cost.planks;
      state.towers.push(tower);
      state.buildSel = null;
      return true;
    }
    return false;
  };

  // --- Mise à jour (simu partagée, appelée depuis update/tick) ---

  // Avance les chantiers (scierie + tours) : construit après TOWER_BUILD_TIME.
  G.updateBuildSites = function (dt) {
    var state = G.state;
    for (var tb in G.TOWN_BUILDINGS) {
      if (!G.TOWN_BUILDINGS.hasOwnProperty(tb)) continue;
      var tdef = G.TOWN_BUILDINGS[tb];
      var b = state[tdef.stateField];
      if (b && !b.chantierDone &&
          state.time - b.builtAt >= G.TOWER_BUILD_TIME) {
        b.chantierDone = true;
      }
    }
    for (var i = 0; i < state.towers.length; i++) {
      var t = state.towers[i];
      if (!t.chantierDone && state.time - t.builtAt >= G.TOWER_BUILD_TIME) {
        t.chantierDone = true;
      }
    }
  };

  // Combat des tours : chaque côté (demi-espace par x) a son cooldown et tire
  // sur le zombie le plus proche à portée. Ne cible que les zombies.
  // Les flèches partent du sommet de la tour (10 % les plus hauts du PNG).
  G.updateTowers = function (dt) {
    var state = G.state;
    for (var i = 0; i < state.towers.length; i++) {
      var t = state.towers[i];
      if (!t.chantierDone) continue;
      var stats = G.TOWER_STATS[t.level] || G.TOWER_STATS.bois;
      if (t.cdL > 0) t.cdL -= dt;
      if (t.cdR > 0) t.cdR -= dt;
      if (t.animL > 0) t.animL -= dt;
      if (t.animR > 0) t.animR -= dt;
      var cx = t.x + t.w / 2;
      var cy = t.y + t.h / 2;
      // Point de départ des flèches : sommet de la tour (haut du PNG).
      var topY = cy - t.h * 0.9;
      for (var side = 0; side < 2; side++) {
        var isLeft = side === 0;
        if (isLeft ? t.cdL > 0 : t.cdR > 0) continue;
        var best = null, bestD = Infinity;
        for (var zi = 0; zi < state.zombies.length; zi++) {
          var z = state.zombies[zi];
          if (z.hp <= 0) continue;
          if (isLeft ? z.x >= cx : z.x < cx) continue;
          var dx = z.x - cx, dy = z.y - topY;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d <= stats.range && d < bestD) { bestD = d; best = z; }
        }
        if (best) {
          var sx = cx, sy = topY;
          var adx = best.x - sx, ady = best.y - sy;
          var alen = Math.sqrt(adx * adx + ady * ady) || 1;
          var vx = (adx / alen) * stats.arrowSpeed;
          var vy = (ady / alen) * stats.arrowSpeed;
          state.projectiles.push({
            x: sx, y: sy, vx: vx, vy: vy,
            dmg: stats.dmg,
            speed: stats.arrowSpeed,
            life: stats.range / stats.arrowSpeed,
            color: "#111111",
            size: 1,
            type: "fleche",
            owner: "tour",
            piercing: false,
            pierceCount: 0,
            trail: [],
            hitEntities: []
          });
          if (isLeft) { t.cdL = stats.cd; t.animL = stats.animDur; }
          else { t.cdR = stats.cd; t.animR = stats.animDur; }
        }
      }
    }
  };

  // Retire les tours détruites (appelé depuis update). Aucune trace au sol,
  // son joué côté client uniquement (le serveur n'a pas d'audio).
  G.cleanupTowers = function () {
    var state = G.state;
    for (var i = state.towers.length - 1; i >= 0; i--) {
      if (state.towers[i].hp <= 0) {
        state.towers.splice(i, 1);
        if (typeof window !== "undefined" && window.document && G.playSfx) {
          G.playSfx("tourCasse");
        }
      }
    }
    // Scierie détruite : la tech reste, le bâtiment disparaît.
    if (state.scierie && state.scierie.hp !== undefined && state.scierie.hp <= 0) {
      state.scierie = null;
    }
  };

  // --- Menu de construction de la scierie (client) ---

  G.openBuildMenu = function () {
    var state = G.state;
    state.buildMenuOpen = true;
    state.paused = false;
    G.drawBuildMenu();
    if (G.buildMenuScreen) G.buildMenuScreen.hidden = false;
  };

  G.closeBuildMenu = function () {
    G.state.buildMenuOpen = false;
    if (G.buildMenuScreen) G.buildMenuScreen.hidden = true;
  };

  G.drawBuildMenu = function () {
    var state = G.state;
    var list = G.buildMenuList;
    if (!list) return;
    list.innerHTML = "";
    var entries = G.buildMenu();
    for (var i = 0; i < entries.length; i++) {
      (function (entry) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn chest__item";
        var costTxt = "";
        if (entry.costPlanks > 0) costTxt += entry.costPlanks + " planches";
        if (entry.costGold > 0) costTxt += (costTxt ? " + " : "") + entry.costGold + " or";
        if (!costTxt) costTxt = "gratuit";
        btn.textContent = entry.label + " — " + costTxt;
        btn.addEventListener("click", function () {
          state.buildSel = entry.id;
          state._buildSel = entry.id;
          state.buildMode = true;
          G.closeBuildMenu();
          if (G.addFloater) G.addFloater("Cliquez sur la carte pour poser : " + entry.label);
        });
        list.appendChild(btn);
      })(entries[i]);
    }
  };

  // --- Déverrouillage tech + vote ---

  // Peut-on payer la tech scierie ? L'or vient du coffre commun, les
  // planches du poseur (state.planks en solo ; en multi le serveur copie
  // p.planks dans state.planks avant l'appel, cf. server/game.js).
  G.canPayScierie = function () {
    return G.canPayTownTech("scierie");
  };

  // Peut-on payer la tech d'un batiment de ville du registre ?
  G.canPayTownTech = function (id) {
    var def = G.TOWN_BUILDINGS[id];
    if (!def) return false;
    return (G.state.mairieGold || 0) >= def.cost.gold &&
           (G.state.planks || 0) >= def.cost.planks;
  };

  // Débite et débloque la tech d'un batiment de ville du registre.
  G.unlockTownTech = function (id) {
    var state = G.state;
    var def = G.TOWN_BUILDINGS[id];
    if (!def || state[def.unlockedField]) return false;
    if (!G.canPayTownTech(id)) return false;
    state.mairieGold -= def.cost.gold;
    state.planks -= def.cost.planks;
    state[def.unlockedField] = true;
    return true;
  };

  // Débite et débloque la tech scierie.
  G.unlockScierie = function () {
    return G.unlockTownTech("scierie");
  };

  // Vote en cours à la mairie (multijoueur). Le serveur est autoritaire ;
  // en solo, l'achat est direct.
  // { proposal: "scierie", initiator: playerId, endsAt, votes: {id: true} }
  G.startVote = function (proposal, initiatorId) {
    var state = G.state;
    if (state.vote) return false;
    if (state.voteCooldownUntil && state.time < state.voteCooldownUntil) return false;
    state.vote = {
      proposal: proposal,
      initiator: initiatorId,
      endsAt: state.time + G.VOTE_DURATION,
      votes: {}
    };
    if (initiatorId !== undefined) state.vote.votes[initiatorId] = true;
    return true;
  };

  G.castVote = function (playerId, yes) {
    var state = G.state;
    if (!state.vote) return false;
    state.vote.votes[playerId] = !!yes;
    return true;
  };

  // Résout le vote : majorité stricte des joueurs connectés requise.
  // payerPlanks : callback (cout) => boolean fourni par l'appelant pour
  // debiter les planches du joueur initiateur (multi) ; en solo, null ->
  // on debite state.planks directement.
  // Renvoie "passed", "failed" ou null (pas de vote en cours).
  G.resolveVote = function (connectedCount, payerPlanks) {
    var state = G.state;
    if (!state.vote) return null;
    if (state.time < state.vote.endsAt) return null;
    var yes = 0;
    for (var id in state.vote.votes) {
      if (state.vote.votes.hasOwnProperty(id) && state.vote.votes[id]) yes++;
    }
    var passed = connectedCount > 0 && yes > Math.floor(connectedCount / 2);
    var proposal = state.vote.proposal;
    state.vote = null;
    if (passed) {
      var tdef = G.TOWN_BUILDINGS[proposal];
      if (tdef) {
        if (payerPlanks) {
          // Multi : les planches viennent du joueur initiateur (state.vote.votes
          // garde son id). L'or vient du coffre commun.
          if ((state.mairieGold || 0) < tdef.cost.gold) return "failed";
          if (!payerPlanks(tdef.cost.planks)) return "failed";
          state.mairieGold -= tdef.cost.gold;
          state[tdef.unlockedField] = true;
          return "passed";
        }
        if (G.unlockTownTech(proposal)) return "passed";
        // Vote gagnant mais paiement impossible : refuse sans cooldown (les
        // ressources manquaient au moment de la resolution).
        return "failed";
      }
      return "passed";
    }
    state.voteCooldownUntil = state.time + G.VOTE_COOLDOWN;
    return "failed";
  };
})();

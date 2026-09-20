// Module de jeu serveur : charge les modules de simulation partagés (src/),
// gère l'état du monde, la simulation par tick, les vagues de zombies et le
// cycle de vie de la partie (démarrage, game over, redémarrage).
(function () {
  "use strict";
  var fs = require("fs");
  var path = require("path");

  // Stub DOM : expose window.GAME (=== global) + canvas factice + stubs d'assets
  // avant de charger les modules src/, pour que buildWorld() fonctionne sans PNG.
  var stub = require("./dom-stub");
  var G = stub.setupStub();

  // Charge les modules de simulation partagés (mêmes fichiers que le client).
  // Les IIFE s'exécutent et remplissent G.* (config, projection, world, etc.).
  // On évalue le code dans le scope global pour que `window.GAME` (=== global.GAME)
  // soit accessible et partagé entre tous les modules.
  var SRC = path.join(__dirname, "..", "src");
  function load(file) {
    var code = fs.readFileSync(path.join(SRC, file), "utf8");
    // `new Function` crée un scope isolé sans `window` ; on l'injecte via `indirect eval`
    // (appel parenthésé) qui s'exécute dans le scope global où window === global.
    (0, eval)(code);
  }
  // Ordre : config d'abord, puis projection, puis world/zombies/walls/chop/weapons/birds.
  load("config.js");
  load("projection.js");
  load("world.js");
  load("player.js");
  load("walls.js");
  load("towers.js");
  load("chop.js");
  load("weapons.js");
  load("birds.js");
  load("zombies.js");

  var MAX_PLAYERS = 20;
  var START_DELAY = 30; // 30 s avant de lancer la partie si un joueur rejoint.

  function createInitialState() {
    return {
      started: false,
      paused: false,
      gameOver: false,
      gameOverCause: "",
      inBuilding: null,
      players: [],        // [{id, name, x, y, hp, alive, face, moving, equipped, axeEquipped, lastDx, lastDy, bag}]
      player: { x: G.WORLD / 2, y: G.WORLD / 2, face: 1, moving: false, hp: G.PLAYER_MAX_HP },
      camera: { x: G.WORLD / 2, y: G.WORLD / 2 },
      zoom: 8,
      targetZoom: 8,
      mouse: { sx: 0, sy: 0, wx: G.WORLD / 2, wy: G.WORLD / 2, inside: false },
      inventory: 0,
      planks: 0,
      items: [],
      buildings: [],
      walls: [],
      zombies: [],
      zombieGroups: [],
      deadTraces: [],
      birds: [],
      bag: { open: false, contents: [] },
      chest: [],
      chestOpen: false,
      mairieGold: 0,
      scierieUnlocked: false,
      scierie: null,
      universiteUnlocked: false,
      universite: null,
      montgolfiereUnlocked: false,
      montgolfiere: null,
      pendingWave: null,
      towers: [],
      buildSel: null,
      vote: null,
      voteCooldownUntil: 0,
      equipped: null,
      projectiles: [],
      keys: {},
      actionHeld: false,
      shootCd: 0,
      buildMode: false,
      plankRotation: 0,
      axeEquipped: false,
      chopTarget: null,
      chopWall: null,
      chopTimer: 0,
      clock: 8,
      day: 0,
      lastDay: 0,
      elapsed: 0,
      nextWaveAt: G.WAVE_EVERY,
      waveActive: false,
      waveCount: 0,
      zombieRamp: 1,
      waveLeaveAt: 0,
      waveSpawnedForDay: false,
      zombieMode: "attack",
      waveMsgTimer: 0,
      hordeMsgTimer: 0,
      time: 0,
      startTimer: 0,
      floaters: []
    };
  }

  var state = createInitialState();
  G.state = state;

  // Construit le monde (sans assets PNG : les collisions replient sur les
  // dimensions par défaut ; le serveur n'a pas besoin de rendu).
  G.buildWorld();
  G.spawnBirds();

  function findPlayer(id) {
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i].id === id) return state.players[i];
    }
    return null;
  }

  function alivePlayers() {
    var n = 0;
    for (var i = 0; i < state.players.length; i++) if (state.players[i].alive) n++;
    return n;
  }

  // Ajoute un joueur à la partie. Retourne le joueur ou null si complet.
  function addPlayer(id, name) {
    if (state.players.length >= MAX_PLAYERS) return null;
    // Place le joueur à un endroit libre.
    var p = {
      id: id,
      name: name || ("Joueur" + (state.players.length + 1)),
      x: G.WORLD / 2, y: G.WORLD / 2 + 140,
      hp: G.PLAYER_MAX_HP,
      alive: true,
      face: 1,
      moving: false,
      lastDx: 0, lastDy: 0,
      equipped: null,
      axeEquipped: false,
      bag: { contents: [] },
      shootCd: 0,
      planks: 0,
      inventory: 0,
      gold: 0,
      chopTarget: null,
      chopWall: null,
      chopTimer: 0
    };
    var tries = 0;
    while (G.aabbHitsBuildings(p.x, p.y)) {
      p.x = G.rand(G.TOWN_MIN + 40, G.TOWN_MAX - 40);
      p.y = G.rand(G.TOWN_MIN + 40, G.TOWN_MAX - 40);
      if (++tries > 200) break;
    }
    state.players.push(p);
    return p;
  }

  function removePlayer(id) {
    for (var i = state.players.length - 1; i >= 0; i--) {
      if (state.players[i].id === id) state.players.splice(i, 1);
    }
  }

  // Démarre ou redémarre la partie : recrée le monde, remet les joueurs en vie.
  function startGame() {
    // Préserve les joueurs connectés (ils gardent leur id et nom) avant de
    // recréer le monde.
    var existingPlayers = state.players;
    state = createInitialState();
    G.state = state;
    state.players = existingPlayers;
    G.buildWorld();
    G.spawnBirds();
    state.started = true;
    state.startTimer = 0;
    // Replace les joueurs existants.
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      p.x = G.WORLD / 2; p.y = G.WORLD / 2 + 140;
      p.hp = G.PLAYER_MAX_HP; p.alive = true;
      p.equipped = null; p.axeEquipped = false;
      p.bag = { contents: [] };
      p.planks = 0; p.inventory = 0;
      p.chopTarget = null; p.chopWall = null; p.chopTimer = 0;
      p.shootCd = 0;
    }
  }

  // Applique un input envoyé par un client au joueur correspondant.
  function applyInput(playerId, input) {
    var p = findPlayer(playerId);
    if (!p || !p.alive || state.gameOver) return;
    if (input.dx !== undefined) p._dx = input.dx;
    if (input.dy !== undefined) p._dy = input.dy;
    if (input.fire) p._fire = true;
    if (input.aimX !== undefined) p._aimX = input.aimX;
    if (input.aimY !== undefined) p._aimY = input.aimY;
    if (input.build) p._build = true;
    if (input.rotate) G.state.plankRotation = G.state.plankRotation ? 0 : 1;
    if (input.openBag) p._openBag = true;
    if (input.buildWall) p._buildWall = { x: input.buildWall.wx, y: input.buildWall.wy };
    // Selection dans le menu de construction (scierie) + pose du batiment.
    if (input.buildSel !== undefined) p._buildSel = input.buildSel;
    if (input.placeBuild) {
      p._placeBuild = { x: input.placeBuild.wx, y: input.placeBuild.wy };
    }
    // Vote technologique a la mairie : l'initiateur lance, les autres votent.
    // Generique pour tout batiment de ville du registre TOWN_BUILDINGS.
    if (input.techVote) {
      var tdef = G.TOWN_BUILDINGS[input.techVote];
      if (tdef && !state[tdef.unlockedField]) {
        if (!state.vote) {
          // L'initiateur doit pouvoir payer (planches) et le coffre aussi (or).
          if ((state.mairieGold || 0) >= tdef.cost.gold && (p.planks || 0) >= tdef.cost.planks) {
            G.startVote(input.techVote, p.id);
          }
        } else {
          // Un clic pendant un vote en cours = vote "pour".
          G.castVote(p.id, true);
        }
      }
    }
    if (input.voteYes !== undefined) G.castVote(p.id, !!input.voteYes);
    // Ramassage d'objet au sol (le client envoie les coords de l'item cliqué).
    if (input.pickup) {
      var tx = input.pickup.x, ty = input.pickup.y;
      for (var ii = 0; ii < state.items.length; ii++) {
        var it = state.items[ii];
        if (it.taken) continue;
        if (Math.abs(it.x - tx) < 5 && Math.abs(it.y - ty) < 5) {
          var pdx = p.x - it.x, pdy = p.y - it.y;
          if (Math.sqrt(pdx * pdx + pdy * pdy) < 140) {
            // Pièce d'or : crédit direct au coffre de la mairie (commun).
            if (it.kind === "or") {
              it.taken = true;
              state.mairieGold = (state.mairieGold || 0) + 1;
            } else {
              it.taken = true;
              p.bag.contents.push({ name: it.name, kind: it.kind, color: it.color });
              p.inventory = p.bag.contents.length;
            }
          }
          break;
        }
      }
    }
    // Dépot de relique à l'église : +100 pièces d'or si une relique est dans le sac.
    if (input.churchDeposit) {
      var ri = -1;
      for (var ci = 0; ci < p.bag.contents.length; ci++) {
        if (p.bag.contents[ci].name === "Relique") { ri = ci; break; }
      }
      if (ri >= 0) {
        p.bag.contents.splice(ri, 1);
        p.inventory = p.bag.contents.length;
        state.mairieGold = (state.mairieGold || 0) + 100;
      }
    }
    // Équipement : un seul objet équipé à la fois.
    if (input.equip !== undefined) {
      var nm = input.equip;
      if (nm === null) { p.equipped = null; }
      else {
        var found = false;
        for (var ai = 0; ai < p.bag.contents.length; ai++) {
          if (p.bag.contents[ai].name === nm && p.bag.contents[ai].kind === "arme") { found = true; break; }
        }
        if (found) { p.equipped = nm; p.axeEquipped = false; }
      }
    }
    if (input.toggleAxe) {
      var hasAxe = false;
      for (var bi = 0; bi < p.bag.contents.length; bi++) {
        if (p.bag.contents[bi].name === "Hache") { hasAxe = true; break; }
      }
      if (hasAxe) { p.axeEquipped = !p.axeEquipped; if (p.axeEquipped) p.equipped = null; }
    }
    if (input.planks !== undefined) p.planks = input.planks;
    // Consommation de nourriture : retire un exemplaire du sac et rend des PV.
    if (input.eat) {
      var fi = -1;
      for (var ci2 = 0; ci2 < p.bag.contents.length; ci2++) {
        if (p.bag.contents[ci2].name === "Nourriture" && p.bag.contents[ci2].kind === "objet") { fi = ci2; break; }
      }
      if (fi >= 0 && p.hp < G.PLAYER_MAX_HP) {
        p.bag.contents.splice(fi, 1);
        p.inventory = p.bag.contents.length;
        p.hp = Math.min(G.PLAYER_MAX_HP, p.hp + G.FOOD_HEAL);
      }
    }
  }

  // Simulation : un tick à dt secondes.
  function tick(dt) {
    state.time += dt;

    // Gestion du démarrage différé (30 s après le 1er joueur).
    if (!state.started) {
      if (state.players.length > 0) {
        state.startTimer += dt;
        if (state.startTimer >= START_DELAY) startGame();
      } else {
        state.startTimer = 0;
      }
      return;
    }

    if (state.gameOver) return;

    // Cycle jour/nuit.
    state.elapsed += dt;
    state.clock += (12 / G.DAY_SECONDS) * G.TIME_SCALE * dt;
    if (state.clock >= 24) { state.clock -= 24; state.day += 1; }

    // Régénération des forêts : à chaque nouveau jour, chaque forêt remonte
    // d'un état de coupe (vers s0 = pleine). Une forêt déjà à s0 ne change pas.
    if (state.day !== state.lastDay) {
      G.regenForets();
      state.lastDay = state.day;
    }

    // Déplacement de chaque joueur (validation côté serveur).
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      if (!p.alive) continue;
      if (p._dx !== undefined && p._dy !== undefined) {
        var dx = p._dx, dy = p._dy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.001) {
          var nx = dx / dist, ny = dy / dist;
          // La direction du sprite (lastDx/lastDy/face) suit la souris meme si
          // le mouvement reel est minuscule ou bloque : l'image reflete la
          // direction visee, independamment de la distance souris.
          p.lastDx = nx; p.lastDy = ny;
          if (nx < 0) p.face = -1; else if (nx > 0) p.face = 1;
          var stepX = p.x + nx * G.SPEED * dt;
          var stepY = p.y + ny * G.SPEED * dt;
          // tryMove valide les collisions (bâtiments, arbres, murs).
          var oldPx = state.player.x, oldPy = state.player.y;
          state.player.x = p.x; state.player.y = p.y;
          p.moving = G.tryMove(stepX, stepY);
          p.x = state.player.x; p.y = state.player.y;
        } else {
          p.moving = false; p.lastDx = 0; p.lastDy = 0;
        }
      } else {
        p.moving = false; p.lastDx = 0; p.lastDy = 0;
      }
      // Tir.
      if (p._fire && p.equipped && p.shootCd <= 0) {
        var st = G.WEAPON_STATS[p.equipped] || G.WEAPON_STATS["Mains nues"];
        p.shootCd = st.cd;
        var baseAng = Math.atan2(p._aimY ? p._aimY - p.y : 0, p._aimX ? p._aimX - p.x : 1);
        var weaponType = st.type || "pistolet";
        if (weaponType === "fusil") {
          var pelletCount = st.pellets || 5;
          var coneSpread = st.coneSpread || 0.3;
          for (var pi = 0; pi < pelletCount; pi++) {
            var poffset = (pelletCount > 1) ? (pi / (pelletCount - 1) - 0.5) * coneSpread : 0;
            var pang = baseAng + poffset + (Math.random() * 2 - 1) * st.spread;
            state.projectiles.push({
              x: p.x, y: p.y - G.PLAYER_H * 0.5,
              vx: Math.cos(pang) * st.speed, vy: Math.sin(pang) * st.speed,
              life: st.life, owner: p.id, dmg: st.dmg, color: st.color,
              size: st.size || 3, type: st.type || "pistolet", trail: [],
              piercing: false, hitEntities: []
            });
          }
        } else {
          var psp = (Math.random() * 2 - 1) * st.spread;
          var spang = baseAng + psp;
          state.projectiles.push({
            x: p.x, y: p.y - G.PLAYER_H * 0.5,
            vx: Math.cos(spang) * st.speed, vy: Math.sin(spang) * st.speed,
            life: st.life, owner: p.id, dmg: st.dmg, color: st.color,
            size: st.size || 3, type: st.type || "pistolet", trail: [],
            piercing: !!st.piercing, pierceCount: st.pierceCount || (st.piercing ? 3 : 0),
            hitEntities: []
          });
        }
      }
      if (p.shootCd > 0) p.shootCd -= dt;
      // Pose de planche.
      if (p._buildWall) {
        state.player.x = p.x; state.player.y = p.y; state.planks = p.planks || 0;
        G.tryBuildWall(p._buildWall.x, p._buildWall.y);
        // pushPlayerOutOfWall (appelé par tryBuildWall) a pu déplacer state.player
        // pour éviter un blocage : on récupère la nouvelle position.
        p.x = state.player.x; p.y = state.player.y;
        p.planks = state.planks;
        p._buildWall = null;
      }
      // Pose de batiment depuis le menu de la scierie (tour, scierie) :
      // l'or vient du coffre commun, les planches du joueur.
      if (p._buildSel !== undefined) state.buildSel = p._buildSel;
      if (p._placeBuild) {
        state.player.x = p.x; state.player.y = p.y;
        state.planks = p.planks || 0;
        G.placeFromBuildMenu(p._placeBuild.x, p._placeBuild.y);
        p.x = state.player.x; p.y = state.player.y;
        p.planks = state.planks;
        p._placeBuild = null;
        state.buildSel = null;
      }
      // Réinitialise les flags d'input consommés.
      p._dx = undefined; p._dy = undefined;
      // Récolte de planches / destruction de palissade à la hache : on swappe
      // l'état global vers le joueur courant pour que updateChop() s'applique à ce joueur.
      var oldChop = { px: state.player.x, py: state.player.y, ax: state.axeEquipped,
                      pl: state.planks, inB: state.inBuilding, bagO: state.bag.open,
                      chO: state.chestOpen, chT: state.chopTarget, chW: state.chopWall, chTi: state.chopTimer,
                      ah: state.actionHeld };
      state.actionHeld = !!p._fire;
      state.player.x = p.x; state.player.y = p.y;
      state.axeEquipped = p.axeEquipped;
      state.planks = p.planks || 0;
      state.inBuilding = null;
      state.bag.open = false;
      state.chestOpen = false;
      state.chopTarget = p.chopTarget || null;
      state.chopWall = p.chopWall || null;
      state.chopTimer = p.chopTimer || 0;
      G.updateChop(dt);
      p.planks = state.planks;
      p.chopTarget = state.chopTarget;
      p.chopWall = state.chopWall;
      p.chopTimer = state.chopTimer;
      state.player.x = oldChop.px; state.player.y = oldChop.py;
      state.axeEquipped = oldChop.ax; state.planks = oldChop.pl;
      state.inBuilding = oldChop.inB; state.bag.open = oldChop.bagO;
      state.chestOpen = oldChop.chO; state.chopTarget = oldChop.chT;
      state.chopWall = oldChop.chW; state.chopTimer = oldChop.chTi;
      state.actionHeld = oldChop.ah;
      // Réinitialise les flags d'input consommés.
      p._dx = undefined; p._dy = undefined;
      p._fire = false; p._build = false; p._openBag = false; p._buildSel = undefined; p._placeBuild = null;
    }

    // Chantiers (scierie, tours), combat des tours, votes a la mairie.
    G.updateBuildSites(dt);
    G.updateTowers(dt);
    G.cleanupTowers();
    if (state.vote) {
      var voteInitiator = state.vote.initiator;
      G.resolveVote(alivePlayers(), function (cost) {
        // Debite les planches du joueur initiateur du vote (or : coffre commun,
        // deja debite par resolveVote).
        var init = voteInitiator !== undefined ? findPlayer(voteInitiator) : null;
        if (!init || (init.planks || 0) < cost) return false;
        init.planks -= cost;
        return true;
      });
    }

    // Zombies, projectiles, oiseaux.
    G.updateZombies(dt);
    G.updateProjectiles(dt);
    G.cleanupZombies();
    G.cleanupBirds();
    G.cleanupWalls();
    G.updateBirds(dt);

    // Game over si mairie détruite.
    var mairie = null;
    for (var b = 0; b < state.buildings.length; b++) {
      if (state.buildings[b].isMairie) { mairie = state.buildings[b]; break; }
    }
    if (mairie && mairie.hp <= 0) {
      state.gameOver = true;
      state.gameOverCause = "mairie";
    }
  }

  // Snapshot d'un batiment de ville (scierie, universite, montgolfiere).
  function snapshotTownBuilding(b) {
    if (!b) return null;
    return {
      x: Math.round(b.x), y: Math.round(b.y),
      w: Math.round(b.w), h: Math.round(b.h),
      chantierDone: !!b.chantierDone,
      buildAge: +(state.time - b.builtAt).toFixed(1)
    };
  }

  // Construit l'état à broadcaster (allégé : pas de textures, pas de HUD).
  function snapshot() {
    return {
      started: state.started,
      gameOver: state.gameOver,
      gameOverCause: state.gameOverCause,
      clock: state.clock,
      day: state.day,
      startTimer: state.startTimer,
      players: state.players.map(function (p) {
        return {
          id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y),
          hp: p.hp, alive: p.alive, face: p.face, moving: p.moving,
          equipped: p.equipped, axeEquipped: p.axeEquipped,
          lastDx: p.lastDx || 0, lastDy: p.lastDy || 0,
          bag: p.bag.contents, inventory: p.bag.contents.length,
          planks: p.planks || 0,
          gold: p.gold || 0
        };
      }),
      zombies: state.zombies.map(function (z) {
        return {
          x: Math.round(z.x), y: Math.round(z.y), hp: z.hp,
          lunge: z.lunge > 0 ? +(z.lunge).toFixed(2) : 0,
          ldx: z.lungeDx || 0, ldy: z.lungeDy || 0,
          leader: !!z.isLeader
        };
      }),
      walls: state.walls.map(function (m) {
        return { x: Math.round(m.x), y: Math.round(m.y), w: Math.round(m.w), h: Math.round(m.h), hp: m.hp, orient: m.orient, built: m.built };
      }),
      items: state.items.filter(function (it) { return !it.taken; }).map(function (it) {
        return { x: Math.round(it.x), y: Math.round(it.y), name: it.name, kind: it.kind, color: it.color };
      }),
      projectiles: state.projectiles.map(function (pr) {
        return { x: Math.round(pr.x), y: Math.round(pr.y), vx: pr.vx, vy: pr.vy, color: pr.color, type: pr.type, size: pr.size, trail: pr.trail || [] };
      }),
      birds: state.birds.map(function (b) {
        return { x: Math.round(b.x), y: Math.round(b.y), hp: b.hp };
      }),
      deadTraces: (state.deadTraces || []).map(function (t) {
        return { x: t.x, y: t.y, v: t.v, r: t.r };
      }),
      mairieHp: mairieHp(),
      mairieMaxHp: G.MAIRIE_MAX_HP,
      mairieGold: state.mairieGold || 0,
      scierieUnlocked: !!state.scierieUnlocked,
      universiteUnlocked: !!state.universiteUnlocked,
      montgolfiereUnlocked: !!state.montgolfiereUnlocked,
      scierie: snapshotTownBuilding(state.scierie),
      universite: snapshotTownBuilding(state.universite),
      montgolfiere: snapshotTownBuilding(state.montgolfiere),
      pendingWave: state.pendingWave ? {
        sides: state.pendingWave.sides,
        count: state.pendingWave.count
      } : null,
      towers: state.towers.map(function (t) {
        return {
          x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.w), h: Math.round(t.h),
          level: t.level, hp: t.hp, maxHp: t.maxHp,
          chantierDone: !!t.chantierDone,
          animL: +t.animL.toFixed(2), animR: +t.animR.toFixed(2),
          buildAge: +(state.time - t.builtAt).toFixed(1)
        };
      }),
      vote: state.vote ? {
        proposal: state.vote.proposal,
        endsAt: +(state.vote.endsAt - state.time).toFixed(1),
        yes: countYesVotes()
      } : null,
      waveCount: state.waveCount || 0,
      zombieRamp: state.zombieRamp || 1,
      waveActive: state.waveActive || false,
      waveMsgTimer: state.waveMsgTimer || 0,
      hordeMsgTimer: state.hordeMsgTimer || 0,
      forets: state.buildings.filter(function (b) {
        return b.isForet && (b.foretStage || 0) > 0;
      }).map(function (b) {
        return { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2), stage: b.foretStage || 0 };
      })
    };
  }

  function countYesVotes() {
    if (!state.vote) return 0;
    var n = 0;
    for (var id in state.vote.votes) {
      if (state.vote.votes.hasOwnProperty(id) && state.vote.votes[id]) n++;
    }
    return n;
  }

  function mairieHp() {
    for (var i = 0; i < state.buildings.length; i++) {
      if (state.buildings[i].isMairie) return state.buildings[i].hp;
    }
    return 0;
  }

  // État du lobby (pour le menu d'accueil avant de rejoindre).
  function lobbySnapshot() {
    return {
      type: "lobby",
      clock: state.clock,
      started: state.started,
      startTimer: state.startTimer,
      gameOver: state.gameOver,
      playerCount: state.players.length,
      maxPlayers: MAX_PLAYERS,
      aliveCount: alivePlayers(),
      players: state.players.map(function (p) {
        return { name: p.name, alive: p.alive };
      })
    };
  }

  // Carte initiale envoyée au client au démarrage (bâtiments, arbres, murs).
  function mapSnapshot() {
    return {
      buildings: state.buildings.map(function (b) {
        return {
          x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h),
          name: b.name, isMairie: b.isMairie, isChurch: b.isChurch, isDecor: b.isDecor,
          isForet: b.isForet || false, foretFrame: b.foretFrame || null, foretStage: b.foretStage || 0,
          houseSprite: b.houseSprite ? b.houseSprite : null,
          hp: b.hp, maxHp: b.maxHp, height: b.height
        };
      })
    };
  }

  // Getter d'état : renvoie toujours l'état courant (startGame() réassigne la
  // variable `state` ; un export statique `state` ne se mettrait pas à jour).
  function getState() { return state; }

  module.exports = {
    G: G,
    state: state,
    getState: getState,
    MAX_PLAYERS: MAX_PLAYERS,
    addPlayer: addPlayer,
    removePlayer: removePlayer,
    applyInput: applyInput,
    tick: tick,
    snapshot: snapshot,
    lobbySnapshot: lobbySnapshot,
    mapSnapshot: mapSnapshot,
    startGame: startGame
  };
})();

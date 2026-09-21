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
  var START_DELAY = 3; // court delai avant de lancer la partie : le premier joueur
                       // ne doit pas attendre (avant : 30 s sans simulation ni
                       // snapshot -> ville "vide", chop/pickup impossibles).

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
      universiteUpgrades: {},
      peacefulNight: false,
      marcheUnlocked: false,
      marche: null,
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

  // Cherche un point de spawn libre en ville : pas dans un batiment/palissade
  // ET pas trop pres des autres joueurs (sinon tous les joueurs apparaissent
  // empiles au meme endroit : sprites superposes, impossible de les distinguer).
  function findSpawn(existing) {
    var cx = G.WORLD / 2, cy = G.WORLD / 2 + 140;
    var best = { x: cx, y: cy }, bestD = -1;
    for (var a = 0; a < 48; a++) {
      var x, y, ok = true;
      if (a === 0) { x = cx; y = cy; }
      else {
        var ang = (a / 48) * Math.PI * 2 + Math.random() * 0.3;
        var rad = 60 + (a % 4) * 55;
        x = cx + Math.cos(ang) * rad;
        y = cy + Math.sin(ang) * rad;
      }
      if (x < G.TOWN_MIN + 20 || x > G.TOWN_MAX - 20 ||
          y < G.TOWN_MIN + 20 || y > G.TOWN_MAX - 20) continue;
      if (G.aabbHitsBuildings(x, y)) continue;
      if (G.aabbHitsWalls(x - G.PLAYER_HALF, y - G.PLAYER_HALF, G.PLAYER_W, G.PLAYER_W, true)) continue;
      var minOther = Infinity;
      for (var oi = 0; oi < existing.length; oi++) {
        var dx = existing[oi].x - x, dy = existing[oi].y - y;
        var d = dx * dx + dy * dy;
        if (d < minOther) minOther = d;
      }
      if (minOther > bestD) { bestD = minOther; best = { x: x, y: y }; }
      if (bestD === Infinity) break;
    }
    return best;
  }

  // Ajoute un joueur à la partie. Retourne le joueur ou null si complet.
  function addPlayer(id, name) {
    if (state.players.length >= MAX_PLAYERS) return null;
    var spawn = findSpawn(state.players);
    var p = {
      id: id,
      name: name || ("Joueur" + (state.players.length + 1)),
      x: spawn.x, y: spawn.y,
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
    // Aides aux tests d'integration (loopback) : stock de planches de depart,
    // equivalent a un joueur qui aurait deja coupe du bois. Variable
    // d'environnement fixee par le test au lancement du serveur — un client
    // ne peut pas la controler (input.planks, supprime, etait une faille).
    var tp = parseInt(process.env.TEST_START_PLANKS || "0", 10);
    if (tp > 0) p.planks = tp;
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
    // Replace les joueurs existants (spawn dispersés : jamais empilés).
    var placed = [];
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      var spawn = findSpawn(placed);
      p.x = spawn.x; p.y = spawn.y;
      placed.push(p);
      p.hp = G.PLAYER_MAX_HP; p.alive = true;
      p.equipped = null; p.axeEquipped = false;
      p.bag = { contents: [] };
      p.planks = 0; p.inventory = 0;
      // Aide aux tests d'integration : TEST_START_PLANKS reapplique ici car
      // le startGame (START_DELAY apres le join) remet les planches a zero.
      var tp2 = parseInt(process.env.TEST_START_PLANKS || "0", 10);
      if (tp2 > 0) p.planks = tp2;
      p.chopTarget = null; p.chopWall = null; p.chopTimer = 0;
      p.shootCd = 0;
      p.lastShotAt = undefined;
      p.chopStartedAt = undefined;
    }
  }

  // Applique un input envoyé par un client au joueur correspondant.
  function applyInput(playerId, input) {
    var p = findPlayer(playerId);
    if (!p || !p.alive || state.gameOver) return;
    if (input.dx !== undefined) p._dx = input.dx;
    if (input.dy !== undefined) p._dy = input.dy;
    // Fire est un ETAT persistant (clic maintenu), pas un evenement : le client
    // l'envoie a chaque input (true ou false) et il reste valide jusqu'au
    // prochain input. Le reinitialiser a chaque tick faisait echouer la coupe
    // des qu'un tick ne recevait pas d'input (jitter reseau 20 Hz client / 20 Hz
    // serveur) : chopTimer repartait de zero avant d'atteindre 1 s.
    if (input.fire !== undefined) {
      // Etat persistant (clic maintenu) + latch : un clic tres bref entre
      // deux ticks serveur (20 Hz) ne doit pas etre perdu. Le latch est
      // consomme par le prochain tick qui traite un tir, puis la domination
      // revient a l'etat persistant.
      if (input.fire && !p._fire) p._fireLatch = true;
      p._fire = !!input.fire;
    }
    if (input.aimX !== undefined) p._aimX = input.aimX;
    if (input.aimY !== undefined) p._aimY = input.aimY;
    if (input.build !== undefined) {
      // Mode build replique cote serveur, par joueur : sans lui, tryBuildWall
      // appliquait WALL_BUILD_RANGE (180 px) a toutes les poses, meme en mode
      // build ou le client peut poser n'importe ou (impossible de ceinturer la
      // muraille). Stocke sur le joueur : un input d'un autre joueur ne doit
      // pas quitter le mode build de celui-ci en plein pose.
      p._buildMode = !!input.build;
      p._build = true;
    }
    if (input.rotate) G.state.plankRotation = G.state.plankRotation ? 0 : 1;
    if (input.buildWall) p._buildWall = { x: input.buildWall.wx, y: input.buildWall.wy };
    // Selection dans le menu de construction (scierie) + pose du batiment.
    if (input.buildSel !== undefined) p._buildSel = input.buildSel;
    if (input.placeBuild) {
      p._placeBuild = { x: input.placeBuild.wx, y: input.placeBuild.wy };
    }
    // Vote technologique a la mairie / universite : l'initiateur lance, les
    // autres votent. Generique pour tout batiment de ville du registre
    // TOWN_BUILDINGS, plus les ameliorations de l'universite ("up:<id>").
    if (input.techVote) {
      var isUnivUp = input.techVote.indexOf("up:") === 0;
      var canPayUp = false;
      if (isUnivUp) {
        var upId0 = input.techVote.slice(3);
        var udef0 = G.UNIVERSITE_UPGRADES[upId0];
        if (udef0 && state.universite && state.universite.chantierDone) {
          var alreadyUp = state.universiteUpgrades && state.universiteUpgrades[upId0] && !udef0.repeatable;
          var hasScroll0 = false;
          for (var sci = 0; sci < p.bag.contents.length; sci++) {
            if (p.bag.contents[sci].name === "Parchemin") { hasScroll0 = true; break; }
          }
          canPayUp = !alreadyUp && (hasScroll0 || (state.mairieGold || 0) >= udef0.cost);
        }
      }
      var tdef = G.TOWN_BUILDINGS[input.techVote];
      if ((isUnivUp && canPayUp) || (tdef && !state[tdef.unlockedField])) {
        if (!state.vote) {
          // L'initiateur doit pouvoir payer (planches ; or du coffre commun,
          // ou parchemin pour les ameliorations d'universite).
          if (isUnivUp || ((state.mairieGold || 0) >= tdef.cost.gold && (p.planks || 0) >= tdef.cost.planks)) {
            G.startVote(input.techVote, p.id);
          }
        } else {
          // Un clic pendant un vote en cours = vote "pour".
          G.castVote(p.id, true);
        }
      }
    }
    // Achat au marche : l'or vient du coffre commun de la mairie, l'objet est
    // livre dans le sac du joueur qui achete.
    if (input.marketBuy !== undefined) {
      if (state.marche && state.marche.chantierDone) {
        var mitem = null;
        for (var mi = 0; mi < G.MARCHE_ITEMS.length; mi++) {
          if (G.MARCHE_ITEMS[mi].name === input.marketBuy) { mitem = G.MARCHE_ITEMS[mi]; break; }
        }
        if (mitem && (state.mairieGold || 0) >= mitem.price) {
          state.mairieGold -= mitem.price;
          p.bag.contents.push({ name: mitem.name, kind: mitem.kind, color: mitem.color });
          p.inventory = p.bag.contents.length;
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
    // Coffre de la mairie (partage entre joueurs) : depot d'un objet du sac
    // (nom + type, le premier exemplaire) ou retrait (index dans le coffre).
    // Identifie l'objet par nom+kind : le client affiche des groupes, l'index
    // affiche change a chaque snapshot — le nom est stable.
    if (input.chestDeposit) {
      var dn = input.chestDeposit.name, dk = input.chestDeposit.kind;
      var di = -1;
      for (var dci = 0; dci < p.bag.contents.length; dci++) {
        if (p.bag.contents[dci].name === dn && p.bag.contents[dci].kind === dk) { di = dci; break; }
      }
      if (di >= 0) {
        var dit = p.bag.contents.splice(di, 1)[0];
        state.chest.push(dit);
        p.inventory = p.bag.contents.length;
      }
    }
    if (input.chestWithdraw !== undefined) {
      var wi = input.chestWithdraw;
      if (wi >= 0 && wi < state.chest.length) {
        var wit = state.chest.splice(wi, 1)[0];
        p.bag.contents.push(wit);
        p.inventory = p.bag.contents.length;
      }
    }
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
      G.spawnNightReliques();
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
          // Le client vise avec sa souris depuis SA position predite ; si le
          // serveur appliquait dx/dy depuis sa propre position, la direction
          // divergeait (ecart de position = direction legerement differente)
          // et chaque snapshot re-correction creait l'effet elastique
          // (rollbacks). On recalcule la direction depuis la position serveur
          // vers le point vise (aimX/aimY, envoyes avec l'input) : la
          // trajectoire converge exactement vers le curseur, quelle que soit
          // la derive de prediction.
          var nx = dx / dist, ny = dy / dist;
          if (p._aimX !== undefined && p._aimY !== undefined) {
            var adx = p._aimX - p.x, ady = p._aimY - p.y;
            var adist = Math.sqrt(adx * adx + ady * ady);
            if (adist > 0.001) { nx = adx / adist; ny = ady / adist; }
          }
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
      // Tir d'arme uniquement : la hache (axeEquipped) declenche la coupe via
      // updateChop, jamais un tir. Le tir utilise le MEME handleShooting que le
      // client (src/weapons.js) avec un swap d'etat par joueur : avant, la
      // logique etait dupliquee ici et toute arme ajoutee dans weapons.js
      // n'etait pas simulee par le serveur (desync silencieuse : le else final
      // la faisait partir comme un projectile "pistolet standard").
      var pSt = G.WEAPON_STATS[p.equipped];
      var wantShot = (p._fire || p._fireLatch) && p.equipped && !p.axeEquipped && !!pSt;
      // Purge du latch obsolote : le latch ne sert qu'a ne pas perdre un clic
      // bref entre deux ticks serveur. Si le joueur ne peut pas tirer ce tick
      // (hache equipee, pas d'arme), le garder en attente ferait partir un tir
      // fantome des qu'il equipe une arme (clic maintenu pendant la coupe).
      if (p._fireLatch && !wantShot) p._fireLatch = false;
      if (wantShot) {
        var oldShot = {
          px: state.player.x, py: state.player.y, eq: state.equipped,
          ax: state.axeEquipped, cd: state.shootCd, lsa: state.lastShotAt,
          inB: state.inBuilding, paused: state.paused, bagO: state.bag.open,
          chO: state.chestOpen, go: state.gameOver, bm: state.buildMode,
          ah: state.actionHeld,
          mwx: state.mouse.wx, mwy: state.mouse.wy, nProj: state.projectiles.length
        };
        state.player.x = p.x; state.player.y = p.y;
        state.equipped = p.equipped;
        state.axeEquipped = p.axeEquipped;
        state.shootCd = p.shootCd || 0;
        state.inBuilding = null;
        state.paused = false;
        state.bag.open = false;
        state.chestOpen = false;
        state.gameOver = false;
        state.buildMode = false;
        // wantShot a deja valide l'intention de tir (clic/latch) : on la prete
        // telle quelle a handleShooting qui lit state.actionHeld.
        state.actionHeld = true;
        state.mouse.wx = p._aimX !== undefined ? p._aimX : p.x;
        state.mouse.wy = p._aimY !== undefined ? p._aimY : p.y;
        G.handleShooting();
        // Les projectiles crees par ce tir appartiennent au joueur : le tag
        // owner sert au bruit des tirs (attraction des zombies) et au rendu.
        var newProj = state.projectiles.length - oldShot.nProj;
        for (var np = state.projectiles.length - 1; np >= 0 && newProj > 0; np--, newProj--) {
          state.projectiles[np].owner = p.id;
        }
        p.x = state.player.x; p.y = state.player.y;
        p.shootCd = state.shootCd;
        if (state.lastShotAt !== oldShot.lsa) p.lastShotAt = state.lastShotAt;
        state.player.x = oldShot.px; state.player.y = oldShot.py;
        state.equipped = oldShot.eq; state.axeEquipped = oldShot.ax;
        state.shootCd = oldShot.cd; state.lastShotAt = oldShot.lsa;
        state.inBuilding = oldShot.inB; state.paused = oldShot.paused;
        state.bag.open = oldShot.bagO; state.chestOpen = oldShot.chO;
        state.gameOver = oldShot.go; state.buildMode = oldShot.bm;
        state.actionHeld = oldShot.ah;
        state.mouse.wx = oldShot.mwx; state.mouse.wy = oldShot.mwy;
        // Le latch n'est consomme que si un tir a effectivement eu lieu (si le
        // cooldown a refuse le tir ce tick, le latch attend le suivant).
        if (p.shootCd > 0) p._fireLatch = false;
      }
      if (p.shootCd > 0) p.shootCd -= dt;
      // Pose de planche.
      if (p._buildWall) {
        state.player.x = p.x; state.player.y = p.y; state.planks = p.planks || 0;
        var oldBuildMode = state.buildMode;
        state.buildMode = !!p._buildMode;
        G.tryBuildWall(p._buildWall.x, p._buildWall.y);
        state.buildMode = oldBuildMode;
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
      // Récolte de planches / destruction de palissade à la hache : on swappe
      // l'état global vers le joueur courant pour que updateChop() s'applique à ce joueur.
      var oldChop = { px: state.player.x, py: state.player.y, ax: state.axeEquipped,
                      pl: state.planks, inB: state.inBuilding, bagO: state.bag.open,
                      chO: state.chestOpen, chT: state.chopTarget, chW: state.chopWall, chTi: state.chopTimer,
                      ah: state.actionHeld };
      // actionHeld suit brut le clic maintenu (sans filtre d'arme) : la
      // factorisation du tir a un moment filtre la hache, ce qui cassait la
      // coupe cote serveur. updateChop gere la hache ; le tir a son propre swap.
      state.actionHeld = !!(p._fire || p._fireLatch);
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
      // Debut d'un nouveau cycle de coupe (cible changee ou relance apres un
      // coup) : horodatage pour l'animation de la hache du joueur distant.
      if (p.axeEquipped && (p.chopTarget || p.chopWall) && state.chopTimer < 0.15 &&
          (p.chopStartedAt === undefined || (state.time - p.chopStartedAt) > 0.15)) {
        p.chopStartedAt = state.time;
      }
      if (!p.chopTarget && !p.chopWall) p.chopStartedAt = undefined;
      state.player.x = oldChop.px; state.player.y = oldChop.py;
      state.axeEquipped = oldChop.ax; state.planks = oldChop.pl;
      state.inBuilding = oldChop.inB; state.bag.open = oldChop.bagO;
      state.chestOpen = oldChop.chO; state.chopTarget = oldChop.chT;
      state.chopWall = oldChop.chW; state.chopTimer = oldChop.chTi;
      state.actionHeld = oldChop.ah;
      // Réinitialise les flags d'input consommés.
      // Evenements ponctuels consommes ; dx/dy/fire restent persistants
      // (le client renvoie l'etat complet a chaque input : dx:0, dy:0, fire:false
      // quand les touches sont relachees).
      p._build = false; p._buildSel = undefined; p._placeBuild = null;
    }

    // Chantiers (scierie, tours), combat des tours, votes a la mairie.
    G.updateBuildSites(dt);
    G.updateTowers(dt);
    G.cleanupTowers();
    if (state.vote) {
      var voteInitiator = state.vote.initiator;
      // Parchemin de l'initiateur : amelioration d'universite gratuite s'il en
      // porte un (consomme a la resolution reussie).
      var scrollUsedFor = null;
      G.resolveVote(alivePlayers(), function (cost) {
        // Debite les planches du joueur initiateur du vote (or : coffre commun,
        // deja debite par resolveVote).
        var init = voteInitiator !== undefined ? findPlayer(voteInitiator) : null;
        if (!init || (init.planks || 0) < cost) return false;
        init.planks -= cost;
        return true;
      }, function () {
        var init = voteInitiator !== undefined ? findPlayer(voteInitiator) : null;
        if (!init) return false;
        for (var si = 0; si < init.bag.contents.length; si++) {
          if (init.bag.contents[si].name === "Parchemin") { scrollUsedFor = init.id; return true; }
        }
        return false;
      });
      if (scrollUsedFor !== null) {
        var scrollP = findPlayer(scrollUsedFor);
        if (scrollP) {
          for (var sc = 0; sc < scrollP.bag.contents.length; sc++) {
            if (scrollP.bag.contents[sc].name === "Parchemin") {
              scrollP.bag.contents.splice(sc, 1);
              scrollP.inventory = scrollP.bag.contents.length;
              break;
            }
          }
        }
      }
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
  // Snapshot personnalise par joueur : cull les entites hors de la zone
  // utile du joueur (zombies, projectiles, oiseaux). A 5000 zombies la nuit,
  // le snapshot global faisait 1,3 Mo/s a 10 Hz et saturait la connexion ;
  // chaque joueur ne voit qu'une petite portion de la horde (brouillard).
  var SNAP_ZOMBIE_RANGE = 900;
  function snapshot(forPlayerId) {
    var me = null;
    if (forPlayerId !== undefined) {
      for (var spi = 0; spi < state.players.length; spi++) {
        if (state.players[spi].id === forPlayerId) { me = state.players[spi]; break; }
      }
    }
    function inRange(e) {
      if (!me) return true;
      var dx = e.x - me.x, dy = e.y - me.y;
      return dx * dx + dy * dy < SNAP_ZOMBIE_RANGE * SNAP_ZOMBIE_RANGE;
    }
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
          // Animation d'action du joueur distant : temps ecoule depuis le
          // dernier tir (shotAge) ou le debut du cycle de hache (chopAge).
          shotAge: p.lastShotAt !== undefined ? +((state.time - p.lastShotAt)).toFixed(2) : undefined,
          chop: !!(p.axeEquipped && (p.chopTarget || p.chopWall)),
          chopAge: p.chopStartedAt !== undefined ? +((state.time - p.chopStartedAt)).toFixed(2) : undefined,
          bag: p.bag.contents, inventory: p.bag.contents.length,
          planks: p.planks || 0,
          gold: p.gold || 0
        };
      }),
      // Zombies en format compact [x, y, hp, lunge, ldx, ldy, leader] : a
      // 3000+ zombies la nuit, le format objet domine la bande passante
      // (200 Ko/s -> ~60 Ko/s a 10 Hz).
      zombies: state.zombies.filter(inRange).map(function (z) {
        return [
          Math.round(z.x), Math.round(z.y), Math.round(z.hp),
          z.lunge > 0 ? +(z.lunge).toFixed(2) : 0,
          +(z.lungeDx || 0).toFixed(2), +(z.lungeDy || 0).toFixed(2),
          z.isLeader ? 1 : 0
        ];
      }),
      walls: state.walls.map(function (m) {
        // Grace anti-blocage : envoyee en DELTA de temps (temps restant), pas
        // en horodatage absolu — les horloges client/serveur different. Sans
        // cette sync, la palissade bloquait le joueur immediatement dans la
        // prediction locale alors que le serveur l'ignorait encore pendant la
        // grace : collision divergente = rollback a chaque snapshot.
        var grace = m.noBlockUntil !== undefined ? +(m.noBlockUntil - state.time).toFixed(2) : undefined;
        if (grace !== undefined && grace < 0) grace = 0;
        return { x: Math.round(m.x), y: Math.round(m.y), w: Math.round(m.w), h: Math.round(m.h), hp: m.hp, orient: m.orient, built: m.built, grace: grace };
      }),
      items: state.items.filter(function (it) { return !it.taken; }).map(function (it) {
        return { x: Math.round(it.x), y: Math.round(it.y), name: it.name, kind: it.kind, color: it.color };
      }),
      projectiles: state.projectiles.filter(inRange).map(function (pr) {
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
      chest: state.chest,
      scierieUnlocked: !!state.scierieUnlocked,
      universiteUnlocked: !!state.universiteUnlocked,
      montgolfiereUnlocked: !!state.montgolfiereUnlocked,
      marcheUnlocked: !!state.marcheUnlocked,
      scierie: snapshotTownBuilding(state.scierie),
      universite: snapshotTownBuilding(state.universite),
      montgolfiere: snapshotTownBuilding(state.montgolfiere),
      marche: snapshotTownBuilding(state.marche),
      universiteUpgrades: state.universiteUpgrades || {},
      peacefulNight: !!state.peacefulNight,
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
      // Forets coupees : envoyees en format compact [x, y, stage]. La cle est
      // le centre exact ARRONDI du batiment serveur : le client memorise la
      // meme cle (foretKey) depuis la carte recue au join, avant tout recalcul
      // d'emprise PNG — les arrondis separes de x/y/w/h dans mapSnapshot
      // declaçaient la cle reconstruite et le stage ne s'appliquait jamais.
      forets: state.buildings.filter(function (b) {
        return b.isForet && (b.foretStage || 0) > 0;
      }).map(function (b) {
        return [Math.round(b.x + b.w / 2), Math.round(b.y + b.h / 2), b.foretStage || 0];
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
        // Forets : positions en precision EXACTE (pas d'arrondi). Le client
        // memorise la cle de sync foretKey = Math.round(x + w/2) depuis ces
        // valeurs : les arrondis separes de x/y/w/h decalaient la cle de 1 px
        // par rapport au snapshot et l'etat de coupe ne s'appliquait jamais.
        var roundPos = !b.isForet;
        return {
          x: roundPos ? Math.round(b.x) : b.x,
          y: roundPos ? Math.round(b.y) : b.y,
          w: roundPos ? Math.round(b.w) : b.w,
          h: roundPos ? Math.round(b.h) : b.h,
          name: b.name, isMairie: b.isMairie, isChurch: b.isChurch, isDecor: b.isDecor,
          isForet: b.isForet || false, foretFrame: b.foretFrame || null, foretStage: b.foretStage || 0,
          // Ne PAS serialiser l'objet sprite du serveur (stub sans image :
          // drawImage(null) cote client). Le client retrouve le PNG par nom
          // (G.SPRITES.house[houseSpriteName]) a la reception de la carte.
          houseSpriteName: b.houseSpriteName || null,
          hp: b.hp, maxHp: b.maxHp, height: b.height
        };
      }),
      // Murs et objets : envoyes des le join pour que le client affiche la
      // ville complete immediatement (sinon il faut attendre le premier
      // snapshot 10 Hz, et celui-ci n'est emis qu'une fois la partie
      // demarree apres START_DELAY).
      walls: state.walls.map(function (m) {
        return { x: Math.round(m.x), y: Math.round(m.y), w: Math.round(m.w), h: Math.round(m.h), hp: m.hp, orient: m.orient, built: m.built };
      }),
      items: state.items.filter(function (it) { return !it.taken; }).map(function (it) {
        return { x: Math.round(it.x), y: Math.round(it.y), name: it.name, kind: it.kind, color: it.color };
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

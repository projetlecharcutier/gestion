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
      floaters: [],
      // Canal d'evenements serveur -> client (votes, achats, sons, mort,
      // deblocages) : en solo ces retours viennent du code client, en ligne le
      // serveur est la seule autorite et n'envoyait RIEN (echecs d'achat et
      // resultats de votes silencieux, aucun son de tir/manger/tour cassee).
      // Chaque evenement est reserve a son destinataire (playerId) ou diffuse
      // a tous (null), et consomme au snapshot du joueur concerne.
      events: []
    };
  }

  var state = createInitialState();
  G.state = state;

  // Empile un evenement pour un joueur (to === null : diffuse a tous les
  // joueurs connectes). Garde-fou memoire : un evenement adresse a un joueur
  // parti n'est pas empile ; les evenements perimes (joueur parti sans
  // consommer, broadcast plus d'actualite) sont purges par age.
  var EVENT_TTL = 5;
  function pushEvent(to, ev) {
    if (to === null || findPlayer(to)) {
      state.events.push({ to: to === null ? undefined : to, t: ev.t, msg: ev.msg, name: ev.name, x: ev.x, y: ev.y, sent: {}, at: state.time });
    }
  }

  // Consomme les evenements visibles par un joueur (appel depuis snapshot :
  // un evenement adresse n'est pas livre a un autre ; un broadcast n'est
  // retire que quand chaque joueur connecte l'a recu — le premier snapshot
  // ne doit pas l'avaler pour tous les autres).
  function takeEvents(forPlayerId) {
    var out = [];
    var keep = [];
    for (var i = 0; i < state.events.length; i++) {
      var e = state.events[i];
      if (e.to !== undefined && e.to !== forPlayerId) { keep.push(e); continue; }
      if (!e.sent[forPlayerId]) {
        out.push({ t: e.t, msg: e.msg, name: e.name, x: e.x, y: e.y });
        e.sent[forPlayerId] = true;
      }
      // Broadcast livre a tous les joueurs connectes (ou perime) : purge.
      var allGot = true;
      for (var pi = 0; pi < state.players.length; pi++) {
        if (!e.sent[state.players[pi].id]) { allGot = false; break; }
      }
      if (!allGot && (state.time - (e.at || state.time)) < EVENT_TTL) keep.push(e);
    }
    state.events = keep;
    return out;
  }

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

  // Distance du joueur au centre d'un batiment.
  function distToBuilding(p, b) {
    if (!b) return Infinity;
    var dx = p.x - (b.x + b.w / 2), dy = p.y - (b.y + b.h / 2);
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Proximite obligatoire : le client n'ouvre ces ecrans que pres du batiment
  // (rayon d'ouverture input.js) ; sans ce controle serveur, un client modifie
  // pouvait deposer/voter/acheter depuis n'importe ou sur la carte.
  var REACH_MAIRIE = 250;   // ouverture coffre : max(w,h)+10+60 = 190, marge
  var REACH_EGLISE = 150;   // ouverture eglise : 45+10+60 = 115, marge
  var REACH_VILLE = 130;    // batiments de ville (universite/marche...) : side/2+10+60
  function nearMairie(p) {
    for (var i = 0; i < state.buildings.length; i++) {
      if (state.buildings[i].isMairie) return distToBuilding(p, state.buildings[i]) < REACH_MAIRIE;
    }
    return false;
  }
  function nearEglise(p) {
    for (var i = 0; i < state.buildings.length; i++) {
      if (state.buildings[i].isChurch) return distToBuilding(p, state.buildings[i]) < REACH_EGLISE;
    }
    return false;
  }
  function nearBuilding(p, b) {
    return distToBuilding(p, b) < REACH_VILLE;
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
    // La file d'evenements de la partie precedente est perimee (batiments et
    // ressources reinitialises).
    state.events = [];
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
    // Rotation de palissade : valeur ABSOLUE (0/1) par joueur. L'ancien toggle
    // global partage l'orientation entre tous les joueurs (si A tournait sa
    // palissade, B voyait la sienne tourner). 0 est falsy : test !== undefined.
    if (input.rotate !== undefined) p._plankRotation = input.rotate ? 1 : 0;
    if (input.buildWall) p._buildWall = { x: input.buildWall.wx, y: input.buildWall.wy };
    // Selection dans le menu de construction (scierie) + pose du batiment.
    if (input.buildSel !== undefined) p._buildSel = input.buildSel;
    if (input.placeBuild) {
      p._placeBuild = { x: input.placeBuild.wx, y: input.placeBuild.wy };
    }
    // Montgolfiere : le clic client declenche l'animation LOCALEMENT chez
    // lui seul (animStart sur le batiment local). En ligne, on declenche
    // cote serveur et on diffuse l'horodatage : tous les clients voient le
    // meme decollage et le meme message de vague.
    if (input.montgolfiere) {
      var mg = state.montgolfiere;
      if (mg && mg.chantierDone) {
        var mgDur = G.MONTGOLFIERE_ANIM_TIME || 4;
        if (mg.animStart === undefined || (state.time - mg.animStart) >= mgDur) {
          mg.animStart = state.time;
          pushEvent(null, { t: "montgolfiere", x: Math.round(mg.x), y: Math.round(mg.y) });
        }
      }
    }
    // Vote technologique a la mairie / universite : l'initiateur lance, les
    // autres votent. Generique pour tout batiment de ville du registre
    // TOWN_BUILDINGS, plus les ameliorations de l'universite ("up:<id>").
    // Proximite obligatoire : tech de ville -> mairie ; amelioration ->
    // universite posee (le client n'ouvre ces menus que pres du batiment).
    if (input.techVote) {
      var isUnivUp0 = input.techVote.indexOf("up:") === 0;
      var nearVote = isUnivUp0
        ? (state.universite && nearBuilding(p, state.universite))
        : nearMairie(p);
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
        if (!nearVote) {
          // Trop loin du batiment : ignore (le client legitime est toujours a
          // portee quand il clique ; un client modifie votait depuis loin).
        } else if (!state.vote) {
          // L'initiateur doit pouvoir payer (planches ; or du coffre commun,
          // ou parchemin pour les ameliorations d'universite).
          if (isUnivUp || ((state.mairieGold || 0) >= tdef.cost.gold && (p.planks || 0) >= tdef.cost.planks)) {
            G.startVote(input.techVote, p.id);
          } else {
            // Meme retour que le solo (buyTownTech/buyUniversiteUpgrade) : le
            // refus de paiement n'etait avant jamais communique en ligne.
            pushEvent(p.id, { t: "msg", msg: isUnivUp
              ? "Ressources insuffisantes (or du coffre ou Parchemin)"
              : "Il faut " + tdef.cost.planks + " planches + " + tdef.cost.gold + " or au coffre" });
          }
        } else {
          // Un clic pendant un vote en cours = vote "pour".
          G.castVote(p.id, true);
        }
      }
    }
    // Achat au marche : l'or vient du coffre commun de la mairie, l'objet est
    // livre dans le sac du joueur qui achete. Proximite obligatoire.
    if (input.marketBuy !== undefined) {
      if (state.marche && state.marche.chantierDone && nearBuilding(p, state.marche)) {
        var mitem = null;
        for (var mi = 0; mi < G.MARCHE_ITEMS.length; mi++) {
          if (G.MARCHE_ITEMS[mi].name === input.marketBuy) { mitem = G.MARCHE_ITEMS[mi]; break; }
        }
        if (mitem && (state.mairieGold || 0) >= mitem.price) {
          state.mairieGold -= mitem.price;
          p.bag.contents.push({ name: mitem.name, kind: mitem.kind, color: mitem.color });
          p.inventory = p.bag.contents.length;
          pushEvent(p.id, { t: "msg", msg: mitem.name + " acheté !" });
        } else if (mitem) {
          // Echec d'achat (or du coffre insuffisant) : avant, silencieux en
          // ligne (le client n'affichait rien dans ce mode).
          pushEvent(p.id, { t: "msg", msg: "Le coffre de la mairie n'a pas assez d'or" });
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
          // 150 px : rayon client (120) + marge de latence reseau. Le client
          // autorise le clic sur sa position PREDITE (en avance sur le serveur
          // du temps d'un aller-retour) : a 120 strict, le serveur refusait
          // des pickups legitimement cliques et l'objet restait au sol.
          if (Math.sqrt(pdx * pdx + pdy * pdy) < 150) {
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
      // Proximite mairie obligatoire ; PAS de return : la suite d'applyInput
      // (equip, eat...) reste valide pour un joueur qui n'est pas au coffre.
      var dn = input.chestDeposit.name, dk = input.chestDeposit.kind;
      var di = -1;
      if (nearMairie(p)) {
        for (var dci = 0; dci < p.bag.contents.length; dci++) {
          if (p.bag.contents[dci].name === dn && p.bag.contents[dci].kind === dk) { di = dci; break; }
        }
        if (di >= 0) {
          var dit = p.bag.contents.splice(di, 1)[0];
          state.chest.push(dit);
          p.inventory = p.bag.contents.length;
        }
      }
    }
    if (input.chestWithdraw !== undefined) {
      // Retrait par nom+kind (le client affiche des groupes) : l'ancien index
      // faisait retirer le mauvais objet si le coffre changeait entre le
      // snapshot et le clic (fenetre de ~100 ms). Proximite mairie requise.
      var wd = input.chestWithdraw;
      if (nearMairie(p) && wd && wd.name !== undefined) {
        var wIdx = -1;
        for (var wci = 0; wci < state.chest.length; wci++) {
          if (state.chest[wci].name === wd.name && state.chest[wci].kind === wd.kind) { wIdx = wci; break; }
        }
        if (wIdx >= 0) {
          var wit = state.chest.splice(wIdx, 1)[0];
          p.bag.contents.push(wit);
          p.inventory = p.bag.contents.length;
        }
      }
    }
    if (input.churchDeposit) {
      var ri = -1;
      if (nearEglise(p)) {
        for (var ci = 0; ci < p.bag.contents.length; ci++) {
          if (p.bag.contents[ci].name === "Relique") { ri = ci; break; }
        }
      }
      if (ri >= 0) {
        p.bag.contents.splice(ri, 1);
        p.inventory = p.bag.contents.length;
        state.mairieGold = (state.mairieGold || 0) + 100;
        // Meme retour que le solo (sellRelic) : +100 or.
        pushEvent(p.id, { t: "msg", msg: "100 pièces d'or" });
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
        // Le client joue le son/floater localement en solo ; en ligne, le
        // serveur est autorite et n'envoyait rien (manger etait invisible).
        pushEvent(p.id, { t: "eat" });
      }
    }
  }

  // Simulation : un tick à dt secondes.
  // --- Swap d'état global par joueur, UNIFIE ---
  // Les modules de simulation partagés (chop, weapons, walls, towers) lisent
  // l'état d'un joueur global (state.player, state.planks, state.axeEquipped,
  // state.buildMode, state.actionHeld, state.buildSel...) alors que le
  // serveur gère N joueurs. Chaque site de swap sauvegardait SA liste de
  // champs : un champ oublié = un bug multijoueur (le bug du mode build est
  // né exactement ainsi). Toute la sauvegarde/restauration passe désormais
  // par CE seul helper : la liste des champs est écrite UNE fois, ici.
  // opts.tir/pose/chop pretent les champs utiles à l'usage ; tout le reste
  // est quand même sauvegardé puis restauré, donc un champ lu à l'insu d'un
  // appel ne peut plus fuiter vers le joueur suivant.
  var PLAYER_SWAP_FIELDS = [
    "equipped", "axeEquipped", "shootCd", "lastShotAt", "inBuilding",
    "paused", "gameOver", "buildMode", "actionHeld", "planks",
    "buildSel", "plankRotation", "chopTarget", "chopWall", "chopTimer"
  ];
  function withPlayer(p, opts, fn) {
    var s = G.state;
    var saved = { px: s.player.x, py: s.player.y, bagOpen: s.bag.open, chestOpen: s.chestOpen, mwx: s.mouse.wx, mwy: s.mouse.wy };
    for (var fi = 0; fi < PLAYER_SWAP_FIELDS.length; fi++) saved[PLAYER_SWAP_FIELDS[fi]] = s[PLAYER_SWAP_FIELDS[fi]];
    s.player.x = p.x; s.player.y = p.y;
    s.bag.open = false; s.chestOpen = false; s.inBuilding = null; s.paused = false; s.gameOver = false;
    if (opts.tir) {
      s.equipped = p.equipped; s.axeEquipped = p.axeEquipped;
      s.shootCd = p.shootCd || 0;
      s.actionHeld = true;
      s.mouse.wx = p._aimX !== undefined ? p._aimX : p.x;
      s.mouse.wy = p._aimY !== undefined ? p._aimY : p.y;
      s.buildMode = false;
    } else if (opts.pose) {
      s.planks = p.planks || 0;
      if (p._buildSel !== undefined) s.buildSel = p._buildSel;
      s.buildMode = !!p._buildMode;
      s.plankRotation = p._plankRotation !== undefined ? p._plankRotation : s.plankRotation;
      s.actionHeld = false;
    } else if (opts.chop) {
      s.axeEquipped = p.axeEquipped;
      s.planks = p.planks || 0;
      s.actionHeld = !!(p._fire || p._fireLatch);
      s.chopTarget = p.chopTarget || null;
      s.chopWall = p.chopWall || null;
      s.chopTimer = p.chopTimer || 0;
    }
    fn();
    // Les modules ont pu déplacer state.player (pushPlayerOutOfWall,
    // tryMove) : on récupère la position de sortie.
    p.x = s.player.x; p.y = s.player.y;
    // Retours spécifiques par usage (ce que le tick relit après l'appel).
    if (opts.tir) {
      p.shootCd = s.shootCd;
      if (s.lastShotAt !== saved.lastShotAt) p.lastShotAt = s.lastShotAt;
      // le latch n'est consommé que si un tir a effectivement eu lieu.
      if (p.shootCd > 0) p._fireLatch = false;
    }
    if (opts.pose) {
      p.planks = s.planks;
    }
    if (opts.chop) {
      p.planks = s.planks;
      p.chopTarget = s.chopTarget;
      p.chopWall = s.chopWall;
      p.chopTimer = s.chopTimer;
    }
    s.player.x = saved.px; s.player.y = saved.py;
    s.bag.open = saved.bagOpen; s.chestOpen = saved.chestOpen;
    s.mouse.wx = saved.mwx; s.mouse.wy = saved.mwy;
    for (var ri = 0; ri < PLAYER_SWAP_FIELDS.length; ri++) s[PLAYER_SWAP_FIELDS[ri]] = saved[PLAYER_SWAP_FIELDS[ri]];
  }
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
          // tryMove valide les collisions (batiments, arbres, murs).
          withPlayer(p, {}, function () {
            p.moving = G.tryMove(stepX, stepY);
          });
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
        var nProjBefore = state.projectiles.length;
        withPlayer(p, { tir: true }, function () {
          G.handleShooting();
        });
        // Les projectiles crees par ce tir appartiennent au joueur : le tag
        // owner sert au bruit des tirs (attraction des zombies) et au rendu.
        var newProj = state.projectiles.length - nProjBefore;
        for (var np = state.projectiles.length - 1; np >= 0 && newProj > 0; np--, newProj--) {
          state.projectiles[np].owner = p.id;
        }
        // Son de tir : le client en ligne n'appelle jamais handleShooting
        // (le serveur pilote les projectiles), il n'a donc aucun evenement
        // pour jouer shoot.mp3. Le tir d'un joueur distant doit aussi
        // s'entendre chez les autres : l'evenement est diffuse a tous,
        // filtre de proximite cote client.
        if (p.shootCd > 0) pushEvent(null, { t: "shoot", x: Math.round(p.x), y: Math.round(p.y) });
      }
      if (p.shootCd > 0) p.shootCd -= dt;
      // Pose de planche.
      if (p._buildWall) {
        withPlayer(p, { pose: true }, function () {
          G.tryBuildWall(p._buildWall.x, p._buildWall.y);
        });
        p._buildWall = null;
      }
      // Pose de batiment depuis le menu de la scierie (tour, scierie) :
      // l'or vient du coffre commun, les planches du joueur.
      // buildSel PAR JOUEUR : la selection est pretee au global seulement
      // pendant placeFromBuildMenu puis restauree. Avant, `state.buildSel =
      // p._buildSel` fuyait dans le global : si la selection et la pose
      // arrivaient dans deux inputs differents, un autre joueur pouvait
      // consommer la selection residuelle d'un tiers a sa propre pose.
      if (p._placeBuild) {
        state.player.x = p.x; state.player.y = p.y;
        state.planks = p.planks || 0;
        var oldBuildSel = state.buildSel;
        if (p._buildSel !== undefined) state.buildSel = p._buildSel;
        G.placeFromBuildMenu(p._placeBuild.x, p._placeBuild.y);
        state.buildSel = oldBuildSel;
        p.x = state.player.x; p.y = state.player.y;
        p.planks = state.planks;
        p._placeBuild = null;
      }
      // Récolte de planches / destruction de palissade à la hache : on swappe
      // l'état global vers le joueur courant pour que updateChop() s'applique à ce joueur.
      // Recolte de planches / destruction de palissade a la hache : swap unifie
      // via withPlayer (meme liste de champs que le tir et la pose).
      withPlayer(p, { chop: true }, function () {
        G.updateChop(dt);
      });
      // Debut d'un nouveau cycle de coupe (cible changee ou relance apres un
      // coup) : horodatage pour l'animation de la hache du joueur distant.
      if (p.axeEquipped && (p.chopTarget || p.chopWall) && p.chopTimer < 0.15 &&
          (p.chopStartedAt === undefined || (state.time - p.chopStartedAt) > 0.15)) {
        p.chopStartedAt = state.time;
      }
      if (!p.chopTarget && !p.chopWall) p.chopStartedAt = undefined;
      // Réinitialise les flags d'input consommés.
      // Evenements ponctuels consommes ; dx/dy/fire restent persistants
      // (le client renvoie l'etat complet a chaque input : dx:0, dy:0, fire:false
      // quand les touches sont relachees).
      // _buildSel N'EST PAS purge : c'est un etat persistant de selection par
      // joueur (comme le menu local). L'ancienne purge au bout d'un tick
      // cassait les poses ou la selection et le clic carte arrivaient dans
      // deux inputs differents : placeFromBuildMenu lisait alors la selection
      // residuelle du global, eventuellement celle d'un autre joueur.
      p._build = false; p._placeBuild = null;
    }

    // Chantiers (scierie, tours), combat des tours, votes a la mairie.
    G.updateBuildSites(dt);
    G.updateTowers(dt);
    // Tours cassees : avant que cleanupTowers ne les retire, on emet un
    // evenement diffuse (son tourCasse chez tous les clients a portee).
    for (var twi = 0; twi < state.towers.length; twi++) {
      if (state.towers[twi].hp <= 0) {
        pushEvent(null, { t: "tourCasse", x: Math.round(state.towers[twi].x), y: Math.round(state.towers[twi].y) });
      }
    }
    G.cleanupTowers();
    if (state.vote) {
      var voteInitiator = state.vote.initiator;
      var voteProposal = state.vote.proposal;
      // Parchemin de l'initiateur : amelioration d'universite gratuite s'il en
      // porte un (consomme a la resolution reussie).
      var scrollUsedFor = null;
      var voteRes = G.resolveVote(alivePlayers(), function (cost) {
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

    // Resultat du vote a la resolution (meme retour que le solo) : avant, un
    // vote echoue en ligne n'affichait rien du tout. Label lisible de la
    // proposition (batiment de ville ou amelioration d'universite).
    if (voteRes === "passed" || voteRes === "failed") {
      var lab = null;
      if (voteProposal.indexOf("up:") === 0) {
        var udef2 = G.UNIVERSITE_UPGRADES[voteProposal.slice(3)];
        lab = udef2 ? udef2.label : voteProposal;
      } else {
        var tdef2 = G.TOWN_BUILDINGS[voteProposal];
        lab = tdef2 ? tdef2.label : voteProposal;
      }
      if (voteRes === "passed") {
        pushEvent(null, { t: "msg", msg: lab + " : voté et débloqué ! Z + posez le bâtiment en ville" });
      } else {
        pushEvent(null, { t: "msg", msg: lab + " : le vote a échoué (majorité non atteinte ou paiement impossible)" });
      }
    }

    // Mort des joueurs : zombiee.js gere la mort dans le module partage,
    // on ne peut pas emettre depuis la ; on compare avant/apres updateZombies
    // pour diffuser l'annonce a tous les joueurs.
    var deadNames = [];
    for (var di = 0; di < state.players.length; di++) {
      if (state.players[di].alive) deadNames.push(state.players[di].name);
    }
    // Zombies, projectiles, oiseaux.
    // Position des zombies au tick precedent : sert a calculer la velocite
    // effective (vx/vy) envoyee dans le snapshot. Le client extrapole entre
    // deux snapshots (10 Hz) pour un mouvement fluide a 60 fps — sans elle,
    // les zombies avancaient par sauts de ~12 px toutes les 100 ms, ce qui
    // passait pour des pics de vitesse ("certains vont trop vite").
    var zPrev = [];
    for (var zpi = 0; zpi < state.zombies.length; zpi++) {
      zPrev.push(state.zombies[zpi].x + "," + state.zombies[zpi].y);
    }
    G.updateZombies(dt);
    // Velocite effective de chaque zombie (position actuelle - precedente).
    // Les morts (hp <= 0) ne bougent plus : velocite nulle.
    for (var zvi = 0; zvi < state.zombies.length && zvi < zPrev.length; zvi++) {
      var zv = state.zombies[zvi];
      if (zv.hp <= 0) { zv.vx = 0; zv.vy = 0; continue; }
      var zpp = zPrev[zvi].split(",");
      zv.vx = (zv.x - parseFloat(zpp[0])) / dt;
      zv.vy = (zv.y - parseFloat(zpp[1])) / dt;
    }
    G.updateProjectiles(dt);
    // Cap projectiles (parite avec src/weapons.js) : sans lui, un lance-
    // flammes par joueur fait croitre le tableau sans limite serveur.
    while (state.projectiles.length > 120) state.projectiles.shift();
    G.cleanupZombies();
    G.cleanupBirds();
    G.cleanupWalls();
    G.updateBirds(dt);
    for (var di2 = 0; di2 < state.players.length; di2++) {
      if (!state.players[di2].alive && deadNames.indexOf(state.players[di2].name) >= 0) {
        pushEvent(null, { t: "msg", msg: state.players[di2].name + " est mort" });
      }
    }

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
      // Zombies en format compact [x, y, hp, lunge, ldx, ldy, leader, vx, vy] :
      // a 3000+ zombies la nuit, le format objet domine la bande passante
      // (200 Ko/s -> ~60 Ko/s a 10 Hz). vx/vy = velocite effective (px/s)
      // mesuree au tick precedent : le client extrapole entre snapshots pour
      // un rendu fluide (sinon, sauts de ~12 px toutes les 100 ms perçus comme
      // des pics de vitesse / de la teleportation selon la latence).
      zombies: state.zombies.filter(inRange).map(function (z) {
        return [
          Math.round(z.x), Math.round(z.y), Math.round(z.hp),
          z.lunge > 0 ? +(z.lunge).toFixed(2) : 0,
          +(z.lungeDx || 0).toFixed(2), +(z.lungeDy || 0).toFixed(2),
          z.isLeader ? 1 : 0,
          +((z.vx || 0)).toFixed(0), +((z.vy || 0)).toFixed(0)
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
        // vx/vy : le client extrapole entre deux snapshots (10 Hz -> 60 fps)
        // et choisit le sprite directionnel (idle sinon).
        return { x: Math.round(b.x), y: Math.round(b.y), vx: Math.round(b.vx), vy: Math.round(b.vy), hp: b.hp };
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
      }),
      // Montgolfiere : horodatage serveur du declenchement, converti en age
      // pour eviter le decalage d'horloges client/serveur. Le client applique
      // animStart = state.time - age sur son batiment local.
      montgolfiereAnim: (state.montgolfiere && state.montgolfiere.animStart !== undefined) ?
        +(state.time - state.montgolfiere.animStart).toFixed(2) : null,
      // Evenements consommes par CE joueur (diffuses ou qui lui sont
      // destines). Consommes a la lecture : jamais livres deux fois.
      events: takeEvents(forPlayerId)
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

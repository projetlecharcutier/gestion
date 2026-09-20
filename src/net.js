// Couche réseau client : WebSocket vers le serveur, gestion du lobby (menu),
// envoi des inputs, réception de l'état du jeu. Le rendu reste inchangé.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  var ws = null;
  var playerId = null;
  var connected = false;

  // Reconciliation equipement : horodatage du dernier input equip/toggleAxe
  // envoye + valeur attendue, pour eviter que l'etat serveur (10 Hz) ecrase la
  // valeur optimistic du client avant que le serveur n'ait traite l'input.
  var equipSentAt = 0;
  var pendingEquip = null; // nom d'arme attendu (null = desequipe / hache)

  // URL du serveur : ws://hote:port. Le WebSocket utilise le même hôte et le
  // même port que la page HTTP servie (le serveur sert le client ET le WS sur
  // un seul port) — fonctionne directement via http://<ip>:<port>, sans DNS.
  // En file://, fallback sur localhost:8080.
  function serverUrl() {
    var loc = window.location;
    var proto = loc.protocol === "https:" ? "wss:" : "ws:";
    if (loc.protocol === "file:") return "ws://localhost:8080";
    var port = loc.port || (loc.protocol === "https:" ? "443" : "80");
    return proto + "//" + loc.hostname + ":" + port;
  }

  G.netConnect = function () {
    // Garde : ne pas ouvrir une seconde connexion si une est déjà ouverte ou
    // en cours d'ouverture (l'utilisateur peut re-sélectionner le mode serveur).
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    try {
      ws = new WebSocket(serverUrl());
    } catch (e) {
      console.warn("Connexion serveur impossible :", e);
      return;
    }
    ws.onopen = function () { connected = true; };
    ws.onclose = function () { connected = false; setTimeout(G.netConnect, 2000); };
    ws.onerror = function () { connected = false; };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      G.netHandle(msg);
    };
  };

  G.netSend = function (msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(msg)); } catch (e) {}
    }
  };

  G.netPlayerId = function () { return playerId; };
  G.netConnected = function () { return connected; };

  // Rejoint la partie avec un nom.
  G.netJoin = function (name) {
    G.netSend({ type: "join", name: name });
  };

  // Envoie un input (déplacement, tir, etc.).
  // Limite la frequence d'envoi des inputs de deplacement/tir : inutile
  // d'envoyer 60 inputs/s au serveur qui tourne a 20 Hz (TICK_HZ) et qui
  // n'utilise que le dernier input recu par tick. Les inputs ponctuels
  // (equip, build, placeBuild...) passent toujours immediatement.
  var lastMoveSentAt = 0;
  var moveSendInterval = 1000 / 20; // 20 Hz, aligne sur TICK_HZ serveur

  G.netInput = function (input) {
    var nowMs = (typeof performance !== "undefined" ? performance.now() : Date.now());
    var isMoveOnly = input.buildWall === null && input.buildSel === undefined &&
      input.placeBuild === undefined && input.equip === undefined &&
      input.toggleAxe === undefined;
    if (isMoveOnly && nowMs - lastMoveSentAt < moveSendInterval) return;
    if (isMoveOnly) lastMoveSentAt = nowMs;
    // Marque le debut de la fenetre de reconciliation pour equip/toggleAxe.
    if (input.equip !== undefined) {
      equipSentAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
      pendingEquip = input.equip; // null (desequipe) ou nom d'arme
    }
    if (input.toggleAxe) {
      equipSentAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
      pendingEquip = null; // bascule hache : on attend axeEquipped cote serveur
    }
    input.type = "input";
    G.netSend(input);
  };

  // Gère les messages reçus du serveur.
  G.lobbyInfo = null; // {clock, players, started, ...}
  G.remoteState = null; // état de jeu reçu (10 Hz)

  G.netHandle = function (msg) {
    if (msg.type === "lobby") {
      G.lobbyInfo = msg;
      G.updateLobbyDisplay();
    } else if (msg.type === "joined") {
      playerId = msg.playerId;
      // Applique la carte reçue (bâtiments, forêts) à l'état local. Les forêts
      // sont des bâtiments (isForet) envoyés dans msg.map.buildings : aucune
      // logique d'arbres séparée. On reconstruit la grille de collision des
      // bâtiments côté client pour les forêts (le serveur n'a pas les PNG).
      if (msg.map) {
        var state = G.state;
        state.buildings = msg.map.buildings || [];
        _applyHouseSprites(state.buildings);
        _applyForetsCollision(state.buildings);
        // Murs et objets : la carte complete arrive des le join (plus besoin
        // d'attendre le premier snapshot 10 Hz apres START_DELAY).
        state.walls = msg.map.walls || [];
        state.items = msg.map.items || [];
        G.rebuildBuildingGrid();
      }
      if (msg.clock !== undefined) G.state.clock = msg.clock;
      // Démarre le rendu du jeu (le serveur pilote la simulation).
      G.state.started = true;
      G.state.gameOver = false;
    } else if (msg.type === "state") {
      G.remoteState = msg;
      G.applyRemoteState(msg);
    } else if (msg.type === "restart") {
      // Redémarrage de partie : recharge la carte.
      if (msg.map) {
        G.state.buildings = msg.map.buildings || [];
        _applyHouseSprites(G.state.buildings);
        _applyForetsCollision(G.state.buildings);
        G.state.walls = msg.map.walls || [];
        G.state.items = msg.map.items || [];
        G.rebuildBuildingGrid();
      }
      if (msg.clock !== undefined) G.state.clock = msg.clock;
      G.state.gameOver = false;
      G.state.started = true;
    } else if (msg.type === "full") {
      alert("Partie complète (20/20 joueurs). Réessayez plus tard.");
    }
  };

  // Applique l'état distant reçu au state local (pour le rendu).
  G.applyRemoteState = function (s) {
    var state = G.state;
    state.clock = s.clock;
    state.day = s.day;
    state.gameOver = s.gameOver;
    state.gameOverCause = s.gameOverCause;
    // Zombies : format compact [x, y, hp, lunge, ldx, ldy, leader] (bande
    // passante ~3x moindre la nuit). Decompression en objets pour le rendu.
    if (s.zombies) {
      var zout = [];
      for (var zi = 0; zi < s.zombies.length; zi++) {
        var za = s.zombies[zi];
        if (za.length) {
          zout.push({ x: za[0], y: za[1], hp: za[2], lunge: za[3], lungeDx: za[4], lungeDy: za[5], leader: !!za[6] });
        } else {
          zout.push(za);
        }
      }
      state.zombies = zout;
    } else state.zombies = [];
    state.walls = s.walls || [];
    state.items = s.items || [];
    state.projectiles = s.projectiles || [];
    state.birds = s.birds || [];
    // Traces de zombies morts : gerees cote serveur (autorite). Le client ne
    // fait que les afficher (rendu juste au-dessus du fond).
    if (s.deadTraces) state.deadTraces = s.deadTraces;
    state.planks = s.planks || 0;
    state.mairieHp = s.mairieHp;
    state.mairieMaxHp = s.mairieMaxHp;
    if (s.mairieGold !== undefined) state.mairieGold = s.mairieGold;
    // Batiments de ville (scierie, universite, montgolfiere...) : le serveur
    // est autorite (tech debloquee, position, avancement du chantier).
    if (G.TOWN_BUILDINGS) {
      for (var tb in G.TOWN_BUILDINGS) {
        if (!G.TOWN_BUILDINGS.hasOwnProperty(tb)) continue;
        var tdef = G.TOWN_BUILDINGS[tb];
        if (s[tdef.unlockedField] !== undefined) state[tdef.unlockedField] = s[tdef.unlockedField];
        if (s[tb] === undefined) continue;
        var snap2 = s[tb];
        if (!snap2) {
          state[tdef.stateField] = null;
          for (var sb = 0; sb < state.buildings.length; sb++) {
            if (state.buildings[sb].townBuilding === tb) { state.buildings.splice(sb, 1); break; }
          }
        } else {
          var local = null;
          for (var sb2 = 0; sb2 < state.buildings.length; sb2++) {
            if (state.buildings[sb2].townBuilding === tb) { local = state.buildings[sb2]; break; }
          }
          if (!local) {
            local = G.makeTownBuilding(tb, snap2.x + snap2.w / 2, snap2.y + snap2.h / 2);
            state.buildings.push(local);
          }
          local.x = snap2.x; local.y = snap2.y;
          local.w = snap2.w; local.h = snap2.h;
          local.chantierDone = snap2.chantierDone;
          if (snap2.buildAge !== undefined) {
            local.builtAt = (state.time || 0) - snap2.buildAge;
          }
          state[tdef.stateField] = local;
        }
      }
    }
    // Prochaine vague (pre-tiree) : annoncee par la montgolfiere.
    if (s.pendingWave !== undefined) state.pendingWave = s.pendingWave;
    // Tours : recreation depuis le snapshot (le serveur simule le combat).
    if (s.towers !== undefined) {
      var kept = [];
      var byPos = {};
      for (var ti = 0; ti < s.towers.length; ti++) {
        byPos[s.towers[ti].x + "," + s.towers[ti].y] = s.towers[ti];
      }
      for (var tk = 0; tk < state.towers.length; tk++) {
        var lt = state.towers[tk];
        var k = Math.round(lt.x) + "," + Math.round(lt.y);
        if (byPos[k] !== undefined) {
          var st2 = byPos[k];
          lt.hp = st2.hp; lt.maxHp = st2.maxHp;
          lt.chantierDone = st2.chantierDone;
          lt.animL = st2.animL; lt.animR = st2.animR;
          if (!lt.chantierDone && st2.buildAge !== undefined) {
            lt.builtAt = (state.time || 0) - st2.buildAge;
          }
          kept.push(lt);
          delete byPos[k];
        }
      }
      for (var bk in byPos) {
        if (!byPos.hasOwnProperty(bk)) continue;
        var nt = byPos[bk];
        kept.push({ x: nt.x, y: nt.y, w: nt.w, h: nt.h, level: nt.level,
                    hp: nt.hp, maxHp: nt.maxHp, chantierDone: nt.chantierDone,
                    animL: nt.animL || 0, animR: nt.animR || 0,
                    builtAt: nt.buildAge !== undefined ? (state.time || 0) - nt.buildAge : 0,
                    cdL: 0, cdR: 0, isTower: true });
      }
      state.towers = kept;
    }
    // Vote en cours a la mairie (affichage dans le coffre).
    if (s.vote !== undefined) {
      if (!s.vote) { state.vote = null; }
      else {
        if (!state.vote) state.vote = { votes: {} };
        state.vote.proposal = s.vote.proposal;
        state.vote.endsAt = (state.time || 0) + s.vote.endsAt;
      }
    }
    if (s.waveCount !== undefined) state.waveCount = s.waveCount;
    if (s.zombieRamp !== undefined) state.zombieRamp = s.zombieRamp;
    if (s.waveActive !== undefined) state.waveActive = s.waveActive;
    if (s.waveMsgTimer !== undefined) state.waveMsgTimer = s.waveMsgTimer;
    if (s.hordeMsgTimer !== undefined) state.hordeMsgTimer = s.hordeMsgTimer;
    // Met à jour l'état de coupe des forêts depuis le snapshot serveur.
    // Format compact [x, y, stage] (tolérant au format objet historique).
    if (s.forets) {
      var byPos = {};
      for (var fx = 0; fx < s.forets.length; fx++) {
        var fr = s.forets[fx];
        if (fr.length) byPos[fr[0] + "," + fr[1]] = fr[2];
        else byPos[fr.x + "," + fr.y] = fr.stage;
      }
      // Applique les stages ; la grille de collision n'est reconstruite que
      // si un stage CHANGE reellement (evite de reconstruire 10x/s une grille
      // de ~2400 forets a chaque snapshot).
      var changed = false;
      for (var bi = 0; bi < state.buildings.length; bi++) {
        var fb = state.buildings[bi];
        if (!fb.isForet) continue;
        var k = Math.round(fb.x + fb.w / 2) + "," + Math.round(fb.y + fb.h / 2);
        var ns = byPos[k] !== undefined ? byPos[k] : 0;
        if ((fb.foretStage || 0) !== ns) {
          fb.foretStage = ns;
          if (G.refitForet) G.refitForet(fb);
          changed = true;
        }
      }
      if (changed && G.rebuildBuildingGrid) G.rebuildBuildingGrid();
    }
    // Met à jour les PV de la mairie (pour le HUD) depuis l'état serveur.
    if (s.mairieHp !== undefined) {
      for (var mi = 0; mi < state.buildings.length; mi++) {
        if (state.buildings[mi].isMairie) { state.buildings[mi].hp = s.mairieHp; break; }
      }
    }

    // Met à jour la position du joueur local + les autres joueurs.
    var local = null;
    if (s.players) {
      state.remotePlayers = [];
      for (var i = 0; i < s.players.length; i++) {
        var p = s.players[i];
        if (p.id === playerId) {
          // Prédiction client : le déplacement est simulé localement chaque
          // frame (main.js). On ne réaligne que si l'écart avec le serveur
          // dépasse NET_SNAP_PX (collision, téléport, dérive) : petit lerp
          // doux, invisible en jeu normal.
          var pdx2 = p.x - state.player.x;
          var pdy2 = p.y - state.player.y;
          if (pdx2 * pdx2 + pdy2 * pdy2 > G.NET_SNAP_PX * G.NET_SNAP_PX) {
            state.player.x += pdx2 * G.NET_SNAP_LERP;
            state.player.y += pdy2 * G.NET_SNAP_LERP;
          }
          state.player.hp = p.hp;
          state.player.face = p.face;
          state.player.moving = p.moving;
          state.player.lastDx = p.lastDx || 0;
          state.player.lastDy = p.lastDy || 0;
          // Reconciliation equipement : le serveur est autorite, mais on garde
          // la valeur optimistic du client pendant un court delai apres un
          // double-clic/equipement pour eviter le scintillement (l'etat serveur
          // arrive avant que l'input equip soit traite). On ne reaffiche donc
          // pas "Mains nues" par erreur.
          var nowEq = (typeof performance !== "undefined" ? performance.now() : Date.now());
          var pending = (equipSentAt !== 0) && (nowEq - equipSentAt < 600);
          if (!pending) {
            state.equipped = p.equipped;
            state.axeEquipped = p.axeEquipped;
          } else if (p.equipped !== undefined) {
            if (pendingEquip !== null && p.equipped === pendingEquip) {
              equipSentAt = 0; pendingEquip = null;
              state.equipped = p.equipped;
              state.axeEquipped = p.axeEquipped;
            }
          }
          // Sac / inventaire / planches gérés côté serveur (autorité).
          if (p.bag) { state.bag.contents = p.bag; state.inventory = p.inventory; }
          // Floater de récolte : le serveur crédite les planches (bois coupé à
          // la hache), le client n'a pas d'événement dédié. On détecte
          // l'incrément entre deux snapshots.
          if (p.planks !== undefined) {
            if (state.axeEquipped && p.planks > (state.planks || 0)) {
              if (G.addFloater) G.addFloater("+" + (p.planks - state.planks) + " planches");
            }
            state.planks = p.planks;
          }
          if (p.gold !== undefined) state.gold = p.gold;
        } else {
          state.remotePlayers.push(p);
        }
      }
    }
  };

  // Maisons décoratives : le serveur n'envoie que le nom du sprite (H1, H2,
  // ...) — jamais l'objet sprite (côté serveur c'est un stub sans image qui
  // ferait drawImage(null)). On résout le PNG réel côté client.
  function _applyHouseSprites(buildings) {
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (!b.isDecor) continue;
      if (b.houseSprite && b.houseSprite.img) continue; // déjà résolu
      var name = b.houseSpriteName || (b.houseSprite && typeof b.houseSprite === "string" ? b.houseSprite : null);
      if (name && G.hasSprite("house", name)) {
        b.houseSprite = G.SPRITES.house[name];
        b.height = b.houseSprite.h;
      }
    }
  }

  // Les forêts reçues du serveur n'ont pas leurs bornes PNG (le serveur n'a
  // pas d'images). On recalcule ici l'emprise de collision de chaque forêt à
  // partir des sprites PNG côté client, en appelant makeForet (qui applique
  // shrinkToOpaque). On remplace la forêt par sa version recalculée à la même
  // position.
  function _applyForetsCollision(buildings) {
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (!b.isForet) continue;
      var frame = b.foretFrame;
      if (!frame || !G.hasSprite("foret", frame)) continue;
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      var stage = b.foretStage || 0;
      var fresh = G.makeForet(cx, cy, frame);
      fresh.foretStage = stage;
      if (G.refitForet) G.refitForet(fresh);
      buildings[i] = fresh;
    }
  }

  // Met à jour l'affichage du lobby dans le menu d'accueil (mode serveur).
  G.updateLobbyDisplay = function () {
    var el = document.getElementById("lobbyInfo");
    if (!el || !G.lobbyInfo) return;
    if (G.playMode !== "server") return;
    var info = G.lobbyInfo;
    var h = Math.floor(info.clock);
    var m = Math.floor((info.clock - h) * 60);
    var timeStr = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    var phase = (G.isNight ? G.isNight(info.clock) : (info.clock >= G.NIGHT_START || info.clock < G.NIGHT_END)) ? "🌙 Nuit" : "☀️ Jour";
    var names = info.players.map(function (p) {
      return p.name + (p.alive ? "" : " †");
    }).join(", ") || "(aucun joueur)";
    var status = info.started ? "Partie en cours" : (info.startTimer > 0 ?
      "Départ dans " + Math.ceil((G.START_DELAY || 3) - info.startTimer) + "s" : "En attente de joueurs");
    // Date de la derniere mise a jour deployee (communiquee par le serveur).
    var updated = "";
    if (info.updatedAt) {
      var d = new Date(info.updatedAt);
      if (!isNaN(d.getTime())) {
        var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
        updated = "<div class=\"lobby__updated\">Dernière mise à jour : " +
          p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() +
          " " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + "</div>";
      }
    }
    el.innerHTML =
      "<div class=\"lobby__info\">" +
        "<div><b>" + phase + " · " + timeStr + "</b></div>" +
        "<div>Joueurs : " + info.playerCount + "/" + info.maxPlayers + " · Survivants : " + info.aliveCount + "</div>" +
        "<div class=\"lobby__status\">" + status + "</div>" +
        "<div class=\"lobby__names\">" + names + "</div>" +
      "</div>" + updated;
  };
})();

// Couche réseau client : WebSocket vers le serveur, gestion du lobby (menu),
// envoi des inputs, réception de l'état du jeu. Le rendu reste inchangé.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  var ws = null;
  var playerId = null;
  var connected = false;

  // URL du serveur : ws://hote:port. Détecte automatiquement l'hôte courant
  // (utile en dev local et en hébergement). En file://, fallback sur localhost.
  function serverUrl() {
    var loc = window.location;
    var proto = loc.protocol === "https:" ? "wss:" : "ws:";
    if (loc.protocol === "file:") return "ws://localhost:8080";
    return proto + "//" + loc.hostname + ":8080";
  }

  G.netConnect = function () {
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
  G.netInput = function (input) {
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
        _applyForetsCollision(state.buildings);
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
        _applyForetsCollision(G.state.buildings);
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
    state.zombies = s.zombies || [];
    state.walls = s.walls || [];
    state.items = s.items || [];
    state.projectiles = s.projectiles || [];
    state.birds = s.birds || [];
    state.planks = s.planks || 0;
    state.mairieHp = s.mairieHp;
    state.mairieMaxHp = s.mairieMaxHp;
    if (s.waveCount !== undefined) state.waveCount = s.waveCount;
    if (s.waveActive !== undefined) state.waveActive = s.waveActive;
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
          // Interpolation douce vers la position serveur.
          state.player.x += (p.x - state.player.x) * 0.4;
          state.player.y += (p.y - state.player.y) * 0.4;
          state.player.hp = p.hp;
          state.player.face = p.face;
          state.player.moving = p.moving;
          state.player.lastDx = p.lastDx || 0;
          state.player.lastDy = p.lastDy || 0;
          state.equipped = p.equipped;
          state.axeEquipped = p.axeEquipped;
          // Sac / inventaire / planches gérés côté serveur (autorité).
          if (p.bag) { state.bag.contents = p.bag; state.inventory = p.inventory; }
          if (p.planks !== undefined) state.planks = p.planks;
          if (p.gold !== undefined) state.gold = p.gold;
        } else {
          state.remotePlayers.push(p);
        }
      }
    }
  };

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
      var fresh = G.makeForet(cx, cy, frame);
      buildings[i] = fresh;
    }
  }

  // Met à jour l'affichage du lobby dans le menu d'accueil.
  G.updateLobbyDisplay = function () {
    var el = document.getElementById("lobbyInfo");
    if (!el || !G.lobbyInfo) return;
    var info = G.lobbyInfo;
    var h = Math.floor(info.clock);
    var m = Math.floor((info.clock - h) * 60);
    var timeStr = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    var phase = (info.clock >= 22 || info.clock < 2) ? "🌙 Nuit" : "☀️ Jour";
    var names = info.players.map(function (p) {
      return p.name + (p.alive ? "" : " †");
    }).join(", ") || "(aucun joueur)";
    var status = info.started ? "Partie en cours" : (info.startTimer > 0 ?
      "Départ dans " + Math.ceil(30 - info.startTimer) + "s" : "En attente de joueurs");
    el.innerHTML =
      "<div class=\"lobby__info\">" +
        "<div><b>" + phase + " · " + timeStr + "</b></div>" +
        "<div>Joueurs : " + info.playerCount + "/" + info.maxPlayers + " · Survivants : " + info.aliveCount + "</div>" +
        "<div class=\"lobby__status\">" + status + "</div>" +
        "<div class=\"lobby__names\">" + names + "</div>" +
      "</div>";
  };
})();

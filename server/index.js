// Serveur WebSocket multijoueur pour Flex Survival.
// Une seule partie, max 20 joueurs. Redémarre la partie quand la mairie est
// détruite. Si aucun joueur connecté : la partie est arrêtée (relancée 30 s
// après l'arrivée d'un joueur). Les places sont libérées à la déconnexion.
(function () {
  "use strict";
  var WebSocket = require("ws");
  var game = require("./game");

  var PORT = process.env.PORT || 8080;
  var TICK_HZ = 20;
  var LOBBY_HZ = 2;
  var STATE_HZ = 10;

  var wss = new WebSocket.Server({ port: PORT });
  console.log("Serveur Flex Survival en écoute sur le port " + PORT);

  var clients = {}; // ws -> {id, name, joined}

  // Génération d'IDs simples.
  var nextId = 1;
  function newId() { return "p" + (nextId++); }

  // Broadcast à tous les clients connectés.
  function broadcast(msg) {
    var data = JSON.stringify(msg);
    for (var id in clients) {
      var c = clients[id];
      if (c.ws.readyState === WebSocket.OPEN) {
        try { c.ws.send(data); } catch (e) {}
      }
    }
  }

  // Broadcast du lobby à 2 Hz (clients non encore en jeu).
  var lobbyAcc = 0;
  // Broadcast de l'état de jeu à 10 Hz (clients en jeu).
  var stateAcc = 0;

  // Boucle serveur principale.
  var last = Date.now();
  function loop() {
    var now = Date.now();
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // clamp pour éviter les sauts.

    // Simulation à chaque frame (20 Hz effectif via setInterval).
    game.tick(dt);

    // Broadcast lobby.
    lobbyAcc += dt;
    if (lobbyAcc >= 1 / LOBBY_HZ) {
      lobbyAcc = 0;
      var lobby = game.lobbySnapshot();
      broadcast(lobby);
    }

    // Broadcast état de jeu.
    stateAcc += dt;
    if (stateAcc >= 1 / STATE_HZ) {
      stateAcc = 0;
      if (game.getState().started) {
        var snap = game.snapshot();
        snap.type = "state";
        broadcast(snap);
      }
    }
  }
  setInterval(loop, 1000 / TICK_HZ);

  // Gestion des connexions.
  wss.on("connection", function connection(ws) {
    var id = newId();
    clients[id] = { ws: ws, id: id, name: null, joined: false };

    ws.on("message", function incoming(message) {
      var msg;
      try { msg = JSON.parse(message); } catch (e) { return; }

      if (msg.type === "join") {
        if (game.getState().players.length >= game.MAX_PLAYERS) {
          ws.send(JSON.stringify({ type: "full" }));
          return;
        }
        var name = (msg.name || "").trim().slice(0, 20) || ("Joueur" + id);
        clients[id].name = name;
        clients[id].joined = true;
        var player = game.addPlayer(id, name);
        if (!player) {
          ws.send(JSON.stringify({ type: "full" }));
          return;
        }
        // Envoie la carte + l'ID du joueur.
        ws.send(JSON.stringify({ type: "joined", playerId: id, map: game.mapSnapshot(), clock: game.getState().clock }));
        console.log("Joueur " + name + " (" + id + ") a rejoint. " + game.getState().players.length + "/" + game.MAX_PLAYERS);
      }

      if (msg.type === "input") {
        game.applyInput(id, msg);
      }

      if (msg.type === "leave") {
        cleanup(id);
      }
    });

    ws.on("close", function () { cleanup(id); });
    ws.on("error", function () { cleanup(id); });
  });

  function cleanup(id) {
    if (clients[id] && clients[id].joined) {
      game.removePlayer(id);
      console.log("Joueur " + (clients[id].name || id) + " s'est déconnecté. " + game.getState().players.length + "/" + game.MAX_PLAYERS);
    }
    delete clients[id];
  }

  // Si la partie est terminée (mairie détruite), redémarre après 10 s.
  var restartTimer = 0;
  var prevGameOver = false;
  setInterval(function () {
    if (game.getState().gameOver && !prevGameOver) {
      console.log("Partie terminée (mairie détruite). Redémarrage dans 10 s...");
      prevGameOver = true;
      restartTimer = 10;
    }
    if (prevGameOver) {
      restartTimer -= 0.5;
      if (restartTimer <= 0 && game.getState().players.length > 0) {
        game.startGame();
        prevGameOver = false;
        broadcast({ type: "restart", clock: game.getState().clock, map: game.mapSnapshot() });
        console.log("Nouvelle partie lancée.");
      }
    }
  }, 500);
})();

// Serveur WebSocket multijoueur pour Flex Survival.
// Une seule partie, max 20 joueurs. Redémarre la partie quand la mairie est
// détruite. Si aucun joueur connecté : la partie est arrêtée (relancée 30 s
// après l'arrivée d'un joueur). Les places sont libérées à la déconnexion.
(function () {
  "use strict";
  var WebSocket = require("ws");
  var http = require("http");
  var fs = require("fs");
  var path = require("path");
  var game = require("./game");

  var PORT = process.env.PORT || 8080;
  var TICK_HZ = 20;
  var LOBBY_HZ = 2;
  var STATE_HZ = 10;

  // Date de la derniere mise a jour deployee : date du dernier commit git
  // (le serveur est un clone mis a jour par update.sh). Repli : date de
  // modification de index.html si git n'est pas disponible.
  var updatedAt = null;
  var version = null; // code de commit court (ex. 3b12130)
  var commitName = null; // titre du dernier commit (affiche dans le menu)
  try {
    var execSync = require("child_process").execSync;
    updatedAt = execSync("git log -1 --format=%cI", { cwd: __dirname, encoding: "utf8" }).trim();
    version = execSync("git log -1 --format=%h", { cwd: __dirname, encoding: "utf8" }).trim();
    commitName = execSync("git log -1 --format=%s", { cwd: __dirname, encoding: "utf8" }).trim();
  } catch (e) {}
  if (!updatedAt) {
    try {
      updatedAt = new Date(fs.statSync(path.join(WEB_ROOT, "index.html")).mtimeMs).toISOString();
    } catch (e2) {}
  }

  // Racine des fichiers statiques (index.html, src/, assets/) : dossier
  // parent de server/, c'est-à-dire la racine du dépôt.
  var WEB_ROOT = path.join(__dirname, "..");
  var MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav"
  };

  // Serveur HTTP servant les fichiers statiques (le client se charge via
  // index.html + src/ + assets/). Le WebSocket est attaché au même serveur,
  // donc tout fonctionne sur un seul port : http://<ip>:<port>.
  var server = http.createServer(function (req, res) {
    var url = req.url.split("?")[0];
    if (url === "/") url = "/index.html";
    // Version deployee (affichee dans le menu d'accueil du client).
    if (url === "/version.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ updatedAt: updatedAt, version: version, commitName: commitName }));
      return;
    }
    // Sécurité : empêche de remonter hors de WEB_ROOT.
    var rel = path.normalize(url).replace(/^(\.\.[\/\\])+/, "");
    var filePath = path.join(WEB_ROOT, rel);
    if (filePath.indexOf(WEB_ROOT) !== 0) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, function (err, data) {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      var ext = path.extname(filePath).toLowerCase();
      // Anti-cache : le client doit toujours recharger la version deployee
      // (update.sh deploye un nouveau main sans changer les noms de fichier).
      var headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
      if (ext === ".html" || ext === ".js" || ext === ".json") {
        headers["Cache-Control"] = "no-cache";
      }
      res.writeHead(200, headers);
      res.end(data);
    });
  });

  var wss = new WebSocket.Server({ server: server });
  server.listen(PORT, function () {
    console.log("Serveur Flex Survival en écoute sur le port " + PORT);
  });

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
    var wasStarted = game.getState().started;
    game.tick(dt);
    // La partie vient de démarrer (START_DELAY écoulé) : le monde a été
    // RÉGÉNÉRÉ aléatoirement par startGame(). Les clients ont reçu l'ancienne
    // carte au join — sans la nouvelle, leurs collisions locales divergeaient
    // totalement de celles du serveur (rollbacks constants, injouable).
    if (!wasStarted && game.getState().started) {
      broadcast({
        type: "restart",
        clock: game.getState().clock,
        map: game.mapSnapshot()
      });
      console.log("Partie démarrée : nouvelle carte diffusée à tous les joueurs.");
    }

    // Broadcast lobby.
    lobbyAcc += dt;
    if (lobbyAcc >= 1 / LOBBY_HZ) {
      lobbyAcc = 0;
      var lobby = game.lobbySnapshot();
      lobby.updatedAt = updatedAt;
      lobby.version = version;
      lobby.commitName = commitName;
      broadcast(lobby);
    }

    // Envoi de l'état de jeu : snapshot personnalise par joueur (culling des
    // zombies/projectiles hors de portée — a 5000 zombies la nuit, le
    // broadcast global saturait la connexion : 1,3 Mo/s par client).
    stateAcc += dt;
    if (stateAcc >= 1 / STATE_HZ) {
      stateAcc = 0;
      if (game.getState().started) {
        for (var id in clients) {
          var c = clients[id];
          if (!c.joined || c.ws.readyState !== WebSocket.OPEN) continue;
          try {
            var snap = game.snapshot(c.id);
            snap.type = "state";
            c.ws.send(JSON.stringify(snap));
          } catch (e) {}
        }
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
        // Envoie la carte + l'ID du joueur. `started` distingue la carte
        // DEFINITIVE (partie deja en cours : le client affiche le jeu des
        // ce message) de la carte provisoire generee au boot du serveur
        // (remplacee par un "restart" au lancement : le client garde son
        // ecran de chargement jusqu'a ce "restart").
        ws.send(JSON.stringify({ type: "joined", playerId: id, started: game.getState().started, map: game.mapSnapshot(), clock: game.getState().clock }));
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

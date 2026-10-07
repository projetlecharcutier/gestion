// Serveur WebSocket multijoueur pour Flex Survival.
// Une seule partie, max 20 joueurs. Redémarre la partie quand la mairie est
// détruite. Si aucun joueur connecté : la partie est arrêtée (relancée 30 s
// après l'arrivée d'un joueur). Les places sont libérées à la déconnexion.
(function () {
  "use strict";
  var WebSocket = require("ws");
  // Log horodate : chaque evenement (connexion, coupure, charge) est
  // retracable par rapport a l'horloge de jeu (nuit/vague) et aux autres
  // evenements. console.log brut garde la ligne "au boot" uniquement.
  function log() {
    var args = Array.prototype.slice.call(arguments);
    console.log(new Date().toISOString() + " " + args.join(" "));
  }
  var http = require("http");
  var fs = require("fs");
  var path = require("path");
  // Villes PNG : verification automatique au demarrage (nouvelles villes,
  // masques modifies, depots a la racine). Genere ville-grids.json + les
  // positions persistees AVANT que game.js ne charge les grilles.
  try {
    var villeSync = require("./ville-sync");
    var res = villeSync.sync();
    if (res.found > 0) {
      console.log("[ville-sync] " + res.found + " ville(s) : " + res.names.join(", ") +
        " | grilles generees : " + res.grids +
        " | placements auto : " + res.placed);
    }
  } catch (e) {
    console.error("[ville-sync] erreur (le serveur demarre sans villes) :", e.message);
  }
  var game = require("./game");

  var PORT = process.env.PORT || 8080;
  var TICK_HZ = 20;
  var LOBBY_HZ = 2;
  var STATE_HZ = 10;

  // Date de la derniere mise a jour deployee : date du dernier commit git
  // (le serveur est un clone mis a jour par update.sh). Repli : date de
  // modification de index.html si git n'est pas disponible.
  // "dubious ownership" : git >= 2.35.2 refuse un depot appartenant a un
  // autre utilisateur (deployment /opt/flex possede par root, service
  // execute par flex). -c safe.directory=... leve le blocage SANS exposer
  // de config globale -- limite a cet appel, le depot reste trusted ici.
  var updatedAt = null;
  var version = null; // code de commit court (ex. 3b12130)
  var commitName = null; // titre du dernier commit (affiche dans le menu)
  try {
    var execSync = require("child_process").execSync;
    var REPO = path.join(__dirname, "..");
    var GIT = "git -c safe.directory=" + JSON.stringify(REPO) + " ";
    updatedAt = execSync(GIT + "log -1 --format=%cI", { cwd: __dirname, encoding: "utf8" }).trim();
    version = execSync(GIT + "log -1 --format=%h", { cwd: __dirname, encoding: "utf8" }).trim();
    commitName = execSync(GIT + "log -1 --format=%s", { cwd: __dirname, encoding: "utf8" }).trim();
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
    // Décodage %-encoded : les navigateurs demandent les PNG à espaces/accents
    // (assets/sprites/elementdecord : "Abord rémalard-2.png", "CHAMP BLE.png"...)
    // sous forme encodée ("Abord%20r%C3%A9malard-2.png"). Sans décodage, le
    // fs.readFile échoue et renvoie 404 : le sprite ne s'affiche jamais.
    try { url = decodeURIComponent(url); } catch (e) { /* URI mal formée : garde l'URL brute */ }
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
        // Trace les 404 : les sondes de frames du client (foret-3.png,
        // H12.png...) en produisent NORMALEMENT, mais un 404 repete sur un
        // VRAI sprite revele un asset manquant (maison qui n'affiche pas,
        // decor absent). Compteur + echantillon, pas un log par requete.
        http404Count++;
        if (http404Count <= 50 || http404Count % 100 === 0) {
          log("[http] 404 " + req.method + " " + url + " (total " + http404Count + ")");
        }
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      var ext = path.extname(filePath).toLowerCase();
      // Anti-cache HTML/JS/JSON : le client doit toujours recharger la
      // version deployee (update.sh deploye un nouveau main sans changer
      // les noms de fichier).
      var headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
      if (ext === ".html" || ext === ".js" || ext === ".json") {
        headers["Cache-Control"] = "no-cache";
      }
      // PNG : cache navigateur AGRESSIF (1 an) — le client les demande avec
      // un parametre de version (?v=<commit>) qui change a chaque deploiement,
      // donc un changement de PNG invalide naturellement le cache. Sans ce
      // header, le navigateur re-validait chaque PNG (304/200) voir le
      // re-telechargeait integralement a chaque chargement de page.
      if (ext === ".png" || ext === ".svg" || ext === ".woff" || ext === ".woff2") {
        headers["Cache-Control"] = "public, max-age=31536000, immutable";
      }
      res.writeHead(200, headers);
      res.end(data);
    });
  });
  var http404Count = 0;
  var http200Count = 0;
  var httpBytesOut = 0;
  server.on("request", function (req, res) {
    http200Count++;
    res.on("finish", function () {
      httpBytesOut += (res.socket && res.socket.bytesWritten) || 0;
    });
  });

  var wss = new WebSocket.Server({ server: server });
  // Heartbeat ping/pong : une connexion TCP morte a moitie (WiFi drop, NAT
  // timeout) n'est detectee que quand un send echoue. Un ping periodique
  // force la detection en ~30 s et coupe proprement (close 1001) au lieu
  // de laisser un zombie socket qui sature le broadcast.
  // 5 s au lieu de 15 : detecte une connexion morte (WiFi drop, NAT) en
  // ~10 s au lieu de ~25 s et libere la place plus tot. Le [stats] reste
  // cadence ici : toutes les 15 s (3 battements), pas a chaque ping.
  var HEARTBEAT_MS = 5000;
  var HEARTBEAT_TIMEOUT_MS = 10000;
  var STATS_EVERY_N_BEATS = 3;
  var heartbeatBeats = 0;
  // Grâce de reconnexion : une coupure réseau (WiFi, NAT, hibernation) ne
  // supprime pas le personnage tout de suite. Le client watchdog détecte la
  // panne, se reconnecte et renvoie son playerId (message "rejoin") : il
  // reprend son état exact. Passé ce délai, le joueur est retiré comme avant.
  var RECONNECT_GRACE_MS = 30000;
  var heartbeatTimer = null;
  function startHeartbeat() {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(function () {
      var now = Date.now();
      // Log continu : etat du serveur a chaque battement (15 s), meme sans
      // evenement — permet de verifier "a posteriori" que le serveur etait
      // vivant lors d'un signalement utilisateur.
      heartbeatBeats++;
      if (heartbeatBeats % STATS_EVERY_N_BEATS === 1) {
      var nbPlayers = 0;
      for (var pid in clients) if (clients[pid] && clients[pid].joined) nbPlayers++;
      var mem = 0;
      try { mem = Math.round(process.memoryUsage().heapUsed / (1024 * 1024)); } catch (e) {}
      log("[stats] uptime=" + Math.round((now - bootAt) / 1000) + "s" +
        " joueurs=" + nbPlayers + "/" + game.MAX_PLAYERS +
        " sockets=" + wss.clients.size +
        " http:200=" + http200Count + " http:404=" + http404Count +
        " httpSorti=" + Math.round(httpBytesOut / 1024) + " Ko" +
        " memoire=" + mem + " Mo");
      }
      // Grâce expirée : retire définitivement les joueurs non revenus.
      for (var gid in clients) {
        var gc = clients[gid];
        if (gc.disconnectedAt && now - gc.disconnectedAt >= RECONNECT_GRACE_MS) {
          log("[ws] grâce expirée pour " + gid + " (" + (gc.name || "?") + ") : joueur retiré");
          hardCleanup(gid);
        }
      }
      wss.clients.forEach(function (ws) {
        if (ws.isAlive === false) {
          var cid = ws._clientId || "?";
          var cname = (clients[cid] && clients[cid].name) || "?";
          log("[heartbeat] coupure " + cid + " (" + cname + ") : aucun pong depuis " + HEARTBEAT_TIMEOUT_MS + " ms, fermeture forcé");
          try { ws.terminate(); } catch (e) {}
          return;
        }
        ws.isAlive = false;
        try { ws.ping(); } catch (e) {}
      });
    }, HEARTBEAT_MS);
  }
  var bootAt = Date.now();
  startHeartbeat();
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

  // Boucle serveur principale : TICK FIXE avec accumulateur. Un dt mesure
  // entre deux setInterval est variable (jitter de l'event loop, charge) ;
  // le tick fixe rend la simulation deterministe et reproductible (memes
  // trajectoires quel que soit le rythme reel), en bornant le rattrapage
  // pour ne jamais spiraler apres un blocage (GC, hibernation).
  var TICK_DT = 1 / TICK_HZ;
  var MAX_CATCHUP = 5; // max 5 ticks rattrapes par tour de boucle
  var acc = 0;
  var last = Date.now();
  function loop() {
    var now = Date.now();
    var real = (now - last) / 1000;
    last = now;
    if (real > 0.25) real = 0.25; // clamp (onglet gele, pause debug)
    acc += real;
    var ticks = 0;
    while (acc >= TICK_DT && ticks < MAX_CATCHUP) {
      acc -= TICK_DT;
      ticks++;
      fixedTick(TICK_DT);
    }
    // Debordement : trop de retard (ralenti > 25%), on jette l'excedent au
    // lieu de le cumuler -- sinon la "dette" de simulation grandit sans fin.
    if (acc > TICK_DT) acc = TICK_DT;
    // Broadcasts horaires (lobby 2 Hz / etat 10 Hz) : en TEMPS REEL, sur le
    // dt mesure, independamment du tick fixe de simulation.
    pumpBroadcasts(real);
  }
  function fixedTick(dt) {

    // Simulation à chaque frame (20 Hz effectif via setInterval).
    var wasStarted = game.getState().started;
    // Une exception dans la simulation (crash de tick) tuerait le serveur
    // sans diagnostic : logge la stack avec contexte, la boucle continue.
    try {
      game.tick(dt);
    } catch (e) {
      log("[tick] ERREUR crash de simulation :", e.stack || e.message);
    }
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
      log("Partie démarrée : nouvelle carte diffusée à tous les joueurs.");
    }

  }
  // Broadcasts horaires (lobby 2 Hz, etat 10 Hz, logs de charge) : appeles
  // depuis loop() en TEMPS REEL, pas depuis fixedTick -- sinon N ticks
  // rattrapes en un tour de boucle envoyaient N snapshots d'un coup.
  function pumpBroadcasts(dt) {
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
            var data = JSON.stringify(snap);
            c.ws.send(data);
            c.lastSnapBytes = data.length;
            c.bytesOut = (c.bytesOut || 0) + data.length;
          } catch (e) {
            // Erreur d'envoi (connexion morte) : log avec contexte joueur,
            // le close/error suivra et nettoiera la place.
            log("[send] ERREUR snapshot vers " + id + " (" + (clients[id] && clients[id].name || "?") + ") :", e.message);
          }
        }
      }
    }

    // Charge nocturne : une ligne par changement de vague et une par 30 s la
    // nuit (zombies, taille moyenne des snapshots, memoire). Permet de
    // corréler une déconnexion client avec un pic de charge serveur.
    var st = game.getState();
    var night = st.started && (st.clock >= 23 || st.clock < 7);
    if (night) {
      loadAcc += dt;
      var waveKey = st.day + ":" + (st.waveCount || 0);
      if (waveKey !== lastWaveKey || loadAcc >= 30) {
        lastWaveKey = waveKey;
        loadAcc = 0;
        var mem = process.memoryUsage();
        log("[charge] jour " + st.day + " heure " + st.clock.toFixed(1) +
          " | joueurs=" + st.players.length + "/" + game.MAX_PLAYERS +
          " zombies=" + st.zombies.length +
          " vague=" + (st.waveCount || 0) + " nuit=" + (night ? "oui" : "non") +
          " | moyenne snapshot=" + avgSnapshotKB().toFixed(1) + " Ko" +
          " mem=" + Math.round(mem.heapUsed / 1048576) + "Mo");
      }
    }
  }
  var loadAcc = 0;
  var lastWaveKey = "";
  function avgSnapshotKB() {
    var total = 0, n = 0;
    for (var id in clients) {
      if (clients[id].joined && clients[id].lastSnapBytes) { total += clients[id].lastSnapBytes; n++; }
    }
    return n ? total / n / 1024 : 0;
  }
  setInterval(loop, 1000 / TICK_HZ);

  // Gestion des connexions.
  wss.on("connection", function connection(ws) {
    var id = newId();
    clients[id] = { ws: ws, id: id, name: null, joined: false };
    ws._clientId = id;
    ws.isAlive = true;
    // TCP keepalive : le heartbeat applicatif detecte les sockets mortes,
    // mais le keepalive TCP fait aussi tomber les connexions zombies (NAT,
    // routeur) au niveau OS, meme pour un client muet qui ne repond ni pong
    // ni close (onglet gele, hibernation).
    try { if (ws._socket && ws._socket.setKeepAlive) ws._socket.setKeepAlive(true, 10000); } catch (e) {}
    ws.on("pong", function () { ws.isAlive = true; });

    ws.on("message", function incoming(message) {
      var msg;
      try { msg = JSON.parse(message); } catch (e) { return; }

      // Reconnexion (watchdog client) : le joueur revient avec son playerId
      // après une coupure. S'il est encore en partie (grâce
      // RECONNECT_GRACE_MS), il reprend son personnage tel quel ; sinon on
      // retombe sur un join normal (nouveau personnage).
      if (msg.type === "rejoin") {
        var rid = msg.playerId;
        var rname = (msg.name || "").trim().slice(0, 20);
        var rplayer = rid ? game.reconnect(rid, rname || null) : null;
        if (rplayer) {
          if (clients[rid] && clients[rid].ws && clients[rid].ws !== ws) {
            try { clients[rid].ws.terminate(); } catch (e) {}
          }
          delete clients[rid];
          delete clients[id];
          clients[rid] = { ws: ws, id: rid, name: rplayer.name, joined: true };
          ws._clientId = rid;
          ws.isAlive = true;
          ws.send(JSON.stringify({ type: "joined", playerId: rid, started: game.getState().started, map: game.mapSnapshot(), clock: game.getState().clock }));
          log("[ws] RECONNEXION " + rid + " (" + rplayer.name + ") : personnage restauré");
          return;
        }
        msg.type = "join"
      }

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
        log("[ws] connexion " + id + " (" + name + ") a rejoint. " + game.getState().players.length + "/" + game.MAX_PLAYERS);
      }

      if (msg.type === "input") {
        game.applyInput(id, msg);
      }

      if (msg.type === "leave") {
        cleanup(id);
      }
    });

    ws.on("close", function (code, reason) {
      var r = "";
      try { r = reason ? reason.toString() : ""; } catch (e) {}
      log("[ws] close " + id + " (" + (clients[id] && clients[id].name || "?") + ") code=" + code + (r ? " raison=" + r : ""));
      softCleanup(id);
    });
    ws.on("error", function (err) {
      log("[ws] error " + id + " (" + (clients[id] && clients[id].name || "?") + ") :", err && err.message || err);
      softCleanup(id);
    });
  });

  // Coupure socket : le joueur reste en partie pendant la grâce de
  // reconnexion (personnage NON retiré). Le watchdog client renvoie
  // "rejoin" avec son playerId ; sans retour, la grâce expire dans
  // startHeartbeat et hardCleanup() le retire définitivement.
  function softCleanup(id) {
    var c = clients[id];
    if (!c || c.disconnectedAt) return;
    c.disconnectedAt = Date.now();
    log("[ws] coupure " + id + " (" + (c.name || "?") + ") : grâce de reconnexion " + RECONNECT_GRACE_MS + " ms");
  }

  // Retrait définitif ("leave" explicite ou grâce expirée).
  function cleanup(id) { hardCleanup(id); }
  function hardCleanup(id) {
    var c = clients[id];
    if (c && c.joined) {
      game.removePlayer(id);
      log("[ws] déconnexion " + (c.name || id) + " (" + id + ") | joueurs restants=" + game.getState().players.length + "/" + game.MAX_PLAYERS +
        " | données envoyées=" + Math.round((c.bytesOut || 0) / 1024) + " Ko");
    }
    delete clients[id];
  }

  // Si la partie est terminée (mairie détruite), redémarre après 10 s.
  // TOLÉRANT : une exception dans startGame/mapSnapshot ne doit ni tuer le
  // serveur ni spammer la console (l'intervalle relance toutes les 500 ms :
  // sans catch, la même stack trace s'imprimait en boucle avec les tildes
  // des code frames Node et le service finissait par tomber). L'erreur est
  // loggée UNE fois par partie, puis réessayée toutes les 2 s.
  var restartTimer = 0;
  var prevGameOver = false;
  var restartErrLogged = false;
  setInterval(function () {
    if (game.getState().gameOver && !prevGameOver) {
      log("Partie terminée (mairie détruite). Redémarrage dans 10 s...");
      prevGameOver = true;
      restartTimer = 10;
      restartErrLogged = false;
    }
    if (prevGameOver) {
      restartTimer -= 0.5;
      if (restartTimer <= 0 && game.getState().players.length > 0) {
        try {
          game.startGame();
          var msg = { type: "restart", clock: game.getState().clock, map: game.mapSnapshot() };
          prevGameOver = false;
          restartErrLogged = false;
          broadcast(msg);
          log("Nouvelle partie lancée.");
        } catch (e) {
          if (!restartErrLogged) {
            restartErrLogged = true;
            console.error("[restart] échec du redémarrage (nouvel essai toutes les 2 s) :", e.stack || e.message);
          }
          restartTimer = 2;
        }
      }
    }
  }, 500);
})();

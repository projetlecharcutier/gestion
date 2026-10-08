// Déconnexion à la fermeture de la fenêtre : un close PROPRE (code 1001,
// envoyé par le navigateur quand on ferme l'onglet/la fenêtre ou qu'on
// navigue ailleurs) doit retirer le joueur IMMÉDIATEMENT — pas de grâce de
// reconnexion de 30 s. En revanche, une coupure BRUTALE (1006, réseau/WiFi)
// garde la grâce : le watchdog client peut revenir avec "rejoin".
var path = require("path");
var WebSocket = require("../../server/node_modules/ws");
var connectWs = require("./ws_connect");
var PORT = 45751;
var srv = require("child_process").spawn("node", ["index.js"], {
  cwd: path.join(__dirname, "..", "..", "server"),
  env: { PATH: process.env.PATH, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"]
});
var logs = [];
srv.stdout.on("data", function (d) { logs.push(d.toString()); });
srv.stderr.on("data", function (d) { logs.push("ERR:" + d.toString()); });

setTimeout(function () {
  connectWs(PORT, function (ws1) {
    ws1.send(JSON.stringify({ type: "join", name: "Fenetre" }));
    var myId = null;
    ws1.on("message", function (m) {
      var msg = JSON.parse(m);
      if (msg.type === "joined") myId = msg.playerId;
    });
    setTimeout(function () {
      if (!myId) { console.log("ECHEC : pas de playerId"); srv.kill(); process.exit(1); }

      // --- 1) Fermeture PROPRE de la fenêtre (close 1001) : déconnexion immédiate ---
      ws1.close(1001, "fermeture fenêtre");
      setTimeout(function () {
        var decoLog = logs.join("").indexOf("déconnexion Fenetre") >= 0;
        console.log("fermeture propre 1001 -> déconnexion immédiate loggée :", decoLog);
        // Le joueur ne doit PAS apparaître dans le lobby après le close 1001.
        var inLobby = false;
        connectWs(PORT, function (ws2) {
          var checked = false;
          ws2.on("message", function (m) {
            var msg = JSON.parse(m);
            if (msg.type === "lobby" && !checked) {
              checked = true;
              if (msg.players) {
                for (var i = 0; i < msg.players.length; i++) {
                  if (msg.players[i].name === "Fenetre") inLobby = true;
                }
              }
            }
          });
          setTimeout(function () {
            var okClose = decoLog && !inLobby;
            console.log("joueur absent du lobby après fermeture :", !inLobby);

            // --- 2) Coupure BRUTALE (1006/terminate) : la grâce de reconnexion reste ---
            connectWs(PORT, function (ws3) {
              var id3 = null;
              ws3.send(JSON.stringify({ type: "join", name: "Brutal" }));
              ws3.on("message", function (m) {
                var msg = JSON.parse(m);
                if (msg.type === "joined") id3 = msg.playerId;
              });
              setTimeout(function () {
                try { ws3.terminate(); } catch (e) {} // coupure réseau simulée
                // Reconnexion immédiate (comme le watchdog client) : rejoin accepté.
                var ws4 = new WebSocket("ws://127.0.0.1:" + PORT);
                var restored = false;
                ws4.on("open", function () {
                  ws4.send(JSON.stringify({ type: "rejoin", playerId: id3, name: "Brutal" }));
                });
                ws4.on("message", function (m) {
                  var msg = JSON.parse(m);
                  if (msg.type === "joined" && msg.playerId === id3) restored = true;
                });
                setTimeout(function () {
                  console.log("coupure brutale -> rejoin toujours restauré :", restored);
                  var ok = okClose && restored;
                  console.log(ok ? "FERMETURE OK" : "FERMETURE ECHEC");
                  srv.kill();
                  process.exit(ok ? 0 : 1);
                }, 5000);
              }, 6000);
            });
          }, 4000);
        });
      }, 1500);
    }, 6000);
  });
}, 6000);

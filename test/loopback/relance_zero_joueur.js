// Relance du serveur = 0 joueur connecté : un joueur joint, on tue le
// processus serveur (comme le watcher au déploiement), on le relance, et le
// lobby NE DOIT contenir AUCUN joueur. Vérifie aussi que le nouveau boot
// diffuse bien un bootId différent (partie repart à zéro).
var path = require("path");
var WebSocket = require("../../server/node_modules/ws");
var connectWs = require("./ws_connect");
var PORT = 45753;
var SERVER_DIR = path.join(__dirname, "..", "..", "server");

function startServer() {
  var s = require("child_process").spawn("node", ["index.js"], {
    cwd: SERVER_DIR,
    env: { PATH: process.env.PATH, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  s.logs = [];
  s.stdout.on("data", function (d) { s.logs.push(d.toString()); });
  s.stderr.on("data", function (d) { s.logs.push("ERR:" + d.toString()); });
  return s;
}

function lobbyPlayerCount(cb) {
  connectWs(PORT, function (ws) {
    var done = false;
    ws.on("message", function (m) {
      var msg = JSON.parse(m);
      if (msg.type === "lobby" && !done) {
        done = true;
        cb(msg.playerCount, msg.bootId);
      }
    });
  });
}

var srv = startServer();
setTimeout(function () {
  // Un joueur joint.
  connectWs(PORT, function (ws1) {
    ws1.send(JSON.stringify({ type: "join", name: "AvantRelance" }));
    setTimeout(function () {
      lobbyPlayerCount(function (count1, bootId1) {
        console.log("avant relance : joueurs=" + count1 + " bootId=" + bootId1);
        if (count1 !== 1) { console.log("ECHEC : joueur attendu avant relance"); srv.kill(); process.exit(1); }

        // Relance : kill du processus puis nouveau processus (comme le watcher).
        srv.kill();
        setTimeout(function () {
          srv = startServer();
          setTimeout(function () {
            lobbyPlayerCount(function (count2, bootId2) {
              console.log("après relance : joueurs=" + count2 + " bootId=" + bootId2);
              var ok = count2 === 0 && bootId2 !== bootId1;
              console.log("relance -> 0 joueur connecté :", count2 === 0);
              console.log("bootId changé (partie à zéro) :", bootId2 !== bootId1);
              console.log(ok ? "RELANCE OK" : "RELANCE ECHEC");
              srv.kill();
              process.exit(ok ? 0 : 1);
            });
          }, 6000);
        }, 1500);
      });
    }, 5000);
  });
}, 6000);

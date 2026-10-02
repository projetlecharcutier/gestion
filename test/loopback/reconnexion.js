// Test loopback reconnexion : un joueur joint, son socket est tue brutalement
// (coupure reseau sans close propre), il se reconnecte et envoie "rejoin"
// avec son playerId. Le serveur doit le RESTAURER (meme playerId, position
// proche de l'ancienne) pendant la grace de reconnexion, pas creer un
// nouveau personnage.
var WebSocket = require("../../server/node_modules/ws");
var PORT = 45747;
var srv = require("child_process").spawn("node", ["index.js"], {
  cwd: require("path").join(__dirname, "..", "..", "server"),
  env: { PATH: process.env.PATH, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"]
});
var logs = [];
srv.stdout.on("data", function (d) { logs.push(d.toString()); });
srv.stderr.on("data", function (d) { logs.push("ERR:" + d.toString()); });

setTimeout(function () {
  var ws1 = new WebSocket("ws://127.0.0.1:" + PORT);
  var myId = null, lastSnap = null;

  ws1.on("open", function () {
    ws1.send(JSON.stringify({ type: "join", name: "Reco" }));
  });
  ws1.on("message", function (m) {
    var msg = JSON.parse(m);
    if (msg.type === "joined") myId = msg.playerId;
    if (msg.type === "state") lastSnap = msg;
  });

  setTimeout(function () {
    // Coupure brutale : termie le socket sans frame close.
    try { ws1.terminate(); } catch (e) {}

    // Reconnexion immediate (comme le watchdog client).
    var ws2 = new WebSocket("ws://127.0.0.1:" + PORT);
    var rejoinedId = null, snapAfter = null, restored = false;

    ws2.on("open", function () {
      ws2.send(JSON.stringify({ type: "rejoin", playerId: myId, name: "Reco" }));
    });
    ws2.on("message", function (m) {
      var msg = JSON.parse(m);
      if (msg.type === "joined") rejoinedId = msg.playerId;
      if (msg.type === "state") {
        snapAfter = msg;
        if (rejoinedId === myId) {
          for (var i = 0; i < msg.players.length; i++) {
            if (msg.players[i].id === myId) {
              var me = msg.players[i];
              var old = null;
              for (var j = 0; j < lastSnap.players.length; j++) {
                if (lastSnap.players[j].id === myId) old = lastSnap.players[j];
              }
              // Restauré : meme id, vivant, position proche de la coupure.
              if (me.alive && old &&
                  Math.abs(me.x - old.x) < 200 && Math.abs(me.y - old.y) < 200) {
                restored = true;
              }
            }
          }
        }
      }
    });

    setTimeout(function () {
      var ok = rejoinedId === myId && restored &&
               logs.join("").indexOf("RECONNEXION") >= 0;
      console.log("playerId initial:", myId, "| apres rejoin:", rejoinedId);
      console.log("personnage restaure (meme id, vivant, position proche):", restored);
      console.log("log serveur RECONNEXION present:",
        logs.join("").indexOf("RECONNEXION") >= 0);
      console.log(ok ? "RECO OK" : "RECO ECHEC");
      if (logs.join("").indexOf("ERR") >= 0) {
        console.log("stderr serveur:", logs.join("").slice(0, 300));
      }
      srv.kill();
      process.exit(ok ? 0 : 1);
    }, 8000);
  }, 15000);
}, 1000);

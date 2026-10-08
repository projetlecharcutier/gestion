// Redémarrage du serveur : tous les joueurs sont déconnectés, la partie
// repart à zéro et un client qui revient avec son ancien playerId (rejoin)
// ne doit PAS reprendre sa session — le serveur répond "sessionInvalid" et
// le client recharge la page. /version.json expose bootId + assetsStamp
// (empreinte des PNG : cache navigateur auto-rafraîchi sans commit).
var path = require("path");
var http = require("http");
var WebSocket = require("../../server/node_modules/ws");
var connectWs = require("./ws_connect");
var PORT = 45749;
var SERVER_DIR = path.join(__dirname, "..", "..", "server");

function startServer(extraEnv) {
  var srv = require("child_process").spawn("node", ["index.js"], {
    cwd: SERVER_DIR,
    env: Object.assign({}, process.env, { PORT: String(PORT) }, extraEnv || {}),
    stdio: ["ignore", "pipe", "pipe"]
  });
  srv.logs = [];
  srv.stdout.on("data", function (d) { srv.logs.push(d.toString()); });
  srv.stderr.on("data", function (d) { srv.logs.push("ERR:" + d.toString()); });
  return srv;
}

function fetchVersion(cb) {
  var req = http.get("http://127.0.0.1:" + PORT + "/version.json", function (res) {
    var body = "";
    res.on("data", function (c) { body += c; });
    res.on("end", function () {
      try { cb(null, JSON.parse(body), res); } catch (e) { cb(e); }
    });
  });
  req.on("error", cb);
}

var srv = startServer();
var results = {};
function check(name, ok) { results[name] = ok; console.log((ok ? "OK   " : "ECHEC") + " " + name); }

setTimeout(function () {
  // --- 1) version.json : bootId + assetsStamp présents, no-cache ---
  fetchVersion(function (err, v, res) {
    check("version.json accessible", !err && !!v);
    check("bootId présent", !!(v && v.bootId));
    check("assetsStamp présent", !!(v && v.assetsStamp));
    check("version.json en no-cache", !!(res && res.headers &&
      /no-cache/.test(res.headers["cache-control"] || "")));
    var bootId1 = v && v.bootId;

    // --- 2) Un joueur joint, récupère son playerId ---
    var myId = null;
    connectWs(PORT, function (ws1) {
      ws1.send(JSON.stringify({ type: "join", name: "Reboot" }));
      ws1.on("message", function (m) {
        var msg = JSON.parse(m);
        if (msg.type === "joined") myId = msg.playerId;
      });
      setTimeout(function () {
        check("joueur joiné avec playerId", !!myId);
        try { ws1.terminate(); } catch (e) {}

        // --- 3) Redémarrage brutal du serveur ---
        srv.kill();
        setTimeout(function () {
          srv = startServer();
          setTimeout(function () {
            // --- 4) bootId différent après redémarrage ---
            fetchVersion(function (err2, v2) {
              check("serveur redémarré (version.json répond)", !err2 && !!v2);
              check("bootId CHANGÉ après redémarrage",
                !!(v2 && v2.bootId && bootId1 && v2.bootId !== bootId1));

              // --- 5) Le lobby diffuse le nouveau bootId ---
              connectWs(PORT, function (ws2) {
                var lobbyBootId = null, gotSessionInvalid = false, gotJoined = false;
                var ws3 = null;
                ws2.on("message", function (m) {
                  var msg = JSON.parse(m);
                  if (msg.type === "lobby" && msg.bootId) lobbyBootId = msg.bootId;
                  if (msg.type === "sessionInvalid") gotSessionInvalid = true;
                });
                setTimeout(function () {
                  check("lobby diffuse bootId",
                    !!lobbyBootId && lobbyBootId === (v2 && v2.bootId));

                  // --- 6) rejoin avec l'ancien playerId -> sessionInvalid ---
                  ws3 = new WebSocket("ws://127.0.0.1:" + PORT);
                  var closed4000 = false;
                  ws3.on("open", function () {
                    ws3.send(JSON.stringify({ type: "rejoin", playerId: myId, name: "Reboot" }));
                  });
                  ws3.on("close", function (code) {
                    // Fermeture forcée avec code dédié : même un client avec
                    // l'ancien JS (sans gestionnaire sessionInvalid) est coupé
                    // net au lieu de rester sur une connexion fantôme.
                    if (code === 4000) closed4000 = true;
                  });
                  ws3.on("message", function (m) {
                    var msg = JSON.parse(m);
                    if (msg.type === "sessionInvalid") gotSessionInvalid = true;
                    if (msg.type === "joined") gotJoined = true;
                  });
                  setTimeout(function () {
                    check("rejoin refusé (sessionInvalid), pas de restauration",
                      gotSessionInvalid && !gotJoined);
                    check("socket fermée avec code 4000 (client ancien coupé net)", closed4000);
                    check("log serveur \"session inconnue\" présent",
                      srv.logs.join("").indexOf("session inconnue") >= 0);

                    // --- 7) join neuf accepté sur la nouvelle partie ---
                    var joinedNew = false;
                    var ws4 = new WebSocket("ws://127.0.0.1:" + PORT);
                    ws4.on("open", function () {
                      ws4.send(JSON.stringify({ type: "join", name: "Reboot2" }));
                    });
                    ws4.on("message", function (m) {
                      var msg = JSON.parse(m);
                      if (msg.type === "joined") joinedNew = true;
                    });
                    setTimeout(function () {
                      check("join neuf accepté après redémarrage", joinedNew);
                      var ok = Object.keys(results).every(function (k) { return results[k]; });
                      console.log(ok ? "REBOOT OK" : "REBOOT ECHEC");
                      srv.kill();
                      process.exit(ok ? 0 : 1);
                    }, 4000);
                  }, 4000);
                }, 6000);
              });
            });
          }, 4000);
        }, 1500);
      }, 6000);
    });
  });
}, 6000);

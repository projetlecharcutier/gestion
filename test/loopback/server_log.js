// Endpoint /server-log.json : les 50 derniers messages serveur sont servis
// SANS mot de passe admin (publics, pour le menu d'accueil). Verifie :
//   1. 200 + JSON { lines: [...] } sans en-tete X-Admin-Password
//   2. les lignes publiees par le serveur (connexion joueur) y figurent
//   3. le plafond est de 50 lignes (on pousse >50 logs via des connexions)
//   4. /admin/logs reste protege (401 sans mot de passe) : la fuite publique
//      ne concerne que /server-log.json
var path = require("path");
var http = require("http");
var connectWs = require("./ws_connect");
var PORT = 45781;
var SERVER_DIR = path.join(__dirname, "..", "..", "server");
var srv = require("child_process").spawn(process.execPath, ["index.js"], {
  cwd: SERVER_DIR,
  env: Object.assign({}, process.env, { PORT: String(PORT) }),
  stdio: ["ignore", "pipe", "pipe"]
});
srv.stdout.on("data", function () {});
srv.stderr.on("data", function () {});
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }
function get(p, headers, cb) {
  http.request({ host: "127.0.0.1", port: PORT, path: p, method: "GET", headers: headers || {} },
    function (res) {
      var out = "";
      res.on("data", function (c) { out += c; });
      res.on("end", function () {
        var json = null;
        try { json = JSON.parse(out); } catch (e) {}
        cb(res.statusCode, json, out);
      });
    }).on("error", function () { cb(0, null, ""); }).end();
}
function cleanup(rc) { try { srv.kill(); } catch (e) {} process.exit(rc); }

function waitReady(cb) {
  get("/version.json", {}, function (code) {
    if (code === 200) return cb();
    setTimeout(function () { waitReady(cb); }, 200);
  });
}
waitReady(function () {
  // 1. /server-log.json public : 200 + JSON sans mot de passe
  get("/server-log.json", {}, function (code, json) {
    assert(code === 200, "/server-log.json repond 200 sans mot de passe (obtenu " + code + ")");
    assert(json && Array.isArray(json.lines), "/server-log.json renvoie { lines: [...] }");
    var bootLines = (json && json.lines) || [];
    assert(bootLines.length > 0, "le journal contient les lignes de boot (" + bootLines.length + ")");
    assert(bootLines.length <= 50, "plafond 50 lignes respecte au boot (" + bootLines.length + ")");

    // 2. Genere des connexions pour produire des logs, puis revérifie.
    // Le serveur est limite a 20 joueurs : on depasse volontairement pour
    // remplir le buffer de 500 lignes (les "full"/refus produisent aussi
    // des logs). Chaque connexion est fermee aussitot pour liberer la place.
    function oneJoin(i, next) {
      connectWs(PORT, function (ws) {
        ws.on("message", function () {});
        ws.send(JSON.stringify({ type: "join", name: "LogTest" + i }));
        setTimeout(function () { try { ws.close(); } catch (e) {} next(); }, 40);
      });
    }
    var idx = 0;
    function nextJoin() {
      if (idx >= 80) return afterJoins();
      oneJoin(idx++, nextJoin);
    }
    function afterJoins() {
      setTimeout(function () {
        get("/server-log.json", {}, function (code2, json2) {
          assert(code2 === 200, "/server-log.json repond 200 apres connexions");
          var lines = (json2 && json2.lines) || [];
          assert(lines.length <= 50, "plafond 50 lignes respecte apres 80 connexions (" + lines.length + ")");
          assert(lines.length > bootLines.length || lines.length === 50,
            "le journal a grandi ou atteint le plafond (" + bootLines.length + " -> " + lines.length + ")");
          var hasJoin = lines.some(function (l) {
            return l.indexOf("[ws] connexion") >= 0 || l.indexOf("LogTest") >= 0 ||
                   l.indexOf("rejoint") >= 0 || l.indexOf("complet") >= 0 ||
                   l.indexOf("[ws] close") >= 0 || l.indexOf("coupure") >= 0;
          });
          if (!hasJoin) {
            console.log("  --- dernieres lignes du journal ---");
            lines.slice(-6).forEach(function (l) { console.log("  " + l); });
          }
          assert(hasJoin, "les connexions apparaissent dans le journal public");
          // 3. /admin/logs reste protege
          get("/admin/logs", {}, function (code3) {
            assert(code3 === 401, "/admin/logs reste protege (401 sans mot de passe, obtenu " + code3 + ")");
            console.log(fails === 0 ? "OK server_log" : "SERVER_LOG ECHEC (" + fails + ")");
            cleanup(fails === 0 ? 0 : 1);
          });
        });
      }, 400);
    }
    nextJoin();
  });
});

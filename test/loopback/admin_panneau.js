// Panneau admin : auth POST /admin/auth (mot de passe "flex", override
// ADMIN_PASSWORD), GET /admin/logs et /admin/status protégés par
// l'en-tête X-Admin-Password, POST /admin/restart protégé
// (401 sans mot de passe — on ne teste PAS le restart réussi ici pour
// ne pas git-reset le checkout ni tuer le serveur de test).
var path = require("path");
var http = require("http");
var PORT = 45755;
var SERVER_DIR = path.join(__dirname, "..", "..", "server");

var srv = require("child_process").spawn(process.execPath, ["index.js"], {
  cwd: SERVER_DIR,
  env: Object.assign({}, process.env, { PORT: String(PORT) }),
  stdio: ["ignore", "pipe", "pipe"]
});
srv.stdout.on("data", function () {});
srv.stderr.on("data", function () {});


function req(method, p, headers, body, cb) {
  var data = body ? JSON.stringify(body) : null;
  if (data) headers = Object.assign({ "Content-Type": "application/json" }, headers);
  var r = http.request({
    host: "127.0.0.1", port: PORT, path: p, method: method, headers: headers || {}
  }, function (res) {
    var out = "";
    res.on("data", function (c) { out += c; });
    res.on("end", function () {
      var json = null;
      try { json = JSON.parse(out); } catch (e) {}
      cb(null, res.statusCode, json);
    });
  });
  r.on("error", function (e) { cb(e); });
  if (data) r.write(data);
  r.end();
}

var results = {};
function check(name, ok) { results[name] = ok; console.log((ok ? "OK   " : "ECHEC") + " " + name); }
function fail(exitMsg) {
  console.log("RESULT: FAIL" + (exitMsg ? " (" + exitMsg + ")" : ""));
  try { srv.kill("SIGKILL"); } catch (e) {}
  process.exit(1);
}

function waitReady(cb, tries) {
  tries = tries || 0;
  if (tries > 90) return cb(new Error("serveur pas pret"));
  var r = http.get("http://127.0.0.1:" + PORT + "/version.json", function (res) {
    res.resume();
    cb(null);
  });
  r.on("error", function () { setTimeout(function () { waitReady(cb, tries + 1); }, 500); });
}

waitReady(function (err) {
  if (err) return fail("serveur pas pret");
  req("POST", "/admin/auth", {}, { password: "faux" }, function (e, code) {
    check("mauvais mot de passe -> 401", !e && code === 401);
    req("POST", "/admin/auth", {}, { password: "flex" }, function (e, code, json) {
      check("bon mot de passe -> ok", !e && code === 200 && json && json.ok === true);
      req("GET", "/admin/logs", { "X-Admin-Password": "flex" }, null, function (e, code, json) {
        check("logs accessibles avec mot de passe", !e && code === 200 && json && Array.isArray(json.lines));
        check("logs non vides", !!(json && json.lines && json.lines.length > 0));
        req("GET", "/admin/logs", {}, null, function (e, code) {
          check("logs refuses sans mot de passe (401)", !e && code === 401);
          req("GET", "/admin/status", { "X-Admin-Password": "flex" }, null, function (e, code, json) {
            check("status ok", !e && code === 200 && !!json);
            check("status bootId present", !!(json && json.bootId));
            check("status version presente", !!(json && json.version));
            req("POST", "/admin/restart", {}, null, function (e, code) {
              check("restart refuse sans mot de passe (401)", !e && code === 401);
              try { srv.kill("SIGKILL"); } catch (e) {}
              var bad = Object.keys(results).filter(function (k) { return !results[k]; });
              console.log(bad.length ? "RESULT: FAIL" : "RESULT: PASS");
              process.exit(bad.length ? 1 : 0);
            });
          });
        });
      });
    });
  });
});

setTimeout(function () { fail("timeout"); }, 60000);

// Test loopback cible : relique->eglise(+100 or) -> vote -> buildSel=scierie + placeBuild pose la scierie.
var WebSocket = require("../../server/node_modules/ws");
var PORT = 45743;
var srv = require("child_process").spawn("node", ["index.js"], { cwd: require("path").join(__dirname, "..", "..", "server"), env: { PATH: process.env.PATH, PORT: String(PORT), TEST_START_PLANKS: "200" }, stdio: ["ignore", "pipe", "pipe"] });
var logs = []; srv.stdout.on("data", function (d) { logs.push(d.toString()); }); srv.stderr.on("data", function (d) { logs.push("ERR:" + d.toString()); });
setTimeout(function () {
  var ws = new WebSocket("ws://127.0.0.1:" + PORT);
  var snap = null, mapBuildings = [];
  ws.on("open", function () { ws.send(JSON.stringify({ type: "join", name: "T" })); });
  ws.on("message", function (m) {
    var msg = JSON.parse(m);
    if (msg.type === "state") snap = msg;
    if (msg.type === "joined" && msg.map) mapBuildings = msg.map.buildings || [];
  });
  function waitUntil(cond, cb, tries) {
    if (tries === undefined) tries = 2000;
    if (cond()) { cb(); return; }
    if (tries <= 0) { console.log("TIMEOUT", logs.join("").slice(0, 400)); srv.kill(); process.exit(1); }
    setTimeout(function () { waitUntil(cond, cb, tries - 1); }, 50);
  }
  waitUntil(function () { return snap && snap.started === true; }, function () {
    var c = 5000;
    // Planches de depart : TEST_START_PLANKS au spawn du serveur (le protocole
    // input.planks a ete supprime : faille de triche).
    var relicList = [[c - 100, c + 330], [c + 1800, c + 3300], [c - 800, c + 2600]];
    var ri = 0, tx = relicList[0][0], ty = relicList[0][1];
    var lastX = 0, lastY = 0, stuck = 0;
    var iv = setInterval(function () {
      var p = snap.players[0];
      if (!p) return;
      if (Math.hypot(p.x - lastX, p.y - lastY) < 10) {
        stuck++;
        if (stuck >= 30) {
          stuck = 0;
          if (++ri < relicList.length) { tx = relicList[ri][0]; ty = relicList[ri][1]; lastX = p.x; lastY = p.y; return; }
          clearInterval(iv);
          console.log("ECHEC : marche bloquee"); srv.kill(); process.exit(1);
        }
      } else stuck = 0;
      lastX = p.x; lastY = p.y;
      var dx = tx - p.x, dy = ty - p.y;
      var d = Math.hypot(dx, dy);
      // Contournement : si bloque, s'ecarte lateralement (comme un joueur).
      if (stuck > 5 && d >= 120) {
        var ang = Math.atan2(dy, dx) + (stuck % 2 === 0 ? 1 : -1) * (Math.PI / 3);
        dx = Math.cos(ang) * d; dy = Math.sin(ang) * d;
      }
      if (d < 120) {
        clearInterval(iv);
        ws.send(JSON.stringify({ type: "input", dx: 0, dy: 0 }));
        ws.send(JSON.stringify({ type: "input", pickup: { x: tx, y: ty } }));
        setTimeout(function () {
          ws.send(JSON.stringify({ type: "input", churchDeposit: true }));
          waitUntil(function () { return snap.mairieGold >= 100; }, function () {
            console.log("[1] coffre:", snap.mairieGold);
            // Le vote tech exige < 250 px de la mairie (audit anti-triche) :
            // on y marche avant de voter (comportement client legitime,
            // bouton du coffre ouvert pres de la mairie).
            var mairie = null;
            for (var mi = 0; mi < mapBuildings.length; mi++) if (mapBuildings[mi].isMairie) { mairie = mapBuildings[mi]; break; }
            var mx = mairie.x + mairie.w / 2, my = mairie.y + mairie.h / 2;
            var mStuck = 0, mLastX = 0, mLastY = 0;
            var mIv = setInterval(function () {
              var me2 = snap.players[0];
              if (!me2) return;
              var mdx = mx - me2.x, mdy = my - me2.y, md = Math.hypot(mdx, mdy);
              if (md < 230) {
                clearInterval(mIv);
                ws.send(JSON.stringify({ type: "input", dx: 0, dy: 0 }));
                ws.send(JSON.stringify({ type: "input", techVote: "scierie" }));
                return;
              }
              if (Math.hypot(me2.x - mLastX, me2.y - mLastY) < 10) {
                mStuck++;
                var mAng = Math.atan2(mdy, mdx) + (mStuck % 2 === 0 ? 1 : -1) * (Math.PI / 3);
                mdx = Math.cos(mAng) * md; mdy = Math.sin(mAng) * md;
              } else mStuck = 0;
              mLastX = me2.x; mLastY = me2.y;
              ws.send(JSON.stringify({ type: "input", dx: mdx / md, dy: mdy / md }));
            }, 100);
            waitUntil(function () { return snap && snap.vote; }, function () {
              console.log("[2] vote lance");
              ws.send(JSON.stringify({ type: "input", techVote: "scierie" }));
              waitUntil(function () { return snap && !snap.vote && snap.scierieUnlocked; }, function () {
                console.log("[3] scierieUnlocked:", snap.scierieUnlocked);
                var spots = [];
                var b = mapBuildings;
                for (var x = 4550; x <= 5450; x += 20) for (var y = 4550; y <= 5450; y += 20) {
                  var ok = true;
                  for (var i = 0; i < b.length; i++) {
                    var bx = b[i];
                    if (x - 45 < bx.x + bx.w && x + 45 > bx.x && y - 45 < bx.y + bx.h && y + 45 > bx.y) { ok = false; break; }
                  }
                  for (var wj = 0; ok && wj < (snap.walls || []).length; wj++) {
                    var mw = snap.walls[wj];
                    if (x - 45 < mw.x + mw.w && x + 45 > mw.x && y - 45 < mw.y + mw.h && y + 45 > mw.y) ok = false;
                  }
                  if (ok) spots.push([x, y]);
                }
                if (spots.length === 0) { console.log("ECHEC : pas de spot ville"); srv.kill(); process.exit(1); }
                (function tryNext() {
                  if (spots.length === 0) { console.log("ECHEC : pose refusee partout"); srv.kill(); process.exit(1); }
                  var sp = spots.shift();
                  ws.send(JSON.stringify({ type: "input", buildSel: "scierie", placeBuild: { wx: sp[0], wy: sp[1] } }));
                  setTimeout(function () {
                    if (snap.scierie) {
                      console.log("SUCCES : flux menu->pose scierie OK en multi (" + sp.join(",") + ")");
                      srv.kill(); process.exit(0);
                    }
                    tryNext();
                  }, 300);
                })();
              });
            });
          });
        }, 400);
      } else {
        ws.send(JSON.stringify({ type: "input", dx: dx / d, dy: dy / d }));
      }
    }, 100);
  });
}, 1000);

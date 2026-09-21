// Test d'integration loopback complet : marche->relique->eglise(+100 or)->vote
// scierie->menu (buildSel)->pose scierie->chantier->pose tour hors ville.
var WebSocket = require("../../server/node_modules/ws");
var PORT = 45742;
var srv = require("child_process").spawn("node", ["index.js"], { cwd: require("path").join(__dirname, "..", "..", "server"), env: { PATH: process.env.PATH, PORT: String(PORT), TEST_START_PLANKS: "150" }, stdio: ["ignore", "pipe", "pipe"] });
var logs = []; srv.stdout.on("data", function (d) { logs.push(d.toString()); }); srv.stderr.on("data", function (d) { logs.push("ERR:" + d.toString()); });
setTimeout(function () {
  var ws = new WebSocket("ws://127.0.0.1:" + PORT);
  var snap = null, mapBuildings = [];
  ws.on("open", function () { ws.send(JSON.stringify({ type: "join", name: "Testeur" })); });
  ws.on("message", function (m) {
    var msg = JSON.parse(m);
    if (msg.type === "state") snap = msg;
    if (msg.type === "joined" && msg.map) mapBuildings = msg.map.buildings || [];
  });
  function waitUntil(cond, cb, tries) {
    if (tries === undefined) tries = 1200;
    if (cond()) { cb(); return; }
    if (tries <= 0) { console.log("TIMEOUT. logs:", logs.join("\n").slice(0, 500)); process.exit(1); }
    setTimeout(function () { waitUntil(cond, cb, tries - 1); }, 50);
  }
  function overlap(buildings, x, y, side) {
    var mx = x - side / 2, my = y - side / 2;
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (mx < b.x + b.w && mx + side > b.x && my < b.y + b.h && my + side > b.y) return true;
    }
    return false;
  }
  waitUntil(function () { return snap && snap.started === true && snap.players.length > 0; }, function () {
    console.log("[0] partie demarree");
    // Planches de depart : TEST_START_PLANKS au spawn du serveur (le protocole
    // input.planks a ete supprime : faille de triche).
    // Marche vers la relique en ville, sinon reliques hors ville proches.
    var c = 5000;
    var relicList = [[c - 100, c + 330], [c + 1800, c + 3300], [c - 800, c + 2600]];
    var ri = 0, tx = relicList[0][0], ty = relicList[0][1];
    var phase = "walk"; // walk -> pickup -> done : bloque les re-declenchements
    var lastX = 0, lastY = 0, stuck = 0;
    var iv = setInterval(function () {
      if (phase === "done") { clearInterval(iv); return; }
      var me = snap.players[0];
      if (!me) return;
      // Anti-blocage : si le joueur n'a pas progresse en 3 s (batiment),
      // abandonne cette relique et passe a la suivante.
      if (phase === "walk") {
        if (Math.hypot(me.x - lastX, me.y - lastY) < 10) {
          stuck++;
          if (stuck >= 30) {
            stuck = 0;
            if (++ri < relicList.length) { tx = relicList[ri][0]; ty = relicList[ri][1]; return; }
            clearInterval(iv);
            console.log("ECHEC : marche bloquee vers toutes les reliques"); process.exit(1);
          }
        } else stuck = 0;
        lastX = me.x; lastY = me.y;
      }
      var dx = tx - me.x, dy = ty - me.y;
      var d = Math.hypot(dx, dy);
      // Contournement : si bloque, s'ecarte lateralement (comme un joueur).
      if (stuck > 5 && d >= 120) {
        var ang = Math.atan2(dy, dx) + (stuck % 2 === 0 ? 1 : -1) * (Math.PI / 3);
        dx = Math.cos(ang) * d; dy = Math.sin(ang) * d;
      }
      if (d < 120) {
        if (phase === "walk") {
          phase = "pickup";
          ws.send(JSON.stringify({ type: "input", dx: 0, dy: 0 }));
          ws.send(JSON.stringify({ type: "input", pickup: { x: tx, y: ty } }));
        }
        setTimeout(function () {
          if (phase === "done") { clearInterval(iv); return; }
          var bag = snap.players[0].bag || [];
          if (bag.some(function (it) { return it.name === "Relique"; })) {
            phase = "done";
            clearInterval(iv);
            ws.send(JSON.stringify({ type: "input", churchDeposit: true }));
            waitUntil(function () { return snap.mairieGold >= 100; }, function () {
              console.log("[1] coffre:", snap.mairieGold, "or | planches:", snap.players[0].planks);
              ws.send(JSON.stringify({ type: "input", techVote: "scierie" }));
              waitUntil(function () { return snap && snap.vote; }, function () {
                console.log("[2] vote lance");
                ws.send(JSON.stringify({ type: "input", techVote: "scierie" }));
                waitUntil(function () { return snap && snap.vote === null && snap.scierieUnlocked; }, function () {
                  console.log("[3] scierie debloquee");
                  // Collecte TOUS les spots ville candidats, essaie chacun jusqu'a pose.
                  var spots = [];
                  for (var x = 4550; x <= 5450; x += 25) for (var y = 4550; y <= 5450; y += 25) {
                    var ok = !overlap(mapBuildings, x, y, 90);
                    if (ok) for (var wj = 0; wj < (snap.walls || []).length; wj++) {
                      var mw = snap.walls[wj];
                      if (x - 45 < mw.x + mw.w && x + 45 > mw.x && y - 45 < mw.y + mw.h && y + 45 > mw.y) { ok = false; break; }
                    }
                    if (ok) spots.push([x, y]);
                  }
                  if (spots.length === 0) { console.log("ECHEC : pas de spot ville"); process.exit(1); }
                  (function tryNext() {
                    if (spots.length === 0) { console.log("ECHEC : pose scierie refusee partout"); process.exit(1); }
                    var sp = spots.shift();
                    ws.send(JSON.stringify({ type: "input", buildSel: "scierie", placeBuild: { wx: sp[0], wy: sp[1] } }));
                    setTimeout(function () {
                      if (snap.scierie) { console.log("[4] scierie posee a (" + sp.join(",") + ")"); step5(); }
                      else tryNext();
                    }, 300);
                  })();
                  function step5() {
                    waitUntil(function () { return snap.scierie && snap.scierie.chantierDone; }, function () {
                      console.log("[5] chantier fini");
                      // Obstacles : batiments de la carte + scierie fraichement posee + murs.
                      var obs = mapBuildings.slice();
                      if (snap.scierie) obs.push({ x: snap.scierie.x - 20, y: snap.scierie.y - 20, w: snap.scierie.w + 40, h: snap.scierie.h + 40 });
                      var tSpots = [];
                      for (var tx2 = 300; tx2 <= 4700; tx2 += 100) {
                        for (var ty2 = 300; ty2 <= 4700; ty2 += 100) {
                          if (overlap(obs, tx2, ty2, 90)) continue;
                          var bad = false;
                          for (var wj2 = 0; !bad && wj2 < (snap.walls || []).length; wj2++) {
                            var w2 = snap.walls[wj2];
                            if (tx2 - 45 < w2.x + w2.w && tx2 + 45 > w2.x && ty2 - 45 < w2.y + w2.h && ty2 + 45 > w2.y) bad = true;
                          }
                          if (!bad) tSpots.push([tx2, ty2]);
                        }
                      }
                      if (tSpots.length === 0) { console.log("ECHEC : pas de spot tour"); srv.kill(); process.exit(1); }
                      (function tryTower() {
                        if (tSpots.length === 0) { console.log("ECHEC : tour non posee"); srv.kill(); process.exit(1); }
                        var tsp = tSpots.shift();
                        ws.send(JSON.stringify({ type: "input", buildSel: "tour:bois", placeBuild: { wx: tsp[0], wy: tsp[1] } }));
                        setTimeout(function () {
                          if (snap.towers && snap.towers.length === 1) {
                            console.log("[6] tour posee en (" + tsp.join(",") + "). gold:", snap.mairieGold, "towers:", snap.towers.length);
                            console.log("SUCCES TOTAL");
                            srv.kill(); process.exit(0);
                          } else tryTower();
                        }, 400);
                      })();
                    });
                  }
                });
              });
            });
          } else if (++ri < relicList.length) {
            phase = "walk";
            tx = relicList[ri][0]; ty = relicList[ri][1];
          } else {
            clearInterval(iv);
            console.log("ECHEC : aucune relique ramassable"); process.exit(1);
          }
        }, 500);
      } else if (phase === "walk") {
        ws.send(JSON.stringify({ type: "input", dx: dx / d, dy: dy / d }));
      }
    }, 100);
  });
}, 1000);

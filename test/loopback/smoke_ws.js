// Smoke test serveur : les modules partages modifies (towers.js, walls.js)
// s'evaluent sans erreur et la partie demarre + snapshot complet.
var WebSocket = require("../../server/node_modules/ws");
var PORT = 45745;
var srv = require("child_process").spawn("node", ["index.js"], { cwd: require("path").join(__dirname, "..", "..", "server"), env: { PATH: process.env.PATH, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });
var logs = []; srv.stdout.on("data", function (d) { logs.push(d.toString()); }); srv.stderr.on("data", function (d) { logs.push("ERR:" + d.toString()); });
setTimeout(function () {
  var ws = new WebSocket("ws://127.0.0.1:" + PORT);
  var snap = null, stateCount = 0;
  ws.on("open", function () { ws.send(JSON.stringify({ type: "join", name: "T" })); });
  ws.on("message", function (m) { var msg = JSON.parse(m); if (msg.type === "state") { snap = msg; stateCount++; } });
  setTimeout(function () {
    var ok = snap && snap.started === true && stateCount > 5 &&
              snap.towers !== undefined && snap.scierie === null && snap.mairieGold === 0;
    console.log("partie demarree:", snap ? snap.started : false, "| snapshots recus:", stateCount);
    console.log("snapshot contient towers/scierie/mairieGold:",
      snap ? (snap.towers !== undefined) + "/" + (snap.scierie !== undefined) + "/" + (snap.mairieGold !== undefined) : "n/a");
    console.log(ok ? "SMOKE OK" : "SMOKE ECHEC");
    console.log("stderr serveur:", logs.join("").indexOf("ERR") >= 0 ? logs.join("").slice(0, 300) : "aucune");
    srv.kill(); process.exit(ok ? 0 : 1);
  }, 40000);
}, 1000);

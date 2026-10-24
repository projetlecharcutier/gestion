// Test: le throttle 20 Hz de netInput ne doit JAMAIS dropper les inputs
// ponctuels (pickup, torche, equip, eat, votes...). Reproduit le bug : le
// pickup pendant la marche entrait dans la fenetre de 50 ms et etait
// retourne sans envoi — l'objet restait au sol, le sac ne se remplissait
// plus. Le move-only est desormais une WHITELIST des champs du message de
// deplacement (dx, dy, fire, build, buildWall, aimX, aimY).
var path = require("path");
var fs = require("fs");
global.window = global;
var SRC = path.join(__dirname, "..", "..", "src");

// Charge net.js dans un environnement minimal : il a besoin de GAME et de
// quelques elements DOM ; on capture seulement les appels a netSend.
var sent = [];
var G = global.GAME = global.G = {};
global.document = {
  getElementById: function () { return { hidden: true, style: {}, textContent: "" }; },
  createElement: function () { return { style: {} }; },
  addEventListener: function () {}
};
global.addEventListener = function () {};
global.performance = { now: function () { return Date.now(); } };
global.XMLHttpRequest = function () { this.open = function(){}; this.send = function(){}; };
global.location = { protocol: "http:", host: "localhost" };
global.WebSocket = function () { this.send = function(){}; this.close = function(){}; };
var code = fs.readFileSync(path.join(SRC, "net.js"), "utf8");
try { (0, eval)(code); } catch (e) { /* le module attache des handlers DOM tolerants */ }
// net.js definit son propre netSend (exige une WS connected) : on le remplace
// APRES le chargement pour capturer les envois.
G.netSend = function (msg) { sent.push(msg); };

var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }
function countSent(pred) { var n = 0; for (var i = 0; i < sent.length; i++) if (pred(sent[i])) n++; return n; }

assert(typeof G.netInput === "function", "netInput expose");

// Simule des inputs de deplacement a 60 Hz (frame par frame) : throttles.
sent.length = 0;
for (var i = 0; i < 60; i++) {
  G.netInput({ dx: 1, dy: 0, fire: false, build: false, buildWall: null, aimX: 10, aimY: 10 });
}
var moves = countSent(function (m) { return m.dx !== undefined && m.pickup === undefined; });
assert(moves > 0 && moves < 60, "deplacement throttle : " + moves + "/60 envois (attendu ~20)");

// Pendant la marche (throttle actif), un pickup DOIT passer immediatement.
sent.length = 0;
G.netInput({ dx: 1, dy: 0, fire: false, build: false, buildWall: null, aimX: 10, aimY: 10 });
G.netInput({ pickup: { x: 100, y: 200 } }); // 0 ms apres : doit passer
var pk = countSent(function (m) { return m.pickup !== undefined; });
assert(pk === 1, "pickup juste apres un move : envoye (0 drop), " + pk + "/1");

// Rafale de pickups et d'inputs ponctuels : tous passent.
sent.length = 0;
for (var j = 0; j < 10; j++) {
  G.netInput({ dx: 1, dy: 1, fire: true, build: false, buildWall: null, aimX: 0, aimY: 0 });
  G.netInput({ pickup: { x: j, y: j } });
  G.netInput({ torche: true });
  G.netInput({ eat: true });
  G.netInput({ techVote: "scierie" });
  G.netInput({ equip: "Fusil" });
}
assert(countSent(function (m) { return m.pickup !== undefined; }) === 10, "10 pickups pendant la marche : 10 envoyes");
assert(countSent(function (m) { return m.torche !== undefined; }) === 10, "10 torches : 10 envoyees");
assert(countSent(function (m) { return m.eat !== undefined; }) === 10, "10 eat : 10 envoyes");
assert(countSent(function (m) { return m.techVote !== undefined; }) === 10, "10 votes : 10 envoyes");
assert(countSent(function (m) { return m.equip !== undefined; }) === 10, "10 equip : 10 envoyes");

// Le move SEUL reste throttle meme apres la rafale.
sent.length = 0;
G.netInput({ dx: 1, dy: 0, fire: false, build: false, buildWall: null, aimX: 5, aimY: 5 });
G.netInput({ dx: 1, dy: 0, fire: false, build: false, buildWall: null, aimX: 5, aimY: 5 });
assert(countSent(function (m) { return m.dx !== undefined; }) <= 1, "deplacement toujours throttle apres les ponctuels");

console.log("----------------------------------------");
console.log(fails === 0 ? "PASS pickup_throttle" : "PICKUP_THROTTLE ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);

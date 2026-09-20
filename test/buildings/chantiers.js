// Stubs DOM (cf. tests precedents)
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }
load("config.js"); load("projection.js"); load("world.js"); load("player.js");
load("walls.js"); load("towers.js");
var G = global.GAME;
G.hasSprite = function () { return false; };
G.houseNames = []; G.foretNames = [];
G.state = { time: 0, buildings: [], walls: [], towers: [], planks: 100, mairieGold: 100, mouse: { inside: false } };
G.updateHud = function () {};
G.foretAt = function () { return null; };

// --- chantierFrame : un seul tour ---
var frames = [0,1,2,3,4,5,6,7,8]; // 9 frames comme scierie chantier
function fi(t0, now) { return G.chantierFrame({frames: frames}, t0, now, frames.length); }
var fails = 0;
function assert(cond, msg) { if (!cond) { console.log("FAIL: " + msg); fails++; } }

// builtAt=0, build time 10 s
for (var t = 0; t <= 10; t += 0.1) {
  var v = fi(0, t);
  var expected = Math.min(8, Math.floor(t / 10 * 9));
  assert(v === expected, "t=" + t.toFixed(1) + " frame=" + v + " attendu=" + expected);
}
assert(fi(0, 15) === 8, "apres la fin, fige sur la derniere frame");
assert(fi(5, 0) === 0, "p negatif -> frame 0");
assert(fi(0, 5) < fi(0, 10), "progression croissante");
// Un seul tour : jamais de retour a 0 apres avoir avance
var seen = [fi(0,0)], maxF = 0;
for (var t2 = 0; t2 <= 20; t2 += 0.25) {
  var v2 = fi(0, t2);
  assert(v2 >= maxF, "pas de retour arriere t=" + t2);
  if (v2 > maxF) maxF = v2;
}
// n=1 -> toujours 0
assert(G.chantierFrame({frames: [1]}, 0, 5, 1) === 0, "1 frame -> 0");

// --- emprise scierie ---
assert(G.SCIERIE_SIDE === 64, "SCIERIE_SIDE = 40 (obtenu " + G.SCIERIE_SIDE + ")");
var s = G.makeScierie(1000, 1000);
assert(s.w === 64 && s.h === 64, "makeScierie emprise 64x64 (obtenu " + s.w + "x" + s.h + ")");
assert(s.builtAt === 0 && s.chantierDone === false, "scierie: builtAt/chantierDone");
assert(s.x === 968 && s.y === 968, "centree sur le clic (side 64)");

// --- tour : emprise fallback (pas de PNG serveur) ---
var tw = G.makeTower(2000, 2000, "bois");
assert(tw.w === 84 && tw.h === 84, "tour fallbackSide 84 (obtenu " + tw.w + ")");
assert(tw.builtAt === 0, "tour builtAt");

// --- updateBuildSites : passage a chantierDone apres TOWER_BUILD_TIME ---
G.state.buildings.push(s); G.state.scierie = s; G.state.towers.push(tw);
G.updateBuildSites(0);
assert(!s.chantierDone && !tw.chantierDone, "pas chantierDone avant 10 s");
G.state.time = 9.9; G.updateBuildSites(0);
assert(!s.chantierDone, "9.9 s : pas fini");
G.state.time = 10.1; G.updateBuildSites(0);
assert(s.chantierDone && tw.chantierDone, "10.1 s : fini");

// --- buildMenu avec scierie construite ---
var menu = G.buildMenu();
assert(menu.some(function (e) { return e.id === "palissade"; }), "palissade au menu");
assert(menu.some(function (e) { return e.id === "tour:bois"; }), "tour:bois au menu apres scierie construite");
assert(!menu.some(function (e) { return e.id === "scierie"; }), "scierie absente (deja posee)");

console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

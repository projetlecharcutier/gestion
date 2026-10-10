// Vagues : la majorite des vagues viennent d'UN SEUL bord (60%), jamais
// de dispersion 4-bords majoritaire ; chaque groupe attaque le mur de son
// bord d'origine (navSide = spawnSide) ; PV zombie x2 des le debut ;
// plafond 2000 (sous le seuil de bug perf ~2000 zombies).
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }
load("config.js"); load("projection.js"); load("world.js"); load("flowfield.js"); load("player.js");
load("walls.js"); load("towers.js"); load("chop.js"); load("weapons.js"); load("birds.js"); load("siege.js"); load("zombies.js");
var G = global.GAME;
G.hasSprite = function () { return false; };
G.houseNames = function () { return []; };
G.foretNames = function () { return []; };
G.updateHud = function () {};
G.foretAt = function () { return null; };
G.state = { time: 0, clock: 12, day: 0, waveActive: true, zombieMode: "attack",
            player: { x: 9000, y: 9000, hp: 100 }, zombies: [], zombieGroups: [],
            walls: [], towers: [], buildings: [], projectiles: [], deadTraces: [],
            mouse: { inside: false }, zoom: 8, camera: { x: 5000, y: 5000 } };
var st = G.state;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// --- 1) PV zombie : x2 des le debut ---
assert(G.ZOMBIE_HP === 2, "ZOMBIE_HP = 2 (obtenu " + G.ZOMBIE_HP + ")");

// --- 2) Plafond : 2000 (sous le seuil de bug) ---
assert(G.ZOMBIE_WAVE_MAX === 2000, "ZOMBIE_WAVE_MAX = 2000 (obtenu " + G.ZOMBIE_WAVE_MAX + ")");
var w7 = G.rollWave(7);
assert(w7.count === 2000, "jour 7 cape a 2000 (obtenu " + w7.count + ")");

// --- 3) Schema de directions : 1 bord majoritaire (~60%) ---
var seen1 = 0, seen2 = 0, seen4 = 0, N = 3000;
for (var i = 0; i < N; i++) {
  st.pendingWave = null;
  var pw = G.rollWave(i % 5);
  var sl = pw.sides.length;
  if (sl === 1) seen1++;
  else if (sl === 2) seen2++;
  else seen4++;
}
var p1 = seen1 / N;
assert(p1 > 0.55 && p1 < 0.65, "1 bord ~60% (obtenu " + (p1 * 100).toFixed(1) + "%)");
assert(seen4 / N < 0.13, "4 bords <= 10% (obtenu " + (seen4 / N * 100).toFixed(1) + "%)");
console.log("schemas sur " + N + " vagues : 1 bord=" + seen1 + " (" + (p1 * 100).toFixed(0) + "%), 2 bords=" + seen2 + ", 4 bords=" + seen4);

// --- 4) Chaque groupe attaque le mur de son bord (navSide = spawnSide) ---
st.zombies = []; st.zombieGroups = [];
st.pendingWave = { sides: [0, 1, 2, 3], count: 32, rawCount: 32 };
G.spawnWave();
for (var g2 = 0; g2 < st.zombieGroups.length; g2++) {
  var grp = st.zombieGroups[g2];
  assert(grp.navSide === grp.spawnSide,
    "groupe " + g2 + " attaque le mur de son bord (navSide " + grp.navSide + " = spawnSide " + grp.spawnSide + ")");
}

console.log("----------------------------------------");
console.log("PASS: all  FAIL: " + fails);
process.exit(fails ? 1 : 0);

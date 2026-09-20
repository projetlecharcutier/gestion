// Vagues : directions tirees au hasard (1, 2 ou 4 bords), toutes les configs
// possibles sortent, les groupes respectent le schema, spawn hors de la ville.
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }
load("config.js"); load("projection.js"); load("world.js"); load("player.js");
load("walls.js"); load("towers.js"); load("chop.js"); load("weapons.js"); load("birds.js"); load("zombies.js");
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

// Bord d'origine d'un chef selon sa position
function sideOf(grp) {
  var e = 200;
  if (grp.y <= e) return 0;            // nord
  if (grp.y >= G.WORLD - e) return 1;  // sud
  if (grp.x <= e) return 2;            // ouest
  if (grp.x >= G.WORLD - e) return 3;  // est
  return -1;
}

var seen1 = 0, seen2 = 0, seen4 = 0;
for (var w = 0; w < 600; w++) {
  st.zombies = []; st.zombieGroups = []; st.day = 0;
  G.spawnWave();
  var sides = st.waveSides;
  assert(sides && sides.length >= 1 && sides.length <= 4, "sides valide (" + JSON.stringify(sides) + ")");
  if (sides.length === 1) seen1++;
  if (sides.length === 2) seen2++;
  if (sides.length === 4) seen4++;
  if (sides.length === 2) assert(sides[0] !== sides[1], "2 directions distinctes (" + JSON.stringify(sides) + ")");
  // Tous les groupes de la vague viennent d'une direction du schema
  for (var g = 0; g < st.zombieGroups.length; g++) {
    var s = st.zombieGroups[g].spawnSide;
    assert(s === 0 || s === 1 || s === 2 || s === 3, "spawnSide valide");
    assert(sides.indexOf(s) >= 0, "chef " + g + " sur une direction du schema (" + s + " pas dans " + JSON.stringify(sides) + ")");
    var ps = sideOf(st.zombieGroups[g]);
    assert(ps !== -1, "chef sur un bord de la carte");
  }
  // Zombies spawns hors de la ville, sur la carte
  for (var z = 0; z < st.zombies.length; z++) {
    var zz = st.zombies[z];
    assert(!G.inTown(zz.x, zz.y), "zombie spawn hors de la ville");
    assert(zz.x >= 0 && zz.x <= G.WORLD && zz.y >= 0 && zz.y <= G.WORLD, "zombie sur la carte");
  }
}
console.log("schemas: 1 dir=" + seen1 + ", 2 dir=" + seen2 + ", 4 dir=" + seen4 + " (600 vagues)");
assert(seen1 > 120 && seen2 > 120 && seen4 > 120, "les 3 schemas sortent (~1/3 chacun)");
console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

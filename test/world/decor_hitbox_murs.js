// Test: décors — hitbox montagne ancrée au sud, aucun décor sur la muraille,
// nouvelle carte à chaque buildWorld (latch villes libéré).
// Contract:
//   1. montagne bloquante : hitbox ANCRÉE AU BAS de l'emprise (le PNG plein
//      cadre dessine le massif en bas ; l'ancienne hitbox centrée couvrait
//      le haut du losange = du ciel, et laissait le joueur "dans" la montagne),
//   2. après buildWorld, AUCUN décor (bloquant ou non) ne chevauche la
//      palissade de la ville (marge 60 px),
//   3. buildWorld libère G._villeRng : deux buildWorld successifs peuvent
//      donner des positions de villes différentes (nouvelle carte).
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

global.window = global;
global.GAME = {};
function load(f) { (0, eval)(fs.readFileSync(path.join(REPO, f), "utf8")); }
load("src/config.js");
load("src/projection.js");
load("src/assets.js");
load("src/ville.js");
load("src/walls.js");
load("src/world.js");
var G = global.GAME;

G.state = { buildings: [], walls: [], items: [], trees: [], zombies: [] };

// 1 : hitbox montagne ancrée au sud.
G.SPRITES = { elementdecord: { "bloquant/montagne": { w: 242, h: 101, img: {} } } };
var m = G.makeDecor(5000, 5000, "bloquant/montagne", "bloquant");
assert(m.hit, "montagne: hitbox présente");
if (m.hit) {
  var bottom = m.y + m.h;
  assert(Math.abs((m.hit.y + m.hit.h) - bottom) < 1,
    "montagne: hitbox ancrée au BAS (bas hit " + (m.hit.y + m.hit.h) + " = bas emprise " + bottom + ")");
  assert(m.hit.y > m.y, "montagne: hitbox couvre le bas, pas le haut du losange");
}

// 2 : aucun décor ne chevauche la muraille (marge 60).
G.SPRITES.elementdecord["nonbloquant/buisson1"] = { w: 25, h: 14, img: {} };
G.state = { buildings: [], walls: [], items: [], trees: [], zombies: [] };
G.buildWorld();
var MARGE = 60;
var wallHits = 0;
for (var i = 0; i < G.state.buildings.length; i++) {
  var b = G.state.buildings[i];
  if (!b.isDecor || b.isTorche) continue; // torches : posées exprès près des villes
  for (var w = 0; w < G.state.walls.length; w++) {
    var wl = G.state.walls[w];
    if (b.x - MARGE < wl.x + wl.w && b.x + b.w + MARGE > wl.x &&
        b.y - MARGE < wl.y + wl.h && b.y + b.h + MARGE > wl.y) { wallHits++; break; }
  }
}
  assert(wallHits === 0,
  "buildWorld: aucun décor ne chevauche la muraille (marge " + MARGE + "px, " + wallHits + " chevauchement(s))");

// 3 : nouvelle carte — le latch villes est libéré à chaque buildWorld.
assert(G._villeRng !== null && G._villeRng !== undefined,
  "buildWorld: positions villes re-tirées (latch libéré puis re-posé)");
var defs = G.VILLE_DEFS || [];
var pos1 = defs.map(function (d) { return d.x + "," + d.y; }).join("|");
var pos2 = null, tries = 0;
// Deux tirages successifs donnent (presque sûrement) des positions
// différentes ; tolerance : jusqu'à 3 essais (collision improbable).
while (tries < 3) {
  tries++;
  G.buildWorld();
  pos2 = defs.map(function (d) { return d.x + "," + d.y; }).join("|");
  if (pos2 !== pos1) break;
}
assert(pos2 !== pos1, "buildWorld x2 : positions des villes différentes (nouvelle carte)");

console.log("----------------------------------------");
console.log(fails ? "PASS: -  FAIL: " + fails : "PASS: all  FAIL: 0");
process.exit(fails ? 1 : 0);

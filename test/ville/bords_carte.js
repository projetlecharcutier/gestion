// Test: villes PNG - aucune bbox visuelle ne depasse du bord de la carte.
// Contract: la bbox VISUELLE d'une ville (emprise sol + debord d'elevation
// du PNG vers le nord/ouest/est) doit rester DANS [0, WORLD] apres le
// tirage aleatoire des positions, y compris le fallback carte saturee.
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

global.window = global;
global.GAME = {};
function load(f) { (0, eval)(fs.readFileSync(path.join(REPO, f), "utf8")); }
load("src/config.js");
load("src/ville.js");
var G = global.GAME;

// Sprites factices : plusieurs tailles pour couvrir petites et grandes
// villes (PNG large -> side = 2 * largeur -> elev = 1.6 * largeur).
var SPRITES = { petit: { w: 100, h: 100 }, moyen: { w: 300, h: 300 }, grand: { w: 600, h: 600 } };
G.SPRITES = { ville: SPRITES };
G.VILLE_DEFS = [
  { name: "Petite", sprite: "petit", x: 0, y: 0 },
  { name: "Moyenne", sprite: "moyen", x: 0, y: 0 },
  { name: "Grande", sprite: "grand", x: 0, y: 0 }
];
G.hasSprite = function () { return true; };

// Boucle de stress : le tirage est aleatoire, on verifie sur N passes.
var worst = null;
for (var pass = 0; pass < 200; pass++) {
  G._villeRng = null;
  G.villeRandomizePositions();
  var rng = G._villeRng;
  for (var key in rng) {
    var p = rng[key];
    var side = SPRITES[key] ? SPRITES[key].w * 2 : 400;
    var elev = side * 0.8;
    var x0 = p.x - elev, y0 = p.y - elev;
    var x1 = p.x + side + elev, y1 = p.y + side;
    if (x0 < 0 || y0 < 0 || x1 > G.WORLD || y1 > G.WORLD) {
      worst = { key: key, p: p, side: side };
      break;
    }
  }
  if (worst) break;
}
assert(!worst, "200 passes : toutes les bboxes visuelles restent dans la carte" +
  (worst ? " (" + worst.key + " en " + worst.p.x + "," + worst.p.y + " side " + worst.side + ")" : ""));

// Fallback carte saturee : MARGE enorme -> aucune position valide ->
// position par defaut clampee, bbox visuelle dans la carte.
G._villeRng = null;
var ORIG = G.WORLD;
G.WORLD = 1200;  // carte minuscule : side 1200 (grand) sature immediatement
G.TOWN_MIN = 0; G.TOWN_MAX = 0;  // neutralise la zone interdite
G.villeRandomizePositions();
var rng2 = G._villeRng;
assert(!!rng2, "fallback : positions tirees malgre la saturation");
for (var k2 in rng2) {
  var q2 = rng2[k2];
  var s2 = SPRITES[k2] ? SPRITES[k2].w * 2 : 400;
  var e2 = s2 * 0.8;
  var sol = q2.x >= 0 && q2.y >= 0 && q2.x + s2 <= G.WORLD && q2.y + s2 <= G.WORLD;
  assert(sol, "fallback " + k2 + " : emprise sol dans la carte (" + q2.x + "," + q2.y + ")");
  if (s2 + 2 * e2 <= G.WORLD) {
    assert(q2.x - e2 >= 0 && q2.y - e2 >= 0 &&
           q2.x + s2 + e2 <= G.WORLD && q2.y + s2 <= G.WORLD,
           "fallback " + k2 + " : bbox visuelle dans la carte (" + q2.x + "," + q2.y + ")");
  }
}
G.WORLD = ORIG;

console.log("----------------------------------------");
console.log(fails ? "PASS: -  FAIL: " + fails : "PASS: all  FAIL: 0");
process.exit(fails ? 1 : 0);

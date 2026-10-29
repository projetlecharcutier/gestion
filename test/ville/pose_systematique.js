// Villes toujours posees : regression de la race condition -- en mode
// serveur, villeSetup peut etre appele AVANT la fin de loadAssets (join ou
// restart) ; les villes sans sprite charge sont ignorees et restaient
// absentes DEFINITIVEMENT. villeSetup doit RETENTER la pose quand les
// assets deviennent prets. Le tirage aleatoire doit aussi fonctionner
// avec un rng injectable (G._villeTestRng) pour les tests.
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

global.window = global;
global.GAME = global.GAME || {};
function load(f) { (0, eval)(fs.readFileSync(path.join(REPO, f), "utf8")); }
load("src/config.js");

// DOM/asset minimal : pas de vrai PNG, on pilote assetsReady/loadAssets.
load("src/ville.js");
var G = global.GAME;

// 1) Race : villeSetup avant assets -> re-tentative quand ready.
var ready = false;
var readyCbs = [];
G.assetsReady = function () { return ready; };
G.loadAssets = function (cb) { readyCbs.push(cb); };
G.SPRITES = {};
G.hasSprite = function (ent, frame) {
  return !!(G.SPRITES[ent] && G.SPRITES[ent][frame]);
};
G.buildVilleGrids = function () {};
G.WORLD = 20000;

var state = {};
G.VILLE_DEFS = [{ name: "Ville de l'Est", sprite: "est", x: 11210, y: 9900 }];
// Assets PAS prets : aucune ville dans SPRITES -> villeSetup rend vide...
G.villeSetup(state);
assert(state.villes.length === 0, "assets non prets : aucune ville posee (attendu)");
assert(G._villeSetupRetry === true, "re-essai programme via loadAssets");
// ...les assets arrivent (sprite visible) : le callback doit re-poser.
G.SPRITES = { ville: { est: { img: {}, w: 512, h: 512 } } };
ready = true;
var cbs = readyCbs.slice(); readyCbs = [];
for (var i = 0; i < cbs.length; i++) cbs[i]();
assert(state.villes.length === 1,
  "assets prets : la ville est re-posee apres la race (obtenu " + state.villes.length + ")");
assert(state.villes[0].sprite === "est", "la ville posee est bien Ville de l'Est");
assert(state.villes[0].w === 512 * 2, "cote du losange = largeur PNG * 2");

// 2) Deuxieme villeSetup (restart) : pas de double re-essai infini.
G._villeSetupRetry = false;
ready = true;
G.villeSetup(state);
assert(state.villes.length === 1, "villeSetup idempotent : toujours 1 ville");

// 3) Rng injectable : positions reproductibles et dans la carte.
G._villeRng = null;
G._villeTestRng = (function () { var s = 42; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })();
G.villeRandomizePositions();
var p = G._villeRng["est"];
assert(p && p.x >= 0 && p.y >= 0 && p.x + 1024 <= G.WORLD && p.y + 1024 <= G.WORLD,
  "rng injectable : position dans la carte (" + (p && p.x) + ", " + (p && p.y) + ")");
// Reproductibilite : meme graine -> meme position.
G._villeRng = null;
G._villeTestRng = (function () { var s = 42; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })();
G.villeRandomizePositions();
var p2 = G._villeRng["est"];
assert(p2.x === p.x && p2.y === p.y, "meme graine -> meme position (" + p2.x + ", " + p2.y + ")");

// 4) Tous les sprites des BG du menu existent sur le disque (decor d'accueil).
var menuCode = fs.readFileSync(path.join(REPO, "src", "menu.js"), "utf8");
var re = /src:\s*"([^"]+)"/g, m;
var missing = [];
while ((m = re.exec(menuCode)) !== null) {
  var f = m[1];
  if (f.indexOf("assets/") !== 0) continue;
  if (!fs.existsSync(path.join(REPO, f))) missing.push(f);
}
assert(missing.length === 0, "images du fond de menu toutes presentes" +
  (missing.length ? " (manquantes: " + missing.join(", ") + ")" : ""));

if (fails) { console.log("FAILURES: " + fails); process.exit(1); }
console.log("ville pose systematique + menu backdrop OK");
process.exit(0);

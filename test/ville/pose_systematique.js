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

// 4) Fond de menu volant : la liste sprites-list.json couvre TOUS les PNG
//    de assets/sprites, sans les masques de collision (*_mask). Le menu
//    charge cette liste (fetch), rend chaque sprite a la MEME hauteur
//    (BG_TILE_H) et les pousse de droite a gauche (x decroit).
var list = JSON.parse(fs.readFileSync(path.join(REPO, "assets", "sprites", "sprites-list.json"), "utf8"));
var onDisk = [];
(function walk(dir) {
  fs.readdirSync(dir).forEach(function (f) {
    var p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) return walk(p);
    if (/\.png$/i.test(f)) onDisk.push(p.split(path.sep).join("/"));
  });
})(path.join(REPO, "assets", "sprites"));
// Chemins relatifs au repo (comme dans sprites-list.json).
onDisk = onDisk.map(function (p) { return path.relative(REPO, p).split(path.sep).join("/"); });
onDisk.sort();
var diskSet = {};
onDisk.forEach(function (p) { diskSet[p] = true; });
var listSet = {};
list.forEach(function (p) { listSet[p] = true; });
var notListed = onDisk.filter(function (p) { return !listSet[p]; });
var notOnDisk = list.filter(function (p) { return !diskSet[p]; });
assert(notListed.length === 0 && notOnDisk.length === 0,
  "sprites-list.json couvre exactement tous les PNG du disque (" +
  list.length + " vs " + onDisk.length + ")");
var menuCode = fs.readFileSync(path.join(REPO, "src", "menu.js"), "utf8");
assert(menuCode.indexOf("_mask") !== -1,
  "le menu filtre les masques techniques (_mask)");
assert(/!\/-\\d\+\\\.png\$\/i\.test\(p\)/.test(menuCode) || menuCode.indexOf("-\\d+\\.png") !== -1,
  "le menu filtre les frames d animation (*-N.png)");
assert(menuCode.indexOf("naturalWidth") !== -1 && menuCode.indexOf("BG_TILE_H") === -1,
  "echelle native : taille du PNG telle quelle (plus de hauteur commune)");
assert(menuCode.indexOf("fl.x -= fl.speed * dt") !== -1,
  "vent : les sprites vont de droite a gauche (x decroit)");
assert(menuCode.indexOf("W + 40") !== -1,
  "apparition hors ecran a droite (x initial > W)");

if (fails) { console.log("FAILURES: " + fails); process.exit(1); }
console.log("ville pose systematique + menu backdrop OK");
process.exit(0);

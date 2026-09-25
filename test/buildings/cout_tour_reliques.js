// Tour a 1 or + 5 reliques hors ville + spots valides
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }
load("config.js"); load("projection.js"); load("world.js"); load("flowfield.js"); load("player.js");
load("walls.js"); load("towers.js");
var G = global.GAME;
G.hasSprite = function () { return false; };
G.houseNames = function () { return []; }; G.foretNames = function () { return []; };
G.updateHud = function () {};
G.foretAt = function () { return null; };
G.state = { time: 0, buildings: [], walls: [], towers: [], planks: 0, mairieGold: 0, items: [], mouse: { inside: false } };
G.buildWorld();
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// 1) Cout de la tour
assert(G.TOWER_STATS.bois.cost.gold === 1, "tour = 1 or (obtenu " + G.TOWER_STATS.bois.cost.gold + ")");
assert(G.TOWER_STATS.bois.cost.planks === 20, "tour = 20 planches (obtenu " + G.TOWER_STATS.bois.cost.planks + ")");

// 2) Items initiaux : 5 reliques, toutes hors ville
var items = G.state.items || [];
var reliques = items.filter(function (it) { return it.name === "Relique"; });
assert(reliques.length === 10, "10 reliques (obtenu " + reliques.length + ")");
var TOWN_MIN = G.TOWN_MIN, TOWN_MAX = G.TOWN_MAX;
reliques.forEach(function (it, i) {
  assert(it.x > 0 && it.x < G.WORLD && it.y > 0 && it.y < G.WORLD, "relique " + i + " dans la carte");
});
var enVille = reliques.filter(function (it) { return it.x >= TOWN_MIN && it.x <= TOWN_MAX && it.y >= TOWN_MIN && it.y <= TOWN_MAX; });
assert(enVille.length === 1, "exactement 1 relique en ville (obtenu " + enVille.length + ")");

// 3) Poses d'une tour avec seulement quelques pieces d'or
G.state = { time: 0, buildings: [], walls: [], towers: [], planks: 200, mairieGold: 3,
            scierieUnlocked: true, mouse: { inside: false } };
G.inTown = function (x, y) { return true; };
G.pushPlayerOutOfWall = function () {};
G.tryBuildWall = function () { return true; };
var s = G.makeScierie(5000, 5000); s.chantierDone = true;
G.state.scierie = s; G.state.buildings.push(s);
G.state.buildSel = "tour:bois";
var ok = G.placeFromBuildMenu(5200, 5200);
assert(ok, "pose tour avec 3 or possible (cout 1)");
assert(G.state.mairieGold === 2, "or deduit (obtenu " + G.state.mairieGold + ")");
assert(G.state.planks === 180, "planches deduites (obtenu " + G.state.planks + ")");
// or = 0 -> refuse
G.state.mairieGold = 0; G.state.buildSel = "tour:bois";
assert(!G.placeFromBuildMenu(5300, 5300), "tour refusee avec 0 or");

console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

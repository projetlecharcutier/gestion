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
G.state = { time: 0, buildings: [], walls: [], towers: [], planks: 200, mairieGold: 100,
            scierieUnlocked: true, scierie: null, mouse: { inside: false } };
G.updateHud = function () {};
G.foretAt = function () { return null; };
G.inTown = function (x, y) { return x > 500 && x < 1500 && y > 500 && y < 1500; };
G.tryBuildWall = function () { return true; };
G.pushPlayerOutOfWall = function () {};

var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// 1) Z -> menu : scierie presente (debloquee, non posee)
var menu = G.buildMenu();
assert(menu.some(function (e) { return e.id === "scierie"; }), "scierie au menu");
assert(!menu.some(function (e) { return e.id.indexOf("tour:") === 0; }), "pas de tour avant scierie construite");

// 2) selection scierie -> pose en ville
G.state.buildSel = "scierie";
var ok = G.placeFromBuildMenu(1000, 1000);
assert(ok, "pose scierie ok");
assert(G.state.scierie && G.state.scierie.w === 64, "scierie posee emprise 64");
assert(G.state.buildSel === null, "buildSel reset apres pose scierie");

// 3) deuxieme pose refusee (unique)
G.state.buildSel = "scierie";
assert(!G.placeFromBuildMenu(1100, 1100), "scierie unique : 2e pose refusee");

// 4) hors ville refuse
G.state.scierie = null; G.state.buildings = [];
G.state.buildSel = "scierie";
assert(!G.placeFromBuildMenu(200, 200), "hors ville refuse");
assert(G.state.scierie === null, "rien pose hors ville");

// 5) scierie construite -> tours au menu, pose tour
G.placeFromBuildMenu(1000, 1000);
G.state.scierie.chantierDone = true;
menu = G.buildMenu();
assert(menu.some(function (e) { return e.id === "tour:bois"; }), "tour:bois au menu");
G.state.buildSel = "tour:bois";
var ok2 = G.placeFromBuildMenu(800, 800);
assert(ok2, "pose tour ok");
assert(G.state.towers.length === 1, "1 tour posee");
assert(G.state.mairieGold === 99 && G.state.planks === 180, "paiement tour (or 1, planches 20)");
assert(G.state.towers[0].w === 84, "tour emprise fallback 84");

// 6) or insuffisant -> refuse
G.state.mairieGold = 0;
G.state.buildSel = "tour:bois";
assert(!G.placeFromBuildMenu(850, 850), "tour refusee sans or");

console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

// Test: scierie -20% (64), message mairie, reliques hors ville augmentees, relique en ville
var fs = require("fs"), path = require("path");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
function load(f) { (0, eval)(fs.readFileSync(path.join(REPO, "src", f), "utf8")); }
["config.js", "projection.js", "world.js", "flowfield.js", "player.js", "walls.js", "towers.js", "chop.js", "weapons.js", "birds.js", "siege.js", "zombies.js"].forEach(load);
var G = global.GAME;
G.hasSprite = function () { return false; };
G.houseNames = function () { return []; };
G.foretNames = function () { return []; };
G.updateHud = function () {};
G.foretAt = function () { return null; };

// 1) Scierie 20% plus petite : 80 -> 64
assert(G.SCIERIE_SIDE === 64, "SCIERIE_SIDE = 64 (obtenu " + G.SCIERIE_SIDE + ")");
assert(G.TOWN_BUILDINGS.scierie.side === 64, "registre scierie.side = 64");
// state minimal (pattern test_town.js)
G.state = { time: 0, clock: 8, day: 0, waveActive: false, zombieMode: "attack",
            player: { x: 5000, y: 5000, hp: 100 }, zombies: [], zombieGroups: [],
            walls: [], towers: [], buildings: [], projectiles: [], deadTraces: [],
            planks: 500, mairieGold: 100, mouse: { inside: false },
            universiteUnlocked: false, universite: null,
            montgolfiereUnlocked: false, montgolfiere: null, pendingWave: null,
            scierieUnlocked: false, scierie: null };
// generer le monde avec le state en place pour les items
G.buildWorld();
var s = G.makeScierie(5000, 5000);
assert(s.w === 64 && s.h === 64, "makeScierie emprise 64x64 (obtenu " + s.w + "x" + s.h + ")");

// 2) Message mairie : mentionne les batiments en bois
var msg = G.TOWN_BUILDINGS.scierie.msg;
assert(msg.indexOf("batiments en bois") >= 0 || msg.indexOf("bâtiments en bois") >= 0,
       "msg scierie parle de batiments en bois (obtenu: " + msg + ")");

// 3) Reliques : total hors ville + au moins une en ville
var relics = G.state.items.filter(function (it) { return it.name === "Relique"; });
assert(relics.length >= 10, "au moins 10 reliques au total (obtenu " + relics.length + ")");
var inTown = relics.filter(function (it) { return G.inTown(it.x, it.y); });
assert(inTown.length >= 1, "au moins une relique en ville (obtenu " + inTown.length + ")");
var outTown = relics.filter(function (it) { return !G.inTown(it.x, it.y); });
assert(outTown.length >= 9, "reliques hors ville augmentees (obtenu " + outTown.length + ")");

// 4) Toutes les reliques dans les limites de la carte
relics.forEach(function (it) {
  assert(it.x >= 12 && it.x <= G.WORLD - 12 && it.y >= 12 && it.y <= G.WORLD - 12,
         "relique dans la carte (" + it.x + "," + it.y + ")");
});

// 5) Relique en ville pas superposee a un autre item
var inTownItems = G.state.items.filter(function (it) { return G.inTown(it.x, it.y); });
inTown.forEach(function (r) {
  inTownItems.forEach(function (o) {
    if (o === r) return;
    var d = Math.abs(o.x - r.x) + Math.abs(o.y - r.y);
    assert(d > 30, "relique en ville pas superposee (d=" + d + ")");
  });
});

// 6) Reliques hors ville pas sur un batiment
var buildings = G.state.buildings;
outTown.forEach(function (r) {
  buildings.forEach(function (b) {
    var inside = r.x >= b.x - 40 && r.x <= b.x + b.w + 40 && r.y >= b.y - 40 && r.y <= b.y + b.h + 40;
    assert(!inside, "relique hors ville pas sur un batiment (" + r.x + "," + r.y + " vs " + b.name + ")");
  });
});

if (fails === 0) console.log("ALL_OK");
else { console.log("FAILURES: " + fails); process.exit(1); }

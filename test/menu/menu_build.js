var fs = require("fs"), path = require("path"), Module = require("module");
var SRC = path.join(__dirname + "/../..", "src");
global.window = global;
global.devicePixelRatio = 1;
var G = {}; global.GAME = G;
global.canvas = G.canvas = { width: 800, height: 600, getContext: function () { return null; } };
G.SPRITES = {};
G.hasSprite = function () { return false; };
G.spriteBounds = function () { return null; };
G.houseNames = function () { return []; };
G.foretNames = function () { return ["foret1", "foret2"]; };
global.document = { getElementById: function () { return { width: 800, height: 600, getContext: function () { return null; }, addEventListener: function () {}, style: {} }; } };
function load(f) { (0, eval)(fs.readFileSync(path.join(SRC, f), "utf8")); }
["config.js","state.js","projection.js","world.js","player.js","walls.js","towers.js","chop.js","weapons.js","birds.js","siege.js","zombies.js"].forEach(load);
var G = global.GAME;
G.buildWorld();
var s = G.state;
var m0 = G.buildMenu();
console.log("[1] menu initial:", m0.map(function(e){return e.id;}).join(","));
if (m0.length !== 1) throw new Error("menu initial devrait n'avoir que palissade");
s.mairieGold = 50; s.planks = 150;
if (!G.unlockScierie()) throw new Error("unlockScierie a echoue");
var m1 = G.buildMenu();
console.log("[2] menu apres tech:", m1.map(function(e){return e.id;}).join(","));
if (m1.map(function(e){return e.id;}).indexOf("scierie") < 0) throw new Error("scierie absente du menu");
s.buildSel = "scierie";
function findSpot(inTownWanted, side) {
  for (var x = 100; x < 9900; x += 50) {
    for (var y = 100; y < 9900; y += 50) {
      if (G.inTown(x, y) !== inTownWanted) continue;
      if (G.towerSpotFree(x - side/2, y - side/2, side, side)) return [x, y];
    }
  }
  return null;
}
var spotSc = findSpot(true, G.SCIERIE_SIDE);
var ok = G.placeFromBuildMenu(spotSc[0], spotSc[1]);
console.log("[3] pose scierie (" + spotSc.join(",") + "):", ok ? "OK" : "ECHEC");
if (!ok) throw new Error("pose scierie echouee");
var m2 = G.buildMenu();
console.log("[4] menu scierie posee (chantier):", m2.map(function(e){return e.id;}).join(","));
if (m2.map(function(e){return e.id;}).indexOf("scierie") >= 0) throw new Error("scierie encore dans le menu");
s.mairieGold = 100; s.planks = 100; s.time += G.TOWER_BUILD_TIME + 0.1;
G.updateBuildSites(0.05);
var m3 = G.buildMenu();
console.log("[5] menu apres chantier:", m3.map(function(e){return e.id;}).join(","));
if (m3.map(function(e){return e.id;}).indexOf("tour:bois") < 0) throw new Error("tour absente du menu");
s.buildSel = "tour:bois";
var spotTw = findSpot(false, 48);
var ok2 = G.placeFromBuildMenu(spotTw[0], spotTw[1]);
console.log("[6] pose tour hors ville (" + spotTw.join(",") + "):", ok2 ? "OK" : "ECHEC");
if (!ok2) throw new Error("pose tour echouee");
console.log("gold:", s.mairieGold, "planches:", s.planks, "towers:", s.towers.length);
// 7. Palissade : selection reste active apres pose.
s.buildSel = "palissade";
var spotPl = [spotTw[0] + 500, spotTw[1] + 500];
var ok3 = G.placeFromBuildMenu(spotPl[0], spotPl[1]);
console.log("[7] pose palissade:", ok3 ? "OK" : "ECHEC", "| buildSel conserve:", s.buildSel);
console.log("TOUS LES TESTS PASSENT");

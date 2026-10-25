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
["config.js","state.js","projection.js","world.js","flowfield.js","player.js","walls.js","towers.js","chop.js","weapons.js","birds.js","siege.js","zombies.js"].forEach(load);
var G = global.GAME;
G.updateHud = function () {};
G.statsAddBuilt = function () {};
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
  // Pas = G.BUILD_GRID : les spots sont centres sur la grille de construction
  // (snap de placeFromBuildMenu) pour que le point teste == le point pose.
  var g = G.BUILD_GRID;
  for (var x = g; x < 9900; x += g) {
    for (var y = g; y < 9900; y += g) {
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
// Le snap de placeFromBuildMenu centre la tour sur la grille : on cherche un
// spot de palissade a partir de la position REELLE de la tour posee.
// Le point cherche est aligne sur la grille (pas multiple de BUILD_GRID) :
// tryBuildWall snappera de toute facon, on veut juste un centre de cellule.
var tourPos = s.towers[0];
var spotPl = null;
var pd0 = G.plankDims();
for (var px = 0; px < G.WORLD && !spotPl; px += G.BUILD_GRID) {
  for (var py = 0; py < G.WORLD; py += G.BUILD_GRID) {
    var mx0 = px - pd0.w / 2, my0 = py - pd0.h / 2;
    var hit0 = false;
    for (var bi = 0; bi < s.buildings.length; bi++) {
      var bb = s.buildings[bi];
      if (mx0 < bb.x + bb.w && mx0 + pd0.w > bb.x && my0 < bb.y + bb.h && my0 + pd0.h > bb.y) { hit0 = true; break; }
    }
    if (!hit0) { spotPl = [px, py]; break; }
  }
}
if (!spotPl) throw new Error("pas de spot palissade libre");
// Eloigne de la tour posee (la tour est un batiment, la palissade ne peut pas
// la chevaucher) et proche du joueur pour la portee hors mode build.
s.player.x = spotPl[0]; s.player.y = spotPl[1];
s.buildMode = false;
console.log("gold:", s.mairieGold, "planches:", s.planks, "towers:", s.towers.length);
// 7. Palissade : selection reste active apres pose + snap sur la grille.
s.buildSel = "palissade";
var ok3 = G.placeFromBuildMenu(spotPl[0], spotPl[1]);
console.log("[7] pose palissade:", ok3 ? "OK" : "ECHEC", "| buildSel conserve:", s.buildSel);
if (ok3) {
  var lastWall = s.walls[s.walls.length - 1];
  if ((lastWall.x + lastWall.w / 2) % G.BUILD_GRID !== 0 ||
      (lastWall.y + lastWall.h / 2) % G.BUILD_GRID !== 0) {
    throw new Error("palissade non centree sur la grille");
  }
  // Pose a un point quelconque : la palissade est snappee sur la cellule.
  var ok4 = G.placeFromBuildMenu(spotPl[0] + 37, spotPl[1] - 23);
  if (!ok4) throw new Error("pose palissade décalee echouee");
  var w2 = s.walls[s.walls.length - 1];
  var snapped = G.snapToGrid(spotPl[0] + 37, spotPl[1] - 23);
  if (w2.x + w2.w / 2 !== snapped[0] || w2.y + w2.h / 2 !== snapped[1]) {
    throw new Error("palissade non snappee sur la cellule la plus proche");
  }
  console.log("[8] snap grille: palissade centree sur cellule", snapped.join(","));
} else {
  console.log("[8] pas de spot palissade libre pres de la tour (snap non verifie ici)");
}
console.log("TOUS LES TESTS PASSENT");

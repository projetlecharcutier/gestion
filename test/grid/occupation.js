// Occupation d'un losange : un losange ne contient qu'un seul batiment ou
// partie de batiment. On ne peut PAS avoir plusieurs batiments (tour,
// scierie, batiment de ville) sur le meme losange, ni un batiment qui
// chevauche une palissade posee sur le meme losange.
//
// Verifie :
//   1. Deux palissades peuvent se superposer sur le meme losange (mur x2,
//      coins de perimetre) : la superposition mur/mur reste autorisee.
//   2. Apres une palissade posee sur un losange, tryBuildWall refuse une
//      palissade perpendiculaire qui chevaucherait son emprise... en fait
//      non : les palissades se superposent toujours entre elles (coins).
//      Par contre un BATIMENT (tour) refuse sur un losange contenant une
//      palissade (towerSpotFree teste les murs).
//   3. Un batiment (tour) refuse sur un losange contenant deja un batiment.
//   4. placeFromBuildMenu refuse de poser deux scieries sur le meme losange
//      (batiment de ville unique : le deuxieme appel est refuse car
//      state.scierie existe deja).
//   5. Deux tours ne peuvent pas occuper le meme losange (towerSpotFree).
var fs = require("fs"), path = require("path");
var SRC = path.join(__dirname, "..", "..", "src");
global.window = global;
global.devicePixelRatio = 1;
var G = {}; global.GAME = G;
global.canvas = G.canvas = { width: 800, height: 600, getContext: function () { return null; } };
G.SPRITES = {};
G.hasSprite = function () { return false; };
G.spriteBounds = function () { return null; };
G.houseNames = function () { return []; };
G.foretNames = function () { return ["foret1", "foret2"]; };
var ctxStub = {
  setTransform: function () {}, fillRect: function () {}, strokeRect: function () {},
  clearRect: function () {}, beginPath: function () {}, closePath: function () {},
  moveTo: function () {}, lineTo: function () {}, arc: function () {}, fill: function () {},
  stroke: function () {}, save: function () {}, restore: function () {},
  translate: function () {}, rotate: function () {}, scale: function () {},
  drawImage: function () {},
  fillText: function () {}, strokeText: function () {},
  measureText: function () { return { width: 10 }; },
  setLineDash: function () {},
  imageSmoothingEnabled: false, globalAlpha: 1, fillStyle: "", strokeStyle: "",
  lineWidth: 1, font: "", textAlign: "", textBaseline: ""
};
global.document = {
  getElementById: function () {
    return { width: 800, height: 600, getContext: function () { return ctxStub; }, addEventListener: function () {}, style: {} };
  }
};
function load(f) { (0, eval)(fs.readFileSync(path.join(SRC, f), "utf8")); }
["config.js", "state.js", "projection.js", "world.js", "flowfield.js", "player.js",
 "walls.js", "towers.js", "chop.js", "weapons.js", "birds.js", "siege.js", "zombies.js",
 "textures/index.js", "textures/hud.js", "hud.js", "grid.js"].forEach(load);
var G = global.GAME;
G.updateHud = function () {};
G.statsAddBuilt = function () {};
G.buildWorld();
var s = G.state;
var fails = 0;
function check(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }
var g = G.BUILD_GRID;

// Cellule libre (ni batiment ni mur) autour de (px,py), en spirale sur les
// centres de cellule. Renvoie [cx, cy] (centre) ou null.
function freeCell(px, py, w, h) {
  for (var r = 0; r < 6000; r += g) {
    for (var a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      var wx = px + Math.cos(a) * r, wy = py + Math.sin(a) * r;
      var sn = G.snapToGrid(wx, wy);
      var mx = sn[0] - w / 2, my = sn[1] - h / 2;
      var hit = false;
      for (var i = 0; i < s.buildings.length; i++) {
        var b = s.buildings[i];
        if (mx < b.x + b.w && mx + w > b.x && my < b.y + b.h && my + h > b.y) { hit = true; break; }
      }
      if (!hit) for (var j = 0; j < s.walls.length; j++) {
        var m = s.walls[j];
        if (!m.built) continue;
        if (mx < m.x + m.w && mx + w > m.x && my < m.y + m.h && my + h > m.y) { hit = true; break; }
      }
      if (!hit) return sn;
    }
  }
  return null;
}

s.buildMode = true;
s.player.x = 5000; s.player.y = 5000;
s.planks = 100000;

// --- 1. Deux palissades sur le MEME losange : autorise (superposition) ---
s.walls.length = 0; G.rebuildWallGrid();
var spot = freeCell(5000, 5000, g, g);
if (!spot) { console.log("FAIL: pas de cellule libre"); process.exit(1); }
s.plankRotation = 0; // verticale (trait /)
var ok1 = G.tryBuildWall(spot[0], spot[1]);
check(ok1 === true, "1re palissade posee sur le losange");
s.plankRotation = 1; // horizontale (trait \) : meme cellule, perpendiculaire
var ok2 = G.tryBuildWall(spot[0], spot[1]);
check(ok2 === true, "2e palissade (perpendiculaire) sur le MEME losange : autorise (superposition mur/mur)");
check(s.walls.length === 2, "2 palissades presentes sur le losange");
// Les deux partagent le meme centre de cellule.
var wA = s.walls[0], wB = s.walls[1];
check(Math.abs((wA.x + wA.w / 2) - spot[0]) < 0.001 && Math.abs((wB.x + wB.w / 2) - spot[0]) < 0.001,
  "les 2 palissades sont centrees sur le meme losange");

// --- 2. Tour refuse sur un losange contenant une palissade ---
// Nettoie les batiments existants pour isoler le test (on garde les murs).
var savedBuildings = s.buildings;
s.buildings = [];
if (G.rebuildBuildingGrid) G.rebuildBuildingGrid();
// La scierie doit etre construite pour poser une tour.
s.scierie = { x: spot[0], y: spot[1], w: 10, h: 10, chantierDone: true };
s.mairieGold = 10000;
// Tour sur le losange contenant les 2 palissades : refuse (towerSpotFree).
s.buildSel = "tour:bois";
var tSide = G.towerSide("bois");
var okTourOnWall = G.placeFromBuildMenu(spot[0], spot[1]);
check(okTourOnWall === false, "tour REFUSEE sur un losange contenant une palissade");
check(s.towers.length === 0, "aucune tour posee sur le losange occupe");

// Tour sur un losange LIBRE (sans mur) : accepte.
var spotFree = freeCell(8000, 8000, tSide, tSide);
if (!spotFree) { console.log("FAIL: pas de cellule libre pour la tour"); process.exit(1); }
s.buildSel = "tour:bois"; // re-selectionne (la pose precedente a remis buildSel a null)
var okTour = G.placeFromBuildMenu(spotFree[0], spotFree[1]);
check(okTour === true, "tour acceptee sur un losange libre (sans palissade)");
check(s.towers.length === 1, "1 tour posee");
var tw = s.towers[0];

// --- 3. Deuxieme tour sur le MEME losange : refusee ---
s.buildSel = "tour:bois"; // re-selectionne
var okTour2 = G.placeFromBuildMenu(spotFree[0], spotFree[1]);
check(okTour2 === false, "2e tour REFUSEE sur le meme losange (deja occupe)");
check(s.towers.length === 1, "toujours 1 seule tour sur ce losange");

// Tour sur un losange voisin (libre) : acceptee.
var spotFree2 = freeCell(spotFree[0] + g * 4, spotFree[1], tSide, tSide);
if (spotFree2) {
  s.buildSel = "tour:bois"; // re-selectionne
  var okTour3 = G.placeFromBuildMenu(spotFree2[0], spotFree2[1]);
  check(okTour3 === true, "tour acceptee sur un losange voisin libre");
}

// --- 4. Scierie (batiment de ville) : unique, refuse si deja posee ---
// On remet les batiments pour le test de la scierie (qui verifie inTown).
s.buildings = savedBuildings;
if (G.rebuildBuildingGrid) G.rebuildBuildingGrid();
// Trouve une cellule en ville libre pour la scierie.
var scSpot = null;
for (var x = g; x < G.WORLD && !scSpot; x += g) {
  for (var y = g; y < G.WORLD; y += g) {
    if (!G.inTown(x, y)) continue;
    if (G.towerSpotFree(x - 32, y - 32, 64, 64)) { scSpot = [x, y]; break; }
  }
}
if (!scSpot) { console.log("FAIL: pas de cellule libre pour la scierie"); process.exit(1); }
s.scierie = null; // reset : on va la poser via le menu
s.scierieUnlocked = true;
s.buildSel = "scierie"; // re-selectionne explicitement
var okSc = G.placeFromBuildMenu(scSpot[0], scSpot[1]);
check(okSc === true, "scierie posee sur un losange libre en ville");
// Deuxieme scierie (meme losange ou autre) : refusee car state.scierie existe.
s.buildSel = "scierie";
var okSc2 = G.placeFromBuildMenu(scSpot[0], scSpot[1]);
check(okSc2 === false, "2e scierie REFUSEE (batiment de ville unique)");

// --- 5. Batiment de ville refuse sur un losange contenant une palissade ---
// Pose une palissade en ville sur une cellule libre, puis tente la scierie.
var scSpot2 = null;
for (var x2 = g; x2 < G.WORLD && !scSpot2; x2 += g) {
  for (var y2 = g; y2 < G.WORLD; y2 += g) {
    if (!G.inTown(x2, y2)) continue;
    if (G.towerSpotFree(x2 - 32, y2 - 32, 64, 64)) { scSpot2 = [x2, y2]; break; }
  }
}
if (scSpot2) {
  // Pose une palissade verticale sur ce losange (elle occupe la cellule).
  s.plankRotation = 0;
  var dims = G.plankDims();
  var mx = scSpot2[0] - dims.w / 2, my = scSpot2[1] - dims.h / 2;
  // Verifie que la cellule est libre pour la palissade (pas de batiment).
  var wallOk = G.tryBuildWall(scSpot2[0], scSpot2[1]);
  if (wallOk === true) {
    // Maintenant la scierie doit etre refusee sur ce losange (mur present).
    s.scierie = null;
    s.buildSel = "scierie";
    var okScOnWall = G.placeFromBuildMenu(scSpot2[0], scSpot2[1]);
    check(okScOnWall === false, "scierie REFUSEE sur un losange contenant une palissade");
  }
}

console.log(fails === 0 ? "ALL_OK" : (fails + " ECHEC(S)"));
process.exit(fails === 0 ? 0 : 1);

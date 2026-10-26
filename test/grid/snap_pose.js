// Grille de construction : snap de toutes les poses joueur sur G.BUILD_GRID.
// Verifie :
//   1. G.snapToGrid / G.buildCellAt (coins, centre, cellule la plus proche)
//   2. tryBuildWall (palissade) : centre snappe, rotation h/v, cellule occupee
//      en longueur exacte (deux palissades adjacentes se touchent sans trou)
//   3. placeFromBuildMenu : tour et batiment de ville snappes (centre sur
//      une cellule), quel que soit le point clique
//   4. L'apercu drawBuildHint dessine l'emprise SNAPPEE (centre = cellule)
//   5. drawBuildGrid ne dessine que hors buildMode (garde d'affichage)
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
// Stub canvas 2D enregistreur : capture les appels de dessin pour verifier
// le centre de l'apercu du hint de pose.
var calls = { stroke: 0, paths: [], setLineDash: [], fillText: [] };
var ctxStub = {
  setTransform: function () {}, fillRect: function () {}, strokeRect: function () {},
  clearRect: function () {}, beginPath: function () { calls.paths.push([]); calls._cur = calls.paths[calls.paths.length - 1]; },
  closePath: function () {},
  moveTo: function (x, y) { calls._cur.push([x, y]); },
  lineTo: function (x, y) { calls._cur.push([x, y]); },
  arc: function () {}, fill: function () {},
  stroke: function () { calls.stroke++; },
  save: function () {}, restore: function () {},
  translate: function () {}, rotate: function () {}, scale: function () {},
  drawImage: function () {},
  fillText: function (t, x, y) { calls.fillText.push({ t: t, x: x, y: y }); },
  strokeText: function () {},
  measureText: function () { return { width: 10 }; },
  setLineDash: function (d) { calls.setLineDash.push(d); },
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

// --- 1. Helpers purs ---
var g = G.BUILD_GRID;
check(g === 120, "BUILD_GRID = 120 (taille d'une palissade)");
var sp = G.snapToGrid(37, -23);
check(sp[0] === 0 && sp[1] === 0, "snapToGrid(37,-23) = (0,0) obtenu " + sp.join(","));
sp = G.snapToGrid(61, 121);
check(sp[0] === 120 && sp[1] === 120, "snapToGrid(61,121) = (120,120) obtenu " + sp.join(","));
var cell = G.buildCellAt(200, 200);
check(cell.cx === 240 && cell.cy === 240 && cell.x === 180 && cell.y === 180 &&
      cell.w === g && cell.h === g, "buildCellAt(200,200) centre (240,240) coin (180,180)");

// --- 2. tryBuildWall : snap palissade ---
s.buildMode = true;
s.player.x = 5000; s.player.y = 5000;
s.planks = 1000;
// Point libre garanti : spirale sur les centres de cellule.
function freeCell(px, py, w, h) {
  for (var r = 0; r < 4000; r += g) {
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
        if (mx < m.x + m.w && mx + w > m.x && my < m.y + m.h && my + h > m.y) { hit = true; break; }
      }
      if (!hit) return sn;
    }
  }
  return null;
}
// Palissade verticale (rotation 0, trait /) : clic decale, centre snappe.
s.plankRotation = 0;
var dims = G.plankDims();
var spot = freeCell(5000, 5000, dims.w, dims.h);
if (!spot) { console.log("FAIL: pas de cellule libre"); process.exit(1); }
var nW = s.walls.length;
var ok = G.tryBuildWall(spot[0] + 37, spot[1] - 23);
check(ok === true, "tryBuildWall accepte le clic decale");
check(s.walls.length === nW + 1, "palissade ajoutee");
var w1 = s.walls[s.walls.length - 1];
var exp = G.snapToGrid(spot[0] + 37, spot[1] - 23);
check(w1.x + w1.w / 2 === exp[0] && w1.y + w1.h / 2 === exp[1],
  "palissade centree sur la cellule snappee (" + exp.join(",") + ") obtenu (" +
  (w1.x + w1.w / 2) + "," + (w1.y + w1.h / 2) + ")");
// Une palissade occupe exactement une cellule en longueur : cote = BUILD_GRID.
check(dims.w === g || dims.h === g, "la longueur d'une palissade = BUILD_GRID (" + dims.w + "x" + dims.h + ")");
// Deuxieme palissade verticale dans la cellule voisine en y : bords qui se touchent.
var dimsV = G.plankDims();
var spot2 = freeCell(exp[0], exp[1] + g, dimsV.w, dimsV.h);
if (spot2 && spot2[0] === exp[0] && spot2[1] === exp[1] + g) {
  G.tryBuildWall(spot2[0], spot2[1]);
  var w2 = s.walls[s.walls.length - 1];
  var touch = Math.abs((w1.y + w1.h) - w2.y) < 0.001 || Math.abs(w1.y - (w2.y + w2.h)) < 0.001;
  check(touch, "palissades verticales adjacentes se touchent sans trou ni chevauchement");
}
// Palissade horizontale (rotation 1, trait \) : pose + voisine en x qui se touche.
s.plankRotation = 1;
var dimsH = G.plankDims();
var spotH = freeCell(exp[0], exp[1] - 2 * g, dimsH.w, dimsH.h);
if (spotH) {
  G.tryBuildWall(spotH[0], spotH[1]);
  var wH = s.walls[s.walls.length - 1];
  var spotH2 = freeCell(spotH[0] + g, spotH[1], dimsH.w, dimsH.h);
  if (spotH2 && spotH2[0] === spotH[0] + g && spotH2[1] === spotH[1]) {
    G.tryBuildWall(spotH2[0], spotH2[1]);
    var wH2 = s.walls[s.walls.length - 1];
    var touchH = Math.abs((wH.x + wH.w) - wH2.x) < 0.001 || Math.abs(wH.x - (wH2.x + wH2.w)) < 0.001;
    check(touchH, "palissades horizontales adjacentes se touchent sans trou ni chevauchement");
  }
}
s.plankRotation = 0;

// --- 3. placeFromBuildMenu : snap tour + batiment de ville ---
// La scierie est un batiment de VILLE unique : on la pose d'abord (elle rend
// les tours constructibles), on verifie son snap, puis on pose une tour.
s.buildSel = "scierie";
s.scierieUnlocked = true;
var scSpot = null;
for (var x = g; x < G.WORLD && !scSpot; x += g) {
  for (var y = g; y < G.WORLD; y += g) {
    if (!G.inTown(x, y)) continue;
    if (G.towerSpotFree(x - 32, y - 32, 64, 64)) { scSpot = [x, y]; break; }
  }
}
if (!scSpot) { console.log("FAIL: pas de cellule libre pour la scierie"); process.exit(1); }
var okS = G.placeFromBuildMenu(scSpot[0] - 29, scSpot[1] + 17);
check(okS === true, "placeFromBuildMenu scierie accepte le clic decale");
var sc = s.scierie;
check(sc.x + sc.w / 2 === scSpot[0] && sc.y + sc.h / 2 === scSpot[1],
  "scierie centree sur la cellule (" + scSpot.join(",") + ") obtenu (" +
  (sc.x + sc.w / 2) + "," + (sc.y + sc.h / 2) + ")");
s.scierie.chantierDone = true;
s.buildSel = "tour:bois";
s.mairieGold = 100; s.planks = 1000;
var tSpot = freeCell(7000, 7000, 84, 84);
if (!tSpot) { console.log("FAIL: pas de cellule libre pour la tour"); process.exit(1); }
var okT = G.placeFromBuildMenu(tSpot[0] + 41, tSpot[1] + 13);
check(okT === true, "placeFromBuildMenu tour accepte le clic decale");
var tw = s.towers[s.towers.length - 1];
check(tw.x + tw.w / 2 === tSpot[0] && tw.y + tw.h / 2 === tSpot[1],
  "tour centree sur la cellule (" + tSpot.join(",") + ") obtenu (" +
  (tw.x + tw.w / 2) + "," + (tw.y + tw.h / 2) + ")");

// --- 4. drawBuildHint : apercu snappe ---
G.state.buildMode = true;
G.state.buildSel = "palissade";
G.state.mouse.inside = true;
G.state.mouse.wx = exp[0] + 37; G.state.mouse.wy = exp[1] - 23;
G.state.camera.x = 5000; G.state.camera.y = 5000;
G.state.zoom = 4;
calls.paths = []; calls.fillText = [];
G.drawBuildHint();
// Le losange de l'apercu a 4 sommets ; le centre ecran = moyenne des sommets.
check(calls.paths.length === 1, "hint : un seul tracé (losange)");
var pts = calls.paths[0];
var cxS = 0, cyS = 0;
for (var pi = 0; pi < pts.length; pi++) { cxS += pts[pi][0]; cyS += pts[pi][1]; }
cxS /= pts.length; cyS /= pts.length;
var expScreen = G.proj(exp[0], exp[1]);
check(Math.abs(cxS - expScreen[0]) < 0.5 && Math.abs(cyS - expScreen[1]) < 0.5,
  "hint centre sur la cellule snappee (proj " + expScreen.join(",") + " obtenu (" + cxS + "," + cyS + "))");

// --- 5. drawBuildGrid : garde d'affichage + grille dessinee en mode build ---
calls.stroke = 0; calls.paths = [];
G.state.buildMode = false;
G.drawBuildGrid();
check(calls.stroke === 0, "hors mode build : aucune grille dessinee");
G.state.buildMode = true;
G.state.mouse.inside = true;
G.state.mouse.wx = 5000; G.state.mouse.wy = 5000;
G.drawBuildGrid();
check(calls.stroke >= 1, "mode build : grille dessinee (stroke=" + calls.stroke + ")");
// Pointilles sur les lignes de la grille (setLineDash avec un motif non vide).
var dashed = calls.setLineDash.some(function (d) { return d && d.length === 2; });
check(dashed, "grille en pointilles (setLineDash [4,4])");
// La cellule sous le curseur recoit un contour plein (setLineDash([])).
var solid = calls.setLineDash.some(function (d) { return d && d.length === 0; });
check(solid, "cellule sous le curseur en trait plein");

console.log(fails === 0 ? "ALL_OK" : "ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);

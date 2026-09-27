// Test: villes PNG - grille confinee au losange de sol + occlusion masque
// (vert = joueur derriere, transparent = joueur devant, rouge = solide)
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

// Grille reelle generee par ville-sync (RLE decode manuellement)
var grids = require(path.join(REPO, "server", "ville-grids.json"));
var rg = grids.est;
assert(!!rg, "ville-grids.json contient la ville est");
if (!rg) process.exit(1);
var data = new Uint8Array(rg.cols * rg.rows);
var p = 0;
for (var i = 0; i + 1 < rg.rle.length; i += 2) {
  for (var k = 0; k < rg.rle[i + 1] && p < data.length; k++) data[p++] = rg.rle[i];
}
G.villeGrids = { est: { cell: rg.cell, cols: rg.cols, rows: rg.rows, ox: rg.ox, oy: rg.oy, data: data } };
G.state = { villes: [{ name: "Ville de l'Est", sprite: "est", x: 6210, y: 4900, w: 200, h: 200, x2: 6410, y2: 5100, cx: 6310, cy: 5000 }] };

// 1) Cellules solides confinees au losange de sol (+1 cellule de marge)
var out = 0;
for (var gy = 0; gy < rg.rows; gy++) {
  for (var gx = 0; gx < rg.cols; gx++) {
    if (data[gy * rg.cols + gx] !== 1) continue;
    var wx = rg.ox + gx * rg.cell + rg.cell / 2;
    var wy = rg.oy + gy * rg.cell + rg.cell / 2;
    if (Math.abs(wx - 6310) + Math.abs(wy - 5000) > 100 + rg.cell) out++;
  }
}
assert(out === 0, "aucune cellule solide hors du losange de sol (+1 cellule)");

// 2) Le masque est respecte : vert non solide, rouge solide
assert(G.villeCell(6310, 5000) === 1, "centre (rouge) solide");
assert(G.villeCell(6230, 4980) === 2, "zone verte = derriere (non bloquante)");
assert(G.villeCell(6238, 4972) === 0, "zone transparente = libre");

// 3) villeCellInfo : modes d'occlusion au sol
var infoV = G.villeCellInfo(6230, 4980);
assert(infoV && infoV.mode === 1, "vert au sol -> mode 1 (joueur derriere)");
var infoT = G.villeCellInfo(6238, 4972);
assert(infoT && infoT.mode === 2, "transparent au sol -> mode 2 (joueur devant)");
var infoH = G.villeCellInfo(6000, 4800);
assert(infoH === null || infoH.mode === 0, "hors emprise -> mode 0 (tri naturel)");

// 4) villeGridFromPixels : la fonction pure filtre l'ELEVATION. Un masque
//    carre (iw = ih) a sa moitie haute au-dessus de l'horizon (contenu en
//    elevation) : peinte en rouge, elle ne doit produire AUCUNE cellule
//    solide ; seule la moitie basse (bande de sol) doit en produire.
var iw = 8, ih = 8, side = 200;
function makeMask(redTopHalf, redBottomHalf) {
  var rgba = new Uint8Array(iw * ih * 4);
  for (var yy = 0; yy < ih; yy++) {
    var inTop = yy < ih / 2;
    var red = (inTop && redTopHalf) || (!inTop && redBottomHalf);
    for (var xx = 0; xx < iw; xx++) {
      var k = (yy * iw + xx) * 4;
      if (red) { rgba[k] = 255; rgba[k + 1] = 0; rgba[k + 2] = 0; rgba[k + 3] = 255; }
    }
  }
  return rgba;
}
function solidCells(grid) {
  var n = 0;
  for (var ci = 0; ci < grid.data.length; ci++) if (grid.data[ci] === 1) n++;
  return n;
}
// Moitie haute rouge seule (elevation) : aucune collision
var gElev = G.villeGridFromPixels(iw, ih, makeMask(true, false), 6210, 4900, side, 8);
assert(solidCells(gElev) === 0, "elevation rouge seule -> 0 cellule solide (obtenu " + solidCells(gElev) + ")");
// Moitie basse rouge seule (bande de sol) : collisions presentes
var gGround = G.villeGridFromPixels(iw, ih, makeMask(false, true), 6210, 4900, side, 8);
assert(solidCells(gGround) > 0, "bande de sol rouge -> cellules solides presentes (obtenu " + solidCells(gGround) + ")");
// Masque entier : meme nombre que la bande seule (le haut est filtre)
var gFull = G.villeGridFromPixels(iw, ih, makeMask(true, true), 6210, 4900, side, 8);
assert(solidCells(gFull) === solidCells(gGround), "masque entier = bande de sol seule (elevation filtree)");

console.log(fails ? "FAIL ville/occlusion (" + fails + ")" : "PASS ville/occlusion");
process.exit(fails ? 1 : 0);

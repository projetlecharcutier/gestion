// Test: villes PNG - grille = echantillonnage inverse du masque ENTIER
// (vert = joueur derriere, transparent = joueur devant, rouge = solide).
// v3 : le filtre d'elevation est supprime -- les 2/3 des pixels rouges du
// masque projettent au NORD du carre d'emprise (tours, hautes facades) ;
// les exclure laissait le joueur marcher SUR ces facades sans collision
// et devant leur rendu. Toute la surface peinte du masque compte desormais.
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

// Geometrie de la ville (meme repere que villeGridFromPixels/drawVilleBand)
var X = 6210, Y = 4900, S = 200;
// Dimensions du masque lues dans sprite-meta.json (ville/est/ville_mask)
var meta = require(path.join(REPO, "server", "sprite-meta.json"));
var mm = meta["ville/est/ville_mask"];
var iw = mm.w, ih = mm.h;
var cx0 = (X - Y) / 2;
var groundY0 = (X + Y + 2 * S) / 4;
var losW = S;
var drawnH = S * ih / iw;

// Decodage du masque (PNG non entrelace 8-bit RGBA)
var zlib = require("zlib");
var d = fs.readFileSync(path.join(REPO, "assets", "sprites", "ville", "est", "ville_mask.png"));
assert(d[24] === 8 && d[25] === 6 && d[28] === 0, "masque PNG 8-bit RGBA non entrelace");
var idat = [], off = 8;
while (off + 8 <= d.length) {
  var len = d.readUInt32BE(off);
  var type = d.toString("ascii", off + 4, off + 8);
  if (type === "IDAT") idat.push(d.subarray(off + 8, off + 8 + len));
  off += 12 + len;
  if (type === "IEND") break;
}
var raw = zlib.inflateSync(Buffer.concat(idat));
var stride = iw * 4, line = new Uint8Array(stride), prev = new Uint8Array(stride);
var rgba = new Uint8Array(w2 = iw * ih * 4), pos = 0;
for (var y = 0; y < ih; y++) {
  var f = raw[pos++];
  for (var x = 0; x < stride; x++) {
    var v = raw[pos++];
    var a = x >= 4 ? line[x - 4] : 0, b = prev[x], c = x >= 4 ? prev[x - 4] : 0;
    if (f === 1) v = (v + a) & 255;
    else if (f === 2) v = (v + b) & 255;
    else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
    else if (f === 4) { var pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = (v + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 255; }
    line[x] = v;
  }
  rgba.set(line, y * stride);
  prev.set(line);
}
function maskVal(px, py) {
  if (px < 0 || py < 0 || px >= iw || py >= ih) return 0;
  var k = (py * iw + px) * 4;
  if (rgba[k + 3] < 128) return 0;
  if (rgba[k] > 180 && rgba[k + 1] < 90) return 1;
  if (rgba[k + 1] > 180 && rgba[k] < 90) return 2;
  return 0;
}
function gridAt(wx, wy) {
  var gx = Math.floor((wx - rg.ox) / rg.cell), gy = Math.floor((wy - rg.oy) / rg.cell);
  if (gx < 0 || gy < 0 || gx >= rg.cols || gy >= rg.rows) return 0;
  return data[gy * rg.cols + gx];
}

// 1) COUVERTURE : chaque pixel rouge/vert du masque ENTIER (y compris
//    l'elevation, moitie haute) a sa cellule correspondante dans la grille.
var redTot = 0, redMiss = 0, grnTot = 0, grnMiss = 0;
for (var py = 0; py < ih; py++) {
  for (var px = 0; px < iw; px++) {
    var val = maskVal(px, py);
    if (!val) continue;
    var sx = cx0 - losW / 2 + ((px + 0.5) / iw) * losW;
    var sy = groundY0 - drawnH + ((py + 0.5) / ih) * drawnH;
    var wx = sx + 2 * sy, wy = 2 * sy - sx;
    var gv = gridAt(wx, wy);
    if (val === 1) { redTot++; if (gv !== 1) redMiss++; }
    else { grnTot++; if (gv === 0) grnMiss++; }
  }
}
assert(redTot > 0, "masque avec pixels rouges");
assert(redMiss === 0, "tout pixel rouge a sa cellule solide (obtenu " + redMiss + "/" + redTot + ")");
assert(grnMiss === 0, "tout pixel vert a sa cellule (derriere)");

// 2) EXACTITUDE : aucune cellule rouge de la grille ne ment -- chaque
//    cellule solide se reprojette sur un pixel rouge du masque.
var gridRed = 0, gridRedBad = 0;
for (var gy2 = 0; gy2 < rg.rows; gy2++) {
  for (var gx2 = 0; gx2 < rg.cols; gx2++) {
    if (data[gy2 * rg.cols + gx2] !== 1) continue;
    gridRed++;
    var wxC = rg.ox + gx2 * rg.cell + rg.cell / 2;
    var wyC = rg.oy + gy2 * rg.cell + rg.cell / 2;
    var sx = (wxC - wyC) * 0.5, sy = (wxC + wyC) * 0.25;
    var fx = (sx - (cx0 - losW / 2)) / losW * iw;
    var fy = (sy - (groundY0 - drawnH)) / drawnH * ih;
    if (maskVal(Math.floor(fx), Math.floor(fy)) !== 1) gridRedBad++;
  }
}
assert(gridRed > 0, "grille avec cellules solides");
assert(gridRedBad === 0, "aucune cellule solide sans pixel rouge (obtenu " + gridRedBad + "/" + gridRed + ")");

// 3) ELEVATION COUVERTE : la moitie haute du masque (py < ih/2, projettee
//    au nord du carre d'emprise) produit des cellules solides -- le joueur
//    au pied d'une tour peinte rouge est bloque (regression du filtre
//    d'elevation qui laissait traverser ces facades).
var elevSolid = 0;
for (var py2 = 0; py2 < ih / 2; py2++) {
  for (var px2 = 0; px2 < iw; px2++) {
    if (maskVal(px2, py2) !== 1) continue;
    var sx2 = cx0 - losW / 2 + ((px2 + 0.5) / iw) * losW;
    var sy2 = groundY0 - drawnH + ((py2 + 0.5) / ih) * drawnH;
    var wx2 = sx2 + 2 * sy2, wy2 = 2 * sy2 - sx2;
    if (gridAt(wx2, wy2) === 1) elevSolid++;
  }
}
assert(elevSolid > 0, "l'elevation rouge produit des cellules solides (obtenu " + elevSolid + ")");

// 4) villeCellInfo : modes d'occlusion sur TOUTE la bbox (emprise + nord)
//    -- le joueur au pied d'une facade haute doit etre en mode 1 ou 2,
//    jamais 0 (tri naturel le faisait apparaitre SUR le PNG).
function cellCenter(gy, gx) { return [rg.ox + gx * rg.cell + rg.cell / 2, rg.oy + gy * rg.cell + rg.cell / 2]; }
var behindPt = null, freePt = null;
for (var gy3 = 0; gy3 < rg.rows && (!behindPt || !freePt); gy3++) {
  for (var gx3 = 0; gx3 < rg.cols; gx3++) {
    var v2 = data[gy3 * rg.cols + gx3];
    var wpt = cellCenter(gy3, gx3);
    if (v2 === 2 && !behindPt) behindPt = wpt;
    else if (v2 === 0 && !freePt) freePt = wpt;
    if (behindPt && freePt) break;
  }
}
assert(!!behindPt, "grille : au moins une cellule derriere (verte)");
assert(!!freePt, "grille : au moins une cellule libre");
if (behindPt) {
  var infoV = G.villeCellInfo(behindPt[0], behindPt[1]);
  assert(infoV && infoV.mode === 1, "vert -> mode 1 (joueur derriere), meme hors du carre d'emprise");
}
if (freePt) {
  var infoT = G.villeCellInfo(freePt[0], freePt[1]);
  assert(infoT && infoT.mode === 2, "transparent -> mode 2 (joueur devant), meme hors du carre d'emprise");
}

// 5) villeGridFromPixels (fonction pure) : meme comportement que le stash
//    -- un masque carre rouge a moitie haute (elevation) doit produire des
//    cellules solides AUSSI dans la moitie haute.
var iw2 = 8, ih2 = 8, side2 = 200;
var rgba2 = new Uint8Array(iw2 * ih2 * 4);
for (var yy = 0; yy < ih2; yy++) {
  for (var xx = 0; xx < iw2; xx++) {
    var k2 = (yy * iw2 + xx) * 4;
    rgba2[k2] = 255; rgba2[k2 + 1] = 0; rgba2[k2 + 2] = 0; rgba2[k2 + 3] = 255;
  }
}
var gFull = G.villeGridFromPixels(iw2, ih2, rgba2, X, Y, side2, 8);
var nFull = 0;
for (var ci = 0; ci < gFull.data.length; ci++) if (gFull.data[ci] === 1) nFull++;
assert(nFull > 0, "masque rouge ENTIER (elevation incluse) -> cellules solides");

console.log(fails ? "FAIL ville/occlusion (" + fails + ")" : "PASS ville/occlusion");
process.exit(fails ? 1 : 0);

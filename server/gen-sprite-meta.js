#!/usr/bin/env node
// Génère server/sprite-meta.json : pour chaque PNG de assets/sprites/,
// la taille (w, h) et la bounding box des pixels opaques (bounds, alpha > 10).
// Le serveur utilise ce fichier pour construire EXACTEMENT le même monde que
// le client (dimensions des objets = PNG * 2, collisions = zone opaque via
// shrinkToOpaque), sans charger d'images.
//
// Usage : node server/gen-sprite-meta.js  (à relancer après tout ajout/
// modification de PNG ; commité avec le reste, ou regénéré par update.sh).
var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

// Decode RGBA complet d'un PNG non entrelace 8-bit couleur+alpha.
// Retourne { w, h, rgba } ou null si le format n'est pas supporte.
function pngRGBA(d) {
  var w = d.readUInt32BE(16), h = d.readUInt32BE(20);
  var bd = d[24], ct = d[25], interlace = d[28];
  if (bd !== 8 || ct !== 6 || interlace !== 0) return null;
  var off = 8, idat = [];
  while (off + 8 <= d.length) {
    var len = d.readUInt32BE(off);
    var type = d.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idat.push(d.subarray(off + 8, off + 8 + len));
    off += 12 + len;
    if (type === "IEND") break;
  }
  var raw = zlib.inflateSync(Buffer.concat(idat));
  var stride = w * 4;
  var line = new Uint8Array(stride);
  var prevLine = new Uint8Array(stride);
  var rgba = new Uint8Array(w * h * 4);
  var pos = 0;
  for (var y = 0; y < h; y++) {
    var f = raw[pos++];
    for (var x = 0; x < stride; x++) {
      var v = raw[pos++];
      var a = x >= 4 ? line[x - 4] : 0;
      var b = prevLine[x];
      var c = x >= 4 ? prevLine[x - 4] : 0;
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        var pp = a + b - c;
        var pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v = (v + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 255;
      }
      line[x] = v;
    }
    rgba.set(line, y * stride);
    prevLine.set(line);
  }
  return { w: w, h: h, rgba: rgba };
}

function pngMeta(p) {
  var d = fs.readFileSync(p);
  var w = d.readUInt32BE(16), h = d.readUInt32BE(20);
  var bd = d[24], ct = d[25], interlace = d[28];
  var bounds = null;
  if (bd === 8 && ct === 6 && interlace === 0) {
    var off = 8, idat = [];
    while (off + 8 <= d.length) {
      var len = d.readUInt32BE(off);
      var type = d.toString("ascii", off + 4, off + 8);
      if (type === "IDAT") idat.push(d.subarray(off + 8, off + 8 + len));
      off += 12 + len;
      if (type === "IEND") break;
    }
    var raw = zlib.inflateSync(Buffer.concat(idat));
    var stride = w * 4;
    var line = new Uint8Array(stride);
    var prevLine = new Uint8Array(stride);
    var minx = w, maxx = -1, miny = h, maxy = -1;
    var pos = 0;
    for (var y = 0; y < h; y++) {
      var f = raw[pos++];
      for (var x = 0; x < stride; x++) {
        var v = raw[pos++];
        var a = x >= 4 ? line[x - 4] : 0;
        var b = prevLine[x];
        var c = x >= 4 ? prevLine[x - 4] : 0;
        if (f === 1) v = (v + a) & 255;
        else if (f === 2) v = (v + b) & 255;
        else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
        else if (f === 4) {
          var pp = a + b - c;
          var pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = (v + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 255;
        }
        line[x] = v;
      }
      for (var px = 0; px < w; px++) {
        if (line[px * 4 + 3] > 10) {
          if (px < minx) minx = px;
          if (px > maxx) maxx = px;
          if (y < miny) miny = y;
          if (y > maxy) maxy = y;
        }
      }
      prevLine.set(line);
    }
    if (maxx >= 0) bounds = { x0: minx, y0: miny, x1: maxx, y1: maxy };
  }
  return { w: w, h: h, bounds: bounds };
}

var root = path.join(__dirname, "..", "assets", "sprites");
var out = {};
(function walk(dir) {
  fs.readdirSync(dir).forEach(function (f) {
    var p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { walk(p); return; }
    if (f.slice(-4).toLowerCase() !== ".png") return;
    var rel = path.relative(root, p).split(path.sep).join("/").replace(/\.png$/, "");
    out[rel] = pngMeta(p);
  });
})(root);

fs.writeFileSync(path.join(__dirname, "sprite-meta.json"), JSON.stringify(out));
console.log("sprite-meta.json : " + Object.keys(out).length + " sprites");

// --- Grilles de collision des villes PNG (server/ville-grids.json) ---
// Pour chaque ville de VILLE_DEFS (src/config.js) dont le masque
// assets/sprites/ville/<sprite>/ville_mask.png existe, decode le masque et
// construit la grille MONDE avec la MEME fonction pure que le client
// (src/ville.js villeGridFromPixels charge par eval) -> parite exacte des
// collisions client/serveur. Encodage RLE pour rester compact.
global.window = global;
var Gv = global.GAME = global.GAME || {};
(0, eval)(fs.readFileSync(path.join(__dirname, "..", "src", "config.js"), "utf8"));
(0, eval)(fs.readFileSync(path.join(__dirname, "..", "src", "ville.js"), "utf8"));
var grids = {};
var defs = Gv.VILLE_DEFS || [];
var nGrids = 0;
for (var di = 0; di < defs.length; di++) {
  var dname = (defs[di].sprite || defs[di].name || "").replace(/[^a-z0-9_-]/gi, "_");
  if (!dname) continue;
  var maskPath = path.join(__dirname, "..", "assets", "sprites", "ville", dname, "ville_mask.png");
  if (!fs.existsSync(maskPath)) continue;
  var dec = pngRGBA(fs.readFileSync(maskPath));
  if (!dec) { console.error("ville " + dname + " : masque PNG non supporte (8-bit RGBA non entrelasse requis)"); continue; }
  var side = Gv.villeSideFor(dec.w, defs[di]);
  if (side <= 0) continue;
  var grid = Gv.villeGridFromPixels(dec.w, dec.h, dec.rgba, defs[di].x || 0, defs[di].y || 0, side, Gv.VILLE_GRID_CELL);
  if (!grid) { console.error("ville " + dname + " : grille invalide"); continue; }
  grids[dname] = {
    cell: grid.cell, cols: grid.cols, rows: grid.rows, ox: grid.ox, oy: grid.oy,
    rle: Array.prototype.slice.call(Gv.villeRLEEncode(grid.data))
  };
  nGrids++;
}
fs.writeFileSync(path.join(__dirname, "ville-grids.json"), JSON.stringify(grids));
console.log("ville-grids.json : " + nGrids + " grille(s)");

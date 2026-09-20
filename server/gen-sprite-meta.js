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

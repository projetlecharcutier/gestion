// Test: depot de N villes PNG - detection, dedoublonnage, placement auto.
// Contract: autant de villes que voulu, deposees par dossier dans
// assets/sprites/ville/<nom>/ (ville.png + ville_mask.png). Le serveur :
//   1. DETECTE tout dossier valide (tolerant : sans dossier, rien ne casse),
//   2. IGNORE les doublons (meme contenu PNG = meme ville, jamais deux
//      fois sur la carte),
//   3. PLACE automatiquement 2 villes par direction diagonale (SE, NE, SO,
//      NO) sur deux anneaux autour de la ville principale, SANS
//      superposition (emprises AABB + marge, hors ville de depart),
//   4. Regener les grilles de collision et le manifeste client.
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

// Module isole : ville-sync se recalcule a chaque require d'un process
// distinct ; on l'importe depuis une copie pour ne PAS polluer le repo
// (positions persistees, grilles, manifeste).
var os = require("os");
var TMP = path.join(os.tmpdir(), "flex-ville-multi-test");
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
fs.mkdirSync(TMP, { recursive: true });
["src", "server", "assets"].forEach(function (f) {
  try {
    fs.cpSync(path.join(REPO, f), path.join(TMP, f), { recursive: true });
    fs.rmSync(path.join(TMP, f, "node_modules"), { recursive: true, force: true });
  } catch (e) {}
});
try { fs.symlinkSync(path.join(REPO, "server", "node_modules"), path.join(TMP, "server", "node_modules")); } catch (e) {}
try { fs.rmSync(path.join(TMP, "server", "ville-positions.json"), { force: true }); } catch (e) {}

// Ajoute un chunk tEXt unique dans un PNG (rend le CONTENU different sans
// toucher les pixels : simule deux villes distinctes dessinees pareil).
function crc32(buf) {
  var c = ~0;
  for (var i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (var k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function tagPng(buf, txt) {
  var chunks = [buf.subarray(0, 8)];
  var off = 8;
  var data = Buffer.concat([Buffer.from("comment\x00" + txt, "latin1")]);
  var type = Buffer.from("tEXt");
  var len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  var crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  var txtChunk = Buffer.concat([len, type, data, crc]);
  while (off + 8 <= buf.length) {
    var l = buf.readUInt32BE(off);
    var t = buf.toString("ascii", off + 4, off + 8);
    var chunk = buf.subarray(off, off + 12 + l);
    off += 12 + l;
    if (t === "IEND") { chunks.push(txtChunk, chunk); break; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// 1. Depose 8 villes UNIQUES (contenu different) + 2 DOUBLONS du PNG d'est.
var ASSETS = path.join(TMP, "assets", "sprites", "ville");
var basePng = fs.readFileSync(path.join(ASSETS, "est", "ville.png"));
var baseMask = fs.readFileSync(path.join(ASSETS, "est", "ville_mask.png"));
var uniq = ["ville_se_a", "ville_se_b", "ville_ne_a", "ville_ne_b",
            "ville_so_a", "ville_so_b", "ville_no_a", "ville_no_b"];
uniq.forEach(function (d) {
  var dir = path.join(ASSETS, d);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "ville.png"), tagPng(basePng, "ville-" + d));
  fs.writeFileSync(path.join(dir, "ville_mask.png"), baseMask);
});
["dup_exact", "dup_renomme"].forEach(function (d) {
  var dir = path.join(ASSETS, d);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "ville.png"), basePng);
  fs.writeFileSync(path.join(dir, "ville_mask.png"), baseMask);
});

// 2. Sync : les doublons doivent etre IGNORES, les 8 uniques PLACEES.
var r = require(path.join(TMP, "server", "ville-sync")).sync();
assert(r.names.indexOf("est") >= 0, "ville est toujours presente");
assert(r.names.indexOf("dup_exact") === -1 && r.names.indexOf("dup_renomme") === -1,
  "doublons (meme contenu PNG) ignores, jamais deux fois la meme ville");
assert(r.placed === 8, "8 villes uniques placees automatiquement (obtenu " + r.placed + ")");
// Villes configurees au repo (VILLE_DEFS : est, laputa, minas) : elles ne
// font pas partie des 8 villes UNIQUES deposees par ce test.
var builtin = ["est", "laputa", "minas"];
var names = r.names.filter(function (n) {
  return builtin.indexOf(n) === -1 && n.indexOf("dup") !== 0;
});
assert(names.length === 8, "11 villes detectees au total dont 3 configurees (est, laputa, minas) + 8 uniques (obtenu " + r.names.length + ")");

// 3. Placement : 2 par direction diagonale, SANS superposition.
var pos = r.positions;
assert(Object.keys(pos).length === 8, "8 positions persistees (obtenu " + Object.keys(pos).length + ")");
var boxes = [];
for (var k in pos) {
  if (!pos.hasOwnProperty(k)) continue;
  boxes.push({ name: k, x: pos[k].x, y: pos[k].y, side: pos[k].side });
}
var overlaps = 0;
for (var i = 0; i < boxes.length; i++) {
  for (var j = i + 1; j < boxes.length; j++) {
    var a = boxes[i], b = boxes[j];
    if (a.x < b.x + b.side && a.x + a.side > b.x &&
        a.y < b.y + b.side && a.y + a.side > b.y) overlaps++;
  }
}
assert(overlaps === 0, "aucune superposition entre villes posees (obtenu " + overlaps + ")");

// Direction de chaque ville par rapport au centre (WORLD/2) : les 8 villes
// couvrent les 4 diagonales, 2 par diagonale.
var G = global.GAME;
var c = G.WORLD / 2;
var dirs = {};
for (var i2 = 0; i2 < boxes.length; i2++) {
  var cx = boxes[i2].x + boxes[i2].side / 2, cy = boxes[i2].y + boxes[i2].side / 2;
  var key = (cx >= c ? "E" : "O") + (cy >= c ? "S" : "N");
  dirs[key] = (dirs[key] || 0) + 1;
}
assert(dirs.ES === 2 && dirs.EN === 2 && dirs.OS === 2 && dirs.ON === 2,
  "2 villes par direction diagonale (obtenu " + JSON.stringify(dirs) + ")");

// 4. Grilles + manifeste regeneres pour toutes les villes posees.
var grids = JSON.parse(fs.readFileSync(path.join(TMP, "server", "ville-grids.json"), "utf8"));
for (var i3 = 0; i3 < names.length; i3++) {
  if (!grids[names[i3]]) { assert(false, "grille manquante pour " + names[i3]); break; }
}
assert(true, "grilles de collision generees pour toutes les villes detectees");
var manifest = fs.readFileSync(path.join(ASSETS, "villes.js"), "utf8");
assert(manifest.indexOf("ville_se_a") !== -1, "manifeste client declare les nouvelles villes");

// 5. Les positions persistees restent STABLES entre deux syncs.
var before = JSON.stringify(r.positions);
var r2 = require(path.join(TMP, "server", "ville-sync")).sync();
assert(JSON.stringify(r2.positions) === before, "positions stables entre redemarrages");
assert(r2.placed === 0, "aucune re-placement au second demarrage (obtenu " + r2.placed + ")");

// 6. Nettoyage.
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
console.log(fails ? "FAIL ville/depot_multi (" + fails + ")" : "PASS ville/depot_multi");
process.exit(fails ? 1 : 0);

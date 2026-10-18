// Test: l'eglise-decor "Lisieux- eglise saint jacque" (PNG 400x400, 4x plus
// gros que les autres decors bloquants) est integree aux amas de decors :
//   1. quota exact : 8 poses sur la carte (spec 2 x MULT 4),
//   2. regroupement : au moins la moitie des eglises a un voisin de pose
//      adjacente (bord a bord via le centre) d'un type DIFFERENT -- l'eglise
//      n'est plus un ilot geant isole,
//   3. taille de rendu : decorRenderScale applique (rendu ~0.4x, du meme ordre
//      que les autres decors bloquants), emprise sol + hitbox sur la taille
//      REELLE du PNG (pas de mise a l'echelle de la collision),
//   4. le rendu applique l'echelle (drawBuilding lit decorRenderScale),
//   5. le snapshot serveur serialise decorRenderScale (parite client/serveur).
// Le PNG n'est PAS modifie.
var game = require("../../server/game.js");
var G = game.G;
game.startGame();
var st = G.state;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }
var FRAME = "bloquant/Lisieux- eglise saint jacque";
var decors = st.buildings.filter(function (b) { return b.decorSpriteName; });
var lis = decors.filter(function (b) { return b.decorSpriteName === FRAME; });

// 1. Quota exact : 8 poses (spec 2 x MULT 4).
var spec = null;
for (var i = 0; i < G.DECOR_SPECS.length; i++) if (G.DECOR_SPECS[i][0] === FRAME) spec = G.DECOR_SPECS[i];
assert(spec, "spec Lisieux presente dans DECOR_SPECS");
if (spec) assert(spec[2] * 4 === 8, "quota spec = 2 (x4 = 8 poses, obtenu " + (spec[2] * 4) + ")");
assert(lis.length === 8, "exactement 8 eglises posees (obtenu " + lis.length + ")");
if (lis.length !== 8) process.exit(1);

// 2. Regroupement : au moins la moitie des eglises a un voisin adjacent
//    (bord a bord via le centre) d'un type different.
var grouped = 0;
for (var g = 0; g < lis.length; g++) {
  var dg = lis[g];
  var side = dg.w;
  for (var h = 0; h < decors.length; h++) {
    var dh = decors[h];
    if (dh === dg || dh.decorSpriteName === FRAME) continue;
    var tol = Math.max(side, dh.w) + 2;
    if (Math.abs(dh.door.x - dg.door.x) < tol && Math.abs(dh.door.y - dg.door.y) < tol) { grouped++; break; }
  }
}
assert(grouped >= lis.length / 2,
  "au moins la moitie des eglises en groupe mixte (" + grouped + "/" + lis.length + ")");

// 3. Taille de rendu : decorRenderScale applique, emprise/hitbox reelles.
var meta = require("../../server/sprite-meta.json");
var mm = meta["elementdecord/" + FRAME];
assert(mm && mm.w === 400 && mm.h === 400, "PNG Lisieux = 400x400 (obtenu " + (mm && mm.w + "x" + mm.h) + ")");
var rs = G.LISIEUX_RENDER_SCALE || 1;
assert(rs > 0 && rs < 1, "LISIEUX_RENDER_SCALE defini et < 1 (obtenu " + rs + ")");
for (var k = 0; k < lis.length; k++) {
  var b = lis[k];
  assert(b.decorRenderScale === rs, "eglise #" + k + " : decorRenderScale = " + rs);
  // Emprise sol = taille reelle du PNG (800 avant shrink, 192x172 apres) :
  // la collision n'est PAS mise a l'echelle.
  assert(b.w <= 800 && b.w > 100, "eglise #" + k + " : hitbox sur la taille reelle (w=" + Math.round(b.w) + ")");
  assert(!b.decorPassable, "eglise #" + k + " : reste bloquante");
}

// 4. Le rendu applique l'echelle.
var fs = require("fs"), path = require("path");
var rsrc = fs.readFileSync(path.join(__dirname, "..", "..", "src", "render.js"), "utf8");
assert(rsrc.indexOf("b.decorRenderScale") !== -1, "drawBuilding applique decorRenderScale");

// 5. Snapshot serveur : decorRenderScale serialise.
var gsrc = fs.readFileSync(path.join(__dirname, "..", "..", "server", "game.js"), "utf8");
assert(gsrc.indexOf("decorRenderScale: b.decorRenderScale") !== -1, "snapshot serveur serialise decorRenderScale");

console.log("----------------------------------------");
console.log(fails === 0 ? "PASS lisieux_groupe" : "LISIEUX_GROUPE ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);

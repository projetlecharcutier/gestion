// Regression occlusion : joueur dans le HAUT d'une grande ville (Minas),
// pieds sur une cellule VERTE du masque (elevation nord), corps a l'ecran
// echantillonne du TRANSPARENT (ciel au-dessus de lui dans le PNG).
// Le sampling PAR BANDE seul le laissait DEVANT le PNG, visible par-dessus
// la ville. Le mode des PIEDS (villeCellInfo = 1, derriere) doit faire foi :
// toutes les bandes couvrantes passent devant lui -> joueur CACHE.
var game = require("../../server/game.js");
var G = game.G;
game.startGame();
var st = G.state;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// 1) Minas est posee avec sa grille.
var v = st.villes.filter(function (x) { return x.sprite === "minas"; })[0];
assert(v, "ville minas posee");
var g = G.villeGrids.minas;
assert(g, "grille minas presente");

// 2) Le cas exact : une cellule VERTE au NORD de l'emprise sol
//    (le haut du PNG -- elevation), traversable.
var vert = null;
for (var gy = 0; gy < g.rows && !vert; gy += 2) {
  var wy = g.oy + gy + 0.5;
  if (wy >= v.y) break;
  for (var gx = 0; gx < g.cols && !vert; gx += 2) {
    if (g.data[gy * g.cols + gx] === 2) vert = { x: g.ox + gx + 0.5, y: wy };
  }
}
assert(vert, "cellule verte dans le HAUT du PNG (nord de l'emprise)");
if (vert) {
  // 3) Le mode des pieds : vert -> 1 (derriere le PNG).
  var info = G.villeCellInfo(vert.x, vert.y);
  assert(info && info.mode === 1, "villeCellInfo sur cette cellule verte -> mode 1 (derriere)");
  assert(info && info.cell === 2, "cellule 2 (verte)");
  assert(!G.aabbHitsVilles(vert.x - 7, vert.y - 7, 14, 14), "zone traversable (pas de rouge sous les pieds)");

  // 4) Le BUG : a l'ecran, le CORPS du joueur (au-dessus des pieds)
  //    echantillonne du TRANSPARENT -> les bandes couvrantes qui
  //    echantillonnent 0 passaient DERRIERE lui (visible par-dessus la
  //    ville). Verifie le code : le mode 1 force TOUTE bande couvrante
  //    devant le joueur AVANT le sampling par bande.
  var fs = require("fs");
  var code = fs.readFileSync(require("path").join(__dirname, "..", "..", "src", "render.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  var iMode1 = code.indexOf("villePinfo.mode === 1");
  var iSample = code.indexOf("G.villeCellAtScreen(vv, vAxisX,");
  assert(iMode1 !== -1, "departage mode 1 (pieds verts) present");
  assert(iSample !== -1, "sampling par bande present");
  if (iMode1 !== -1 && iSample !== -1) {
    assert(iMode1 < iSample, "le mode 1 des pieds precede le sampling par bande (il fait foi)");
  }

  // 5) Numeriquement : le corps du joueur au-dessus de ses pieds echantillonne
  //    bien du transparent a l'ecran (c'est ce qui declenchait le bug).
  st.zoom = 1;
  st.camera = { x: vert.x, y: vert.y };
  var pj = G.proj(vert.x, vert.y);
  var transparents = 0, total = 0;
  for (var sy = Math.round(pj[1]) - 26; sy <= Math.round(pj[1]); sy += 2) {
    total++;
    var cell = G.villeCellAtScreen(v, pj[0], sy);
    if (cell === 0) transparents++;
  }
  console.log("corps a l'ecran : " + transparents + "/" + total + " echantillons transparents" +
    (transparents > 0 ? " (le cas buguel est bien present ici)" : ""));
}

console.log("----------------------------------------");
console.log("PASS: all  FAIL: " + fails);
process.exit(fails ? 1 : 0);

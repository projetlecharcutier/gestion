// Villes PNG : le recouvrement avec les elements de decor est autorise
// UNIQUEMENT sur les parties TRANSPARENTES du PNG ville (carte d'opacite
// construite depuis le masque de collision). Une zone PEINTE (rouge ou
// verte du masque) reste interdite a la generation.
// Toutes les villes detectees sont posees sur la carte a chaque partie.
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
function load(f) { (0, eval)(fs.readFileSync(path.join(REPO, "src", f), "utf8")); }

// Serveur : charges config + dom-stub (grilles RLE reelles des villes).
var game = require(path.join(REPO, "server", "game.js"));
var G = game.G;
game.startGame();
var st = G.state;

// --- 1) Toutes les villes posees ---
var defs = G.VILLE_DEFS.filter(function (d) { return G.hasSprite("ville", d.sprite); });
assert(st.villes.length === defs.length,
  "toutes les villes detectees sont posees (" + st.villes.length + "/" + defs.length + ")");
for (var i = 0; i < defs.length; i++) {
  var posed = st.villes.some(function (v) { return v.sprite === defs[i].sprite; });
  assert(posed, "ville posee : " + defs[i].sprite);
}

// --- 2) Carte d'opacite presente pour chaque ville (grilles serveur) ---
for (var j = 0; j < st.villes.length; j++) {
  var v = st.villes[j];
  assert(v.opaq && v.opaq.data && v.opaq.data.length > 0,
    "carte d'opacite construite : " + v.sprite);
  // La carte contient AU MOINS une cellule transparente (le PNG ne peint
  // jamais 100% de sa bbox : coins du losange) et AU MOINS une peinte.
  var ones = 0;
  for (var k = 0; k < v.opaq.data.length; k++) if (v.opaq.data[k]) ones++;
  assert(ones > 0, v.sprite + " : zones peintes presentes (" + ones + ")");
  assert(ones < v.opaq.data.length, v.sprite + " : zones transparentes presentes (" + ones + "/" + v.opaq.data.length + ")");
}

// --- 3) Recouvrement : transparent OK, peint interdit ---
var v0 = st.villes[0];
// Trouve une cellule TRANSPARENT de la bbox visuelle.
var free = null, solid = null;
for (var r = 0; r < v0.opaq.rows && (!free || !solid); r++) {
  for (var cq = 0; cq < v0.opaq.cols && (!free || !solid); cq++) {
    var wx = v0.vx0 + cq * v0.opaq.cell + v0.opaq.cell / 2;
    var wy = v0.vy0 + r * v0.opaq.cell + v0.opaq.cell / 2;
    if (v0.opaq.data[r * v0.opaq.cols + cq]) {
      if (!solid) solid = { x: wx, y: wy };
    } else {
      if (!free) free = { x: wx, y: wy };
    }
  }
}
assert(free, "une cellule transparente trouvee dans la bbox de " + v0.sprite);
assert(solid, "une cellule peinte trouvee dans la bbox de " + v0.sprite);
if (free) {
  assert(!G.villeBoxHits(free.x - 4, free.y - 4, 8, 8),
    "boite sur zone TRANSPARENTE : recouvrement autorise");
}
if (solid) {
  assert(G.villeBoxHits(solid.x - 4, solid.y - 4, 8, 8),
    "boite sur zone PEINTE : toujours interdite");
}

// --- 4) Generation : des decors occupent les zones transparentes ---
// (avec l'ancien test bbox-pleine, AUCUN decor ne pouvait y etre).
var decorsDansBbox = 0, decorsSurPeint = 0;
for (var b = 0; b < st.buildings.length; b++) {
  var bd = st.buildings[b];
  if (!bd.isDecor) continue;
  var cx = bd.x + bd.w / 2, cy = bd.y + bd.h / 2;
  for (var vi = 0; vi < st.villes.length; vi++) {
    var vv = st.villes[vi];
    if (cx < vv.vx0 || cx > vv.vx1 || cy < vv.vy0 || cy > vv.vy1) continue;
    decorsDansBbox++;
    if (G.villeBoxHits(bd.x, bd.y, bd.w, bd.h)) decorsSurPeint++;
    break;
  }
}
console.log("decors dans les bbox villes : " + decorsDansBbox + " dont sur zone peinte : " + decorsSurPeint);
assert(decorsSurPeint === 0, "aucun decor ne chevauche une zone PEINTE de ville");
// Au moins un decor profite d'une zone transparente (monde 20000 px, decors
// nombreux : statistiquement garanti si le recouvrement marche).
assert(decorsDansBbox > 0, "des decors occupent les zones transparentes des villes (" + decorsDansBbox + ")");

console.log("----------------------------------------");
console.log("PASS: all  FAIL: " + fails);
process.exit(fails ? 1 : 0);

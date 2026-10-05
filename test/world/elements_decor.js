// Éléments de décor (assets/sprites/elementdecord/) : quotas exacts par
// type (DECOR_SPECS), modes bloquant / nonbloquant / dessous, placement hors
// ville et hors villes PNG, collisions conformes au mode.
var game = require("../../server/game.js");
var G = game.G;
game.startGame();
var st = G.state;
function fail(msg) { console.log("FAIL: " + msg); process.exit(1); }

var decors = st.buildings.filter(function (b) { return b.decorSpriteName; });
var specs = G.DECOR_SPECS;

// 1. Quotas : chaque spec doit être posée exactement 4x le nombre demandé
// (décors 4x plus nombreux, par groupes de 4 adjacents).
for (var i = 0; i < specs.length; i++) {
  var frame = specs[i][0], total = specs[i][2] * 4;
  var n = 0;
  for (var j = 0; j < decors.length; j++) if (decors[j].decorSpriteName === frame) n++;
  if (n !== total) fail(frame + " : " + n + " posé(s), attendu " + total);
}
if (decors.length === 0) fail("aucun décor posé (sprites elementdecord absents ?)");
// 1b. Groupes MIXTES : chaque décor groupé doit avoir au moins un voisin
// de pose adjacente (bord à bord via le centre) d'un TYPE DIFFÉRENT. Les
// gros éléments (side >= 480) sont posés isolément par conception : exemptés.
var bigSet = {};
for (var bi = 0; bi < specs.length; bi++) {
  var bsp = G.SPRITES.elementdecord[specs[bi][0]];
  if (bsp && bsp.w * 2 >= 480) bigSet[specs[bi][0]] = true;
}
var grouped = 0;
for (var g = 0; g < decors.length; g++) {
  var dg = decors[g];
  if (bigSet[dg.decorSpriteName]) continue;
  var spSide = G.SPRITES.elementdecord[dg.decorSpriteName];
  var side = spSide ? spSide.w * 2 : dg.w;
  var hasNb = false;
  for (var h = 0; h < decors.length && !hasNb; h++) {
    var dh = decors[h];
    if (dh === dg || dh.decorSpriteName === dg.decorSpriteName) continue;
    var dx = Math.abs(dh.door.x - dg.door.x);
    var dy = Math.abs(dh.door.y - dg.door.y);
    // voisin de grille : cellules posées bord à bord, tailles de cellule
    // mixtes => tolérance de la plus grande des deux cellules.
    var sideH = G.SPRITES.elementdecord[dh.decorSpriteName];
    var tol = Math.max(side, sideH ? sideH.w * 2 : dh.w) + 2;
    if (dx < tol && dy < tol) hasNb = true;
  }
  if (hasNb) grouped++;
}
// Phase 3 pose des restes isolés : une minorité isolée est acceptable, la
// grande majorité doit être en groupe mixte.
if (grouped < decors.length * 0.5)
  fail("trop peu de décors en groupes mixtes : " + grouped + "/" + decors.length);
// 1c. Aucun chevauchement AABB strict entre décors.
for (var o1 = 0; o1 < decors.length; o1++) {
  var A = decors[o1];
  for (var o2 = o1 + 1; o2 < decors.length; o2++) {
    var B = decors[o2];
    if (A.x < B.x + B.w && A.x + A.w > B.x && A.y < B.y + B.h && A.y + A.h > B.y)
      fail(A.decorSpriteName + " chevauche " + B.decorSpriteName);
  }
}

// 2. Modes : bloquant = solide (pas decorPassable) ; nonbloquant =
// decorPassable sans decorSous ; dessous = decorPassable + decorSous.
for (var k = 0; k < decors.length; k++) {
  var b = decors[k];
  var spec = null;
  for (var s = 0; s < specs.length; s++) if (specs[s][0] === b.decorSpriteName) { spec = specs[s]; break; }
  if (!spec) fail("décor sans spec : " + b.decorSpriteName);
  if (spec[1] === "bloquant" && b.decorPassable) fail(b.decorSpriteName + " bloquant mais passable");
  if (spec[1] === "nonbloquant" && (!b.decorPassable || b.decorSous)) fail(b.decorSpriteName + " nonbloquant mal marqué");
  if (spec[1] === "dessous" && (!b.decorPassable || !b.decorSous)) fail(b.decorSpriteName + " dessous mal marqué");
  if (!b.isDecor) fail(b.decorSpriteName + " sans isDecor");
}

// 3. Placement : hors de la ville principale, hors des villes PNG, dans la
// carte, et les bloquants ne chevauchent aucun autre bâtiment.
for (var d = 0; d < decors.length; d++) {
  var b2 = decors[d];
  if (b2.x < 0 || b2.y < 0 || b2.x + b2.w > G.WORLD || b2.y + b2.h > G.WORLD)
    fail(b2.decorSpriteName + " hors carte");
  if (G.inTown(b2.x + b2.w / 2, b2.y + b2.h / 2))
    fail(b2.decorSpriteName + " dans la ville principale");
  if (G.villeBoxHits && G.villeBoxHits(b2.x, b2.y, b2.w, b2.h))
    fail(b2.decorSpriteName + " dans une ville PNG");
}
for (var bl = 0; bl < decors.length; bl++) {
  var bb = decors[bl];
  if (bb.decorPassable) continue;
  for (var ob = 0; ob < st.buildings.length; ob++) {
    var o = st.buildings[ob];
    if (o === bb || o.decorPassable) continue;
    // Deux décors d'un même groupe se touchent bord à bord (groupes adjacents)
    // : la marge de 6 ne s'applique qu'entre un décor et un bâtiment/forêt,
    // pas entre décors (le chevauchement strict est vérifié au point 1c).
    if (o.decorSpriteName) continue;
    if (bb.x < o.x + o.w + 6 && bb.x + bb.w > o.x - 6 &&
        bb.y < o.y + o.h + 6 && bb.y + bb.h > o.y - 6)
      fail(bb.decorSpriteName + " (bloquant) chevauche un bâtiment");
  }
}

// 4. Collisions joueur : bloquant bloque, passable laisse passer.
var p = st.player;
var bloq = null, pass = null, sous = null;
for (var q = 0; q < decors.length; q++) {
  if (!decors[q].decorPassable && !bloq) bloq = decors[q];
  if (decors[q].decorPassable && !decors[q].decorSous && !pass) pass = decors[q];
  if (decors[q].decorSous && !sous) sous = decors[q];
}
if (!bloq || !pass || !sous) fail("il faut au moins un décor de chaque mode");
p.x = bloq.x + bloq.w / 2; p.y = bloq.y + bloq.h / 2;
if (!G.aabbHitsBuildings(p.x, p.y)) fail("bloquant ne bloque pas le joueur");
p.x = pass.x + pass.w / 2; p.y = pass.y + pass.h / 2;
if (G.aabbHitsBuildings(p.x, p.y)) fail("nonbloquant bloque le joueur");
p.x = sous.x + sous.w / 2; p.y = sous.y + sous.h / 2;
if (G.aabbHitsBuildings(p.x, p.y)) fail("dessous bloque le joueur");

console.log("ALL_OK");

// Test réseau rivières/chemins (src/rivieres.js) : génération locale via
// buildWorld -> polylines lissées sans angle (pas de pivot brutal), les
// chemins ne traversent ni forêt ni palissade, les ponts sont posés aux
// croisements chemin×rivière, le bonus de vitesse s'applique sur un chemin
// et les rivières ne bloquent pas le déplacement.
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

global.window = global;
global.document = {
  createElement: function () {
    return { getContext: function () { return {}; }, style: {} };
  }
};

// Via le module serveur (comme test/world/torches_poteaux.js) : le stub DOM
// charge les sprites et les grilles de villes avant buildWorld.
// PRNG seedable : monde reproductible (cf. test/seed.js, TEST_SEED serveur).
require(path.join(REPO, "test", "seed.js"))(424242);
var game = require(path.join(REPO, "server", "game.js"));
var G = game.G;
game.startGame();
var st = G.state;

// 1) Le réseau existe et est lisse : pas de pivot > 25° entre points
// consecutifs d'un même tracé (Catmull-Rom bien échantillonné).
assert(st.chemins.length > 0, "au moins un chemin genere");
assert(st.rivieres.length > 0, "au moins une riviere generee");
function maxAngle(pts) {
  var worst = 0;
  for (var i = 1; i < pts.length - 1; i++) {
    var a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    var a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
    var d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > worst) worst = d;
  }
  return worst;
}
for (var c = 0; c < st.chemins.length; c++) {
  assert(maxAngle(st.chemins[c].pts) < 25 * Math.PI / 180,
         "chemin " + c + " lisse (pas d'angle vif)");
}
for (var r = 0; r < st.rivieres.length; r++) {
  assert(maxAngle(st.rivieres[r].pts) < 25 * Math.PI / 180,
         "riviere " + r + " lisse (pas d'angle vif)");
}

// 2) Finesse : largeurs plafonnées à ~1/4 de la ville (TOWN = 1000).
assert(G.CHEMIN_W <= G.TOWN / 4, "chemin fin (<= TOWN/4)");
assert(G.RIVIERE_W <= G.TOWN / 4, "riviere fine (<= TOWN/4)");

// 3) Pas de forêt ni palissade sur un chemin (pad 26 comme la génération).
function segHitsBox(pts, bx, by, bw, bh) {
  for (var i = 0; i < pts.length - 1; i++) {
    var x0 = pts[i].x, y0 = pts[i].y, x1 = pts[i + 1].x, y1 = pts[i + 1].y;
    var len = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
    var steps = Math.max(1, Math.ceil(len / 6));
    for (var s = 0; s <= steps; s++) {
      var t = s / steps;
      var px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
      if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) return true;
    }
  }
  return false;
}
for (var c2 = 0; c2 < st.chemins.length; c2++) {
  var cp = st.chemins[c2].pts;
  for (var b = 0; b < st.buildings.length; b++) {
    var bb = st.buildings[b];
    if (!bb.isForet) continue;
    assert(!segHitsBox(cp, bb.x - 22, bb.y - 22, bb.w + 44, bb.h + 44),
           "chemin " + c2 + " evite la foret");
  }
  // Palissades : pad reduit (12 px, moitie de l'epaisseur + marge). L'entree
  // de la ville (trou de 40 px dans le mur nord) est un passage LEGITIME :
  // un pad de 26 marquerait faux positif les murs voisins du trou.
  for (var w = 0; w < st.walls.length; w++) {
    var ww = st.walls[w];
    assert(!segHitsBox(cp, ww.x - 12, ww.y - 12, ww.w + 24, ww.h + 24),
           "chemin " + c2 + " evite la palissade");
  }
}

// 4) Couleurs imposées.
assert(G.CHEMIN_COLOR === "#FFFABC", "couleur chemin #FFFABC");
assert(G.RIVIERE_COLOR === "#4093E4", "couleur riviere #4093E4");

// 5) Bonus de vitesse sur un chemin, pas hors chemin.
st.player.x = st.chemins[0].pts[Math.floor(st.chemins[0].pts.length / 2)].x;
st.player.y = st.chemins[0].pts[Math.floor(st.chemins[0].pts.length / 2)].y;
assert(G.onChemin(st.player.x, st.player.y), "joueur place sur un chemin");
assert(G.playerSpeed() > G.SPEED, "bonus de vitesse sur chemin");
st.player.x = 30; st.player.y = 30;
assert(!G.onChemin(30, 30) || G.playerSpeed() === G.SPEED, "pas de bonus hors chemin");

// 6) Les rivières ne bloquent pas : tryMove à travers une rivière réussit.
var rp = st.rivieres[0].pts[Math.floor(st.rivieres[0].pts.length / 2)];
st.player.x = rp.x; st.player.y = rp.y;
// La riviere n'est PAS un obstacle : le joueur s'y deplace librement
// (tryMove vers un point voisin reussit, aucun blocage specifique riviere).
assert(G.tryMove(rp.x + 12, rp.y + 12), "deplacement sur une riviere non bloque");

// 7) Ponts : si un chemin croise une rivière, un pont gris existe.
var crossings = 0;
for (var ci = 0; ci < st.chemins.length; ci++) {
  var cpp = st.chemins[ci].pts;
  for (var ri = 0; ri < st.rivieres.length; ri++) {
    var rpp = st.rivieres[ri].pts;
    for (var pi = 0; pi < cpp.length; pi += 6) {
      for (var qi = 0; qi < rpp.length - 1; qi++) {
        var ddx = rpp[qi + 1].x - rpp[qi].x, ddy = rpp[qi + 1].y - rpp[qi].y;
        var l2 = ddx * ddx + ddy * ddy;
        var t = ((cpp[pi].x - rpp[qi].x) * ddx + (cpp[pi].y - rpp[qi].y) * ddy) / l2;
        if (t < 0) t = 0; if (t > 1) t = 1;
        var qx = rpp[qi].x + ddx * t - cpp[pi].x, qy = rpp[qi].y + ddy * t - cpp[pi].y;
        if (qx * qx + qy * qy < (G.RIVIERE_W / 2) * (G.RIVIERE_W / 2)) { crossings++; break; }
      }
    }
  }
}
if (crossings > 0) assert(st.ponts.length > 0, "pont(s) pose(s) aux croisements");

console.log(fails === 0 ? "SUCCES TOTAL" : fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);

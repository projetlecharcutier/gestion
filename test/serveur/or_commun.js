// Test : l'or est un BIEN COMMUN de tous les joueurs. Il n'existe qu'un seul
// compteur (state.mairieGold, le coffre de la mairie) : pas d'or individuel
// par joueur (p.gold n'existe plus). Un joueur ramasse une piece -> le coffre
// commun augmente, visible par tous. Un autre joueur depense au marche ->
// le coffre commun diminue.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
var pa = srv.addPlayer("a1", "alice");
var pb = srv.addPlayer("b2", "bob");
for (var i = 0; i < 5; i++) srv.tick(0.05);

var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

// 1) Pas d'or individuel sur les joueurs.
assert(pa.gold === undefined, "pas d'or individuel (pa.gold inexistant)");
assert(pb.gold === undefined, "pas d'or individuel (pb.gold inexistant)");

// 2) Alice ramasse une piece d'or a proximite : le coffre COMMUN augmente.
st.items.push({ x: pa.x + 50, y: pa.y, taken: false, name: "Pi\u00e8ce", color: "#fbbf24", kind: "or" });
var orAvant = st.mairieGold;
srv.applyInput("a1", { pickup: { x: Math.round(pa.x + 50), y: Math.round(pa.y) } });
assert(st.mairieGold === orAvant + 1, "piece ramassee par alice -> coffre commun +1 (commun)");

// 3) Le snapshot expose mairieGold (commun) et PAS de gold individuel.
var snap = srv.snapshot("b2");
assert(snap.mairieGold === orAvant + 1, "snapshot expose mairieGold (commun)");
var meB = snap.players.filter(function (q) { return q.id === "b2"; })[0];
assert(meB.gold === undefined, "snapshot joueur : pas de champ gold individuel");

// 4) Bob depense au marche (pres du marche) : le coffre COMMUN diminue.
//    (necessite un marche construit ; on le pose artificiellement)
st.marche = { x: pb.x + 100, y: pb.y + 100, w: 90, h: 90, chantierDone: true };
pb.x = st.marche.x + st.marche.w / 2; pb.y = st.marche.y + st.marche.h / 2; // au centre du marche
st.mairieGold = (st.mairieGold || 0) + 100; // le coffre commun a de l'or a depenser
var orAvantAchat = st.mairieGold;
// On achete l'item le moins cher (Nourriture, 5 or).
var prixMin = Infinity, itemMin = null;
for (var mi = 0; mi < G.MARCHE_ITEMS.length; mi++) {
  if (G.MARCHE_ITEMS[mi].price < prixMin) { prixMin = G.MARCHE_ITEMS[mi].price; itemMin = G.MARCHE_ITEMS[mi]; }
}
srv.applyInput("b2", { marketBuy: itemMin.name });
assert(st.mairieGold === orAvantAchat - prixMin, "achat de bob (" + itemMin.name + ") -> coffre commun -" + prixMin + " (commun)");

if (fails > 0) { console.log(fails + " FAIL"); process.exit(1); }
console.log("OK or_commun (or = bien commun, pas d'individuel)");

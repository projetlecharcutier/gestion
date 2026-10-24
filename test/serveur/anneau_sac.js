// Test : l'Anneau Unique ramasse va DANS LE SAC du joueur (comme tout objet),
// avec son flag `anneau` preserve (pour le poeme cote client). Le serveur ne
// donne PAS l'anneau directement (pas d'or, pas d'effet) : seule la vente a
// l'eglise rapporte 1000 or.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
var p = srv.addPlayer("a1", "alice");
for (var i = 0; i < 5; i++) srv.tick(0.05);

var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

// Place l'anneau au sol a proximite du joueur.
st.items.push({ x: p.x + 50, y: p.y, taken: false, name: "Anneau unique", color: "#f5c542", kind: "objet", anneau: true });
var orAvant = st.mairieGold;
var bagAvant = p.bag.contents.length;

srv.applyInput("a1", { pickup: { x: Math.round(p.x + 50), y: Math.round(p.y) } });

// 1) L'anneau est dans le sac (pas d'effet direct).
assert(p.bag.contents.length === bagAvant + 1, "anneau ajoute au sac (+1)");
var dansSac = p.bag.contents.some(function (it) { return it.name === "Anneau unique"; });
assert(dansSac, "Anneau unique present dans le sac");
// 2) Le flag anneau est preserve (poeme au ramassage cote client).
var avecFlag = p.bag.contents.some(function (it) { return it.name === "Anneau unique" && it.anneau === true; });
assert(avecFlag, "flag anneau preserve dans le sac");
// 3) L'item au sol est marque pris.
var itSol = st.items[st.items.length - 1];
assert(itSol.taken === true, "item au sol marque pris");
// 4) PAS d'or crédite au ramassage (l'or vient de la vente a l'eglise).
assert(st.mairieGold === orAvant, "pas d'or au ramassage (or = vente eglise uniquement)");

// 5) La vente a l'eglise necessite d'etre pres de l'eglise.
var eglise = st.buildings.filter(function (b) { return b.isChurch; })[0];
assert(!!eglise, "eglise presente sur la carte");
p.x = eglise.x + eglise.w / 2 + 30; p.y = eglise.y + eglise.h / 2 + 30;
var orAvantVente = st.mairieGold;
srv.applyInput("a1", { anneauSell: true });
assert(st.mairieGold === orAvantVente + 1000, "vente anneau a l'eglise : +1000 or au coffre commun");
assert(!p.bag.contents.some(function (it) { return it.name === "Anneau unique"; }), "anneau retire du sac apres vente");

if (fails > 0) { console.log(fails + " FAIL"); process.exit(1); }
console.log("OK anneau_sac (dans le sac au ramassage, vente +1000 or a l'eglise)");

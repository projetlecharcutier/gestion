// Test Anneau Unique (src/anneau.js) : pose systematique sur la tache
// #5a944a la plus au nord du PNG de Minas, poeme doré italique 5 s non
// bloquant au ramassage, vente 1000 or au monastere (eglise).
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
require(path.join(REPO, "test", "seed.js"))(424242);
var game = require(path.join(REPO, "server", "game.js"));
var G = game.G;
game.startGame();
var st = G.state;

// 1) L'anneau existe, unique, pose sur la tache #5a944a nord de Minas.
var anneaux = st.items.filter(function (it) { return it.name === "Anneau unique"; });
assert(anneaux.length === 1, "un seul Anneau unique pose");
var an = anneaux[0];
// Minas est posee a une position ALEATOIRE a chaque generation : la
// position de reference est lue dans state.villes, pas en dur.
var minas = (st.villes || []).filter(function (v) { return v.sprite === "minas"; })[0];
assert(!!minas, "ville Minas posee");
var MX = minas.x, MY = minas.y, MS = minas.w;
assert(Math.abs(an.x - (MX + G.ANNEAU_OFFSET.x)) < 3 &&
       Math.abs(an.y - (MY + G.ANNEAU_OFFSET.y)) < 3,
       "anneau sur la position #5a944a nord de Minas (" + an.x + "," + an.y + ")");
// La position est bien dans l'emprise de Minas.
assert(an.x > MX - MS && an.x < MX && an.y > MY - MS && an.y < MY,
       "position dans l'emprise de Minas");
// Et c'est bien le point le PLUS AU NORD : l'anneau est au-dessus (plus petit
// x+y iso) du centre de la ville.
assert(an.x + an.y < 2 * MX + 2 * MY, "anneau cote nord de Minas");

// 2) Idempotence : re-pose n'ajoute pas un deuxieme anneau.
G.placeAnneauUnique(st);
anneaux = st.items.filter(function (it) { return it.name === "Anneau unique"; });
assert(anneaux.length === 1, "placeAnneauUnique idempotent");

// 3) Poeme : contenu exact (lignes clefs), duree 5 s, non bloquant.
assert(G.ANNEAU_POEME.indexOf("Un Anneau pour les gouverner tous") >= 0,
       "poeme contient 'Un Anneau pour les gouverner tous'");
assert(G.ANNEAU_POEME.indexOf("Au pays de Mordor") >= 0,
       "poeme contient 'Au pays de Mordor'");
assert(G.ANNEAU_POEME.indexOf("Trois Anneaux pour les rois elfes sous le ciel") === 0,
       "poeme commence par 'Trois Anneaux...'");
G.showAnneauPoeme();
assert(st.anneauPoemeT === 5, "poeme affiche 5 secondes");
assert(!st.paused && !st.inBuilding && !st.chestOpen && !st.churchOpen,
       "poeme ne bloque pas le jeu (aucun menu/pause ouvert)");
G.updateAnneauPoeme(2);
assert(st.anneauPoemeT === 3, "poeme decompte avec le temps");
G.updateAnneauPoeme(3);
assert(st.anneauPoemeT === undefined, "poeme disparait apres 5 s");

// 4) Ramassage : l'anneau va dans le sac (mecanique standard des items).
st.player.x = an.x; st.player.y = an.y;
an.taken = true;
st.bag.contents.push({ name: an.name, kind: an.kind, color: an.color });
st.inventory = st.bag.contents.length;
assert(st.bag.contents.some(function (it) { return it.name === "Anneau unique"; }),
       "anneau dans le sac apres ramassage");

// 5) Vente au monastere : +1000 or au coffre de la mairie.
var gold0 = st.mairieGold || 0;
var anIdx = -1;
for (var i = 0; i < st.bag.contents.length; i++) {
  if (st.bag.contents[i].name === "Anneau unique") { anIdx = i; break; }
}
assert(anIdx >= 0, "anneau trouve dans le sac");
var addFloaterCalls = 0;
G.addFloater = function () { addFloaterCalls++; };
G.drawChurch = function () {};
G.updateHud = function () {};
G.sellAnneau(anIdx);
assert(st.mairieGold === gold0 + 1000, "vente anneau +1000 or (" + st.mairieGold + " vs " + (gold0 + 1000) + ")");
assert(!st.bag.contents.some(function (it) { return it.name === "Anneau unique"; }),
       "anneau retire du sac apres vente");
assert(addFloaterCalls === 1, "message de vente affiche (+1000 or)");
// Une seconde vente impossible (plus d'anneau).
G.sellAnneau(anIdx);
assert(st.mairieGold === gold0 + 1000, "pas de double vente");

// 6) Prix conforme.
assert(G.ANNEAU_PRICE === 1000, "prix anneau = 1000");

console.log(fails === 0 ? "SUCCES TOTAL" : fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);

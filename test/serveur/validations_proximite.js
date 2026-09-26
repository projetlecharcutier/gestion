// Regression partie 4 de l'audit : validations serveur des inputs.
// Le serveur est autoritaire mais acceptait sans verifier la proximite : un
// client modifie pouvait deposer au coffre, voter, acheter au marche ou
// ramasser des objets depuis n'importe ou sur la carte (en jeu reel, le
// client n'ouvre ces ecrans que pres du batiment).
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("a1", "alice");
srv.addPlayer("b2", "bob");
var pa = st.players[0], pb = st.players[1];
for (var i = 0; i < 5; i++) srv.tick(0.05);

var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }
var mairie = st.buildings.filter(function (b) { return b.isMairie; })[0];
var eglise = st.buildings.filter(function (b) { return b.isChurch; })[0];
function near(p, b) { p.x = b.x + b.w / 2 + 30; p.y = b.y + b.h / 2 + 30; }
function far(p) { p.x = 1500; p.y = 1500; }

// --- 1) coffre : depot refuse a distance, accepte pres de la mairie ---
pa.bag.contents.push({ name: "Pistolet", kind: "arme", color: "#94a3b8" });
far(pa);
srv.applyInput("a1", { chestDeposit: { name: "Pistolet", kind: "arme" } });
assert(pa.bag.contents.length === 1 && st.chest.length === 0, "depot coffre refuse a distance");
near(pa, mairie);
srv.applyInput("a1", { chestDeposit: { name: "Pistolet", kind: "arme" } });
assert(pa.bag.contents.length === 0 && st.chest.length === 1, "depot coffre accepte pres de la mairie");

// --- 2) coffre : retrait par nom+kind (l'ancien index etait une course
// snapshot/clic ; l'index n'est plus accepte du tout) ---
far(pa);
srv.applyInput("a1", { chestWithdraw: 0 });
assert(st.chest.length === 1 && pa.bag.contents.length === 0, "retrait par index refuse (+ a distance)");
near(pa, mairie);
srv.applyInput("a1", { chestWithdraw: 0 });
assert(st.chest.length === 1, "retrait par index refuse meme pres de la mairie (format nom+kind requis)");
srv.applyInput("a1", { chestWithdraw: { name: "Pistolet", kind: "arme" } });
assert(pa.bag.contents.length === 1 && st.chest.length === 0, "retrait par nom+kind accepte");
// Plusieurs depots du meme nom+kind : chaque retrait nomme retire UN seul
// exemplaire (le premier), jamais tout le groupe.
srv.applyInput("a1", { chestDeposit: { name: "Pistolet", kind: "arme" } });
pa.bag.contents.push({ name: "Pistolet", kind: "arme", color: "#94a3b8" });
srv.applyInput("a1", { chestDeposit: { name: "Pistolet", kind: "arme" } });
assert(st.chest.length === 2, "deux exemplaires au coffre (obtenu " + st.chest.length + ")");
srv.applyInput("a1", { chestWithdraw: { name: "Pistolet", kind: "arme" } });
assert(st.chest.length === 1, "retrait nom+kind retire un seul exemplaire");
srv.applyInput("a1", { chestWithdraw: { name: "Pistolet", kind: "arme" } });
assert(st.chest.length === 0, "retrait du second exemplaire");

// --- 3) eglise : depot de relique refuse a distance ---
var gold3 = st.mairieGold;
var relics3 = pa.bag.contents.filter(function (it) { return it.name === "Relique"; }).length;
pa.bag.contents.push({ name: "Relique", kind: "objet", color: "#daa" });
far(pa);
srv.applyInput("a1", { churchDeposit: true });
assert(pa.bag.contents.filter(function (it) { return it.name === "Relique"; }).length === relics3 + 1 && st.mairieGold === gold3, "depot eglise refuse a distance");
near(pa, eglise);
srv.applyInput("a1", { churchDeposit: true });
assert(pa.bag.contents.filter(function (it) { return it.name === "Relique"; }).length === relics3 && st.mairieGold === gold3 + 100, "depot eglise accepte pres de l'eglise");

// --- 4) marche : achat refuse a distance ---
st.marche = { x: 4800, y: 4800, w: 100, h: 100, chantierDone: true };
var gold4 = st.mairieGold;
var bag4 = pb.bag.contents.length;
far(pb);
srv.applyInput("b2", { marketBuy: "Pistolet" });
assert(pb.bag.contents.length === bag4 && st.mairieGold === gold4, "achat marche refuse a distance");
near(pb, st.marche);
srv.applyInput("b2", { marketBuy: "Pistolet" });
assert(pb.bag.contents.length === bag4 + 1 && st.mairieGold === gold4 - 20, "achat marche accepte pres du marche");

// --- 5) techVote : vote de ville refuse loin de la mairie ---
pa.planks = 500; st.mairieGold = 500;
far(pa);
srv.applyInput("a1", { techVote: "scierie" });
assert(!st.vote, "vote de ville refuse loin de la mairie");
near(pa, mairie);
srv.applyInput("a1", { techVote: "scierie" });
assert(!!st.vote, "vote de ville accepte pres de la mairie");

// --- 6) voteYes d'un joueur MORT ignore (garde d'entree d'applyInput) ---
pb.alive = false;
srv.applyInput("b2", { voteYes: true });
assert(st.vote.votes["b2"] === undefined, "vote d'un joueur mort ignore");
pb.alive = true;
srv.applyInput("b2", { voteYes: true });

// --- 7) vote d'amelioration universite (up:) refuse loin de l'universite ---
// Resolution du vote scierie en cours d'abord.
for (var t = 0; t < 400 && st.vote; t++) srv.tick(0.05);
st.mairieGold = 1000;
pa.planks = 500; pb.planks = 500;
// Pose l'universite (flux direct : vote + placeBuild via inputs realistes).
near(pa, mairie); near(pb, mairie);
srv.applyInput("a1", { techVote: "universite" });
srv.applyInput("b2", { techVote: "universite" });
for (var t2 = 0; t2 < 400 && st.vote; t2++) srv.tick(0.05);
assert(st.universiteUnlocked, "universite debloquee");
// Le spot doit etre cherche avec la VRAIE emprise du batiment
// (G.TOWN_BUILDINGS.<id>.side) : l'universite fait 80x80 depuis le passage
// x2, un spot 40x40 libre pouvait chevaucher un batiment pour 80x80 et la
// pose etait refusee.
var uSide = G.TOWN_BUILDINGS.universite.side;
var su = null;
outer:
for (var r = 150; r <= 900 && !su; r += 30) {
  for (var a = 0; a < 24; a++) {
    var px = mairie.x + mairie.w / 2 + Math.cos(a / 24 * Math.PI * 2) * r;
    var py = mairie.y + mairie.h / 2 + Math.sin(a / 24 * Math.PI * 2) * r;
    if (G.inTown(px, py) && G.towerSpotFree(px - uSide / 2, py - uSide / 2, uSide, uSide)) { su = [px, py]; break outer; }
  }
}
assert(su, "spot universite trouve");
srv.applyInput("a1", { buildSel: "universite", placeBuild: { wx: su[0], wy: su[1] } });
srv.tick(0.05);
assert(st.universite, "universite posee");
st.time += 11; srv.tick(0.05);
assert(st.universite.chantierDone, "chantier universite fini");
// Loin de l'universite : le vote up: est refuse ; pres : accepte.
far(pa);
srv.applyInput("a1", { techVote: "up:weaponDmg" });
assert(!st.vote, "vote up: refuse loin de l'universite");
near(pa, st.universite);
srv.applyInput("a1", { techVote: "up:weaponDmg" });
assert(!!st.vote && st.vote.proposal === "up:weaponDmg", "vote up: accepte pres de l'universite");
for (var t3 = 0; t3 < 400 && st.vote; t3++) srv.tick(0.05);

// --- 8) pickup : rayon serveur 150 px (client 120 + marge de latence : le
// client clique sur sa position PREDITE, en avance sur le serveur ; a 120
// strict le serveur refusait des pickups legitimement cliques).
// Le client envoie les coordonnees DE L'ITEM clique (pas du joueur).
var bag8 = pa.bag.contents.length;
st.items = [];
st.items.push({ x: pa.x + 160, y: pa.y, name: "Pistolet", kind: "arme", color: "#333" });
srv.applyInput("a1", { pickup: { x: pa.x + 160, y: pa.y } });
assert(pa.bag.contents.length === bag8 && !st.items[0].taken, "pickup refuse a 160 px (rayon 150)");
st.items = [];
st.items.push({ x: pa.x + 130, y: pa.y, name: "Pistolet", kind: "arme", color: "#333" });
srv.applyInput("a1", { pickup: { x: pa.x + 130, y: pa.y } });
assert(pa.bag.contents.length === bag8 + 1 && st.items[0].taken, "pickup accepte a 130 px (marge latence)");
st.items = [];
st.items.push({ x: pa.x + 110, y: pa.y, name: "Pistolet", kind: "arme", color: "#333" });
srv.applyInput("a1", { pickup: { x: pa.x + 110, y: pa.y } });
assert(pa.bag.contents.length === bag8 + 2 && st.items[0].taken, "pickup accepte a 110 px, item marque pris");

if (fails > 0) { console.log(fails + " FAIL"); process.exit(1); }
console.log("OK validations serveur (proximite + retrait nom/kind + pickup 120)");

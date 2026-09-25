// Marche : achat en ligne (livraison dans le sac + messages d'echec explicites)
// et achat en solo (compteur d'inventaire du HUD mis a jour).
var srv = require("../../server/game.js");
var G = srv.G;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// --- En ligne (serveur) : livraison + or debite + messages d'echec ---
srv.startGame();
var st = srv.getState();
srv.addPlayer("a1", "A");
var pa = st.players[0];
st.marcheUnlocked = true;
st.marche = G.makeTownBuilding("marche", 5000, 5000);
st.marche.chantierDone = true;
st.mairieGold = 500;
function events(re) {
  return st.events.filter(function (e) { return e.t === "msg" && re.test(e.msg); });
}

// 1) Hors portee : message explicite, PAS de livraison (avant : silencieux,
//    le joueur croyait avoir achete et l'objet n'arrivait jamais dans le sac).
pa.x = 5600; pa.y = 5600;
srv.applyInput("a1", { marketBuy: "Fusil" });
assert(!pa.bag.contents.some(function (it) { return it.name === "Fusil"; }), "hors portee : pas de livraison");
assert(st.mairieGold === 500, "hors portee : or intact");
assert(events(/Rapprochez/).length === 1, "hors portee : message Rapprochez-vous recu");

// 2) Marche pas construit : message explicite.
st.marche.chantierDone = false;
pa.x = 5040; pa.y = 5040;
srv.applyInput("a1", { marketBuy: "Fusil" });
assert(!pa.bag.contents.some(function (it) { return it.name === "Fusil"; }), "chantier : pas de livraison");
assert(events(/pas encore construit/).length === 1, "chantier : message recu");

// 3) Or insuffisant : message explicite, or intact.
st.marche.chantierDone = true;
st.mairieGold = 10;
srv.applyInput("a1", { marketBuy: "Fusil" });
assert(!pa.bag.contents.some(function (it) { return it.name === "Fusil"; }), "or insuffisant : pas de livraison");
assert(events(/assez d/).length === 1, "or insuffisant : message recu");

// 4) Achat valide pres du marche : objet livre + or debite.
st.mairieGold = 500;
srv.applyInput("a1", { marketBuy: "Fusil" });
assert(pa.bag.contents.some(function (it) { return it.name === "Fusil" && it.kind === "arme"; }), "Fusil livre dans le sac");
assert(st.mairieGold === 460, "or debite (obtenu " + st.mairieGold + ")");
assert(pa.inventory === pa.bag.contents.length, "inventaire du joueur sync");
assert(events(/Fusil achet/).length === 1, "message de confirmation d'achat");

// 5) Objet inconnu : message explicite (avant : silencieux).
srv.applyInput("a1", { marketBuy: "Truc" });
assert(events(/inconnu/).length === 1, "objet inconnu : message recu");

// --- En solo : le compteur d'inventaire du HUD est mis a jour ---
global.window = global;
global.Image = function () {};
function mkEl() { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "", textContent: "", hidden: false, children: [] }; }
var elems = {};
global.document = {
  getElementById: function (id) { if (!elems[id]) elems[id] = mkEl(); return elems[id]; },
  createElement: function () { return mkEl(); }
};
global.addEventListener = function () {};
global.performance = global.performance || { now: function () { return Date.now(); } };
var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }
load("bag.js");
load("player.js");
var Gc = global.GAME;
Gc.netConnected = function () { return false; };
Gc.netInput = function () {};
Gc.updateHud = function () {};
Gc.addFloater = function () {};
Gc.drawMarche = function () {};
Gc.state = { mairieGold: 500, bag: { contents: [], open: false }, marche: { chantierDone: true }, players: [], playerName: "T", inventory: 0 };
Gc.buyMarcheItem("Fusil");
assert(Gc.state.bag.contents.some(function (it) { return it.name === "Fusil"; }), "solo : Fusil dans le sac");
assert(Gc.state.inventory === 1, "solo : compteur inventaire HUD = 1 (obtenu " + Gc.state.inventory + ")");
assert(Gc.state.mairieGold === 460, "solo : or debite");

if (fails > 0) { console.log("FAIL marche : " + fails + " assertion(s)"); process.exit(1); }
console.log("OK marche : achats livres (en ligne et solo), messages d'echec explicites, compteur HUD sync");

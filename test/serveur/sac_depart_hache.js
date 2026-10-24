// Sac de depart : chaque joueur commence avec une hache dans son sac
// (G.START_BAG dans src/config.js), en multi (addPlayer + restart startGame)
// comme en solo (reset du formulaire de demarrage).
var srv = require("../../server/game.js");
var G = srv.G;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

srv.startGame();
var st = srv.getState();

// --- 1) addPlayer : hache presente dans le sac ---
srv.addPlayer("u1", "alice");
srv.addPlayer("u2", "bob");
var pa = st.players[0], pb = st.players[1];
assert(pa.bag.contents.length === 1, "addPlayer : sac = 1 objet (obtenu " + pa.bag.contents.length + ")");
assert(pa.bag.contents[0].name === "Hache" && pa.bag.contents[0].kind === "outil", "addPlayer : hache outil dans le sac");
assert(pa.inventory === pa.bag.contents.length, "addPlayer : inventory sync avec le sac");
assert(pb.bag.contents.length === 1 && pb.bag.contents[0].name === "Hache", "addPlayer : hache pour le 2e joueur aussi");

// --- 2) startGame (restart) : le sac est remis avec la hache ---
pa.bag.contents.push({ name: "Pistolet", kind: "arme", color: "#333" });
pa.inventory = pa.bag.contents.length;
srv.startGame();
st = srv.getState();
pa = st.players[0];
assert(pa.bag.contents.length === 1, "restart : sac remis a 1 objet (obtenu " + pa.bag.contents.length + ")");
assert(pa.bag.contents[0].name === "Hache" && pa.bag.contents[0].kind === "outil", "restart : hache de retour dans le sac");
assert(pa.inventory === pa.bag.contents.length, "restart : inventory sync apres reset");
assert(!pa.axeEquipped, "restart : hache non equipee automatiquement");

// --- 3) le joueur peut equiper la hache de depart (toggleAxe) ---
for (var i = 0; i < 80; i++) srv.tick(0.05);
srv.applyInput("u1", { toggleAxe: true });
assert(pa.axeEquipped === true, "toggleAxe : hache de depart equipable");

// --- 4) snapshot : le sac avec la hache est transmis au client ---
var snap = srv.snapshot("u1");
assert(snap.players[0].bag.length === 1 && snap.players[0].bag[0].name === "Hache", "snapshot : hache presente dans le bag transmis");
assert(snap.players[0].inventory === 1, "snapshot : inventory = 1 transmis");

// --- 5) solo : G.START_BAG defini et reset du formulaire l'utilise ---
assert(Array.isArray(G.START_BAG) && G.START_BAG.length === 1 && G.START_BAG[0].name === "Hache", "G.START_BAG defini (config partage)");

if (fails > 0) { console.log(fails + " FAIL"); process.exit(1); }
console.log("OK sac de depart : hache dans le sac (addPlayer, restart, snapshot)");

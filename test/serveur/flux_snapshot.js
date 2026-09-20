// Test serveur via require : flux reel (addPlayer -> _buildSel/_placeBuild -> tick -> snapshot).
var srv = require("../../server/game.js");
var G = srv.G;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

assert(G.SCIERIE_SIDE === 64, "SCIERIE_SIDE=80 cote serveur (obtenu " + G.SCIERIE_SIDE + ")");

srv.startGame();
var st = srv.getState();
var mairie = st.buildings.filter(function (b) { return b.isMairie; })[0];
st.scierieUnlocked = true;
st.mairieGold = 100;

// Spot libre dans la ville pres de la mairie
var spot = null;
outer:
for (var r = 200; r <= 2000 && !spot; r += 40) {
  for (var a = 0; a < 32; a++) {
    var px = mairie.x + mairie.w / 2 + Math.cos(a / 32 * Math.PI * 2) * r;
    var py = mairie.y + mairie.h / 2 + Math.sin(a / 32 * Math.PI * 2) * r;
    if (G.inTown(px, py) && G.towerSpotFree(px - G.SCIERIE_SIDE / 2, py - G.SCIERIE_SIDE / 2, G.SCIERIE_SIDE, G.SCIERIE_SIDE)) { spot = [px, py]; break outer; }
  }
}
assert(spot, "spot libre trouve dans la ville");

// Joueur rejoint, debloque et pose la scierie via le flux reel
srv.addPlayer("tester", "test-id");
var p = st.players[0];
p.planks = 200;
p._buildSel = "scierie";
p._placeBuild = { x: spot[0], y: spot[1] };
srv.tick(0.05);
assert(st.scierie, "scierie posee cote serveur");
assert(st.scierie.w === 64, "scierie emprise 64 (obtenu " + (st.scierie ? st.scierie.w : "null") + ")");
assert(st.buildSel === null, "buildSel reset apres pose");

// Snapshot pendant chantier
var snap = srv.snapshot();
assert(snap.scierie, "snapshot scierie present");
assert(typeof snap.scierie.buildAge === "number", "snapshot scierie.buildAge present");
assert(snap.scierie.buildAge >= 0 && snap.scierie.buildAge <= 10, "buildAge dans [0,10] (obtenu " + snap.scierie.buildAge + ")");
assert(snap.scierie.chantierDone === false, "chantier en cours dans snapshot");

// Boucle 10 s : chantier fini
for (var i = 0; i < 250; i++) srv.tick(0.05);
snap = srv.snapshot();
assert(snap.scierie.chantierDone === true, "chantier fini apres ~10 s de boucle (buildAge obtenu " + snap.scierie.buildAge + ")");
assert(st.scierie.chantierDone, "chantierDone cote etat serveur");

// Pose d'une tour : snapshot tour buildAge
p._buildSel = "tour:bois";
var tSide = G.towerSide("bois");
var tspot = null;
outer2: for (var r2 = 200; r2 <= 2000; r2 += 40) {
  for (var a2 = 0; a2 < 32; a2++) {
    var tx2 = mairie.x + mairie.w / 2 + Math.cos(a2 / 32 * Math.PI * 2) * r2;
    var ty2 = mairie.y + mairie.h / 2 + Math.sin(a2 / 32 * Math.PI * 2) * r2;
    if (G.towerSpotFree(tx2 - tSide / 2, ty2 - tSide / 2, tSide, tSide)) { tspot = [tx2, ty2]; break outer2; }
  }
}
assert(tspot, "spot libre pour la tour");
p._placeBuild = { x: tspot[0], y: tspot[1] };
srv.tick(0.05);
assert(st.towers.length >= 1, "tour posee cote serveur (obtenu " + st.towers.length + ")");
var snap2 = srv.snapshot();
var tw = snap2.towers[0];
assert(typeof tw.buildAge === "number", "snapshot tour.buildAge present");
assert(tw.buildAge >= 0 && tw.buildAge <= 10, "tour buildAge dans [0,10] (obtenu " + tw.buildAge + ")");

console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

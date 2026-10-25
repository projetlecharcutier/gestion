// Serveur : techs generiques (vote), pose universite/montgolfiere, snapshot.
var srv = require("../../server/game.js");
var G = srv.G;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

srv.startGame();
var st = srv.getState();
var mairie = st.buildings.filter(function (b) { return b.isMairie; })[0];
st.mairieGold = 100;
srv.addPlayer("a1", "alice");
srv.addPlayer("b2", "bob");
var pa = st.players[0], pb = st.players[1];
pa.planks = 500; pb.planks = 500;
// Le vote tech exige la proximite de la mairie (audit anti-triche) : le
// client legitime clique le bouton du coffre ouvert pres de la mairie.
pa.x = mairie.x + mairie.w / 2 + 40; pa.y = mairie.y + mairie.h / 2 + 40;
pb.x = mairie.x + mairie.w / 2 - 40; pb.y = mairie.y + mairie.h / 2 - 40;

// 1) Vote tech universite (2 joueurs, majorite stricte = 2)
srv.applyInput("a1", { techVote: "universite" });
assert(st.vote && st.vote.proposal === "universite", "vote universite lance");
srv.applyInput("b2", { techVote: "universite" });
assert(st.vote && st.vote.votes["b2"] === true, "bob vote pour");
// resolution apres VOTE_DURATION (15 s)
for (var i = 0; i < 320; i++) srv.tick(0.05);
assert(st.universiteUnlocked, "universite debloquee apres vote");
assert(st.mairieGold === 90, "or debite (obtenu " + st.mairieGold + ")");

// 2) Pose universite en ville (flux reel) : l'emprise cherchee est celle
// du registre (side 80 depuis le passage x2 de l'universite).
var uSide = G.TOWN_BUILDINGS.universite.side;
// Centres alignes sur la grille de construction (G.BUILD_GRID) :
// placeFromBuildMenu snappera le point clique sur la cellule.
var spot = null;
outer:
for (var gx = G.BUILD_GRID; gx < G.WORLD && !spot; gx += G.BUILD_GRID) {
  for (var gy = G.BUILD_GRID; gy < G.WORLD; gy += G.BUILD_GRID) {
    var ddx = gx - (mairie.x + mairie.w / 2), ddy = gy - (mairie.y + mairie.h / 2);
    if (ddx * ddx + ddy * ddy > 900 * 900) continue;
    if (G.inTown(gx, gy) && G.towerSpotFree(gx - uSide / 2, gy - uSide / 2, uSide, uSide)) { spot = [gx, gy]; break outer; }
  }
}
assert(spot, "spot libre en ville");
pa._buildSel = "universite";
pa._placeBuild = { x: spot[0], y: spot[1] };
srv.tick(0.05);
assert(st.universite, "universite posee cote serveur");
assert(st.universite.w === uSide, "universite emprise " + uSide + " (x2)");
var bInBuildings = st.buildings.some(function (b) { return b.townBuilding === "universite"; });
assert(bInBuildings, "universite dans buildings");

// 3) Snapshot : universite + pendingWave
var snap = srv.snapshot();
assert(snap.universiteUnlocked === true, "snapshot universiteUnlocked");
assert(snap.universite && typeof snap.universite.buildAge === "number", "snapshot universite.buildAge");
assert(snap.montgolfiere === null, "snapshot montgolfiere null");
assert(snap.pendingWave === null || (snap.pendingWave.sides && snap.pendingWave.count !== undefined), "snapshot pendingWave valide");

// 4) crossedMorning cote serveur : pendingWave pre-tire
st.clock = 7.99;
for (var j = 0; j < 40; j++) srv.tick(0.05);
assert(st.pendingWave, "serveur : pendingWave pre-tire au matin");
var snap2 = srv.snapshot();
assert(snap2.pendingWave && snap2.pendingWave.count === 100, "snapshot pendingWave = 100 zombies");

console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

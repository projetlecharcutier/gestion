// Regression partie 2 de l'audit : plankRotation et buildSel PAR JOUEUR.
// 1) Rotation : A tourne sa palissade -> B ne doit pas heriter de la rotation
//    (l'ancien protocole toggle un etat GLOBAL partage entre tous les joueurs).
// 2) buildSel : la selection de A (envoyee separement de sa pose, deux inputs
//    differents) ne doit ni disparaitre apres un tick, ni influencer la pose
//    de B (l'ancienne purge au bout d'un tick + fuite dans le global faisait
//    poser a B la selection residuelle d'un tiers).
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("a1", "alice");
srv.addPlayer("b2", "bob");
var pa = st.players[0], pb = st.players[1];
pa.planks = 300; pb.planks = 300;
for (var i = 0; i < 80; i++) srv.tick(0.05);
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// Chaque joueur sur une zone libre HORS ville. La carte est aleatoire : on
// scanne des candidats et on garde le PREMIER ou une pose de mur reussit
// (essayee pour de vrai), pour ne pas dependre du terrain.
function findWallSpot(p) {
  for (var r = 300; r < 2400; r += 60) {
    for (var a = 0; a < 16; a++) {
      var x = 5000 + Math.cos(a / 16 * Math.PI * 2) * r;
      var y = 5000 + Math.sin(a / 16 * Math.PI * 2) * r;
      if (G.inTown(x, y)) continue;
      var before = st.walls.length;
      p.x = x; p.y = y;
      srv.applyInput(p.id, { build: true, buildWall: { wx: x + 60, wy: y } });
      for (var t = 0; t < 3; t++) srv.tick(0.05);
      srv.applyInput(p.id, { build: false });
      if (st.walls.length > before) {
        return st.walls[st.walls.length - 1];
      }
    }
  }
  return null;
}

// --- 1) Rotation par joueur : valeur absolue, pas de toggle global ---
srv.applyInput("a1", { rotate: 1 });
assert(pa._plankRotation === 1, "rotate:1 stocke chez A (obtenu " + pa._plankRotation + ")");
assert(pb._plankRotation === undefined, "B n'herite pas de la rotation de A");
srv.applyInput("a1", { rotate: 0 });
assert(pa._plankRotation === 0, "rotate:0 stocke chez A (valeur absolue, pas toggle)");

// B pose un mur SANS rotation -> horizontal, meme apres les toggles de A.
var wB = findWallSpot(pb);
assert(wB && wB.w >= wB.h, "mur de B pose et horizontal (rotation de B, pas celle de A)");

// A tourne SA palissade et pose -> vertical. B ne doit pas en heriter.
srv.applyInput("a1", { rotate: 1 });
var wA = null;
outer:
for (var r2 = 300; r2 < 2400; r2 += 60) {
  for (var a2 = 0; a2 < 16; a2++) {
    var x2 = 5000 + Math.cos(a2 / 16 * Math.PI * 2) * r2;
    var y2 = 5000 + Math.sin(a2 / 16 * Math.PI * 2) * r2;
    if (G.inTown(x2, y2)) continue;
    var b2 = st.walls.length;
    pa.x = x2; pa.y = y2;
    srv.applyInput("a1", { build: true, buildWall: { wx: x2 + 60, wy: y2 } });
    for (var t2 = 0; t2 < 3; t2++) srv.tick(0.05);
    srv.applyInput("a1", { build: false });
    if (st.walls.length > b2) { wA = st.walls[st.walls.length - 1]; break outer; }
  }
}
assert(wA && wA.h > wA.w, "mur de A pose et vertical (rotation 1 de A)");
assert(wB && wB.w >= wB.h, "mur de B toujours horizontal apres rotation de A");

// --- 2) buildSel persiste par joueur et ne fuit pas ---
srv.applyInput("a1", { buildSel: "tour:bois" });
// Des ticks complets SANS pose : la selection de A doit survivre (l'ancienne
// purge a la fin du tick la detruisait).
for (var t3 = 0; t3 < 5; t3++) srv.tick(0.05);
assert(pa._buildSel === "tour:bois", "selection de A persiste apres les ticks (obtenu " + pa._buildSel + ")");
assert(st.buildSel === null, "le global buildSel reste null (pas de fuite)");
assert(pb._buildSel === undefined, "B n'a pas de selection");

// La pose de B ne doit PAS utiliser la selection de A.
st.scierie = { x: 4800, y: 4800, w: 40, h: 40, chantierDone: true };
st.mairieGold = 500;
var towersBefore = st.towers.length;
srv.applyInput("b2", { placeBuild: { wx: pb.x + 50, wy: pb.y + 50 } });
srv.tick(0.05);
assert(st.towers.length === towersBefore, "pose de B n'utilise pas la selection de A (aucune tour posee)");

// La pose de A avec SA selection (envoyee plusieurs ticks avant) doit marcher.
var ta = null;
outer2:
for (var r3 = 300; r3 < 2400; r3 += 60) {
  for (var a3 = 0; a3 < 16; a3++) {
    var x3 = 5000 + Math.cos(a3 / 16 * Math.PI * 2) * r3;
    var y3 = 5000 + Math.sin(a3 / 16 * Math.PI * 2) * r3;
    if (G.inTown(x3, y3)) continue;
    var tb = st.towers.length;
    srv.applyInput("a1", { placeBuild: { wx: x3, wy: y3 } });
    srv.tick(0.05);
    if (st.towers.length > tb) { ta = x3; break outer2; }
  }
}
assert(ta !== null, "pose de A avec sa selection persistee (tour posee)");

console.log(fails === 0 ? "OK etat par joueur (rotation + buildSel)" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

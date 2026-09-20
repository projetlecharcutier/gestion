// Jitter reseau : inputs a 15 Hz alors que le serveur tick a 20 Hz.
// Avant le fix (fire reset chaque tick), la coupe echouait.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("u1", "alice");
var p = st.players[0];
for (var i = 0; i < 80; i++) srv.tick(0.05);
// Hache en sac + equipee.
p.bag.contents.push({ name: "Hache", kind: "outil", color: "#b45309" });
p.axeEquipped = true;
// Foret hors ville ET a >150 px de tout mur (sinon la priorite mur-plus-proche
// fait couper la palissade au lieu de la foret : comportement de jeu voulu ;
// les forets de lisiere collees aux murs doivent etre ecartees du test).
function distMur(x, y) {
  var dm = Infinity;
  for (var w = 0; w < st.walls.length; w++) {
    var m = st.walls[w];
    var d = Math.hypot((m.x + m.w / 2) - x, (m.y + m.h / 2) - y);
    if (d < dm) dm = d;
  }
  return dm;
}
var foret = null, bestD = Infinity;
for (var b = 0; b < st.buildings.length; b++) {
  var bb = st.buildings[b];
  if (!bb.isForet || G.foretDepleted(bb)) continue;
  var cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  if (G.inTown(cx, cy)) continue;
  if (distMur(cx, cy) < 250) continue;
  var d = Math.hypot(cx - p.x, cy - p.y);
  if (d < bestD) { bestD = d; foret = bb; }
}
if (!foret) { console.log("ECHEC : pas de foret hors ville loin des murs"); process.exit(1); }
p.x = foret.x + foret.w / 2 + 60; p.y = foret.y + foret.h / 2;
if (distMur(p.x, p.y) < 200) { console.log("ECHEC : mur trop proche"); process.exit(1); }
var stage0 = foret.foretStage || 0;
var planks0 = p.planks || 0;
// 3 ticks serveur (150 ms) pour 1 input client (jitter 2:1).
for (var t = 0; t < 60; t++) {
  if (t % 3 === 0) srv.applyInput("u1", { fire: true });
  srv.tick(0.05);
}
console.log("planks: " + planks0 + " -> " + p.planks + " | foret stage: " + stage0 + " -> " + (foret.foretStage || 0));
if (!(p.planks > planks0)) { console.log("FAIL: chop casse par le jitter"); process.exit(1); }
var anyStage = false;
for (var b2 = 0; b2 < st.buildings.length; b2++) {
  var bb2 = st.buildings[b2];
  if (bb2.isForet && (bb2.foretStage || 0) > 0) { anyStage = true; break; }
}
if (!anyStage) { console.log("FAIL: aucune foret coupee"); process.exit(1); }
// Relachement : fire:false doit arreter la coupe (pas de coupe infinie).
srv.applyInput("u1", { fire: false });
for (var t2 = 0; t2 < 40; t2++) srv.tick(0.05);
var planksAfter = p.planks;
if (planksAfter !== p.planks) { console.log("FAIL: coupe continue apres relachement"); process.exit(1); }
console.log("OK chop resiste au jitter + relachement propre");

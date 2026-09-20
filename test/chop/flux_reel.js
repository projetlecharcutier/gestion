// Flux REEL client-serveur du chop : pickup hache -> equip -> fire maintenu.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("u1", "alice");
var p = st.players[0];
for (var i = 0; i < 80; i++) srv.tick(0.05); // START_DELAY 3s
// Trouve la hache au sol la plus proche et positionne le joueur dessus.
var hache = null;
for (var k = 0; k < st.items.length; k++) {
  if (st.items[k].name === "Hache" && !st.items[k].taken) { hache = st.items[k]; break; }
}
if (!hache) { console.log("FAIL: pas de hache au sol"); process.exit(1); }
p.x = hache.x; p.y = hache.y;
// Ramassage (comme le client).
srv.applyInput("u1", { pickup: { x: Math.round(hache.x), y: Math.round(hache.y) } });
var hasAxe = p.bag.contents.some(function (it) { return it.name === "Hache"; });
if (!hasAxe) { console.log("FAIL: hache non ramassee, bag=" + JSON.stringify(p.bag.contents)); process.exit(1); }
// Equip la hache.
srv.applyInput("u1", { toggleAxe: true });
if (!p.axeEquipped) { console.log("FAIL: hache non equipee"); process.exit(1); }
// Foret hors ville, a >250 px de tout mur (la priorite mur-plus-proche fait
// sinon couper la palissade : comportement voulu, pas un bug).
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
if (!foret) { console.log("FAIL: pas de foret hors ville loin des murs"); process.exit(1); }
// Teleporte a portee de hache (AXE_RANGE = 120).
p.x = foret.x + foret.w / 2 + 60; p.y = foret.y + foret.h / 2;
var stage0 = foret.foretStage || 0;
console.log("foret stage initial: " + stage0);
// Maintient fire comme le client 20Hz pendant 3 s.
var planks0 = p.planks || 0;
for (var t = 0; t < 60; t++) {
  srv.applyInput("u1", { fire: true }); // comme sendNetInput a chaque frame 20Hz
  srv.tick(0.05);
}
console.log("planks: " + planks0 + " -> " + p.planks);
var anyStage = false;
for (var b2 = 0; b2 < st.buildings.length; b2++) {
  var bb2 = st.buildings[b2];
  if (bb2.isForet && (bb2.foretStage || 0) > stage0) { anyStage = true; break; }
}
console.log("une foret coupee: " + anyStage);
if (!(p.planks > planks0)) { console.log("FAIL: aucune planche recoltee"); process.exit(1); }
if (!anyStage) { console.log("FAIL: aucune foret change d'etat"); process.exit(1); }
console.log("OK chop reel serveur");

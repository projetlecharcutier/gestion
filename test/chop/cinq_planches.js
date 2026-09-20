// Coupe de foret HORS ville : 5 planches par coup de hache.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("u1", "alice");
var p = st.players[0];
if (G.FORET_PLANKS_PER_CHOP !== 5) { console.log("FAIL config: " + G.FORET_PLANKS_PER_CHOP); process.exit(1); }
for (var i = 0; i < 80; i++) srv.tick(0.05);
var foret = null;
for (var b = 0; b < st.buildings.length; b++) {
  var bb = st.buildings[b];
  if (!bb.isForet || G.foretDepleted(bb) || G.inTown(bb.x, bb.y)) continue;
  foret = bb; break;
}
p.equipped = "Hache"; p.axeEquipped = true;
p.x = foret.x + foret.w / 2 + 60; p.y = foret.y + foret.h / 2;
var planks0 = p.planks || 0;
for (var j = 0; j < 30; j++) { p._fire = true; srv.tick(0.05); }
srv.applyInput("u1", { fire: false });
if (!(p.planks > planks0)) { console.log("FAIL: aucune planche (" + p.planks + ")"); process.exit(1); }
console.log("OK coupe: " + planks0 + " -> " + p.planks + " planches (FORET_PLANKS_PER_CHOP=" + G.FORET_PLANKS_PER_CHOP + ")");

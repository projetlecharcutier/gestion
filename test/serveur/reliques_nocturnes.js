// Repop nocturne : 5 reliques par nouveau jour (serveur).
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
function countReliques() {
  return st.items.filter(function (it) { return it.name === "Relique" && !it.taken; }).length;
}
var before = countReliques();
st.clock = 23.99;
for (var i = 0; i < 40; i++) srv.tick(0.05); // ~2s sim -> passe minuit
if (st.day !== 1) { console.log("FAIL: jour non incremente: " + st.day); process.exit(1); }
var after = countReliques();
if (after !== before + G.RELIQUES_PER_NIGHT) {
  console.log("FAIL: reliques attendues +" + G.RELIQUES_PER_NIGHT + ", obtenu " + before + " -> " + after);
  process.exit(1);
}
console.log("OK repop nocturne: " + before + " -> " + after + " reliques (+" + G.RELIQUES_PER_NIGHT + ")");

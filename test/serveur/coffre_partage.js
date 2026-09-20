// Coffre partage en mode serveur : depot puis retrait via inputs.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("u1", "alice");
var p = st.players[0];
p.bag.contents.push({ name: "Pistolet", kind: "arme", color: "#94a3b8" });

srv.applyInput("u1", { chestDeposit: { name: "Pistolet", kind: "arme" } });
if (p.bag.contents.length !== 0 || st.chest.length !== 1) {
  console.log("FAIL depot: bag=" + p.bag.contents.length + " chest=" + st.chest.length); process.exit(1);
}
var snap = srv.snapshot();
if (!snap.chest || snap.chest.length !== 1) { console.log("FAIL: chest absent du snapshot"); process.exit(1); }

srv.applyInput("u1", { chestWithdraw: 0 });
if (p.bag.contents.length !== 1 || st.chest.length !== 0) {
  console.log("FAIL retrait: bag=" + p.bag.contents.length + " chest=" + st.chest.length); process.exit(1);
}
console.log("OK coffre partage (depot + snapshot + retrait)");

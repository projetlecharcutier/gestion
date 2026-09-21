// Coffre partage en mode serveur : depot puis retrait via inputs.
// Proximite mairie obligatoire (partie 4 : le client n'ouvre le coffre que
// pres de la mairie) et retrait par nom+kind (l'ancien index etait une course
// snapshot/clic).
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("u1", "alice");
var p = st.players[0];
// Le joueur est devant la mairie (comportement client reel).
var mairie = st.buildings.filter(function (b) { return b.isMairie; })[0];
p.x = mairie.x + mairie.w / 2 + 30;
p.y = mairie.y + mairie.h / 2 + 30;
p.bag.contents.push({ name: "Pistolet", kind: "arme", color: "#94a3b8" });
srv.applyInput("u1", { chestDeposit: { name: "Pistolet", kind: "arme" } });
if (p.bag.contents.length !== 0 || st.chest.length !== 1) {
  console.log("FAIL depot: bag=" + p.bag.contents.length + " chest=" + st.chest.length); process.exit(1);
}
var snap = srv.snapshot();
if (!snap.chest || snap.chest.length !== 1) { console.log("FAIL: chest absent du snapshot"); process.exit(1); }
srv.applyInput("u1", { chestWithdraw: { name: "Pistolet", kind: "arme" } });
if (p.bag.contents.length !== 1 || st.chest.length !== 0) {
  console.log("FAIL retrait: bag=" + p.bag.contents.length + " chest=" + st.chest.length); process.exit(1);
}
console.log("OK coffre partage (depot + snapshot + retrait)");

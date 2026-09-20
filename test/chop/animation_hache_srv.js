// Bout en bout serveur : chop bois + animation de tir pistolet en ligne.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("u1", "alice");
var p = st.players[0];
for (var i = 0; i < 80; i++) srv.tick(0.05);

// Foret HORS ville (les forets de ville sont collees a la palissade : la hache
// y prioriserait le mur le plus proche).
var foret = null;
for (var b = 0; b < st.buildings.length; b++) {
  var bb = st.buildings[b];
  if (!bb.isForet || G.foretDepleted(bb) || G.inTown(bb.x, bb.y)) continue;
  foret = bb; break;
}
if (!foret) { console.log("FAIL: pas de foret hors ville"); process.exit(1); }
p.equipped = "Hache"; p.axeEquipped = true;
p.x = foret.x + foret.w / 2 + 60; p.y = foret.y + foret.h / 2;
for (var j = 0; j < 30; j++) { srv.applyInput("u1", { fire: true }); srv.tick(0.05); }
srv.applyInput("u1", { fire: false });
if (!(p.planks > 0)) { console.log("FAIL: aucune planche recoltee"); process.exit(1); }
console.log("chop 1.5s: planks=" + p.planks);

// chop/chopAge emis pendant la coupe.
srv.applyInput("u1", { fire: true });
srv.tick(0.05); srv.tick(0.05);
var snap = srv.snapshot("u1");
var me = snap.players.filter(function (q) { return q.id === "u1"; })[0];
if (!me.chop || me.chopAge === undefined) { console.log("FAIL: chop/chopAge manquants"); process.exit(1); }
console.log("chop emis: chop=" + me.chop + " chopAge=" + me.chopAge);
srv.applyInput("u1", { fire: false });
srv.tick(0.05);

// Tir pistolet : un clic bref ne doit pas etre perdu (latch).
p.axeEquipped = false; p.equipped = "Pistolet";
p.bag.contents.push({ name: "Pistolet", kind: "arme", color: "#94a3b8" });
for (var k = 0; k < 40; k++) srv.tick(0.05);
srv.applyInput("u1", { fire: true, dx: 1, dy: 0, aimX: p.x + 100, aimY: p.y });
srv.applyInput("u1", { fire: false, dx: 0, dy: 0 });
srv.tick(0.05);
snap = srv.snapshot("u1");
me = snap.players.filter(function (q) { return q.id === "u1"; })[0];
if (me.shotAge === undefined || me.shotAge < 0 || me.shotAge > 0.06) {
  console.log("FAIL: shotAge inattendu: " + me.shotAge); process.exit(1);
}
console.log("shotAge apres tir: " + me.shotAge);
console.log("OK");

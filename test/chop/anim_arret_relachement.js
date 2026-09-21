// Regression : apres un coup de hache complet, si le joueur relache le clic
// en restant a portee de l'arbre, le serveur doit cesser d'emettre chop/chopAge
// (sinon le client boucle l'animation de hache et le cercle de decompte).
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("u1", "alice");
var p = st.players[0];
for (var i = 0; i < 80; i++) srv.tick(0.05);
function foretHorsVille() {
  for (var b = 0; b < st.buildings.length; b++) {
    var bb = st.buildings[b];
    if (!bb.isForet || G.foretDepleted(bb) || G.inTown(bb.x, bb.y)) continue;
    return bb;
  }
  return null;
}
var foret = foretHorsVille();
if (!foret) { console.log("ECHEC : pas de foret hors ville"); process.exit(1); }
p.equipped = "Hache"; p.axeEquipped = true;
p.x = foret.x + foret.w / 2 + 60; p.y = foret.y + foret.h / 2;
for (var j = 0; j < 25; j++) { srv.applyInput("u1", { fire: true }); srv.tick(0.05); }
srv.applyInput("u1", { fire: false });
srv.tick(0.05); srv.tick(0.05);
var snap = srv.snapshot("u1");
var me = snap.players.filter(function (q) { return q.id === "u1"; })[0];
console.log("apres relachement: chop=" + me.chop + " chopAge=" + me.chopAge);
if (me.chop) { console.log("FAIL: chop encore emis apres relachement (anim en boucle)"); process.exit(1); }
for (var k = 0; k < 40; k++) srv.tick(0.05);
snap = srv.snapshot("u1");
me = snap.players.filter(function (q) { return q.id === "u1"; })[0];
console.log("2s plus tard: chop=" + me.chop + " chopAge=" + me.chopAge);
if (me.chop) { console.log("FAIL: chop reaparu apres 2s sans clic"); process.exit(1); }
// Reprendre la coupe doit refonctionner immediatement.
var planks0 = p.planks;
for (var m = 0; m < 25; m++) { srv.applyInput("u1", { fire: true }); srv.tick(0.05); }
console.log("reprise: planks " + planks0 + " -> " + p.planks);
if (!(p.planks > planks0)) { console.log("FAIL: coupe impossible apres reprise"); process.exit(1); }
console.log("OK arret propre de l'animation de hache apres relachement");

// Serveur : nouvelle semantique du vote (blancs non comptabilises, majorite
// des VOTANTS, egalite -> OUI sauf pendaison), potence (vote hang:<id> +
// execution de la sentence) et degats alliés (friendly fire).
var srv = require("../../server/game.js");
var G = srv.G;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// ---------------------------------------------------------------
// 1) Semantique du vote : majorite des VOTANTS, blancs non comptes,
//    egalite -> OUI sauf pendaison.
// ---------------------------------------------------------------
srv.startGame();
var st = srv.getState();
var mairie = st.buildings.filter(function (b) { return b.isMairie; })[0];
st.mairieGold = 100;
srv.addPlayer("a1", "alice");
srv.addPlayer("b2", "bob");
srv.addPlayer("c3", "carol");
var pa = st.players[0], pb = st.players[1], pc = st.players[2];
pa.planks = 500; pb.planks = 500;
function nearM(p) { p.x = mairie.x + mairie.w / 2 + 40; p.y = mairie.y + mairie.h / 2 + 40; }
nearM(pa); nearM(pb); nearM(pc);

// 1a. 1 oui sur 3 joueurs, 2 blancs -> Passe (majorite des votants).
srv.applyInput("a1", { techVote: "scierie" });
assert(st.vote && st.vote.proposal === "scierie", "vote scierie lance");
for (var i = 0; i < 320; i++) srv.tick(0.05);
assert(st.scierieUnlocked, "1 oui / 2 blancs -> debloquee (majorite des votants)");
assert(st.mairieGold === 90, "or debite (obtenu " + st.mairieGold + ")");
assert(pa.planks === 400, "planches de l'initiateur debitees");

// 1b. Le non compte : 1 oui + 1 non (2 votants, egalite) -> OUI l'emporte.
st.mairieGold = 100;
srv.applyInput("a1", { techVote: "universite" });
assert(st.vote && st.vote.proposal === "universite", "vote universite lance (apres cooldown)");
if (st.vote) {
  srv.applyInput("b2", { voteYes: false });
  for (var j = 0; j < 320; j++) srv.tick(0.05);
  assert(st.universiteUnlocked, "egalite 1-1 -> OUI l'emporte (batiment)");
}

// 1c. Snapshot : compteurs oui/non/votants.
st.mairieGold = 100;
srv.applyInput("a1", { techVote: "marche" });
srv.applyInput("b2", { voteYes: true });
srv.applyInput("c3", { voteYes: false });
var snap = srv.snapshot();
assert(snap.vote && snap.vote.yes === 2, "snapshot vote.yes = 2 (obtenu " + (snap.vote && snap.vote.yes) + ")");
assert(snap.vote && snap.vote.no === 1, "snapshot vote.no = 1");
assert(snap.vote && snap.vote.voters === 3, "snapshot vote.voters = 3");
for (var k = 0; k < 320; k++) srv.tick(0.05);
assert(st.marcheUnlocked, "marche debloquee (2 oui / 1 non)");

// ---------------------------------------------------------------
// 2) Potence : tech + pose + vote de pendaison.
// ---------------------------------------------------------------
// 2a. Deblocage de la tech potence (potenceUnlocked).
st.mairieGold = 100;
srv.applyInput("a1", { techVote: "potence" });
srv.applyInput("b2", { voteYes: true });
for (var k2 = 0; k2 < 320; k2++) srv.tick(0.05);
assert(st.potenceUnlocked, "potence debloquee");

// 2b. Pose de la potence (flux reel : buildSel + placeBuild).
function findSpot(side) {
  for (var r = 150; r <= 900; r += 30) {
    for (var a = 0; a < 24; a++) {
      var px = mairie.x + mairie.w / 2 + Math.cos(a / 24 * Math.PI * 2) * r;
      var py = mairie.y + mairie.h / 2 + Math.sin(a / 24 * Math.PI * 2) * r;
      if (G.inTown(px, py) && G.towerSpotFree(px - side / 2, py - side / 2, side, side)) return [px, py];
    }
  }
  return null;
}
var sp = findSpot(48);
assert(sp, "spot libre pour la potence");
pa._buildSel = "potence";
pa._placeBuild = { x: sp[0], y: sp[1] };
srv.tick(0.05);
assert(st.potence, "potence posee cote serveur");
st.time += 11;
srv.tick(0.05);
assert(st.potence.chantierDone, "chantier potence fini");

// 2c. Vote de pendaison : egalite -> la cible est SAUVEE.
// alice initie la pendaison de bob, carol vote contre -> 1-1.
srv.applyInput("a1", { hangVote: "b2" });
assert(st.vote && st.vote.proposal === "hang:b2", "vote hang:b2 lance depuis la potence");
srv.applyInput("c3", { voteYes: false });
for (var k3 = 0; k3 < 320; k3++) srv.tick(0.05);
assert(pb.alive, "egalite 1-1 en pendaison -> cible sauvee");
assert(!pb.alive === false, "bob toujours vivant");

// 2d. Vote de pendaison : majorite -> sentence executee.
// Cooldown d'echec (30 s) ecoule d'abord : le vote raté applique
// voteCooldownUntil, un nouveau vote ne peut pas partir avant.
for (var cw = 0; cw < 700 && st.voteCooldownUntil > st.time; cw++) srv.tick(0.05);
// alice et carol votent pour pendre bob.
srv.applyInput("a1", { hangVote: "b2" });
assert(st.vote && st.vote.proposal === "hang:b2", "vote hang:b2 relance (pas de cooldown de ressources)");
srv.applyInput("c3", { voteYes: true });
for (var k4 = 0; k4 < 320; k4++) srv.tick(0.05);
assert(!pb.alive, "2 oui / 1 non -> bob pendu");
assert(pb.hp === 0, "bob a 0 PV");
// La partie continue : il reste des survivants.
assert(!st.gameOver, "la partie continue apres la pendaison (survivants)");

// 2e. Potence dans le snapshot.
var snap2 = srv.snapshot();
assert(snap2.potence && typeof snap2.potence.buildAge === "number", "snapshot potence present");
assert(snap2.potenceUnlocked === true, "snapshot potenceUnlocked");
// 2f. Execution scenique : execAt horodate sur la potence, evenement
//     "execution" diffuse (nom du pendu + position du batiment), execAge
//     dans le snapshot, message de confirmation pour les autres joueurs.
assert(st.potence.execAt !== undefined, "potence.execAt horodate apres la sentence");
var evs = srv.snapshot("a1").events || [];
var evExec = null;
for (var ei = 0; ei < evs.length; ei++) if (evs[ei].t === "execution") evExec = evs[ei];
assert(evExec && evExec.name === "bob", "evenement execution diffuse (bob)");
assert(evExec && typeof evExec.x === "number" && typeof evExec.y === "number",
  "evenement execution : position de la potence");
var snapExec = srv.snapshot("c3");
var potSnap = snapExec.potence;
assert(potSnap && potSnap.execAge !== undefined && potSnap.execAge >= 0,
  "snapshot potence.execAge (obtenu " + (potSnap && potSnap.execAge) + ")");
assert(potSnap.execAge < 2, "execAge petit (temps reel ecoule depuis la sentence)");

// ---------------------------------------------------------------
// 3) Degats allies (friendly fire) : les tirs d'un joueur blessent
//    les autres joueurs, jamais le tireur.
// ---------------------------------------------------------------
// alice tire sur carol avec un pistolet (25 degats). L'arme doit etre
// dans son sac (l'equipement serveur verifie le contenu du sac).
pa.x = sp[0]; pa.y = sp[1];
pc.x = pa.x + 60; pc.y = pa.y;
pa.bag.contents.push({ name: "Pistolet", kind: "arme", color: "#ffcc00" });
srv.applyInput("a1", { equip: "Pistolet" });
assert(pa.equipped === "Pistolet", "pistolet equipe (obtenu " + pa.equipped + ")");
var pcHpBefore = pc.hp;
srv.applyInput("a1", { fire: true, aimX: pc.x, aimY: pc.y });
for (var k5 = 0; k5 < 40; k5++) srv.tick(0.05);
srv.applyInput("a1", { fire: false });
assert(pc.hp < pcHpBefore, "carol touchee par le tir d'alice (obtenu " + pc.hp + " avant " + pcHpBefore + ")");
// Le tireur ne se touche pas lui-meme.
var paHp = pa.hp;
srv.applyInput("a1", { fire: true, aimX: pa.x, aimY: pa.y });
srv.tick(0.05);
srv.applyInput("a1", { fire: false });
assert(pa.hp === paHp, "le tireur ne se blesse pas");

console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

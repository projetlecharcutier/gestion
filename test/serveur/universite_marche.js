// Serveur : ameliorations de l'universite (vote up:<id>, or/parchemin, effets
// degats d'armes + tours + nuit tranquille) et achats au marche.
var srv = require("../../server/game.js");
var G = srv.G;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

srv.startGame();
var st = srv.getState();
var mairie = st.buildings.filter(function (b) { return b.isMairie; })[0];

srv.addPlayer("a1", "alice");
srv.addPlayer("b2", "bob");
var pa = st.players[0], pb = st.players[1];
pa.planks = 500; pb.planks = 500;
function moveNear(p, b) { p.x = b.x + b.w / 2 + 40; p.y = b.y + b.h / 2 + 40; }
moveNear(pa, mairie); moveNear(pb, mairie);

// Universite + marche : deblocage tech + pose + chantier fini.
st.mairieGold = 1000;
["universite", "marche"].forEach(function (tech) {
  srv.applyInput("a1", { techVote: tech });
  srv.applyInput("b2", { techVote: tech });
  for (var i = 0; i < 320; i++) srv.tick(0.05);
});
assert(st.universiteUnlocked, "universite debloquee");
assert(st.marcheUnlocked, "marche debloque");

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
var su = findSpot(80);
pa._buildSel = "universite";
pa._placeBuild = { x: su[0], y: su[1] };
srv.tick(0.05);
assert(st.universite, "universite posee");
var sm = findSpot(48);
pa._buildSel = "marche";
pa._placeBuild = { x: sm[0], y: sm[1] };
srv.tick(0.05);
assert(st.marche, "marche pose");
st.time += 11;
srv.tick(0.05);
assert(st.universite.chantierDone, "chantier universite fini");
assert(st.marche.chantierDone, "chantier marche fini");

// 1) Vote amelioration degats d'armes (100 or, non repetable).
moveNear(pa, st.universite); moveNear(pb, st.universite);
var goldBefore = st.mairieGold;
srv.applyInput("a1", { techVote: "up:weaponDmg" });
assert(st.vote && st.vote.proposal === "up:weaponDmg", "vote up:weaponDmg lance");
srv.applyInput("b2", { techVote: "up:weaponDmg" });
for (var k = 0; k < 320; k++) srv.tick(0.05);
assert(st.universiteUpgrades && st.universiteUpgrades.weaponDmg, "weaponDmg acquise");
assert(st.mairieGold === goldBefore - 100, "or debite (obtenu " + st.mairieGold + ")");

// 1b) Degats d'armes appliques : le pistolet passe de 25 a 32 (round(25*1.25)).
assert(G.weaponDmg("Pistolet") === 31, "pistolet 25 -> 31 (obtenu " + G.weaponDmg("Pistolet") + ")");
assert(G.weaponDmg("Fusil") === 19, "fusil 15 -> 19 (obtenu " + G.weaponDmg("Fusil") + ")");

// 1c) Non repetable : un second vote echoue (pas de nouveau vote lance).
srv.applyInput("a1", { techVote: "up:weaponDmg" });
assert(!st.vote, "weaponDmg deja acquise : pas de vote");

// 2) Amelioration gratuite avec Parchemin : alice porte un parchemin.
pa.bag.contents.push({ name: "Parchemin", kind: "objet", color: "#fde68a" });
goldBefore = st.mairieGold;
moveNear(pa, st.universite); moveNear(pb, st.universite);
srv.applyInput("a1", { techVote: "up:towerRange" });
srv.applyInput("b2", { techVote: "up:towerRange" });
for (var k2 = 0; k2 < 320; k2++) srv.tick(0.05);
assert(st.universiteUpgrades.towerRange, "towerRange acquise via parchemin");
assert(st.mairieGold === goldBefore, "parchemin : or intact");
assert(!pa.bag.contents.some(function (it) { return it.name === "Parchemin"; }), "parchemin consomme");

// 3) Nuit de tranquillite (50 or, repetable) : la vague de 22h est annulee.
moveNear(pa, st.universite); moveNear(pb, st.universite);
srv.applyInput("a1", { techVote: "up:peacefulNight" });
srv.applyInput("b2", { techVote: "up:peacefulNight" });
for (var k3 = 0; k3 < 320; k3++) srv.tick(0.05);
assert(st.peacefulNight === true, "peacefulNight armee");
// On avance l'horloge jusqu'a 22h passe : pas de spawn.
st.clock = 21.99;
st.day = 1;
for (var ti = 0; ti < 30; ti++) srv.tick(0.02);
assert(st.waveSpawnedForDay === true, "nuit tranquille : vague marquee passee");
assert(st.peacefulNight === false, "peacefulNight consomme apres la nuit");
// Aucune vague ne doit avoir ete generee pendant la nuit tranquille :
// le flag zombieMode attaque n'est pas declenche par 22h.
assert(st.zombieMode !== "attack" || st.zombies.length === 0, "pas de vague spawn pendant la nuit tranquille");

// 4) Achats au marche : or du coffre commun, objet livre dans le sac.
var goldA = st.mairieGold;
moveNear(pa, st.marche);
srv.applyInput("a1", { marketBuy: "Grenade" });
assert(pa.bag.contents.some(function (it) { return it.name === "Grenade"; }), "grenade livree");
assert(st.mairieGold === goldA - 60, "or debite marche (obtenu " + st.mairieGold + ")");
moveNear(pb, st.marche);
srv.applyInput("b2", { marketBuy: "Lance-flammes" });
assert(pb.bag.contents.some(function (it) { return it.name === "Lance-flammes"; }), "lance-flammes livre");

// 5) Snapshot : upgrades + peacefulNight + marche.
var snap = srv.snapshot();
assert(snap.universiteUpgrades && snap.universiteUpgrades.weaponDmg === true, "snapshot universiteUpgrades");
assert(snap.marche && snap.marche.chantierDone === true, "snapshot marche");
assert(snap.marcheUnlocked === true, "snapshot marcheUnlocked");

// 6) Grenade : explosion de zone (blast) cote serveur.
var gz = { x: pa.x + 50, y: pa.y, hp: 200, atkCd: 0, wallCd: 0, group: null, speedFactor: 1, lunge: 0, lungeDx: 0, lungeDy: 0 };
st.zombies.push(gz);
pa.equipped = "Grenade";
pa._fire = true;
pa._aimX = pa.x + 50; pa._aimY = pa.y;
srv.tick(0.05);
pa._fire = false;
var grenadePr = st.projectiles.filter(function (pr) { return pr.type === "grenade"; });
assert(grenadePr.length === 1, "projectile grenade cree");
assert(grenadePr[0].dmg === 100, "grenade dmg 80*1.25=100 (obtenu " + grenadePr[0].dmg + ")");
assert(grenadePr[0].blast === true && grenadePr[0].blastRadius === 120, "grenade blast radius");
for (var gi = 0; gi < 60; gi++) srv.tick(0.05);
assert(gz.hp < 200, "grenade : zombie touche (hp " + gz.hp + ")");

// 7) Lance-flammes : flux de flammes cadence rapide.
// Le cooldown de la grenade (3.5 s) n'est pas tombe a zero apres les 3 s de
// ticks de propagation : on le reinitialise pour isoler cette section.
pa.shootCd = 0;
var fz = { x: pa.x + 30, y: pa.y, hp: 100, atkCd: 0, wallCd: 0, group: null, speedFactor: 1, lunge: 0, lungeDx: 0, lungeDy: 0 };
st.zombies.push(fz);
pa.equipped = "Lance-flammes";
pa._fire = true;
pa._aimX = pa.x + 30; pa._aimY = pa.y;
srv.tick(0.1);
pa._fire = false;
for (var fi = 0; fi < 60; fi++) srv.tick(0.05);
assert(fz.hp < 100, "lance-flammes : zombie brule (hp " + fz.hp + ")");

console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

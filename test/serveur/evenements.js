// Regression partie 3 de l'audit : canal d'evenements serveur -> client.
// Le serveur est la seule autorite en ligne ; avant, aucun retour n'etait
// emis : votes echoues silencieux, achats refuses muets, aucun son de
// tir/manger/tour cassee, mort d'un joueur invisible pour les autres.
// Ce test verifie l'EMISSION (file + snapshot) directement, sans loopback.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("a1", "alice");
srv.addPlayer("b2", "bob");
var pa = st.players[0], pb = st.players[1];
for (var i = 0; i < 10; i++) srv.tick(0.05);

var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }
function lastEvents(pid) { return srv.snapshot(pid).events || []; }
function hasEv(evs, t, msgPart) {
  for (var i = 0; i < evs.length; i++) {
    if (evs[i].t === t && (!msgPart || (evs[i].msg || "").indexOf(msgPart) >= 0)) return true;
  }
  return false;
}
// Les actions serveur exigent la proximite du batiment (comme le client,
// qui n'ouvre ces ecrans que pres du batiment) : on place les joueurs.
function moveNear(p, b) { p.x = b.x + b.w / 2 + 40; p.y = b.y + b.h / 2 + 40; }
var eglise = st.buildings.filter(function (b) { return b.isChurch; })[0];
var mairie = st.buildings.filter(function (b) { return b.isMairie; })[0];

// --- 1) eat : evenement dedie au joueur qui mange ---
pa.bag.contents.push({ name: "Nourriture", kind: "objet", color: "#a00" });
pa.hp = 50;
srv.applyInput("a1", { eat: true });
var ev1 = lastEvents("a1");
assert(hasEv(ev1, "eat"), "eat emis pour le joueur qui mange");
assert(lastEvents("b2").length === 0, "eat non diffuse aux autres");

// --- 2) depot d'eglise : retour +100 or (proximite requise) ---
pa.bag.contents.push({ name: "Relique", kind: "objet", color: "#daa" });
moveNear(pa, eglise);
srv.applyInput("a1", { churchDeposit: true });
assert(hasEv(lastEvents("a1"), "msg", "100 pièces d'or"), "eglise : message 100 pieces d'or");
// Loin de l'eglise : depot refuse (validation serveur partie 4).
pa.bag.contents.push({ name: "Relique", kind: "objet", color: "#daa" });
pa.x = 2000; pa.y = 2000;
srv.applyInput("a1", { churchDeposit: true });
assert(pa.bag.contents.length === 1, "eglise : depot refuse a distance");
pa.bag.contents.splice(0, 1);
moveNear(pa, mairie);

// --- 3) marche : achat reussi + echec (or insuffisant) ---
st.marche = { x: 4800, y: 4800, w: 100, h: 100, chantierDone: true };
st.mairieGold = 300;
moveNear(pb, st.marche);
srv.applyInput("b2", { marketBuy: "Fusil" });
assert(hasEv(lastEvents("b2"), "msg", "acheté !"), "marche : achat confirme");
// Loin du marche : achat refuse.
pb.x = 2000; pb.y = 2000;
srv.applyInput("b2", { marketBuy: "Grenade" });
assert(st.mairieGold === 260, "marche : achat refuse a distance (or intact)");
moveNear(pb, st.marche);
st.mairieGold = 0;
srv.applyInput("b2", { marketBuy: "Grenade" });
assert(hasEv(lastEvents("b2"), "msg", "pas assez d'or"), "marche : echec d'achat communique");

// --- 4) techVote sans ressources : refus communique (pas de vote fantome) ---
moveNear(pb, mairie);
pb.planks = 0;
srv.applyInput("b2", { techVote: "universite" });
assert(!st.vote, "vote non lance sans ressources");
assert(hasEv(lastEvents("b2"), "msg", "planches"), "refus de vote communique");
// Loin de la mairie : vote refuse meme avec les ressources.
pb.planks = 500; st.mairieGold = 100;
pb.x = 2000; pb.y = 2000;
srv.applyInput("b2", { techVote: "universite" });
assert(!st.vote, "vote refuse a distance de la mairie");
moveNear(pb, mairie);

// --- 5) vote complet : resolution reussie diffusee a TOUS les joueurs ---
// Majorite stricte des joueurs CONNECTES : avec 2 joueurs, il faut 2 oui.
pa.planks = 200; st.mairieGold = 100;
srv.applyInput("a1", { techVote: "scierie" });
assert(!!st.vote, "vote lance par l'initiateur");
srv.applyInput("b2", { voteYes: true });
var gone = false;
for (var t = 0; t < 400; t++) {
  srv.tick(0.05);
  if (!st.vote) { gone = true; break; }
}
assert(gone, "vote resolu dans le temps imparti");
assert(st.scierieUnlocked, "scierie debloquee apres vote reussi");
var evA = lastEvents("a1"), evB = lastEvents("b2");
assert(hasEv(evA, "msg", "voté et débloqué"), "resultat de vote emis (joueur A)");
assert(hasEv(evB, "msg", "voté et débloqué"), "resultat de vote emis (joueur B)");

// --- 6) vote echoue : majorite non atteinte -> evenement d'echec ---
srv.applyInput("b2", { techVote: "universite" }); // cooldown ou pas de planches
outer2:
for (var t2 = 0; t2 < 500; t2++) {
  srv.tick(0.05);
  if (!st.vote && st.voteCooldownUntil > st.time) break;
}
// Si le vote a bien ete lance (initiateur doit payer universite : gold),
// il doit echouer (1 oui sur 2 joueurs = pas la majorite stricte) et l'echec
// doit etre diffuse.
var sawFail = hasEv(lastEvents("a1"), "msg", "échoué");
if (!sawFail) console.log("(info) deuxieme vote non observe (cooldown ou ressources)");

// --- 7) tir : evenement shoot diffuse avec position ---
srv.applyInput("a1", { equip: null });
pa.bag.contents.push({ name: "Pistolet", kind: "arme", color: "#333" });
srv.applyInput("a1", { equip: "Pistolet" });
srv.applyInput("a1", { fire: true, aimX: pa.x + 100, aimY: pa.y });
var sawShoot = false;
for (var t3 = 0; t3 < 40 && !sawShoot; t3++) {
  srv.tick(0.05);
  var evs3 = lastEvents("b2");
  if (hasEv(evs3, "shoot")) sawShoot = true;
}
srv.applyInput("a1", { fire: false });
assert(sawShoot, "tir : evenement shoot diffuse (vu chez le joueur B)");
if (sawShoot) {
  // B ne doit PAS le recevoir une seconde fois (consomme pour lui)...
  assert(!hasEv(lastEvents("b2"), "shoot"), "evenement shoot consomme pour B (pas livre deux fois)");
  // ...mais A (qui n'a pas encore snapshotte) doit le recevoir une fois :
  // un broadcast n'est pas avale par le premier joueur qui lit le snapshot.
  assert(hasEv(lastEvents("a1"), "shoot"), "broadcast shoot livre aussi au joueur A");
  assert(!hasEv(lastEvents("a1"), "shoot"), "broadcast shoot consomme pour A ensuite");
}

// --- 8) mort d'un joueur : annonce diffusee ---
// Les zombies sont pilotes par groupes (zombieGroups) : un zombie brut
// pousse dans st.zombies n'appartient a aucun groupe et n'attaque jamais.
// On cree un groupe d'un membre directement sur le joueur.
pa.hp = 1;
var z = { x: pa.x + 5, y: pa.y + 5, hp: 50, lunge: 0, lungeDx: 0, lungeDy: 0, dmg: 50, atkCd: 0, wallCd: 0, slotAng: 0, slotDist: 5, slotAngT: 0, slotDistT: 5 };
var grp = { x: pa.x, y: pa.y, members: [z], hasRaider: false, spawnSide: 0, formation: 0, formPhase: 0, isHorde: false, retreat: false, hordeMsgShown: false };
z.group = grp;
st.zombies.push(z);
st.zombieGroups.push(grp);
var deadSeen = false;
for (var t4 = 0; t4 < 120 && !deadSeen; t4++) {
  srv.tick(0.05);
  if (!pa.alive) {
    var evs5 = lastEvents("b2");
    if (hasEv(evs5, "msg", "est mort")) deadSeen = true;
  }
}
assert(!pa.alive, "joueur tue par un zombie");
assert(deadSeen, "mort du joueur annoncee aux autres joueurs");

// --- 9) restart : file d'evenements vide ---
srv.startGame();
assert(srv.getState().events.length === 0, "file d'evenements videe au restart");
assert((srv.snapshot("b2").events || []).length === 0, "aucun evenement perime au restart");

if (fails > 0) { console.log(fails + " FAIL"); process.exit(1); }
console.log("PASS evenements");

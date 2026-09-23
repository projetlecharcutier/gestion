// Tour de siege : spawn des la 2e nuit, avance a mi-vitesse vers le mur le
// plus proche, s'y colle (etat ouvert) et libere 100 zombies de l'autre
// cote. Resistance x100, destruction -> trace au sol, annonce montgolfiere.
var game = require("../../server/game.js");
var G = game.G;
game.startGame();
var s = G.state;

// Pas de simulation : avance l'horloge exactement comme la boucle principale
// (main.js / tick serveur) avant updateSieges, sinon 22h n'est jamais franchi.
var CLOCK_RATE = (12 / G.DAY_SECONDS) * G.TIME_SCALE;
function step(dt) {
  s.clock += CLOCK_RATE * dt;
  if (s.clock >= 24) { s.clock -= 24; s.day += 1; }
  G.updateSieges(dt);
}

// --- Compteur par nuit ---
// Nuit 1 (day 0) : 0. Nuit 2 (day 1) : 1. Nuit 3 : 2. Plafond : 10.
if (G.siegeCountForDay(0) !== 0) { console.log("FAIL: nuit 1 devrait avoir 0 tours"); process.exit(1); }
if (G.siegeCountForDay(1) !== 1) { console.log("FAIL: nuit 2 devrait avoir 1 tour"); process.exit(1); }
if (G.siegeCountForDay(2) !== 2) { console.log("FAIL: nuit 3 devrait avoir 2 tours"); process.exit(1); }
if (G.siegeCountForDay(3) !== 4) { console.log("FAIL: nuit 4 devrait avoir 4 tours"); process.exit(1); }
if (G.siegeCountForDay(4) !== 8) { console.log("FAIL: nuit 5 devrait avoir 8 tours"); process.exit(1); }
if (G.siegeCountForDay(5) !== 10) { console.log("FAIL: nuit 6 devrait etre plafonnee a 10"); process.exit(1); }
if (G.siegeCountForDay(20) !== 10) { console.log("FAIL: plafond 10 respecte"); process.exit(1); }
console.log("compteur par nuit OK (0,1,2,4,8,10,10)");

// --- Annonce montgolfiere : nombre de tours de la nuit a venir ---
s.pendingWave = { sides: [0], count: 10, rawCount: 10 };
var now = (G.MONTGOLFIERE_ANIM_TIME || 4) + 1;
s.day = 0;
var msg0 = G.montgolfiereWaveMessage({ animStart: 0 }, now) || [];
var line0 = null;
for (var mi = 0; mi < msg0.length; mi++) if (msg0[mi].indexOf("Tours de si") === 0) line0 = msg0[mi];
if (line0 !== null) { console.log("FAIL: nuit 1 ne doit annoncer aucune tour, got '" + line0 + "'"); process.exit(1); }
s.day = 1;
var msg1 = G.montgolfiereWaveMessage({ animStart: 0 }, now) || [];
var line1 = null;
for (var mj = 0; mj < msg1.length; mj++) if (msg1[mj].indexOf("Tours de si") === 0) line1 = msg1[mj];
if (line1 !== "Tours de si\u00e8ge : 1") { console.log("FAIL: annonce attendue 'Tours de si\u00e8ge : 1', got '" + line1 + "'"); process.exit(1); }
s.pendingWave = null;
console.log("annonce montgolfiere OK : '" + line1 + "' en nuit 2, rien en nuit 1");

// --- Spawn nocturne au passage de 22h ---
// Day 1 (= 2e nuit d'attaque), 21h54 : petits pas jusqu'au passage de 22h.
s.day = 1;
s.clock = 21.9;
for (var i = 0; i < 20 && s.sieges.length === 0; i++) step(0.1);
if (s.sieges.length !== 1) { console.log("FAIL: 1 tour attendue au passage de 22h, got " + s.sieges.length); process.exit(1); }
var tw = s.sieges[0];
if (!tw.isSiege) { console.log("FAIL: isSiege"); process.exit(1); }
// Un seul spawn par jour : re-appeler updateSieges n'en ajoute pas.
step(0.1); step(0.1);
if (s.sieges.length !== 1) { console.log("FAIL: spawn en double au meme jour"); process.exit(1); }
console.log("spawn nuit 2 OK : 1 tour, dir=" + tw.dir);

// --- Vitesse : moitie d'un zombie ---
// Sans murs la cible est le centre-ville : trajectoire droite mesurable.
s.walls = [];
s.sieges = [];
var st = G.makeSiegeTower(5000, 5300, G.SIEGE_DIRS[0]);
s.sieges.push(st);
for (var v = 0; v < 50; v++) step(0.1); // 5 s de jeu
var moved = Math.abs(st.y - 5300) + Math.abs(st.x - 5000);
var zomDist = G.ZOMBIE_SPEED * 5; // distance d'un zombie en 5 s
if (moved < 0.4 * zomDist || moved > 0.6 * zomDist) {
  console.log("FAIL: distance parcourue " + moved.toFixed(1) + " px en 5 s (zombie: " + zomDist + ", attendu ~moitie)");
  process.exit(1);
}
if (st.state === "open" || st.open) { console.log("FAIL: tour ouverte sans mur (cible centre-ville)"); process.exit(1); }
console.log("vitesse OK : " + moved.toFixed(1) + " px en 5 s (zombie " + zomDist + " px, ~moitie)");

// --- Contact mur : arret + ouverture + liberation de 100 zombies ---
G.buildPerimeterWall();
s.sieges = [];
var st2 = G.makeSiegeTower(G.TOWN_MIN - 300, 5000, G.SIEGE_DIRS[0]);
s.sieges.push(st2);
var zBefore = s.zombies.length;
// Simule jusqu'au contact (la tour avance vers le mur ouest de la ville).
var opened = false;
for (var t2 = 0; t2 < 2000 && !opened; t2++) {
  step(0.1);
  if (st2.state === "open") opened = true;
}
if (!opened) { console.log("FAIL: la tour ne s'est jamais collee au mur"); process.exit(1); }
if (!st2.open) { console.log("FAIL: etat ouvert non active"); process.exit(1); }
var released = s.zombies.length - zBefore;
if (released !== G.SIEGE_RELEASE_COUNT || released !== 100) {
  console.log("FAIL: 100 zombies attendus, got " + released); process.exit(1);
}
// Les zombies liberes sont du cote ville du mur (x > mur ouest).
var allInside = true;
for (var zi = 0; zi < s.zombies.length; zi++) {
  var rz = s.zombies[zi];
  if (rz.releasedBySiege && rz.x < G.TOWN_MIN - 20) allInside = false;
}
if (!allInside) { console.log("FAIL: des zombies liberes sont hors de la ville"); process.exit(1); }
// Collee = elle ne bouge plus.
var sxOpen = st2.x, syOpen = st2.y;
for (var r = 0; r < 10; r++) step(0.1);
if (st2.x !== sxOpen || st2.y !== syOpen) { console.log("FAIL: la tour ouverte bouge encore"); process.exit(1); }
console.log("contact mur OK : ouverte + " + released + " zombies liberes cote ville, immobile");

// --- Resistance : 100 PV (100x un zombie) ---
if (G.SIEGE_HP !== 100) { console.log("FAIL: SIEGE_HP attendu 100, got " + G.SIEGE_HP); process.exit(1); }
if (G.SIEGE_HP !== G.ZOMBIE_HP * 100) { console.log("FAIL: SIEGE_HP doit valoir 100 x ZOMBIE_HP"); process.exit(1); }
console.log("resistance OK : 100 PV (100x un zombie a " + G.ZOMBIE_HP + " PV)");

// --- Destruction : trace au sol, plus de collision ---
var tracesBefore = s.siegeTraces.length;
st2.hp = 0;
G.cleanupSieges();
if (s.sieges.length !== 0) { console.log("FAIL: tour detruite toujours presente"); process.exit(1); }
if (s.siegeTraces.length !== tracesBefore + 1) { console.log("FAIL: trace de destruction manquante"); process.exit(1); }
// La trace ne bloque rien : le joueur peut marcher dessus (aucune fonction
// de collision ne reference siegeTraces).
console.log("destruction OK : trace au sol, plus aucun obstacle");

// --- Collision : seulement les 10% du bas ---
var st3 = G.makeSiegeTower(5000, 5000, G.SIEGE_DIRS[0]);
s.sieges.push(st3);
// Le point (5000, 5000 - 50% h) est au-dessus de la zone de collision.
if (G.hitsSiegeFoot(5000, 5000 - st3.h * 0.5, 2, 2)) { console.log("FAIL: collision au milieu du PNG (devrait etre bas 10%)"); process.exit(1); }
// Le point dans les 10% du bas collisionne.
if (!G.hitsSiegeFoot(5000 - 1, 5000 - st3.h * 0.05, 2, 2)) { console.log("FAIL: pas de collision dans les 10% du bas"); process.exit(1); }
console.log("collision OK : emprise = 10% du bas du PNG");

console.log("OK tour de siege");

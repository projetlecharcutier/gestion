// Zombies qui passent le mur : chaque zombie a l'interieur de la ville choisit
// sa cible finale une seule fois -- 50% mairie, 30% tour a proximite, 20%
// joueur le plus proche. Dehors : pas de choix (cible du groupe). Et la horde
// suit son meneur (zombie vivant le plus proche de la mairie).
var fs = require("fs"), path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
function load(f) { (0, eval)(fs.readFileSync(path.join(REPO, "src", f), "utf8")); }
["config.js", "projection.js", "world.js", "flowfield.js", "player.js", "walls.js", "towers.js", "chop.js", "weapons.js", "birds.js", "siege.js", "zombies.js"].forEach(load);
var G = global.GAME;
G.hasSprite = function () { return false; };
G.houseNames = function () { return []; };
G.foretNames = function () { return []; };
G.updateHud = function () {};
G.foretAt = function () { return null; };
G.aabbHitsForets = function () { return false; };
G.wallsInRange = function () { return []; };
G.wallsNear = function () { return []; };
G.aabbHitsWalls = function () { return false; };
G.aabbHitsVillesCenter = function () { return false; };
G.hitsSiegeFoot = function () { return null; };
G.state = {
  time: 0, clock: 12, day: 0, waveActive: true, zombieMode: "attack", waveSpawnedForDay: true,
  player: { x: G.WORLD / 2, y: G.WORLD / 2 + 140, hp: 100 },
  zombies: [], zombieGroups: [],
  walls: [], towers: [], buildings: [], projectiles: [], deadTraces: [],
  planks: 0, mairieGold: 0, mouse: { inside: false },
  pendingWave: null, waveCount: 0, zombieRamp: 1, lastShot: null,
  items: [], birds: [], groupMergeTimer: 0
};
// Mairie au centre-ville + une tour proche + un joueur proche.
G.state.buildings.push({ x: G.TOWN_MIN + 400, y: G.TOWN_MIN + 400, w: 100, h: 100, isMairie: true, hp: 1000 });
var mairie = G.state.buildings[0];
G.state.towers.push({ x: G.TOWN_MIN + 300, y: G.TOWN_MIN + 300, w: 40, h: 40, hp: 200 });
var tour = G.state.towers[0];

function mkZombie(x, y) {
  var grp = { x: x, y: y, members: [], hasRaider: false, spawnSide: -1, formation: 0, formPhase: 0, isHorde: false, retreat: false, hordeMsgShown: false, navSide: -1, navT: 0.5 };
  var z = {
    x: x, y: y, hp: 2, atkCd: 0, wallCd: 0, group: grp,
    slotAng: 0, slotDist: 0, slotAngT: 0, slotDistT: 0,
    speedFactor: 1, wanderPhase: 0, wanderFreq: 1,
    blockedSides: 0, harasser: false, raider: false, wallBreaker: false,
    seekDir: 0, lunge: 0, lungeDx: 0, lungeDy: 0, isLeader: true
  };
  grp.members.push(z);
  G.state.zombies.push(z);
  G.state.zombieGroups.push(grp);
  return z;
}

// --- 1) Dehors : aucun choix memorise ---
var outZ = mkZombie(G.TOWN_MIN - 400, G.TOWN_MIN - 400);
G.updateZombies(0.05);
assert(!outZ.breachTarget, "zombie hors ville : pas de breachTarget");
G.state.zombies = []; G.state.zombieGroups = [];

// --- 2) Dedans : choix unique, repartition 50/30/20 ---
var counts = { mairie: 0, tour: 0, joueur: 0 };
var N = 3000;
for (var i = 0; i < N; i++) {
  var z = mkZombie(G.TOWN_MIN + 200 + (i % 40), G.TOWN_MIN + 200 + (i % 40));
  z.x = G.TOWN_MIN + 200; z.y = G.TOWN_MIN + 200;
}
// Les zombies de tous les groupes sont dedans : update les fait choisir.
G.updateZombies(0.05);
for (var j = 0; j < G.state.zombies.length; j++) {
  var bt = G.state.zombies[j].breachTarget;
  assert(!!bt, "zombie dedans : breachTarget pose");
  if (bt) counts[bt.kind]++;
}
console.log("repartition:", JSON.stringify(counts), "sur", N);
assert(counts.mairie > N * 0.40 && counts.mairie < N * 0.60, "mairie ~50% (obtenu " + (counts.mairie / N * 100).toFixed(1) + "%)");
assert(counts.tour > N * 0.22 && counts.tour < N * 0.38, "tour ~30% (obtenu " + (counts.tour / N * 100).toFixed(1) + "%)");
assert(counts.joueur > N * 0.12 && counts.joueur < N * 0.28, "joueur ~20% (obtenu " + (counts.joueur / N * 100).toFixed(1) + "%)");

// --- 3) Le choix est stable (memorise une seule fois) ---
var z0 = G.state.zombies[0];
var kind0 = z0.breachTarget.kind;
for (var k = 0; k < 20; k++) G.updateZombies(0.05);
assert(z0.breachTarget.kind === kind0, "breachTarget stable dans le temps");

// --- 4) Cible effective coherente avec le choix ---
// Un zombie "mairie" proche de la mairie doit lui infliger des degats.
G.state.zombies = []; G.state.zombieGroups = [];
var zm = mkZombie(mairie.x + mairie.w / 2, mairie.y + mairie.h / 2 + 30);
zm.breachTarget = null;
var hp0 = mairie.hp;
for (var m = 0; m < 40; m++) G.updateZombies(0.05);
var hitMairie = mairie.hp < hp0;
// Un zombie "tour" colle a la tour doit l'attaquer.
G.state.zombies = []; G.state.zombieGroups = [];
var zt = mkZombie(tour.x + tour.w + 15, tour.y + tour.h / 2);
zt.breachTarget = null;
var thp0 = tour.hp;
for (var t2 = 0; t2 < 40; t2++) G.updateZombies(0.05);
var hitTour = tour.hp < thp0;
console.log("attaque mairie:", hitMairie, "| attaque tour:", hitTour);
assert(hitMairie || hitTour, "un zombie dedans attaque bien sa cible (mairie ou tour)");
if (hitMairie) console.log("OK: zombie mairie attaque la mairie (hp " + hp0 + " -> " + mairie.hp + ")");
if (hitTour) console.log("OK: zombie tour attaque la tour (hp " + thp0 + " -> " + tour.hp + ")");

// --- 5) Horde suit son meneur (zombie le plus proche de la mairie) ---
// Un groupe loin suivi : sa cible de marche doit viser le meneur (frontZ).
G.state.zombies = []; G.state.zombieGroups = [];
var leader = mkZombie(G.TOWN_MIN - 30, G.TOWN_MIN - 30); // le plus proche de la mairie
var grpFar = { x: G.TOWN_MIN - 800, y: G.TOWN_MIN - 800, members: [], hasRaider: false, spawnSide: -1, formation: 0, formPhase: 0, isHorde: false, retreat: false, hordeMsgShown: false, navSide: -1, navT: 0.5 };
var zFar = {
  x: G.TOWN_MIN - 800, y: G.TOWN_MIN - 800, hp: 2, atkCd: 0, wallCd: 0, group: grpFar,
  slotAng: 0, slotDist: 0, slotAngT: 0, slotDistT: 0, speedFactor: 1,
  wanderPhase: 0, wanderFreq: 1, blockedSides: 0, harasser: false, raider: false,
  wallBreaker: false, seekDir: 0, lunge: 0, lungeDx: 0, lungeDy: 0, isLeader: true
};
grpFar.members.push(zFar);
G.state.zombies.push(zFar);
G.state.zombieGroups.push(grpFar);
// Le meneur est a > 250 px de la mairie : le groupe loin doit marcher vers lui.
// On verifie via la distance groupe->meneur qui diminue.
var d0 = Math.sqrt((grpFar.x - leader.x) * (grpFar.x - leader.x) + (grpFar.y - leader.y) * (grpFar.y - leader.y));
for (var w = 0; w < 100; w++) G.updateZombies(0.05);
var d1 = Math.sqrt((grpFar.x - leader.x) * (grpFar.x - leader.x) + (grpFar.y - leader.y) * (grpFar.y - leader.y));
console.log("groupe -> meneur: " + d0.toFixed(1) + " -> " + d1.toFixed(1));
assert(d1 < d0, "le groupe converge vers le zombie le plus proche de la mairie");

console.log(fails === 0 ? "OK zombies : breach 50/30/20 + horde suit le meneur" : "ZOMBIES BREACH ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);

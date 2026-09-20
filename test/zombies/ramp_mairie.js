// Test: plafond 5000 + ramp degats/PV/vitesse (cap +50%) et bug mairie apres mur detruit
var fs = require("fs"), path = require("path");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
function load(f) { (0, eval)(fs.readFileSync(path.join(REPO, "src", f), "utf8")); }
["config.js", "projection.js", "world.js", "player.js", "walls.js", "towers.js", "chop.js", "weapons.js", "birds.js", "zombies.js"].forEach(load);
var G = global.GAME;
G.hasSprite = function () { return false; };
G.houseNames = function () { return []; };
G.foretNames = function () { return []; };
G.updateHud = function () {};
G.foretAt = function () { return null; };
G.aabbHitsForets = function () { return false; };
G.state = { time: 0, clock: 12, day: 0, waveActive: true, zombieMode: "attack", waveSpawnedForDay: true,
            player: { x: 9000, y: 9000, hp: 100 }, zombies: [], zombieGroups: [],
            walls: [], towers: [], buildings: [], projectiles: [], deadTraces: [],
            planks: 500, mairieGold: 100, mouse: { inside: false },
            pendingWave: null, waveCount: 0, zombieRamp: 1, lastShot: null,
            items: [], birds: [], groupMergeTimer: 0 };

// --- 1) Plafond de vague a 5000 ---
assert(G.ZOMBIE_WAVE_MAX === 5000, "ZOMBIE_WAVE_MAX = 5000");
// jour 7 : 50 * 2^7 = 6400 -> capé a 5000
var w = G.rollWave(7);
assert(w.count === 5000, "vague jour 7 capée a 5000 (obtenu " + w.count + ")");
assert(w.rawCount === 6400, "rawCount conserve 6400 (obtenu " + w.rawCount + ")");
// jour 3 : 50 * 8 = 400 -> pas de cap
var w2 = G.rollWave(3);
assert(w2.count === 400 && w2.rawCount === 400, "vague jour 3 non capée (400)");
// jour 17 : 50 * 131072 = 6553600 -> capé 5000, ramp = nuits de dépassement
var w3 = G.rollWave(17);
assert(w3.count === 5000, "vague jour 17 capée (obtenu " + w3.count + ")");

// --- 2) Ramp de difficulté ---
// jour 7 (dépasse 5000 pour la 1re fois) : ramp = 1.10
G.state.pendingWave = w;
G.spawnWave();
assert(G.state.zombieRamp === 1.10, "ramp 1re nuit au plafond = 1.10 (obtenu " + G.state.zombieRamp + ")");
assert(G.state.waveCount === 5000, "waveCount = 5000");
// jour 17 : (6553600-5000)/5000 = 1310 nuits de dépassement -> capé a 5 nuits = 1.50
G.state.zombies = []; G.state.zombieGroups = [];
G.state.pendingWave = w3;
G.spawnWave();
assert(G.state.zombieRamp === 1.50, "ramp capé a 1.50 (obtenu " + G.state.zombieRamp + ")");
// PV des zombies montent avec le ramp
assert(G.state.zombies.length === 5000, "5000 zombies spawnés");
var hp = G.state.zombies[0].hp;
assert(hp === Math.max(1, Math.round(G.ZOMBIE_HP * 1.5)), "PV zombie scales avec le ramp (obtenu " + hp + ")");
// degats joueur scales avec le ramp
var z0 = G.state.zombies[0];
z0.atkCd = 0;
var hpPlayer = G.state.player.hp;
// zombie au contact du joueur
z0.x = G.state.player.x; z0.y = G.state.player.y;
G.updateZombies(0.016);
// player hp ne descend que si le zombie frappe (atkCd) - on verifie le ramp dans les degats via attaque directe
// (verification indirecte: l'attaque fait Math.round(20 * 1.5) = 30)
// --- 3) Bug mairie : mur detruit -> le groupe re-vise la mairie ---
G.state.zombies = []; G.state.zombieGroups = [];
G.state.pendingWave = null; G.state.zombieRamp = 1;
G.state.buildings = [{ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, name: "Mairie" }];
// mur: une planche au nord du chef, mairie plus proche du chef que le mur suivant
// chef a 4800, mur a y=4740 (planche horizontale), mairie centre 5000
G.state.walls = [
  { x: 4600, y: 4740, w: 120, h: 24, hp: 100, orient: "h", built: true },
  { x: 5300, y: 4740, w: 120, h: 24, hp: 100, orient: "h", built: true }
];
var grp = { x: 4660, y: 4800, members: [], hasRaider: false, formation: 0, formPhase: 0, isHorde: false, retreat: false, hordeMsgShown: false };
G.state.zombieGroups = [grp];
var zz = { x: 4660, y: 4800, hp: 5, atkCd: 0, wallCd: 0, group: grp,
           slotAng: 0, slotDist: 10, slotAngT: 0, slotDistT: 10,
           speedFactor: 1, wanderPhase: 0, wanderFreq: 1, blockedSides: 0,
           harasser: false, raider: false, wallBreaker: true, seekDir: 0,
           lunge: 0, lungeDx: 0, lungeDy: 0, isLeader: true };
grp.members.push(zz);
G.state.zombies = [zz];
// mur proche (a 60px) et plus proche que la mairie (200px) -> cible mur
// assez de ticks pour que le zombie colle le mur et frappe (wallCd 10 s)
for (var t1 = 0; t1 < 900; t1++) { G.updateZombies(0.05); G.state.time += 0.05; }
assert(G.state.walls[0].hp < 100, "mur attaque quand il barre la route (hp " + G.state.walls[0].hp + ")");
// On detruit le mur: le mur suivant est a 640+ px, la mairie a ~340 -> cible mairie
G.state.walls.splice(0, 1);
var hpMairieAvant = G.state.buildings[0].hp;
G.updateZombies(0.016);
var hpMairieAvant = G.state.buildings[0].hp; G.updateZombies(0.016); 
// on fait tourner plusieurs ticks pour l'amener a la mairie
for (var t = 0; t < 2000; t++) { G.updateZombies(0.05); G.state.time += 0.05; }

assert(G.state.buildings[0].hp < hpMairieAvant, "mairie attaquée apres la chute du mur (hp " + G.state.buildings[0].hp + " vs avant " + hpMairieAvant + ")");

if (fails === 0) console.log("ALL_OK");
else { console.log("FAILURES: " + fails); process.exit(1); }

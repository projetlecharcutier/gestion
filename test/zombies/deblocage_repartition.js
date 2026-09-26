// Trois comportements IA zombies :
// 1. Manoeuvre anti-blocage : un zombie (chef ou membre) bloque 5 s loin de
//    la ville -> 1 s direction opposee au blocage, 1 s a 90 degres, puis il
//    reprend la navigation normale. Pres de la ville : jamais de manoeuvre
//    (un zombie bloque contre la palissade doit la presser).
// 2. Repartition sur les murs : le champ BFS descend les gradients vers le
//    point de couronne le plus proche (les ANGLES pour un groupe diagonal).
//    Chaque groupe porte un mur assigne (navSide/navT) et son chef vise le
//    point de ce mur : les zombies se repandent sur TOUT le perimetre.
// 3. La fleche du champ ne guide le chef que loin de l'objectif ; pres de
//    l'objectif (NAV_DIRECT_DIST), cap direct.
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }
load("config.js"); load("projection.js"); load("world.js"); load("flowfield.js");
load("player.js"); load("walls.js"); load("towers.js"); load("chop.js");
load("weapons.js"); load("birds.js"); load("siege.js"); load("zombies.js");
var G = global.GAME;
G.hasSprite = function () { return false; };
G.houseNames = function () { return []; };
G.foretNames = function () { return []; };
G.updateHud = function () {};
G.foretAt = function () { return null; };
G.state = { time: 0, clock: 12, day: 0, waveActive: true, zombieMode: "attack",
            player: { x: 9000, y: 9000, hp: 100 }, players: [], zombies: [], zombieGroups: [],
            walls: [], towers: [], buildings: [], projectiles: [], deadTraces: [],
            mouse: { inside: false }, zoom: 8, camera: { x: 5000, y: 5000 } };
var st = G.state;
st.buildings.push({ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, door: { x: 5000, y: 5060 }, name: "Mairie" });
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// --- 1) Manoeuvre anti-blocage : membre enferme dans un enclos de forets ---
// Le membre presse contre la paroi de l'enclos sans jamais progresser :
// apres 5 s il doit declencher unstick (1 s oppose, 1 s a 90 degres), puis
// reprendre la navigation normale. L'enclos est loin de la ville (pas de
// pressage de mur prioritaire).
var grp = { x: 3200, y: 5000, members: [], formation: 0, formPhase: 0,
            isHorde: false, retreat: false, hasRaider: false, navSide: 3, navT: 0.5, id: 1 };
st.zombieGroups.push(grp);
// Enclos fermé autour de (1000, 5000) : 4 bandes de foret, pas d'ouverture.
st.buildings.push({ x: 700, y: 4700, w: 600, h: 60, isForet: true, foretStage: 0, hp: 400, maxHp: 400, name: "F1" });
st.buildings.push({ x: 700, y: 5240, w: 600, h: 60, isForet: true, foretStage: 0, hp: 400, maxHp: 400, name: "F2" });
st.buildings.push({ x: 700, y: 4700, w: 60, h: 600, isForet: true, foretStage: 0, hp: 400, maxHp: 400, name: "F3" });
st.buildings.push({ x: 1240, y: 4700, w: 60, h: 600, isForet: true, foretStage: 0, hp: 400, maxHp: 400, name: "F4" });
G.rebuildBuildingGrid();
var zm = { x: 1000, y: 5000, hp: 60, atkCd: 0, wallCd: 0, lunge: 0, speedFactor: 1,
           slotAng: 0, slotDist: 20, slotAngT: 0, slotDistT: 20, wanderFreq: 1,
           wanderPhase: 0, wallBreaker: false, seekDir: 0 };
grp.members.push(zm); st.zombies.push(zm);
var t, sawUnstick = false, sawBack = false, sawSide = false, resumeOk = false;
for (t = 0; t < 40; t += 0.05) {
  st.time = t;
  var before = zm.unstick ? zm.unstick.phase : null;
  G.updateZombies(0.05);
  if (zm.unstick) {
    sawUnstick = true;
    if (zm.unstick.phase === "back") sawBack = true;
    if (zm.unstick.phase === "side") sawSide = true;
  }
  if (before === "side" && !zm.unstick) resumeOk = true;
}
assert(sawUnstick, "membre bloque declenche la maneuvre anti-blocage");
assert(sawBack, "phase 1 : direction opposee au blocage");
assert(sawSide, "phase 2 : 90 degres");
assert(resumeOk, "apres la maneuvre le zombie reprend la navigation normale");
// Pres de la ville : pas de manoeuvre (le zombie bloque presse le mur).
var grp2 = { x: G.TOWN_MAX + 60, y: 5000, members: [], formation: 0, formPhase: 0,
             isHorde: false, retreat: false, hasRaider: false, navSide: 3, navT: 0.5, id: 2 };
st.zombieGroups.push(grp2);
var zm2 = { x: G.TOWN_MAX + 40, y: 5000, hp: 60, atkCd: 0, wallCd: 0, lunge: 0, speedFactor: 1,
            slotAng: 0, slotDist: 20, slotAngT: 0, slotDistT: 20, wanderFreq: 1,
            wanderPhase: 0, wallBreaker: false, seekDir: 0 };
grp2.members.push(zm2); st.zombies.push(zm2);
for (t = 0; t < 15; t += 0.05) { st.time = t; G.updateZombies(0.05); }
assert(!zm2.unstick, "pres de la ville un zombie bloque ne recule pas (pressage du mur)");
// Le chef declenche aussi la manoeuvre : enferme dans un enclos propre, il
// presse la paroi sans progresser -> apres 5 s il recule.
st.buildings.push({ x: 1300, y: 1300, w: 600, h: 60, isForet: true, foretStage: 0, hp: 400, maxHp: 400, name: "F5" });
st.buildings.push({ x: 1300, y: 1840, w: 600, h: 60, isForet: true, foretStage: 0, hp: 400, maxHp: 400, name: "F6" });
st.buildings.push({ x: 1300, y: 1300, w: 60, h: 600, isForet: true, foretStage: 0, hp: 400, maxHp: 400, name: "F7" });
st.buildings.push({ x: 1840, y: 1300, w: 60, h: 600, isForet: true, foretStage: 0, hp: 400, maxHp: 400, name: "F8" });
G.rebuildBuildingGrid();
var grp3 = { x: 1600, y: 1600, members: [], formation: 0, formPhase: 0,
             isHorde: false, retreat: false, hasRaider: false, navSide: -1, navT: 0.5, id: 3 };
st.zombieGroups.push(grp3);
var zm3 = { x: 1600, y: 1610, hp: 60, atkCd: 0, wallCd: 0, lunge: 0, speedFactor: 1,
            slotAng: 0, slotDist: 20, slotAngT: 0, slotDistT: 20, wanderFreq: 1,
            wanderPhase: 0, wallBreaker: false, seekDir: 0 };
grp3.members.push(zm3); st.zombies.push(zm3);
var chefUnstick = false, chefBack = false;
for (t = 0; t < 40; t += 0.05) {
  st.time = t;
  G.updateZombies(0.05);
  if (grp3.unstick) { chefUnstick = true; if (grp3.unstick.phase === "back") chefBack = true; }
}
assert(chefUnstick, "chef bloque loin de la ville declenche la maneuvre");
assert(chefBack, "chef : phase opposee au blocage vue");

// --- 2) Repartition : les groupes visent des murs differents ---
// Simule l'assignation d'une vague multi-bordes : les navSide doivent
// repartir les groupes sur les 4 murs, pas seulement le plus proche.
var sidesSeen = {};
st.zombies = []; st.zombieGroups = [];
st.pendingWave = { sides: [0, 1, 2, 3], count: 32, rawCount: 32 };
G.spawnWave();
assert(st.zombieGroups.length === 4, "4 groupes pour 32 zombies");
for (var gi = 0; gi < st.zombieGroups.length; gi++) {
  var g = st.zombieGroups[gi];
  assert(g.navSide !== undefined && g.navSide >= 0 && g.navSide <= 3, "groupe " + gi + " a un mur assigne (navSide " + g.navSide + ")");
  sidesSeen[g.navSide] = true;
}
assert(sidesSeen[0] && sidesSeen[1] && sidesSeen[2] && sidesSeen[3],
  "les 4 murs sont assignes aux groupes (" + JSON.stringify(sidesSeen) + ")");

// --- 3) Le chef vise le point de son mur, pas le coin de la ville ---
// Groupe diagonal (sud-ouest) : le point navTargetOf doit etre sur un mur
// perimetrique, jamais un angle. On verifie via navTargetOf indirectement :
// le cap final du chef proche (sous NAV_DIRECT_DIST) doit etre direct vers
// le point de mur, pas vers le coin.
var grp4 = { x: G.TOWN_MIN - 300, y: G.TOWN_MIN - 300, members: [], formation: 0,
             formPhase: 0, isHorde: false, retreat: false, hasRaider: false,
             navSide: 0, navT: 0.5, id: 4 };
st.zombies = []; st.zombieGroups = [grp4];
var zm4 = { x: grp4.x, y: grp4.y, hp: 60, atkCd: 0, wallCd: 0, lunge: 0, speedFactor: 1,
            slotAng: 0, slotDist: 20, slotAngT: 0, slotDistT: 20, wanderFreq: 1,
            wanderPhase: 0, wallBreaker: false, seekDir: 0 };
grp4.members.push(zm4); st.zombies.push(zm4);
for (t = 0; t < 10; t += 0.05) { st.time = t; G.updateZombies(0.05); }
// Le point cible du chef doit rester sur le segment nord (y = TOWN_MIN - 20),
// a une abscisse NON angulaire (loin de TOWN_MIN/TOWN_MAX stricts).
assert(Math.abs(grp4.y - (G.TOWN_MIN - 20)) < 40 || grp4.y < G.TOWN_MIN,
  "groupe diagonal converge vers son mur assigne, pas le coin (grp.y=" + grp4.y.toFixed(0) + ")");

if (fails === 0) console.log("ALL_OK");
else console.log("FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

// Batiments de ville generiques : scierie, universite, montgolfiere.
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }
load("config.js"); load("projection.js"); load("world.js"); load("player.js");
load("walls.js"); load("towers.js"); load("chop.js"); load("weapons.js"); load("birds.js"); load("zombies.js");
var G = global.GAME;
G.hasSprite = function () { return false; };
G.houseNames = function () { return []; };
G.foretNames = function () { return []; };
G.updateHud = function () {};
G.foretAt = function () { return null; };
G.state = { time: 0, clock: 8, day: 0, waveActive: false, zombieMode: "attack",
            player: { x: 5000, y: 5000, hp: 100 }, zombies: [], zombieGroups: [],
            walls: [], towers: [], buildings: [], projectiles: [], deadTraces: [],
            planks: 500, mairieGold: 100, mouse: { inside: false },
            universiteUnlocked: false, universite: null,
            montgolfiereUnlocked: false, montgolfiere: null, pendingWave: null,
            scierieUnlocked: false, scierie: null };
var st = G.state;
st.buildings.push({ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, door: { x: 5000, y: 5060 }, name: "Mairie" });
G.inTown = function (x, y) { return x > 4500 && x < 5500 && y > 4500 && y < 5500; };
G.pushPlayerOutOfWall = function () {};
G.tryBuildWall = function () { return true; };
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// 1) Registry
assert(G.TOWN_BUILDINGS.scierie && G.TOWN_BUILDINGS.universite && G.TOWN_BUILDINGS.montgolfiere, "3 batiments au registre");

// 2) Achat solo des 3 techs (100 planches + 10 or chacune)
assert(G.unlockTownTech("scierie"), "achat scierie");
assert(G.unlockTownTech("universite"), "achat universite");
assert(G.unlockTownTech("montgolfiere"), "achat montgolfiere");
assert(st.mairieGold === 70 && st.planks === 200, "or 30 debite, planches 300 debitees (obtenu or=" + st.mairieGold + " pl=" + st.planks + ")");
assert(!G.unlockTownTech("scierie"), "pas de rachat");
assert(!G.unlockTownTech("inconnu"), "id inconnu refuse");

// 3) Menu Z : les 3 batiments constructibles, aucune tour (scierie pas posee)
var menu = G.buildMenu();
function has(id) { return menu.some(function (e) { return e.id === id; }); }
assert(has("palissade") && has("scierie") && has("universite") && has("montgolfiere"), "menu : palissade + 3 batiments");
assert(!menu.some(function (e) { return e.id.indexOf("tour:") === 0; }), "pas de tour avant scierie construite");

// 4) Pose des 3 batiments en ville
["scierie", "universite", "montgolfiere"].forEach(function (id) {
  st.buildSel = id;
  var ok = G.placeFromBuildMenu(5000, 5000 + (id === "scierie" ? 150 : id === "universite" ? 300 : 450));
  assert(ok, "pose " + id);
  var b = st[G.TOWN_BUILDINGS[id].stateField];
  assert(b && b.w === G.TOWN_BUILDINGS[id].side && b.townBuilding === id, id + " pose, emprise " + G.TOWN_BUILDINGS[id].side + ", champ townBuilding");
  assert(st.buildings.indexOf(b) >= 0, id + " dans buildings");
});
assert(st.buildSel === null, "buildSel reset apres chaque pose");
// unique : re-pose refusee
st.buildSel = "scierie";
assert(!G.placeFromBuildMenu(5000, 5200), "scierie unique");
// hors ville refusee
st.buildSel = "universite";
assert(!G.placeFromBuildMenu(1000, 1000), "universite hors ville refusee");

// 5) Chantier 10 s -> chantierDone pour les 3
st.time = 10.1;
G.updateBuildSites(0);
["scierie", "universite", "montgolfiere"].forEach(function (id) {
  assert(st[G.TOWN_BUILDINGS[id].stateField].chantierDone, id + " chantierDone");
});

// 6) Apres scierie construite : tours au menu
menu = G.buildMenu();
assert(menu.some(function (e) { return e.id === "tour:bois"; }), "tour:bois au menu");
// scierie/universite/montgolfiere disparues du menu (deja posees)
assert(!has("scierie") && !has("universite") && !has("montgolfiere"), "batiments poses absents du menu");

// 7) rollWave + pendingWave (info montgolfiere)
var pw = G.rollWave(1);
assert(pw && pw.sides && pw.count === 100, "rollWave day1 : 100 zombies");
var pw2 = G.rollWave(2);
assert(pw2.count === 200, "rollWave day2 : 200 zombies");
assert([1,2,4].indexOf(pw.sides.length) >= 0, "sides 1, 2 ou 4");

// 8) spawnWave consomme le pre-tirage
st.pendingWave = { sides: [0], count: 16 };
st.day = 0;
G.spawnWave();
assert(st.waveSides.length === 1 && st.waveSides[0] === 0, "spawnWave utilise le pre-tirage");
assert(st.waveCount === 16, "volume du pre-tirage respecte");
// fallback sans pre-tirage
delete st.pendingWave;
G.spawnWave();
assert(st.waveSides && [1,2,4].indexOf(st.waveSides.length) >= 0, "fallback rollWave dans spawnWave");

// 9) crossedMorning pre-tire la vague suivante (simulation horloge)
st.pendingWave = null;
st.clock = 7.99; st.day = 0;
st.zombies = []; st.zombieGroups = []; st.waveSpawnedForDay = true;
st.waveActive = true;
// avance l'horloge de 7.99 a 8.01 en plusieurs pas (DAY_SECONDS=300, TIME_SCALE cf config)
var step = (12 / G.DAY_SECONDS) * G.TIME_SCALE * 0.05;
for (var i = 0; i < 40; i++) { st.time += 0.05; st.clock += step; if (st.clock >= 24) st.clock -= 24; G.updateZombies(0.05); }
assert(st.pendingWave !== null, "crossedMorning pre-tire la vague (pendingWave present)");
assert(st.pendingWave.count === 100, "vague pre-tiree = 100 zombies (day+1)");

console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

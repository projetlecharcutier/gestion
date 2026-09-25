// Non-regression : un zombie dans un groupe loin de tout mur doit pousser
// vers l'objectif (mur) au lieu d'orbiter autour du chef.
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }
load("config.js"); load("projection.js"); load("world.js"); load("flowfield.js"); load("player.js");
load("walls.js"); load("towers.js"); load("chop.js"); load("weapons.js"); load("birds.js"); load("siege.js"); load("zombies.js");
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

// Mairie au centre
st.buildings.push({ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, door: { x: 5000, y: 5060 }, name: "Mairie" });

// Mur (palissade) a 300 px a l'ouest du groupe, long de 200 px, hp 300
var wall = { x: 4700, y: 4900, w: 24, h: 200, built: true, hp: 300, maxHp: 300 };
st.walls.push(wall);

// Mur ENTRE le groupe et la mairie : le chef s'arrete contre le mur (ld <= 10),
// les membres doivent atteindre le mur et l'attaquer.
var grp = { x: 4500, y: 5000, members: [], formation: 0, formPhase: 0, isHorde: false, retreat: false, hasRaider: false, id: 1 };
st.zombieGroups.push(grp);
for (var i = 0; i < 8; i++) {
  var z = { x: 4500, y: 5000, hp: 60, atkCd: 0, wallCd: 0, lunge: 0, speedFactor: 1,
            slotAng: 0, slotDist: 40, slotAngT: 0, slotDistT: 40, wanderFreq: 1, wanderPhase: i,
            wallBreaker: true };
  grp.members.push(z); st.zombies.push(z);
}
// Slots fixes autour du chef (pas de lerp aleatoire : on verifie le mouvement)
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// Simule 10 s par pas de 0.05 s : le zombie (demolisseur) doit atteindre le mur
// (distance au mur < ZOMBIE_WALL_HIT) au lieu d'orbiter autour du chef.
var hit = false, minDistWall = Infinity;
for (var t = 0; t < 10; t += 0.05) {
  st.time = t;
  G.updateZombies(0.05);
  for (var k = 0; k < st.zombies.length; k++) {
    var zz = st.zombies[k];
    var clx = Math.max(wall.x, Math.min(zz.x, wall.x + wall.w));
    var cly = Math.max(wall.y, Math.min(zz.y, wall.y + wall.h));
    var d = Math.sqrt((clx - zz.x) ** 2 + (cly - zz.y) ** 2);
    if (d < minDistWall) minDistWall = d;
    if (d < G.ZOMBIE_WALL_HIT) hit = true;
  }
}
assert(hit, "au moins un zombie atteint le mur en 10 s (distance min " + minDistWall.toFixed(1) + ")");
assert(wall.hp < 300, "le mur a ete endommage (hp " + wall.hp.toFixed(0) + ")");

// Cas 2 : mur plus proche du chef (d < 40) -> le groupe cible deja le mur
// (comportement existant, non-regression)
console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

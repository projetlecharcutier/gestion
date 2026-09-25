// Reproduit : groupe arrete a la muraille, membres en formation autour du chef.
// Ceux qui sont a plus de ZOMBIE_WALL_SENSE du mur doivent quand meme finir
// par attaquer la muraille au d'orbiter autour du chef.
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
            player: { x: 9000, y: 9000, hp: 100 }, zombies: [], zombieGroups: [],
            walls: [], towers: [], buildings: [], projectiles: [], deadTraces: [],
            mouse: { inside: false }, zoom: 8, camera: { x: 5000, y: 5000 } };
var st = G.state;
st.buildings.push({ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, door: { x: 5000, y: 5060 }, name: "Mairie" });

// Muraille verticale entre le groupe et la mairie, indestructible pour le test
var wall = { x: 4300, y: 4300, w: 24, h: 1400, built: true, hp: 999999, maxHp: 999999 };
st.walls.push(wall);

var grp = { x: 4000, y: 5000, members: [], formation: 0, formPhase: 0, isHorde: false, retreat: false, hasRaider: false };
st.zombieGroups.push(grp);
for (var i = 0; i < 8; i++) {
  var z = { x: 4000 + (i - 4) * 4, y: 5000 + ((i % 2) ? 4 : -4), hp: 60, atkCd: 0, wallCd: 0, lunge: 0,
            speedFactor: 1, slotAng: 0, slotDist: 20, slotAngT: 0, slotDistT: 20,
            wanderFreq: 1, wanderPhase: i, wallBreaker: false };
  grp.members.push(z); st.zombies.push(z);
}
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

function distWall(z) {
  var clx = Math.max(wall.x, Math.min(z.x, wall.x + wall.w));
  var cly = Math.max(wall.y, Math.min(z.y, wall.y + wall.h));
  return Math.sqrt((clx - z.x) ** 2 + (cly - z.y) ** 2);
}

var t;
for (t = 0; t < 25; t += 0.05) { st.time = t; G.updateZombies(0.05); }

var near = 0, far = [];
for (var k = 0; k < st.zombies.length; k++) {
  var d = distWall(st.zombies[k]);
  if (d < 100) near++; else far.push({ i: k, d: d.toFixed(0), x: st.zombies[k].x.toFixed(0) });
}
console.log("chef x=" + grp.x.toFixed(0) + " | pres du mur: " + near + "/8 | loin: " + JSON.stringify(far));
console.log("mur hp=" + wall.hp + " (degats infliges: " + (999999 - wall.hp).toFixed(0) + ")");
assert(wall.hp < 999999, "la muraille a ete attaquee");
assert(near >= 6, "au moins 6/8 zombies finissent pres de la muraille (obtenu " + near + ")");
assert(far.length === 0, "aucun zombie ne reste en orbite loin du mur (" + JSON.stringify(far) + ")");
console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

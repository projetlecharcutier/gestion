// Flow field : un membre de groupe bloque contre une foret doit suivre la
// fleche du champ (contourner le massif) et atteindre la palissade, au lieu
// de glisser en oscillant le long du contour.
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
G.state = { time: 0, clock: 12, day: 0, waveActive: true, zombieMode: "attack",
            player: { x: 9000, y: 9000, hp: 100 }, players: [], zombies: [], zombieGroups: [],
            walls: [], towers: [], buildings: [], projectiles: [], deadTraces: [],
            mouse: { inside: false }, zoom: 8, camera: { x: 5000, y: 5000 } };
var st = G.state;

// Mairie au centre (cible du flow field).
st.buildings.push({ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, door: { x: 5000, y: 5060 }, name: "Mairie" });

// Foret solide ENTRE le groupe et la ville : large enough to force le
// contournement, assez loin de la ville pour ne pas toucher la palissade.
st.buildings.push({ x: 3000, y: 4800, w: 800, h: 400, isForet: true, foretStage: 0, hp: 400, maxHp: 400, name: "Foret" });

// Palissade a l'ouest de la ville, assez longue pour couvrir le point
// d'arrivee du contournement (les zombies passent au nord de la foret).
var wall = { x: 4400, y: 4300, w: 24, h: 1000, built: true, hp: 300, maxHp: 300 };
st.walls.push(wall);

var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// Champ : BFS depuis le perimetre de la ville.
G.rebuildBuildingGrid();
assert(G.navGrid, "champ BFS construit");
assert(G.navDirX && G.navDirY, "fleches precalculees");
var cell = G.NAV_CELL;
var cols = G.navCols, rows = G.navRows;
var kForet = Math.floor(5000 / cell) * cols + Math.floor(3400 / cell);
assert(G.navGrid[kForet] === -1, "cellule dans la foret bloquee (dist -1)");
var kOuest = Math.floor(5000 / cell) * cols + Math.floor(2000 / cell);
assert(G.navGrid[kOuest] > 0, "cellule a l'ouest de la foret atteignable (dist " + G.navGrid[kOuest] + ")");

// Groupe a l'ouest de la foret : le chef et les membres doivent la contourner
// (nord ou sud) pour atteindre le mur a l'ouest de la ville.
var grp = { x: 2000, y: 5000, members: [], formation: 0, formPhase: 0, isHorde: false, retreat: false, hasRaider: false, id: 1 };
st.zombieGroups.push(grp);
for (var i = 0; i < 6; i++) {
  var z = { x: 2000, y: 5000, hp: 60, atkCd: 0, wallCd: 0, lunge: 0, speedFactor: 1,
            slotAng: 0, slotDist: 30, slotAngT: 0, slotDistT: 30, wanderFreq: 1, wanderPhase: i,
            wallBreaker: true };
  grp.members.push(z); st.zombies.push(z);
}

// navStep sur une cellule atteignable : fleche coherent avec le gradient
// (la cellule voisine visee a une distance BFS strictement inferieure).
var pt = G.navStep(2000, 5000);
assert(pt && pt.arrowX !== undefined, "navStep renvoie la fleche");
if (pt) {
  var tcx = Math.floor(pt.x / cell), tcy = Math.floor(pt.y / cell);
  var tk = tcy * cols + tcx;
  var sk = Math.floor(5000 / cell) * cols + Math.floor(2000 / cell);
  assert(G.navGrid[tk] < G.navGrid[sk], "fleche descend le gradient (vers la ville)");
}

// Simule 30 s : au moins un membre doit atteindre le mur (le chef contourne,
// les membres suivent fleches/slots).
var hit = false, minD = Infinity;
for (var t = 0; t < 30; t += 0.05) {
  st.time = t;
  G.updateZombies(0.05);
  for (var k = 0; k < st.zombies.length; k++) {
    var zz = st.zombies[k];
    var clx = Math.max(wall.x, Math.min(zz.x, wall.x + wall.w));
    var cly = Math.max(wall.y, Math.min(zz.y, wall.y + wall.h));
    var d = Math.sqrt((clx - zz.x) ** 2 + (cly - zz.y) ** 2);
    if (d < minD) minD = d;
    if (d < G.ZOMBIE_WALL_HIT) hit = true;
  }
}
assert(hit, "au moins un zombie atteint le mur en 30 s (distance min " + minD.toFixed(1) + ")");
assert(wall.hp < 300, "le mur a ete endommage (hp " + wall.hp.toFixed(0) + ")");

// Aucun zombie ne doit rester coince DANS la foret.
for (var k2 = 0; k2 < st.zombies.length; k2++) {
  var z2 = st.zombies[k2];
  var inside = z2.x > 3000 && z2.x < 3800 && z2.y > 4800 && z2.y < 5200;
  assert(!inside, "zombie " + k2 + " pas coince dans la foret (" + z2.x.toFixed(0) + "," + z2.y.toFixed(0) + ")");
}

if (fails === 0) console.log("OK flow field : contourne la foret et atteint la palissade");
process.exit(fails ? 1 : 0);

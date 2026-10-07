// Mode fantôme + tombes : à la mort d'un joueur, une tombe « rip - <nom> »
// reste à l'endroit du décès, le snapshot la diffuse à tous les clients, et
// le fantôme (espace après mort) ne peut plus interagir avec rien.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("a1", "alice");
srv.addPlayer("b2", "bob");
var pa = st.players[0], pb = st.players[1];
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// --- 1) Mort par zombie : tombe posée à l'endroit exact du décès ---
pa.x = 9000; pa.y = 9000;
var z = {
  x: pa.x + 5, y: pa.y, hp: 100, atkCd: 0, wallCd: 0,
  group: { x: pa.x, y: pa.y, members: [], formation: 0, formPhase: 0 },
  slotAng: 0, slotDist: 0, speedFactor: 1, wanderPhase: 0, wanderFreq: 1,
  hesitate: 0, harasser: false, raider: false, wallBreaker: false,
  seekDir: 0, lunge: 0, lungeDx: 0, lungeDy: 0, isLeader: true
};
z.group.members.push(z);
st.zombies.push(z);
st.zombieGroups.push(z.group);
for (var i = 0; i < 400 && pa.alive; i++) { st.time += 0.05; G.updateZombies(0.05); }
assert(!pa.alive, "alice morte par le zombie");
assert(pb.alive, "bob toujours vivant (la partie continue)");
assert(st.graves && st.graves.length === 1, "une tombe posée");
if (st.graves && st.graves.length === 1) {
  var g = st.graves[0];
  assert(g.x === Math.round(pa.x) && g.y === Math.round(pa.y),
    "tombe à l'endroit du décès (" + g.x + "," + g.y + " vs " + Math.round(pa.x) + "," + Math.round(pa.y) + ")");
  assert(g.name === "alice", "tombe au nom d'alice (rip - alice)");
}

// --- 2) Snapshot : la tombe est diffusée à tous les clients ---
var snap = srv.snapshot("b2");
assert(snap.graves && snap.graves.length === 1, "tombe dans le snapshot");
if (snap.graves && snap.graves.length === 1) {
  assert(snap.graves[0].name === "alice", "nom de la tombe dans le snapshot");
}

// --- 3) Un joueur mort ne peut plus interagir (inputs ignorés) ---
var wallsBefore = st.walls.length;
srv.applyInput("a1", { build: true, buildWall: { wx: pa.x + 60, wy: pa.y } });
for (var t2 = 0; t2 < 3; t2++) srv.tick(0.05);
assert(st.walls.length === wallsBefore, "le mort ne peut plus poser de mur");

// --- 4) Plafond de tombes : GRAVES_MAX respecté ---
for (var gi = 0; gi < G.GRAVES_MAX + 20; gi++) {
  G.spawnGrave(st, { id: "x" + gi, x: 100 + gi, y: 100 + gi }, "bot" + gi);
}
assert(st.graves.length <= G.GRAVES_MAX, "plafond de tombes (" + st.graves.length + " <= " + G.GRAVES_MAX + ")");

// --- 5) Idempotence : un joueur ne laisse qu'une tombe ---
var before = st.graves.length;
G.spawnGrave(st, pb, "bob");
G.spawnGrave(st, pb, "bob");
var bobGraves = st.graves.filter(function (gr) { return gr.name === "bob"; });
assert(bobGraves.length === 1, "une seule tombe par joueur");

if (fails === 0) console.log("OK mode fantôme + tombes");
process.exit(fails === 0 ? 0 : 1);

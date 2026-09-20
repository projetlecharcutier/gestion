var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("u1", "alice");
for (var i = 0; i < 80; i++) srv.tick(0.05);
var snap = srv.snapshot();
var size = JSON.stringify(snap).length;
console.log("taille snapshot: " + Math.round(size / 1024) + " Ko (" + size + " octets)");
console.log("items: " + snap.items.length + " | zombies: " + snap.zombies.length + " | walls: " + snap.walls.length + " | projectiles: " + snap.projectiles.length + " | birds: " + snap.birds.length);
// Nuit pleine (5000 zombies) pour mesurer le pire cas.
st.zombies = [];
for (var z = 0; z < 5000; z++) {
  st.zombies.push({ x: 1000, y: 1000, hp: 50, lunge: 0, lungeDx: 0, lungeDy: 0, isLeader: false, atkCd: 0, wallCd: 0, wanderFreq: 1, wanderPhase: 0, speedFactor: 1, slotAng: 0, slotDist: 0, wallBreaker: false, harasser: false, seekDir: 1 });
}
var snap2 = srv.snapshot();
var size2 = JSON.stringify(snap2).length;
console.log("nuit 5000 zombies: " + Math.round(size2 / 1024) + " Ko -> " + Math.round(size2 * 10 / 1024) + " Ko/s a 10 Hz");

var srv = require("../../server/game.js");
srv.startGame();
var st = srv.getState();
srv.addPlayer("u1", "alice");
for (var i = 0; i < 80; i++) srv.tick(0.05);
// Nuit pleine : 5000 zombies repartis autour de la ville.
var c = 5000 / 2; // centre ville
st.zombies = [];
for (var z = 0; z < 5000; z++) {
  var ang = Math.random() * Math.PI * 2;
  var dist = 200 + Math.random() * 3000;
  st.zombies.push({ x: c + Math.cos(ang) * dist, y: c + Math.sin(ang) * dist, hp: 50, lunge: 0, lungeDx: 0, lungeDy: 0, isLeader: false });
}
var snap = srv.snapshot("u1");
var size = JSON.stringify(snap).length;
console.log("snapshot personnalise (5000 zombies nuit): " + Math.round(size / 1024) + " Ko -> " + Math.round(size * 10 / 1024) + " Ko/s a 10 Hz");
console.log("zombies visibles: " + snap.zombies.length + "/5000");
// Sans playerId (compat): tout est envoye.
var snapAll = srv.snapshot();
console.log("snapshot global (compat): " + Math.round(JSON.stringify(snapAll).length / 1024) + " Ko, zombies: " + snapAll.zombies.length);

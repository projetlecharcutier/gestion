var srv = require("../../server/game.js");
srv.startGame();
var st = srv.getState();
st.clock = 21; st.day = 1; st.waveSpawnedForDay = true;
// Force une vague via le module
srv.G.spawnWave();
var sides = st.waveSides;
console.log("sides:", JSON.stringify(sides), "groups:", st.zombieGroups.length, "zombies:", st.zombies.length);
if (!sides || [1,2,4].indexOf(sides.length) < 0) { console.log("FAIL: sides invalide"); process.exit(1); }
for (var g = 0; g < st.zombieGroups.length; g++) {
  if (sides.indexOf(st.zombieGroups[g].spawnSide) < 0) { console.log("FAIL: groupe hors schema"); process.exit(1); }
}
console.log("ALL_OK");

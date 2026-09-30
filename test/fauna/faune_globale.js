// Animaux sauvages (cerf, cochon, vache, mouton) : spawn 200 betes hors
// ville, errance, mort par projectile avec drop de Nourriture, repop du
// matin pour revenir a 200.
var game = require("../../server/game.js");
var G = game.G;
game.startGame();
var st = G.state;

function fail(msg) { console.log("FAIL: " + msg); process.exit(1); }

// 1. Population initiale : 200 animaux sur la carte.
if (st.fauna.length !== G.FAUNA_COUNT) fail("faune initiale = " + st.fauna.length);
var types = {};
for (var i = 0; i < st.fauna.length; i++) {
  var a = st.fauna[i];
  if (!G.FAUNA_TYPES[a.type]) fail("type inconnu: " + a.type);
  types[a.type] = (types[a.type] || 0) + 1;
  // Aucun animal dans la ville (elle reste aux joueurs/zombies).
  if (Math.abs(a.x - G.WORLD / 2) < G.TOWN + 200 && Math.abs(a.y - G.WORLD / 2) < G.TOWN + 200) {
    fail("animal spawn en ville");
  }
}
for (var t in G.FAUNA_TYPES) {
  if (!(t in types)) fail("type absent du spawn: " + t);
}

// 2. Errance : updateFauna deplace les betes et les garde dans la carte.
var before = st.fauna.map(function (a) { return [a.x, a.y]; });
G.updateFauna(1);
var moved = 0;
for (var j = 0; j < st.fauna.length; j++) {
  var f = st.fauna[j];
  if (f.x < 0 || f.x > G.WORLD || f.y < 0 || f.y > G.WORLD) fail("animal hors carte");
  if (f.x !== before[j][0] || f.y !== before[j][1]) moved++;
}
if (moved === 0) fail("aucun animal ne se deplace");

// 3. Mort par projectile : degats, drop de Nourriture, cleanup.
var target = st.fauna[0];
var items0 = st.items.length;
st.projectiles.push({
  x: target.x, y: target.y, vx: 0, vy: 0,
  dmg: 50, life: 1, owner: "local", color: "#fff", type: "balle",
  size: 2, trail: [], piercing: false, pierceCount: 0, hitEntities: []
});
G.updateProjectiles(0.05);
if (target.hp > 0) fail("projectile n'a pas tue l'animal");
var dropped = false;
for (var k = st.items.length - 1; k >= items0; k--) {
  if (st.items[k].name === "Nourriture" && st.items[k].kind === "objet") { dropped = true; break; }
}
if (!dropped) fail("pas de Nourriture droppee");
G.cleanupFauna();
if (st.fauna.length >= G.FAUNA_COUNT) fail("cleanup n'a pas retire l'animal mort");

// 4. Repop du matin : retour a 200 betes.
st.day += 1;
G.repopFauna();
if (st.fauna.length !== G.FAUNA_COUNT) fail("repop = " + st.fauna.length);

console.log("OK faune : " + G.FAUNA_COUNT + " animaux (" + JSON.stringify(types) +
            "), errance, drop nourriture, repop matin");

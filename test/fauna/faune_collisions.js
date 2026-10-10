// Animaux : ils se hurtaient aux memes objets que le joueur/zombies
// (batiments solides, forets, villes PNG, palissades, tours de siege)
// au lieu de les traverser. Test de collision axe par axe + rebond.
var game = require("../../server/game.js");
var G = game.G;
game.startGame();
var st = G.state;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// 1) Mur : un animal lance vers une palissade s'arrete dessus et rebondit.
// Le mur est pose a un endroit garanti LIBRE (le monde aleatoire peut
// sinon couvrir la zone fixe d'un batiment/foret et l'animal reste coi).
var freeAt = null;
for (var fy = 7000; fy < 13000 && !freeAt; fy += 400) {
  for (var fx = 7000; fx < 13000 && !freeAt; fx += 400) {
    if (!G.aabbHitsBuildingsBox(fx - 200, fy - 250, 600, 300) &&
        !(G.aabbHitsForets && G.aabbHitsForets(fx, fy, 300)) &&
        !(G.aabbHitsVillesCenter && G.aabbHitsVillesCenter(fx, fy, 300)) &&
        (st.sieges || []).length === 0) freeAt = { x: fx, y: fy };
  }
}
var wallX = freeAt ? freeAt.x : 9200;
var wallY = freeAt ? freeAt.y : 9000;
st.walls = [{ x: wallX - 200, y: wallY, w: 400, h: 24, hp: 100, orient: "h", built: true }];
G.rebuildWallGrid();
// Point de depart libre : cherche une case vide au sud du mur (le monde
// aleatoire peut placer un batiment/foret exactement sur le point fixe).
var sx = wallX, sy = wallY - 100, found = false;
for (var tryy = 0; tryy < 80 && !found; tryy++) {
  sx = wallX + (tryy % 8) * 20 - 70;            // reste dans la largeur du mur
  sy = wallY - 100 - Math.floor(tryy / 8) * 60; // s'eloigne si la case est occupee
  if (!G.aabbHitsWalls(sx - 7, sy - 7, 14, 14) &&
      !(G.aabbHitsBuildingsBox && G.aabbHitsBuildingsBox(sx - 7, sy - 7, 14, 14)) &&
      !(G.aabbHitsForets && G.aabbHitsForets(sx, sy, 7)) &&
      !(G.aabbHitsVillesCenter && G.aabbHitsVillesCenter(sx, sy, 7))) found = true;
}
var a = { type: "cerf", x: sx, y: sy, vx: 0, vy: 110, hp: 3, wanderT: 99 };
st.fauna = [a];
// Assez de ticks pour atteindre le mur depuis le point de depart choisi
// (vitesse 110 px/s + marge pour le glissement le long du mur).
var distToWall = Math.max(0, wallY - (sy + 7));
var ticksNeeded = Math.ceil((distToWall + 200) / 11) + 5;
for (var i = 0; i < ticksNeeded; i++) G.updateFauna(0.1);
assert(a.y < wallY - 3 || a.x < wallX - 200 || a.x > wallX + 200, "l'animal ne traverse pas la palissade (y=" + a.y.toFixed(0) + ")");
assert(a.vy < 0, "l'animal rebondit (demi-tour) sur le mur");

// 2) Batiment solide : jamais a l'interieur de l'AABB d'une maison.
st.walls = [];
G.rebuildWallGrid();
var maison = null;
for (var b = 0; b < st.buildings.length; b++) {
  var bb = st.buildings[b];
  if (!bb.isForet && !bb.isDecor && !bb.decorPassable) { maison = bb; break; }
}
if (maison) {
  var hb = maison.hit || maison;
  var a2 = { type: "cochon", x: hb.x + hb.w / 2, y: hb.y - 30, vx: 0, vy: 70, hp: 3, wanderT: 99 };
  st.fauna = [a2];
  for (var k = 0; k < 60; k++) G.updateFauna(0.1);
  var inside = a2.y > hb.y && a2.y < hb.y + hb.h && a2.x > hb.x && a2.x < hb.x + hb.w;
  assert(!inside, "l'animal ne traverse pas le batiment solide");
} else {
  console.log("SKIP batiment : aucune maison solide dans ce monde");
}

// 3) Tour de siege : l'animal contourne au lieu de traverser.
st.sieges = [G.makeSiegeTower(7000, 7000, G.SIEGE_DIRS[3])];
var a3 = { type: "mouton", x: 7000, y: 6900, vx: 0, vy: 60, hp: 2, wanderT: 99 };
st.fauna = [a3];
for (var m = 0; m < 30; m++) G.updateFauna(0.1);
var d3 = G.siegeFootprint(st.sieges[0]);
var inSiege = a3.x > d3.x - 6 && a3.x < d3.x + d3.w + 6 && a3.y > d3.y - 6 && a3.y < d3.y + d3.h + 6;
assert(!inSiege, "l'animal ne traverse pas la tour de siege");
st.sieges = [];

// 4) Villes PNG : pas d'animal dans un batiment de ville solide apres errance.
st.fauna = [];
G.spawnFaunaAll();
for (var w = 0; w < 100; w++) G.updateFauna(0.1);
var violations = 0;
for (var f = 0; f < st.fauna.length; f++) {
  var an = st.fauna[f];
  var half = (G.FAUNA_TYPES[an.type].w || 12) / 2;
  if (G.aabbHitsVillesCenter && G.aabbHitsVillesCenter(an.x, an.y, half)) violations++;
}
assert(violations === 0, violations + " animaux dans une ville PNG apres errance");

console.log("----------------------------------------");
console.log("PASS: all  FAIL: " + fails);
process.exit(fails ? 1 : 0);

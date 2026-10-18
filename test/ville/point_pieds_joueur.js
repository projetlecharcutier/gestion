// Test: villes PNG - le JOUEUR est represente par UN SEUL PIXEL, le point
// sous ses pieds (x, y), pour la collision ET l'occlusion contre les villes.
// Le masque n'est PAS modifie : c'est le code qui change de contrat.
//
// Contrat verifie :
//   1) Collision : le point sous les pieds bloque exactement SUR le rouge
//      (jamais avant : l'ancienne AABB 6x6 bloquait 3 px trop tot) et laisse
//      passer le vert et le transparent (la zone verte laisse passer, quelle
//      que soit sa largeur : 1 cellule verte suffit).
//   2) Le rouge reste TOUJOURS bloquant : le joueur ne peut pas poser le
//      pied sur une cellule rouge, meme en venant d'une cellule verte.
//   3) Occlusion : le personnage est masque (mode 1, derriere le PNG) quand
//      le point sous les pieds est sur du VERT **ou** du ROUGE ; il est
//      devant (mode 2) quand le point est sur du TRANSPARENT.
//   4) Le deplacement reel (tryMove, moteur partage client/serveur) suit ce
//      contrat, et le code branche bien sur le point (pas l'AABB 6x6).
var game = require("../../server/game.js");
var G = game.G;
game.startGame();
var st = G.state;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

// 1) Une ville posee avec sa grille reelle (grille commitee ville-grids.json).
var v = st.villes.filter(function (x) { return x.sprite === "est"; })[0];
assert(v, "ville est posee");
var g = G.villeGrids.est;
assert(g, "grille est presente");
if (!v || !g) process.exit(1);

function cellAt(x, y) {
  var gx = Math.floor((x - g.ox) / g.cell);
  var gy = Math.floor((y - g.oy) / g.cell);
  if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return -1;
  return g.data[gy * g.cols + gx];
}
function centerOf(gx, gy) { return [g.ox + gx * g.cell + g.cell / 2, g.oy + gy * g.cell + g.cell / 2]; }
function valAt(gx, gy) {
  if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return -1;
  return g.data[gy * g.cols + gx];
}

// Cherche un pixel ROUGE avec un voisin TRANSPARENT (bord de mur) et un
// pixel VERT avec un voisin ROUGE (bord de zone derriere) + un pixel VERT
// avec un voisin TRANSPARENT (bord de zone derriere).
var redEdge = null, grnRed = null, grnFree = null;
var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
for (var gy = 1; gy < g.rows - 1 && (!redEdge || !grnRed || !grnFree); gy++) {
  for (var gx = 1; gx < g.cols - 1 && (!redEdge || !grnRed || !grnFree); gx++) {
    var c = valAt(gx, gy);
    if (c === 1 && !redEdge) {
      for (var d = 0; d < 4; d++) {
        if (valAt(gx + DIRS[d][0], gy + DIRS[d][1]) === 0) { redEdge = { x: gx, y: gy, d: d }; break; }
      }
    }
    if (c === 2) {
      var hasRed = false, hasFree = false;
      for (var d2 = 0; d2 < 4; d2++) {
        var nv = valAt(gx + DIRS[d2][0], gy + DIRS[d2][1]);
        if (nv === 1) hasRed = true;
        if (nv === 0) hasFree = true;
      }
      if (hasRed && !grnRed) grnRed = { x: gx, y: gy };
      if (hasFree && !grnFree) grnFree = { x: gx, y: gy };
    }
  }
}
assert(redEdge, "grille est : rouge avec voisin transparent trouve (bord de mur)");
assert(grnRed, "grille est : vert avec voisin rouge trouve (bord derriere)");
assert(grnFree, "grille est : vert avec voisin transparent trouve");
if (!redEdge || !grnRed || !grnFree) process.exit(1);

// --- 2) Contrat du point sous les pieds : villeMaskAtFoot / aabbHitsVilles point
var redC = centerOf(redEdge.x, redEdge.y);
var grnC = centerOf(grnFree.x, grnFree.y);
assert(G.villeMaskAtFoot(redC[0], redC[1]) === 1, "villeMaskAtFoot : rouge -> 1 (solide)");
assert(G.villeMaskAtFoot(grnC[0], grnC[1]) === 2, "villeMaskAtFoot : vert -> 2 (derriere)");
assert(G.aabbHitsVilles(redC[0], redC[1], 0, 0, { point: true }) === true, "aabbHitsVilles point : rouge bloque");
assert(G.aabbHitsVilles(grnC[0], grnC[1], 0, 0, { point: true }) === false, "aabbHitsVilles point : vert ne bloque PAS");
// Le voisin transparent du rouge reste libre en mode point : l'ancienne AABB
// 6x6 bloquait 3 px avant le mur (le carre debordait sur le rouge).
var freeNb = { x: redEdge.x + DIRS[redEdge.d][0], y: redEdge.y + DIRS[redEdge.d][1] };
var freeC = centerOf(freeNb.x, freeNb.y);
assert(valAt(freeNb.x, freeNb.y) === 0, "le voisin du rouge est bien transparent");
assert(G.aabbHitsVilles(freeC[0], freeC[1], 0, 0, { point: true }) === false,
  "point : cellule transparente a cote du rouge = libre (pas de blocage anticipe)");
// L'AABB pleine, elle, bloque bien 3 px avant (preuve que le contrat point
// est distinct et corrige le decalage) : la boite 6x6 centree sur le voisin
// transparent deborde sur le rouge.
assert(G.aabbHitsVilles(freeC[0] - 3, freeC[1] - 3, 6, 6) === true,
  "AABB 6x6 sur le voisin transparent touche le rouge (l'ancien contrat bloquait trop tot)");

// --- 3) Deplacement reel du joueur (tryMove, moteur partage client/serveur)
function placePlayer(x, y) { st.player.x = x; st.player.y = y; }
// 3a) Le joueur sur le transparent avance JUSQU'A la limite du rouge : le
//     pas qui poserait le pied DANS le rouge est refuse en x, et le joueur
//     reste colle au bord (jamais 3 px avant).
placePlayer(freeC[0], freeC[1]);
var okA = G.tryMove(redC[0], redC[1]); // tente d'entrer dans le rouge
assert(st.player.x !== redC[0] || st.player.y !== redC[1], "tryMove : le pied ne pose jamais sur le rouge");
assert(cellAt(st.player.x, st.player.y) !== 1, "tryMove : le joueur n'occupe jamais une cellule rouge");
// 3b) Le joueur traverse une zone VERTE : le vert ne bloque pas. On approche
//     le vert depuis son voisin transparent, on y entre, on en ressort.
var grnNbFree = null;
for (var d3 = 0; d3 < 4 && !grnNbFree; d3++) {
  if (valAt(grnFree.x + DIRS[d3][0], grnFree.y + DIRS[d3][1]) === 0) {
    grnNbFree = { x: grnFree.x + DIRS[d3][0], y: grnFree.y + DIRS[d3][1] };
  }
}
var grnIn = centerOf(grnFree.x, grnFree.y);
var grnOut = centerOf(grnNbFree.x, grnNbFree.y);
placePlayer(grnOut[0], grnOut[1]);
var okB = G.tryMove(grnIn[0], grnIn[1]);
assert(okB, "tryMove : le joueur ENTRE dans une zone VERTE (le vert ne bloque pas)");
assert(cellAt(st.player.x, st.player.y) === 2, "tryMove : le joueur est bien sur la cellule verte");
// Traverse dans l'autre sens (sortie du vert).
placePlayer(grnIn[0], grnIn[1]);
var okB2 = G.tryMove(grnOut[0], grnOut[1]);
assert(okB2, "tryMove : le joueur SORT de la zone verte (1 cellule de large suffit)");
// 3c) Rouge toujours bloquant depuis le vert : un joueur sur une cellule
//     verte ne peut pas poser le pied sur la cellule rouge adjacente.
var grnNbRed = null;
for (var d4 = 0; d4 < 4 && !grnNbRed; d4++) {
  if (valAt(grnRed.x + DIRS[d4][0], grnRed.y + DIRS[d4][1]) === 1) {
    grnNbRed = { x: grnRed.x + DIRS[d4][0], y: grnRed.y + DIRS[d4][1] };
  }
}
var grnC2 = centerOf(grnRed.x, grnRed.y);
var redC2 = centerOf(grnNbRed.x, grnNbRed.y);
placePlayer(grnC2[0], grnC2[1]);
G.tryMove(redC2[0], redC2[1]); // tente de poser le pied sur le rouge
assert(cellAt(st.player.x, st.player.y) !== 1,
  "tryMove : depuis le vert, poser le pied sur le ROUGE reste bloque (rouge toujours bloquant)");

// --- 4) Occlusion : le point sous les pieds decide du masquage
var infoGrn = G.villeCellInfo(grnC[0], grnC[1]);
assert(infoGrn && infoGrn.mode === 1, "occlusion : pieds sur VERT -> mode 1 (masque, derriere le PNG)");
var infoRed = G.villeCellInfo(redC[0], redC[1]);
assert(infoRed && infoRed.mode === 1, "occlusion : pieds sur ROUGE -> mode 1 (jamais devant une facade rouge)");
var infoFree = G.villeCellInfo(freeC[0], freeC[1]);
assert(infoFree && infoFree.mode === 2, "occlusion : pieds sur TRANSPARENT -> mode 2 (devant la ville)");

// --- 5) Le code du joueur branche bien sur le point (pas sur l'AABB 6x6).
var psrc = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "src", "player.js"), "utf8");
var pcode = psrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
assert(pcode.indexOf("G.playerHitsVilles(testX, testY)") !== -1, "_stepMove teste le POINT sous les pieds (pas l'AABB)");
assert(pcode.indexOf("G.playerHitsVilles(x, y)") !== -1, "posBlocked teste le POINT sous les pieds");
assert(pcode.indexOf("G.aabbHitsVilles(testX - G.PLAYER_HALF") === -1, "plus d'AABB 6x6 contre les villes dans _stepMove");

console.log("----------------------------------------");
console.log(fails === 0 ? "PASS point_pieds_joueur" : "POINT_PIEDS_JOUEUR ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);

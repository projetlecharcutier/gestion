// Test: anti-tunneling joueur vs villes PNG. Depuis le SUD, 30 px d'elance,
// le joueur marche vers 30 px AU NORD d'un mur rouge continu : il ne doit
// JAMAIS finir au nord du mur (le point sous les pieds teste a chaque
// sous-pas de 1 px pres des villes, cf. tryMove STEP_VILLE).
// Reproduit le bug 33c8cd5 : un sous-pas de 8 px testait seulement le point
// d'arrivee et sautait les murs fins des masques.
var game = require("../../server/game.js");
var G = game.G;
game.startGame();
var st = G.state;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

var tested = 0, leaked = 0;
(st.villes || []).forEach(function (v) {
  var g = G.villeGrids[v.sprite];
  if (!g) return;
  function cell(x, y) {
    var cx = Math.floor((x - g.ox) / g.cell), cy = Math.floor((y - g.oy) / g.cell);
    if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return -1;
    return g.data[cy * g.cols + cx];
  }
  // Mur continu >= 8 cellules rouges avec LIBRE au sud sur toute la longueur
  var wall = null;
  for (var gy = 1; gy < g.rows - 1 && !wall; gy++) {
    var run = 0;
    for (var gx = 1; gx < g.cols - 1; gx++) {
      if (g.data[gy * g.cols + gx] === 1) {
        run++;
        if (run >= 8 && g.data[(gy + 1) * g.cols + gx] === 0 &&
            g.data[(gy + 1) * g.cols + gx - run + 1] === 0) {
          wall = { gy: gy, gx0: gx - run + 1, gx1: gx };
          break;
        }
      } else run = 0;
    }
  }
  if (!wall) return; // pas de mur exploitable sur cette ville
  for (var gx = wall.gx0 + 1; gx < wall.gx1; gx++) {
    var wx = g.ox + gx * g.cell + g.cell / 2;
    var wy = g.oy + wall.gy * g.cell + g.cell / 2;
    if (cell(wx, wy + 30) !== 0) continue; // depart doit etre libre
    tested++;
    st.player.x = wx; st.player.y = wy + 30;
    G.tryMove(wx, wy - 30); // cible 30 px au NORD : doit traverser le mur
    if (st.player.y < wy - 0.5) {
      leaked++;
      console.log("  FUITE " + v.sprite + " gx=" + gx + " final(" + st.player.x.toFixed(1) + "," + st.player.y.toFixed(1) + ")");
    }
  }
});
assert(tested > 0, "au moins un mur continu teste (" + tested + " points)");
assert(leaked === 0, "aucune fuite a travers les murs (" + leaked + "/" + tested + ")");
console.log("----------------------------------------");
console.log(fails === 0 ? "PASS antitunnel_murs_ville" : "ANTITUNNEL_MURS_VILLE ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);

// Regression : en mode serveur, le buildMode du client doit etre replique par
// joueur (p._buildMode) pour que tryBuildWall autorise la pose loin du joueur
// (ceinturer la muraille). Avant le fix, le serveur restait hors build et
// rejetait toute pose a plus de WALL_BUILD_RANGE (180 px) par la garde de
// tryBuildWall : impossible de construire autour de la muraille.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
srv.addPlayer("p1", "A");
srv.addPlayer("p2", "B");
var st = srv.getState();
var p = st.players[0];
p.planks = 1000;
var base = st.walls.length;
// Point libre garanti : cherche en spirale un point a >600 px du joueur qui ne
// chevauche ni batiment ni mur pose (la garde anti-chevauchement de tryBuildWall
// refuse legitimentement un point sur un batiment/mur existant).
function farSpot(px, py) {
  var dims = G.plankDims();
  for (var r = 600; r < 4000; r += 40) {
    for (var a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      var wx = px + Math.cos(a) * r, wy = py + Math.sin(a) * r;
      var mx = wx - dims.w / 2, my = wy - dims.h / 2;
      var hit = false;
      for (var i = 0; i < st.buildings.length; i++) {
        var b = st.buildings[i];
        if (mx < b.x + b.w && mx + dims.w > b.x && my < b.y + b.h && my + dims.h > b.y) { hit = true; break; }
      }
      if (!hit) for (var j = 0; j < st.walls.length; j++) {
        var m = st.walls[j];
        if (mx < m.x + m.w && mx + dims.w > m.x && my < m.y + m.h && my + dims.h > m.y) { hit = true; break; }
      }
      if (!hit) return { x: wx, y: wy };
    }
  }
  return null;
}
var far = farSpot(p.x, p.y);
if (!far) { console.log("FAIL: aucun point libre trouve"); process.exit(1); }
// Pose loin EN mode build (input.build = true, comme le client envoie) : acceptee.
srv.applyInput("p1", { type: "input", build: true, dx: 0, dy: 0, fire: false,
                       buildWall: { wx: far.x, wy: far.y } });
srv.tick(0.05);
if (st.walls.length !== base + 1) { console.log("FAIL: pose loin en mode build refusee (" + st.walls.length + ")"); process.exit(1); }
// Un input d'un AUTRE joueur ne doit pas desactiver le mode build de p1 :
// la pose suivante de p1 reste acceptee meme apres un input build:false de p2.
srv.applyInput("p2", { type: "input", build: false, dx: 0, dy: 0, fire: false });
p.planks = 1000;
var far2 = farSpot(p.x, p.y);
p._buildWall = { x: far2.x, y: far2.y };
srv.tick(0.05);
if (st.walls.length !== base + 2) { console.log("FAIL: mode build ecrase par l input d un autre joueur (" + st.walls.length + ")"); process.exit(1); }
// Hors mode build : la limite de portee WALL_BUILD_RANGE s applique a nouveau.
srv.applyInput("p1", { type: "input", build: false, dx: 0, dy: 0, fire: false });
p.planks = 1000;
p._buildWall = { x: far2.x, y: far2.y };
srv.tick(0.05);
if (st.walls.length !== base + 2) { console.log("FAIL: pose loin hors build acceptee par erreur"); process.exit(1); }
// Pose proche hors build : acceptee (portee < 180 px, point libre garanti).
p.planks = 1000;
function nearSpot(px, py) {
  var dims = G.plankDims();
  for (var r = 20; r < 160; r += 10) {
    for (var a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      var wx = px + Math.cos(a) * r, wy = py + Math.sin(a) * r;
      var mx = wx - dims.w / 2, my = wy - dims.h / 2;
      var hit = false;
      for (var i = 0; i < st.buildings.length; i++) {
        var b = st.buildings[i];
        if (mx < b.x + b.w && mx + dims.w > b.x && my < b.y + b.h && my + dims.h > b.y) { hit = true; break; }
      }
      if (!hit) for (var j = 0; j < st.walls.length; j++) {
        var m = st.walls[j];
        if (mx < m.x + m.w && mx + dims.w > m.x && my < m.y + m.h && my + dims.h > m.y) { hit = true; break; }
      }
      if (!hit) return { x: wx, y: wy };
    }
  }
  return null;
}
var near = nearSpot(p.x, p.y);
if (!near) { console.log("FAIL: aucun point proche libre trouve"); process.exit(1); }
p._buildWall = { x: near.x, y: near.y };
srv.tick(0.05);
if (st.walls.length !== base + 3) { console.log("FAIL: pose proche hors build refusee (" + st.walls.length + ")"); process.exit(1); }
console.log("ALL_OK");

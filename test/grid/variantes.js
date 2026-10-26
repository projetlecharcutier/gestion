// Variantes de palissade (PNG A/B/C/H/K/X/Z) par contacts de coins.
// Verifie :
//   1. La palissade est la reference de la grille : longueur = G.BUILD_GRID
//      (emprise = une cellule), quelle que soit la rotation.
//   2. Le joueur ne choisit que la direction (A = NESO, B = NOSE) via
//      state.plankRotation ; la variante est calculee automatiquement.
//   3. Table des variantes selon les coins en contact avec un mur voisin :
//      C = SE+NE, H = SE+SO+NE, K = NE+NO+SE, X = 4 coins, Z = SO+NO.
//   4. Pose d'un voisin : les variantes des murs existants sont rafraichies.
//   5. Destruction (cleanupWalls) : les voisins perdent le contact.
//   6. drawWall choisit le sprite de la variante (fallback dir A/B), dessine
//      a l'echelle commune G.SPRITE_PX (taille stable, proportionnelle au zoom).
var fs = require("fs"), path = require("path");
var SRC = path.join(__dirname, "..", "..", "src");
global.window = global;
global.devicePixelRatio = 1;
var G = {}; global.GAME = G;
global.canvas = G.canvas = { width: 800, height: 600, getContext: function () { return null; } };
G.SPRITES = {};
G.hasSprite = function () { return false; };
G.spriteBounds = function () { return null; };
G.houseNames = function () { return []; };
G.foretNames = function () { return ["foret1", "foret2"]; };
var ctxStub = {
  setTransform: function () {}, fillRect: function () {}, strokeRect: function () {},
  clearRect: function () {}, beginPath: function () {}, closePath: function () {},
  moveTo: function () {}, lineTo: function () {}, arc: function () {}, fill: function () {},
  stroke: function () {}, save: function () {}, restore: function () {},
  translate: function () {}, rotate: function () {}, scale: function () {},
  drawImage: function (img, x, y, w, h) { ctxStub._lastDraw = { w: w, h: h, x: x, y: y }; },
  fillText: function () {}, strokeText: function () {},
  measureText: function () { return { width: 10 }; },
  setLineDash: function () {},
  imageSmoothingEnabled: false, globalAlpha: 1, fillStyle: "", strokeStyle: "",
  lineWidth: 1, font: "", textAlign: "", textBaseline: ""
};
global.document = {
  getElementById: function () {
    return { width: 800, height: 600, getContext: function () { return ctxStub; }, addEventListener: function () {}, style: {} };
  }
};
function load(f) { (0, eval)(fs.readFileSync(path.join(SRC, f), "utf8")); }
["config.js", "state.js", "projection.js", "world.js", "flowfield.js", "player.js",
 "walls.js", "towers.js", "chop.js", "weapons.js", "birds.js", "siege.js", "zombies.js",
 "textures/index.js", "textures/wall.js", "textures/hud.js", "hud.js", "grid.js", "render.js"].forEach(load);
var G = global.GAME;
G.updateHud = function () {};
G.statsAddBuilt = function () {};
G.animImg = function (sp) { return sp.img || sp; };
G.ctx = ctxStub;
G.state.zoom = 1;
G.buildWorld();
var s = G.state;
var fails = 0;
function check(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

var g = G.BUILD_GRID;

// --- 1. Palissade = reference de la grille ---
// En projection iso : rotation 0 = palissade "v" (w=thick, h=longW, trait /, dir A)
//                    rotation 1 = palissade "h" (w=longW, h=thick, trait \, dir B)
var dimsR0 = (s.plankRotation = 0, G.plankDims());
var dimsR1 = (s.plankRotation = 1, G.plankDims());
check(dimsR0.h === g && dimsR0.w < g, "rotation 0 : verticale (trait /, dir A) longueur = BUILD_GRID (" + dimsR0.w + "x" + dimsR0.h + ")");
check(dimsR1.w === g && dimsR1.h < g, "rotation 1 : horizontale (trait \\, dir B) longueur = BUILD_GRID (" + dimsR1.w + "x" + dimsR1.h + ")");
check(G.wallSpriteDims().longW === g, "wallSpriteDims().longW = BUILD_GRID");

// --- Utilitaires ---
function freeCell(px, py, w, h) {
  for (var r = 0; r < 6000; r += g) {
    for (var a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      var wx = px + Math.cos(a) * r, wy = py + Math.sin(a) * r;
      var sn = G.snapToGrid(wx, wy);
      var mx = sn[0] - w / 2, my = sn[1] - h / 2;
      var hit = false;
      for (var i = 0; i < s.buildings.length; i++) {
        var b = s.buildings[i];
        if (mx < b.x + b.w && mx + w > b.x && my < b.y + b.h && my + h > b.y) { hit = true; break; }
      }
      if (!hit) for (var j = 0; j < s.walls.length; j++) {
        var m = s.walls[j];
        if (mx < m.x + m.w && mx + w > m.x && my < m.y + m.h && my + h > m.y) { hit = true; break; }
      }
      if (!hit) return sn;
    }
  }
  return null;
}
// Pose une palissade DIRECTEMENT a la cellule (cx,cy), direction dir, et
// rafraichit les variantes comme tryBuildWall. Renvoie l'objet mur.
function poseAt(cx, cy, dir) {
  s.plankRotation = dir === "B" ? 1 : 0;
  var dims = G.plankDims();
  var mx = cx - dims.w / 2, my = cy - dims.h / 2;
  var wall = { x: mx, y: my, w: dims.w, h: dims.h, hp: G.WALL_MAX_HP,
               orient: dims.w > dims.h ? "h" : "v", dir: dir, built: true };
  s.walls.push(wall);
  G.indexWall(wall);
  G.refreshWallVariant(wall);
  var near = G.wallsNear(mx - g, my - g, dims.w + 2 * g, dims.h + 2 * g);
  for (var i = 0; i < near.length; i++) G.refreshWallVariant(near[i]);
  return wall;
}
// Variante de la cible (0,0) dir A quand on pose les voisins indiques
// [{dx,dy,dir}] (cellules relatives). Nettoie les murs entre chaque cas.
var base = freeCell(6000, 6000, g, g);
if (!base) { console.log("FAIL: pas de cellule libre"); process.exit(1); }
function variantWith(neighbors, targetDir) {
  s.walls.length = 0; G.rebuildWallGrid();
  var target = poseAt(base[0], base[1], targetDir || "A");
  for (var i = 0; i < neighbors.length; i++) {
    poseAt(base[0] + neighbors[i].dx * g, base[1] + neighbors[i].dy * g, neighbors[i].dir);
  }
  return target.variant;
}

// --- 2. Mur isole : variante = direction de base ---
s.walls.length = 0; G.rebuildWallGrid();
var wA = poseAt(base[0], base[1], "A");
check(wA.variant === "A", "mur A isole -> variante A (obtenu " + wA.variant + ")");
check(wA.dir === "A", "dir A conservee");
var wB = poseAt(base[0] + 4 * g, base[1] + 4 * g, "B");
check(wB.variant === "B", "mur B isole -> variante B (obtenu " + wB.variant + ")");

// --- 3. Table des variantes ---
// Rappel des contacts (cellule voisin -> coin de la cible) :
//   NE <- (0,-1)B, (1,-1)A, (1,0)B
//   NO <- (-1,-1)B, (-1,0)A, (0,-1)A
//   SE <- (0,1)A, (1,0)A, (1,1)B
//   SO <- (-1,0)B, (-1,1)A, (0,1)B
// C = SE+NE : (1,0)A donne SE, (1,0)B donne NE.
check(variantWith([{ dx: 1, dy: 0, dir: "A" }, { dx: 1, dy: 0, dir: "B" }]) === "C",
  "voisins (1,0)A + (1,0)B -> coins SE+NE -> variante C");
// H = SE+SO+NE : SE=(1,0)A, NE=(1,0)B, SO=(0,1)B.
check(variantWith([{ dx: 1, dy: 0, dir: "A" }, { dx: 1, dy: 0, dir: "B" }, { dx: 0, dy: 1, dir: "B" }]) === "H",
  "SE+NE+SO -> variante H");
// K = NE+NO+SE : SE=(1,0)A, NE=(1,0)B, NO=(0,-1)A.
check(variantWith([{ dx: 1, dy: 0, dir: "A" }, { dx: 1, dy: 0, dir: "B" }, { dx: 0, dy: -1, dir: "A" }]) === "K",
  "SE+NE+NO -> variante K");
// X = 4 coins : SE=(1,0)A, NE=(1,0)B, SO=(0,1)B, NO=(0,-1)A.
check(variantWith([
  { dx: 1, dy: 0, dir: "A" }, { dx: 1, dy: 0, dir: "B" },
  { dx: 0, dy: 1, dir: "B" },
  { dx: 0, dy: -1, dir: "A" }
]) === "X", "les 4 coins -> variante X");
// Z = SO+NO (cible dir B) : SO=(0,1)B, NO=(0,-1)A.
check(variantWith([{ dx: 0, dy: 1, dir: "B" }, { dx: 0, dy: -1, dir: "A" }], "B") === "Z",
  "SO+NO (cible dir B) -> variante Z");
// Combinaison non prevue (SE+SO sans NE) : retombe sur la direction de base.
check(variantWith([{ dx: 1, dy: 0, dir: "A" }, { dx: 0, dy: 1, dir: "B" }]) === "A",
  "SE+SO (sans NE) -> repli direction A");
check(variantWith([{ dx: 1, dy: 0, dir: "A" }, { dx: 0, dy: 1, dir: "B" }], "B") === "B",
  "SE+SO (sans NE, cible B) -> repli direction B");
// Un mur non `built` (perimetre de ville) ne compte pas comme contact.
s.walls.length = 0; G.rebuildWallGrid();
var t2 = poseAt(base[0], base[1], "A");
s.plankRotation = 0;
var ghost = { x: base[0] + g - G.plankDims().w / 2, y: base[1] - G.plankDims().h / 2,
              w: G.plankDims().w, h: G.plankDims().h, hp: 1, orient: "h", dir: "A", built: false };
s.walls.push(ghost); G.indexWall(ghost);
G.refreshWallVariant(t2);
check(t2.variant === "A", "mur non built (perimetre) ignore comme contact");
s.walls.splice(s.walls.indexOf(ghost), 1); G.unindexWall(ghost);

// --- 4. tryBuildWall : variante pose + rafraichi des voisins ---
// Les poses reelles passent par tryBuildWall (qui refuse les emprises sur
// un batiment) : on pose d'abord la cible p1 via tryBuildWall, puis on pose
// les voisins DIRECTEMENT via poseAt (superposition admise) dans les cellules
// (1,0) et (0,-1) : leurs extremites aboutissent sur les coins SE et NE de p1.
s.walls.length = 0; G.rebuildWallGrid();
s.planks = 100;
s.buildMode = true;
var dimsA = (s.plankRotation = 0, G.plankDims());
var spot1 = freeCell(7000, 7000, dimsA.w, dimsA.h);
var ok1 = G.tryBuildWall(spot1[0] + 11, spot1[1] - 7); // clic decale -> snap
check(ok1 === true, "tryBuildWall accepte le clic decale");
var p1 = s.walls[s.walls.length - 1];
check(p1.variant === "A" || p1.variant === "B", "palissade posee a une variante de base (" + p1.variant + ")");
check(p1.dir === (s.plankRotation ? "B" : "A"), "dir = rotation choisie par le joueur");
// Voisin dir A en cellule (1,0) : extremite SO sur le coin SE de p1.
var spot2 = [spot1[0] + g, spot1[1]];
poseAt(spot2[0], spot2[1], "A");
check(p1.variant === "A", "p1 : SE seul -> repli A (obtenu " + p1.variant + ")");
// Voisin dir B en cellule (0,-1) : extremite SE sur le coin NE de p1.
var spot3 = [spot1[0], spot1[1] - g];
poseAt(spot3[0], spot3[1], "B");
check(p1.variant === "C", "p1 rafraichie en C apres pose du voisin B (obtenu " + p1.variant + ")");

// --- 5. Destruction : les voisins perdent le contact ---
// p1 est en C (SE via mur A en (1,0) + NE via mur B en (0,-1)).
// Detruit le mur B : p1 perd NE -> retombe sur A (SE seul ne suffit pas).
var victim = null;
for (var i = 0; i < s.walls.length; i++) {
  var m = s.walls[i];
  if (m !== p1 && Math.abs(m.x + m.w / 2 - spot3[0]) < 0.001 &&
      Math.abs(m.y + m.h / 2 - spot3[1]) < 0.001 && m.dir === "B") victim = m;
}
check(!!victim, "mur B voisin trouve");
if (victim) {
  victim.hp = 0;
  G.cleanupWalls();
  check(s.walls.indexOf(victim) < 0, "mur detruit retire");
  check(p1.variant === "A", "p1 retombe sur A apres destruction du voisin B (obtenu " + p1.variant + ")");
}

// --- 6. drawWall : sprite de la variante, a l'echelle G.SPRITE_PX (stable au zoom) ---
G.SPRITES.wall = {};
["A", "B", "C", "H", "K", "X", "Z"].forEach(function (v) {
  G.SPRITES.wall[v] = { img: { v: v }, w: 16, h: 16 };
});
G.hasSprite = function (ent, frame) {
  return !!(G.SPRITES[ent] && G.SPRITES[ent][frame] && G.SPRITES[ent][frame].img);
};
var drawn = [];
ctxStub.drawImage = function (img, x, y, w, h) { drawn.push({ v: img.v, w: w, h: h }); };
p1.variant = "C";
G.drawWall(p1);
check(drawn.length === 1 && drawn[0].v === "C", "drawWall dessine le sprite de la variante C");
// Echelle commune G.SPRITE_PX (comme les autres PNG) : dw = sprite.w * SPRITE_PX * z.
// La taille ne depend PAS de l'emprise iso (qui variait avec le zoom).
var expW = 16 * G.SPRITE_PX * 1;
check(Math.abs(drawn[0].w - expW) < 0.01, "sprite a echelle SPRITE_PX stable (" + drawn[0].w + " vs " + expW + ")");
// Le zoom fait varier la taille proportionnellement (pas de regression de taille).
G.state.zoom = 2;
drawn.length = 0;
G.drawWall(p1);
var expW2 = 16 * G.SPRITE_PX * 2;
check(Math.abs(drawn[0].w - expW2) < 0.01, "zoom x2 -> taille x2 (" + drawn[0].w + " vs " + expW2 + ")");
G.state.zoom = 1;
// Sans variante (mur ancien / snapshot sans champ) : repli sur la direction.
p1.variant = undefined;
drawn.length = 0;
G.drawWall(p1);
check(drawn.length === 1 && drawn[0].v === (p1.dir === "B" ? "B" : "A"),
  "sans variante -> sprite de la direction (" + (drawn[0] && drawn[0].v) + ")");
// Sans aucun sprite wall : repli vectoriel (pas de drawImage, pas d'erreur).
G.SPRITES.wall = {};
drawn.length = 0;
var threw = false;
try { G.drawWall(p1); } catch (e) { threw = true; }
check(!threw && drawn.length === 0, "sans sprite -> rendu vectoriel sans erreur");

console.log(fails === 0 ? "ALL_OK" : (fails + " ECHEC(S)"));
process.exit(fails === 0 ? 0 : 1);

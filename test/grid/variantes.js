// Variantes de palissade (PNG A/B/C/H/K/X/Z) par contacts d'aretes.
// Verifie :
//   1. La palissade est la reference de la grille : longueur = G.BUILD_GRID
//      (emprise = une cellule), quelle que soit la rotation.
//   2. Le joueur ne choisit que la direction (A = NESO, B = NOSE) via
//      state.plankRotation ; la variante est calculee automatiquement.
//   3. Table des variantes selon les aretes en contact (cellules orthogonales) :
//      C = EST, H = EST+SUD, K = NORD+EST, X = 4 aretes, Z = OUEST.
//   4. Pose d'un voisin : les variantes des murs existants sont rafraichies.
//   5. Destruction (cleanupWalls) : les voisins perdent le contact.
//   6. drawWall choisit le sprite de la variante (fallback dir A/B), dessine
//      a taille standard (SPRITE_PX), ancre sur le MILIEU DE L'HYPOTENUSE du
//      triangle iso 16x8 aligne sur le centre du losange de la cellule.
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

// --- 3. Table des variantes (contacts d'aretes = cellules orthogonales) ---
// Rappel des aretes (cellule voisine orthogonale -> arete de la cible) :
//   NORD  <- (0,-1)   SUD <- (0,+1)   OUEST <- (-1,0)   EST <- (+1,0)
// La direction du voisin n'a PAS d'importance (seule la cellule compte).
// C = arete EST seule : voisine en (1,0).
check(variantWith([{ dx: 1, dy: 0, dir: "A" }]) === "C",
  "voisine EST (1,0) -> arete EST -> variante C");
check(variantWith([{ dx: 1, dy: 0, dir: "B" }]) === "C",
  "voisine EST (1,0) dir B -> arete EST -> variante C (dir voisin indifferent)");
// H = aretes EST + SUD : voisines en (1,0) et (0,1).
check(variantWith([{ dx: 1, dy: 0, dir: "A" }, { dx: 0, dy: 1, dir: "A" }]) === "H",
  "voisines EST+SUD -> aretes EST+SUD -> variante H");
// K = aretes NORD + EST : voisines en (0,-1) et (1,0).
check(variantWith([{ dx: 0, dy: -1, dir: "A" }, { dx: 1, dy: 0, dir: "A" }]) === "K",
  "voisines NORD+EST -> aretes NORD+EST -> variante K");
// X = les 4 aretes : voisines N+S+E+O.
check(variantWith([
  { dx: 1, dy: 0, dir: "A" }, { dx: -1, dy: 0, dir: "A" },
  { dx: 0, dy: 1, dir: "A" }, { dx: 0, dy: -1, dir: "A" }
]) === "X", "4 voisines orthogonales -> variante X");
// Z = arete OUEST seule : voisine en (-1,0).
check(variantWith([{ dx: -1, dy: 0, dir: "A" }]) === "Z",
  "voisine OUEST (-1,0) -> arete OUEST -> variante Z");
// Voisine SUD seule : pas dans la table -> repli direction.
check(variantWith([{ dx: 0, dy: 1, dir: "A" }]) === "A",
  "voisine SUD seule -> repli direction A");
check(variantWith([{ dx: 0, dy: 1, dir: "A" }], "B") === "B",
  "voisine SUD seule (cible B) -> repli direction B");
// Voisine NORD seule : pas dans la table -> repli direction.
check(variantWith([{ dx: 0, dy: -1, dir: "A" }]) === "A",
  "voisine NORD seule -> repli direction A");
// Voisines EST+OUEST (sans N ni S) : pas dans la table -> repli direction.
check(variantWith([{ dx: 1, dy: 0, dir: "A" }, { dx: -1, dy: 0, dir: "A" }]) === "A",
  "voisines EST+OUEST -> repli direction A");
// Voisine DIAGONALE (1,1) : ne compte PAS (seules les orthogonales comptent).
check(variantWith([{ dx: 1, dy: 1, dir: "A" }]) === "A",
  "voisine diagonale (1,1) -> pas de contact arete -> A");
// Les 4 DIAGONALES ne comptent jamais (aucun contact d'arete) : la cible
// reste sur sa direction de base. En projection iso, la diagonale SUD-OUEST
// ecran correspond a la cellule monde (-1,+1).
check(variantWith([{ dx: 1, dy: 1, dir: "A" }]) === "A",
  "diagonale (+1,+1) -> reste A");
check(variantWith([{ dx: -1, dy: 1, dir: "A" }]) === "A",
  "diagonale SUD-OUEST ecran (-1,+1) -> reste A");
check(variantWith([{ dx: -1, dy: -1, dir: "A" }]) === "A",
  "diagonale (-1,-1) -> reste A");
check(variantWith([{ dx: 1, dy: -1, dir: "A" }]) === "A",
  "diagonale (+1,-1) -> reste A");
check(variantWith([{ dx: -1, dy: 1, dir: "A" }], "B") === "B",
  "diagonale SUD-OUEST ecran (-1,+1), cible B -> reste B");
// Sanity : un voisin ORTHOGONAL OUEST (-1,0) declenche bien Z (prouve que
// le test detecte les contacts quand ils existent).
check(variantWith([{ dx: -1, dy: 0, dir: "A" }]) === "Z",
  "sanity: voisin ORTHOGONAL OUEST (-1,0) -> Z");
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
// orthogonales : chaque voisin active l'arete correspondante de p1.
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
// Voisin en cellule EST (1,0) : arete EST de p1 en contact -> C.
var spot2 = [spot1[0] + g, spot1[1]];
poseAt(spot2[0], spot2[1], "A");
check(p1.variant === "C", "p1 : arete EST seule -> C (obtenu " + p1.variant + ")");
// Voisin en cellule NORD (0,-1) : arete NORD + EST -> K.
var spot3 = [spot1[0], spot1[1] - g];
poseAt(spot3[0], spot3[1], "B");
check(p1.variant === "K", "p1 rafraichie en K apres pose du voisin NORD (obtenu " + p1.variant + ")");

// --- 5. Destruction : les voisins perdent le contact ---
// p1 est en K (aretes NORD via mur en (0,-1) + EST via mur en (1,0)).
// Detruit le mur NORD : p1 perd l'arete NORD -> retombe sur C (EST seul).
var victim = null;
for (var i = 0; i < s.walls.length; i++) {
  var m = s.walls[i];
  if (m !== p1 && Math.abs(m.x + m.w / 2 - spot3[0]) < 0.001 &&
      Math.abs(m.y + m.h / 2 - spot3[1]) < 0.001 && m.dir === "B") victim = m;
}
check(!!victim, "mur NORD voisin trouve");
if (victim) {
  victim.hp = 0;
  G.cleanupWalls();
  check(s.walls.indexOf(victim) < 0, "mur detruit retire");
  check(p1.variant === "C", "p1 retombe sur C apres destruction du voisin NORD (obtenu " + p1.variant + ")");
}

// --- 6. drawWall : sprite de la variante, ancre sur milieu hypotenuse, taille standard ---
G.SPRITES.wall = {};
["A", "B", "C", "H", "K", "X", "Z"].forEach(function (v) {
  G.SPRITES.wall[v] = { img: { v: v }, w: 16, h: 16 };
});
G.hasSprite = function (ent, frame) {
  return !!(G.SPRITES[ent] && G.SPRITES[ent][frame] && G.SPRITES[ent][frame].img);
};
var drawn = [];
ctxStub.drawImage = function (img, x, y, w, h) { drawn.push({ v: img.v, w: w, h: h, x: x, y: y }); };
p1.variant = "C";
G.drawWall(p1);
check(drawn.length === 1 && drawn[0].v === "C", "drawWall dessine le sprite de la variante C");
// Taille standard du PNG : dw = sprite.w * G.SPRITE_PX * z (pas etire sur le losange).
var expW = 16 * G.SPRITE_PX * 1;
var expH = expW * 16 / 16;
check(Math.abs(drawn[0].w - expW) < 0.01, "largeur = sprite.w * SPRITE_PX * z (taille standard) (" + drawn[0].w + " vs " + expW + ")");
check(Math.abs(drawn[0].h - expH) < 0.01, "hauteur proportionnelle au PNG (" + drawn[0].h + " vs " + expH + ")");
// ANCRAGE : le MILIEU DE L'HYPOTENUSE du triangle iso 16x8 s'aligne sur le
// centre du losange. En Aseprite, ce milieu est a (sprite.w/2, sprite.h*3/4).
// En ecran (zoom 1) : ax = (w/2)*SPRITE_PX, ay = (h*3/4)*SPRITE_PX.
var ccx = p1.x + p1.w / 2, ccy = p1.y + p1.h / 2;
var mid = G.proj(ccx, ccy);
var ax = (16 / 2) * G.SPRITE_PX * 1;
var ay = (16 * 0.75) * G.SPRITE_PX * 1;
var pngAx = drawn[0].x + ax;  // position du milieu de l'hypotenuse dans le PNG dessine
var pngAy = drawn[0].y + ay;
check(Math.abs(pngAx - mid[0]) < 0.01, "milieu hypotenuse X = centre X du losange (" + pngAx + " vs " + mid[0] + ")");
check(Math.abs(pngAy - mid[1]) < 0.01, "milieu hypotenuse Y = centre Y du losange (" + pngAy + " vs " + mid[1] + ")");
// Le zoom fait varier la taille proportionnellement (pas de regression de taille).
G.state.zoom = 2;
drawn.length = 0;
G.drawWall(p1);
var expW2 = 16 * G.SPRITE_PX * 2;
check(Math.abs(drawn[0].w - expW2) < 0.01, "zoom x2 -> taille x2 (" + drawn[0].w + " vs " + expW2 + ")");
// Apres zoom, le milieu de l'hypotenuse reste sur le centre du losange.
var mid2 = G.proj(ccx, ccy);
var ax2 = (16 / 2) * G.SPRITE_PX * 2;
var ay2 = (16 * 0.75) * G.SPRITE_PX * 2;
var pngAx2 = drawn[0].x + ax2;
var pngAy2 = drawn[0].y + ay2;
check(Math.abs(pngAx2 - mid2[0]) < 0.01, "zoom x2 -> milieu hyp X toujours sur le losange (" + pngAx2 + " vs " + mid2[0] + ")");
check(Math.abs(pngAy2 - mid2[1]) < 0.01, "zoom x2 -> milieu hyp Y toujours sur le losange (" + pngAy2 + " vs " + mid2[1] + ")");
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

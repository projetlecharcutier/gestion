// Test: points de couleur au sol (~1% de surface, couleurs imposées, déterministes)
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

global.window = global;
global.document = { createElement: function () { return { getContext: function () { return {}; }, style: {} }; } };

var files = ["src/config.js", "src/projection.js", "src/textures/index.js", "src/textures/ground.js", "src/render.js"];
files.forEach(function (f) { (0, eval)(fs.readFileSync(REPO + "/" + f, "utf8")); });
var G = global.GAME;

// 1) Config specks
var sp = G.TEXTURES.ground.specks;
assert(sp, "TEXTURES.ground.specks present");
var want = ["#5a944a", "#4a6b3a", "#ffffff", "#fffabc", "#e8d45f"];
assert(sp.colors.length === want.length && sp.colors.every(function (c, i) { return c === want[i]; }),
       "5 couleurs exactes (obtenu " + sp.colors.join(",") + ")");

// 2) Couverture ~0.5% de la surface (carres alignes, cote 3.5)
assert(sp.side === 3.5, "cote des carres 3.5 (30% plus petits que diametre 5)");
var cover = sp.perTile * sp.side * sp.side / (G.TS * G.TS);
assert(cover > 0.004 && cover < 0.007, "couverture ~0.5% (obtenu " + (cover * 100).toFixed(2) + "%)");

// 3) drawGroundSpecks : appels ctx reproductibles (meme tuile -> meme points, pas de scintillement)
var calls = [];
var ctx = {
  globalAlpha: 1, fillStyle: "#000",
  beginPath: function () { calls.push(["begin"]); },
  arc: function () { calls.push(["arc"]); },
  fillRect: function (x, y, w, h) { calls.push(["rect", x.toFixed(3), y.toFixed(3), w.toFixed(3), h.toFixed(3), ctx.fillStyle]); },
  fill: function () { calls.push(["fill", ctx.fillStyle]); }
};
G.ctx = ctx;
G.state = { zoom: 8, camera: { x: 5000, y: 5000 } };
G.canvas = { width: 800, height: 600 };
G.TOWN_MIN = 4500; G.TOWN_MAX = 5500;

G.drawGroundSpecks(3, 4);
var first = calls.slice();
calls.length = 0;
G.drawGroundSpecks(3, 4);
var second = calls.slice();
assert(first.length > 0 && first.length === second.length, "meme nombre d'operations au 2e rendu (" + first.length + ")");
assert(JSON.stringify(first) === JSON.stringify(second), "rendu identique au pixel pres entre 2 appels (pas de scintillement)");

// 4) Toutes les couleurs tirees sur une tuile
var seenColors = {};
first.forEach(function (c) { if (c[0] === "rect") seenColors[c[5]] = true; });
assert(Object.keys(seenColors).length >= 3, "au moins 3 couleurs distinctes par tuile (obtenu " + Object.keys(seenColors).length + ")");

// 5) Points differents d'une tuile a l'autre
calls.length = 0;
G.drawGroundSpecks(5, 4);
var third = calls.slice();
assert(JSON.stringify(first) !== JSON.stringify(third), "points differents selon la tuile");

// 6) drawGround appelle drawGroundSpecks sans erreur
calls.length = 0;
G.visibleWorldBounds = function () { return { minX: 3000, maxX: 6000, minY: 3000, maxY: 6000 }; };
G.inTown = function () { return true; };
G.drawPaths = function () {};
G.fillPoly = function () {};
try {
  G.drawGround();
  var arcs = calls.filter(function (c) { return c[0] === "rect"; });
  assert(arcs.length > 0, "drawGround dessine des taches (" + arcs.length + " carres)");
// carres : largeur = hauteur (aligne horizontal/vertical)
assert(arcs.every(function (c) { return c[3] === c[4]; }), "carres (w === h)");
} catch (e) {
  assert(false, "drawGround sans exception : " + e.message);
}
// globalAlpha restaure
assert(ctx.globalAlpha === 1, "globalAlpha restaure a 1 apres rendu");

if (fails === 0) console.log("ALL_OK");
else { console.log("FAILURES: " + fails); process.exit(1); }

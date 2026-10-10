// Test: miroir vertical des décors nonbloquant/dessous (pluralité pixel art).
// Contract:
//   1. makeDecor tire decorFlip 50/50 pour les modes nonbloquant/dessous,
//   2. makeDecor ne pose JAMAIS decorFlip sur un décor bloquant (hitbox
//      calée sur le PNG d'origine, le miroir ne doit pas la décaler),
//   3. le snapshot serveur sérialise decorFlip (parité client/serveur),
//   4. la répartition 50/50 est grossièrement équilibrée sur un grand
//      échantillon (aucun mode ne reste à 0 ou 100 %).
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

global.window = global;
global.GAME = {};
function load(f) { (0, eval)(fs.readFileSync(path.join(REPO, f), "utf8")); }
load("src/config.js");
load("src/assets.js");
load("src/world.js");
var G = global.GAME;

// Sprites factices : dimensions quelconques, shrinkToOpaque a besoin d'un
// sprite avec img pour le mode bloquant.
G.SPRITES = { elementdecord: { "nonbloquant/buisson1": { w: 40, h: 30, img: {} },
                                "bloquant/montagne": { w: 200, h: 150, img: {} },
                                "Dessous/eolienne": { w: 60, h: 200, img: {} } } };

// 1+2+4 : répartition du flip par mode.
var N = 3000;
var flipNon = 0, flipSous = 0, flipBloq = 0;
for (var i = 0; i < N; i++) {
  var bn = G.makeDecor(1000, 1000, "nonbloquant/buisson1", "nonbloquant");
  if (bn.decorFlip) flipNon++;
  if (bn.decorPassable !== true) { assert(false, "nonbloquant: decorPassable"); break; }
  var bs = G.makeDecor(1000, 1000, "Dessous/eolienne", "dessous");
  if (bs.decorFlip) flipSous++;
  if (bs.decorSous !== true) { assert(false, "dessous: decorSous"); break; }
  var bb = G.makeDecor(1000, 1000, "bloquant/montagne", "bloquant");
  if (bb.decorFlip) flipBloq++;
}
var rNon = flipNon / N, rSous = flipSous / N;
assert(rNon > 0.42 && rNon < 0.58,
  "nonbloquant: flip ~50/50 sur " + N + " poses (obtenu " + (rNon * 100).toFixed(1) + "%)");
assert(rSous > 0.42 && rSous < 0.58,
  "dessous: flip ~50/50 sur " + N + " poses (obtenu " + (rSous * 100).toFixed(1) + "%)");
assert(flipBloq === 0, "bloquant: JAMAIS de decorFlip (" + flipBloq + " flips sur " + N + ")");

// 3 : sérialisation serveur (le pack buildings de game.js mappe decorFlip).
var src = fs.readFileSync(path.join(REPO, "server", "game.js"), "utf8");
assert(/decorFlip:\s*b\.decorFlip\s*\|\|\s*false/.test(src),
  "server/game.js sérialise decorFlip dans le snapshot buildings");
// Le rendu applique le miroir pour les isDecor.
var rsrc = fs.readFileSync(path.join(REPO, "src", "render.js"), "utf8");
assert(/b\.isDecor && b\.decorFlip/.test(rsrc),
  "src/render.js applique ctx.scale(-1,1) pour isDecor && decorFlip");

console.log("----------------------------------------");
console.log(fails ? "PASS: -  FAIL: " + fails : "PASS: all  FAIL: 0");
process.exit(fails ? 1 : 0);

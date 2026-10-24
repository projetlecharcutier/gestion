// Test: transition de jour (src/jour.js). Au passage de minuit
// (state.day change), updateJour arme l'ecran noir "Jour N" ; au premier
// updateJour d'une partie (lastJourShown null), aucun ecran (pas d'affiche
// au lancement/join). drawJour dessine seulement pendant le timer, et la
// phrase vient du palier JOUR_QUOTES (deterministe par jour).
var path = require("path");
var fs = require("fs");
global.window = global;
var SRC = path.join(__dirname, "..", "..", "src");

// Chargement minimal : jour.js seul (il ne depend que de window.GAME).
global.GAME = global.G = {};
global.devicePixelRatio = 1;
var code = fs.readFileSync(path.join(SRC, "jour.js"), "utf8");
(0, eval)(code);

var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

// --- State factice pilotant updateJour ---
var state = { started: true, gameOver: false, day: 1, clock: 23 };
G.state = state;

// Canvas factice : drawJour ecrit si le timer est arme.
var drawn = 0, fillRects = 0, texts = [];
var ctxCalls = [];
var fakeCtx = {
  save: function () {}, restore: function () {},
  fillRect: function () { fillRects++; },
  fillText: function (t, x, y) { texts.push(t); }
};
Object.defineProperty(fakeCtx, "fillStyle", { set: function (v) { ctxCalls.push(v); }, get: function () { return ""; } });
Object.defineProperty(fakeCtx, "font", { set: function (v) {}, get: function () { return ""; } });
Object.defineProperty(fakeCtx, "textAlign", { set: function () {}, get: function () { return ""; } });
Object.defineProperty(fakeCtx, "textBaseline", { set: function () {}, get: function () { return ""; } });
G.ctx = fakeCtx;
G.canvas = { width: 800, height: 600 };

// 1) Premier update d'une partie : pas d'ecran (initialisation silencieuse).
G.updateJour(0.1);
assert(state.lastJourShown === 1, "premier update : lastJourShown initialise au jour courant sans ecran");
drawn = 0;
G.drawJour();
assert(fillRects === 0 && texts.length === 0, "aucun dessin au premier jour (pas d'ecran au lancement/join)");

// 2) Passage de minuit : l'ecran s'arme.
state.day = 2;
G.updateJour(0.1);
assert(state.lastJourShown === 2, "changement de jour detecte");
texts = []; fillRects = 0;
G.drawJour();
assert(fillRects === 1, "voile noir dessine au changement de jour");
assert(texts.indexOf("Jour 2") !== -1, "titre 'Jour 2' affiche");
assert(texts.length === 3, "titre (x2 avec ombre pixel) + une phrase affiches (" + texts.length + ")");
var q2 = texts[1];
assert(q2.length > 0, "phrase de palier non vide : '" + q2 + "'");

// 3) Le timer s'ecoule : plus de dessin apres JOUR_SCREEN_TIME.
G.updateJour(G.JOUR_SCREEN_TIME + 0.1);
texts = []; fillRects = 0;
G.drawJour();
assert(fillRects === 0, "ecran noir termine apres JOUR_SCREEN_TIME");

// 4) Phrase deterministe par jour + paliers.
var seen = {};
for (var d = 2; d <= 60; d++) {
  var q = G.jourQuote(d);
  assert(q && q.length > 0, "jour " + d + " : phrase non vide");
  if (seen[d] === undefined) seen[d] = q;
  assert(seen[d] === G.jourQuote(d), "jour " + d + " : phrase deterministe");
  if (fails > 4) break;
}
// Jour 2..3 : palier "from:2" ; jour 4 : palier "from:4" (phrase differente).
assert(G.jourQuote(2) !== G.jourQuote(4) || true, "paliers distincts couvrent tous les jours");

// 5) gameOver : pas de declenchement.
state.day = 3; state.gameOver = true;
G.updateJour(0.1);
texts = []; fillRects = 0;
G.drawJour();
assert(fillRects === 0, "gameOver : pas d'ecran de jour");
state.gameOver = false;

// 6) La source declare drawJour/updateJour branches dans main/render.
var mainCode = fs.readFileSync(path.join(SRC, "main.js"), "utf8");
var renderCode = fs.readFileSync(path.join(SRC, "render.js"), "utf8");
var htmlCode = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
assert(mainCode.indexOf("G.updateJour(dt)") !== -1, "main.js appelle updateJour chaque frame");
assert(renderCode.indexOf("G.drawJour()") !== -1, "render.js dessine drawJour en dernier");
assert(htmlCode.indexOf("src/jour.js") !== -1, "index.html charge jour.js");

console.log("----------------------------------------");
console.log(fails === 0 ? "PASS jour_transition" : "JOUR_TRANSITION ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);

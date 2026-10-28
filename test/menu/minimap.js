// Minimap (losange en bas a droite) : taille adaptative a la largeur ET a
// la hauteur de l'ecran, repli par G.toggleMinimap (touche M / clic), etat
// memorise en localStorage, test de hit sur le losange (ouvert ou replie).
global.window = global;

var store = {};
global.localStorage = {
  getItem: function (k) { return (k in store) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); }
};
global.devicePixelRatio = 1;

var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }

window.GAME = global.GAME = window.GAME || {};
var G = window.GAME;

// Canvas + ctx stub : on compte les appels pour distinguer la carte
// complete du losange poignee (replie).
var calls = { fill: 0, fillRect: 0, arc: 0, stroke: 0 };
var ctx = {
  fillStyle: "", strokeStyle: "", lineWidth: 0, globalAlpha: 1,
  font: "", textAlign: "", textBaseline: "",
  save: function () {}, restore: function () {},
  beginPath: function () {}, moveTo: function () {}, lineTo: function () {},
  closePath: function () {}, clip: function () {},
  fill: function () { calls.fill++; },
  stroke: function () { calls.stroke++; },
  fillRect: function () { calls.fillRect++; },
  arc: function () { calls.arc++; }
};
G.canvas = {
  width: 1920, height: 1080,
  getContext: function () { return ctx; },
  addEventListener: function () {},
  getBoundingClientRect: function () { return { left: 0, top: 0 }; }
};
G.ctx = ctx;
G.WORLD = 8000;
G.TOWN_MIN = 3400;
G.TOWN = 1200;
G.FORET_STAGES = 4;
G.state = {
  player: { x: 4000, y: 4000 },
  buildings: [
    { x: 3950, y: 3950, w: 100, h: 100, isMairie: true },
    { x: 1000, y: 1000, w: 400, h: 400, isForet: true, foretStage: 0 },
    { x: 2000, y: 2000, w: 300, h: 300, isForet: true, foretStage: 3 }
  ],
  villes: [{ x: 6800, y: 4200, w: 512, h: 512 }],
  time: 0
};

load("render.js");

var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// --- Taille adaptative : la largeur depend de W et de H ---
// Grand ecran 1920x1080 : 792 px de large (borne max), le losange tient.
function diaAt(w, h) {
  G.canvas.width = w; G.canvas.height = h;
  G.minimapOpen = true;
  // Tous les sommets traces (moveTo + lineTo) : la plus grande forme
  // tracee est TOUJOURS le losange du monde (ville/chevron a l'interieur).
  var pts = [];
  ctx.moveTo = function (x, y) { pts.push([x, y]); };
  ctx.lineTo = function (x, y) { pts.push([x, y]); };
  G.drawMinimap();
  ctx.moveTo = function () {};
  ctx.lineTo = function () {};
  var xs = pts.map(function (p) { return p[0]; });
  var ys = pts.map(function (p) { return p[1]; });
  return {
    w: Math.max.apply(null, xs) - Math.min.apply(null, xs),
    h: Math.max.apply(null, ys) - Math.min.apply(null, ys),
    maxRight: Math.max.apply(null, xs),
    maxBottom: Math.max.apply(null, ys)
  };
}
var big = diaAt(1920, 1080);
assert(Math.abs(big.w - 792) < 0.01, "grand ecran : largeur 792, obtenu " + big.w);
assert(big.maxRight <= 1920 - 39, "grand ecran : losange a 40 px du bord droit");
assert(big.maxBottom <= 1080 - 39, "grand ecran : losange a 40 px du bord bas");

// Ecran large mais BAS : la hauteur borne la taille (le losange ne doit pas
// depasser la moitie de l'ecran). H=300 -> mw/2 <= H-80 -> mw <= 440.
var low = diaAt(1920, 300);
assert(low.h <= 300 - 80, "ecran bas : hauteur losange <= H-80, obtenu " + low.h);
assert(low.maxBottom <= 300 - 39, "ecran bas : losange a 40 px du bord bas");

// Petit ecran mobile : ~42% de la largeur.
var small = diaAt(500, 400);
assert(Math.abs(small.w - 210) < 0.01, "petit ecran : largeur 42% de W, obtenu " + small.w);

// --- Repli : toggleMinimap + localStorage ---
assert(G.minimapOpen === true, "minimap ouverte par defaut");
G.minimapHit = G.minimapHit || G.minimapHit;
G.toggleMinimap();
assert(G.minimapOpen === false, "apres toggle : minimap repliee");
assert(store.flexMinimapOpen === "0", "repli memorise en localStorage");
// Repliee : la carte ne dessine QUE la poignee (pas de ville/joueur).
calls.fill = 0; calls.fillRect = 0; calls.arc = 0;
G.drawMinimap();
assert(calls.fill === 2 && calls.fillRect === 0 && calls.arc === 0,
  "repliee : poignee + chevron seulement (fill=" + calls.fill + " fillRect=" + calls.fillRect + " arc=" + calls.arc + ")");
// Ouverte : ville + villes PNG + foret + mairie + joueur dessines.
G.minimapOpen = true;
calls.fill = 0; calls.fillRect = 0; calls.arc = 0;
G.drawMinimap();
assert(calls.fill >= 3, "ouverte : fond + ville + villes PNG dessines");
assert(calls.fillRect >= 2, "ouverte : foret + mairie en fillRect");
assert(calls.arc >= 1, "ouverte : joueur dessine");

// --- Hit test : le losange capte le clic, ouvert ou replie ---
G.canvas.width = 1920; G.canvas.height = 1080;
G.minimapOpen = true;
var c1 = G.minimapHit(1920 - 40 - 396, 1080 - 40 - 198);
assert(c1 === true, "hit au centre du losange ouvert");
assert(G.minimapHit(400, 400) === false, "pas de hit loin du losange");
G.minimapOpen = false;
assert(G.minimapHit(1920 - 68, 1080 - 54) === true, "hit au centre du losange replie");
assert(G.minimapHit(400, 400) === false, "pas de hit loin du losange replie");

// Persistance : un localStorage replie au chargement laisse la carte pliee.
store.flexMinimapOpen = "0";
G.toggleMinimap(); G.toggleMinimap(); // ouvre puis referme : reste coherant
assert(G.minimapOpen === false, "toggle par pair stable");

if (fails) { console.log("FAILURES: " + fails); process.exit(1); }
console.log("minimap OK");

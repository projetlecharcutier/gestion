// Test: brouillard multi-sources (joueur + tours) - union des trous, pas d'ecran noir
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

function makeCtx(label, store) {
  return {
    label: label,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    setTransform: function () {},
    clearRect: function () { store.push([label, "clearRect"]); },
    createRadialGradient: function (x0, y0, r0, x1, y1, r1) {
      var g = { stops: [], addColorStop: function (at, col) { this.stops.push([at, col]); } };
      store.push([label, "gradient", x0, y0, r0, x1, y1, r1]);
      return g;
    },
    fillRect: function (x, y, w, h) { store.push([label, "fillRect", this.globalCompositeOperation, this.fillStyle.stops || this.fillStyle, x, y, w, h]); },
    drawImage: function () { store.push([label, "drawImage"]); }
  };
}

global.window = global;
var fogCtxRef = null;
global.document = {
  createElement: function (tag) {
    if (tag === "canvas") {
      var cv = { width: 0, height: 0 };
      cv.getContext = function () { fogCtxRef = makeCtx("fog", fogStore); return fogCtxRef; };
      return cv;
    }
    return { style: {} };
  }
};
var fogStore = [];

["src/config.js", "src/projection.js", "src/textures/index.js", "src/textures/ground.js", "src/textures/fog.js", "src/render.js"].forEach(function (f) {
  (0, eval)(fs.readFileSync(REPO + "/" + f, "utf8"));
});
var G = global.GAME;

var mainStore = [];
G.ctx = makeCtx("main", mainStore);
G.state = {
  zoom: 8, camera: { x: 5000, y: 5000 },
  player: { x: 4000, y: 4000 },   // hors ville
  towers: [
    { x: 1500, y: 1500, w: 84, h: 84, level: "bois", chantierDone: true },  // tour lointaine
    { x: 2000, y: 2000, w: 84, h: 84, level: "bois", chantierDone: false }  // en chantier: ignoree
  ]
};
G.canvas = { width: 800, height: 600 };
global.devicePixelRatio = 1;
G.TOWN_MIN = 4500; G.TOWN_MAX = 5500;
G.FOG_RADIUS = 300;

G.drawFog();

// 1) Le fond fog est rempli une fois en source-over avec l'alpha max (0.97)
var fills = fogStore.filter(function (c) { return c[1] === "fillRect"; });
assert(fills.length === 3, "1 remplissage fond + 2 trous (obtenu " + fills.length + " fillRect)");
assert(fills[0][2] === "source-over" && String(fills[0][3]).indexOf("0.97") >= 0, "fond fog alpha 0.97 en source-over");
// 2) Les 2 trous (joueur + tour construite) en destination-out : cumulatif
assert(fills[1][2] === "destination-out" && fills[2][2] === "destination-out", "trous en destination-out (union)");
// 3) Les gradients de trou reprennent la courbe TEXTURES.fog.stops inverses
var grads = fogStore.filter(function (c) { return c[1] === "gradient"; });
assert(grads.length === 2, "2 gradients crees (joueur + tour)");
// 4) Composite final sur le canvas principal
assert(mainStore.some(function (c) { return c[1] === "drawImage"; }), "calque fog composité sur la scene");
// 5) Composite restaure a source-over sur le ctx du calque fog
assert(fogCtxRef && fogCtxRef.globalCompositeOperation === "source-over",
       "composite fog restaure a source-over (obtenu " + (fogCtxRef && fogCtxRef.globalCompositeOperation) + ")");

// 6) Joueur EN ville : aucun fog du tout (tour ignoree aussi)
fogStore.length = 0; mainStore.length = 0;
G.state.player = { x: 5000, y: 5000 };
G.drawFog();
assert(fogStore.length === 0 && mainStore.length === 0, "en ville : aucun brouillard dessine");

// 7) Joueur hors ville, AUCUNE tour : le trou du joueur seul reste (pas de noir en retour)
fogStore.length = 0; mainStore.length = 0;
G.state.player = { x: 4000, y: 4000 };
G.state.towers = [];
G.drawFog();
var fills2 = fogStore.filter(function (c) { return c[1] === "fillRect"; });
assert(fills2.length === 2, "sans tour : fond + 1 trou joueur (obtenu " + fills2.length + ")");

if (fails === 0) console.log("ALL_OK");
else { console.log("FAILURES: " + fails); process.exit(1); }

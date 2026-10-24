// Tutoriel de demarrage (src/tuto.js) : moins de 10 etapes, aucune action
// de jeu requise, Espace avance, Echap sort a tout moment, une seule
// proposition (memorisee).
global.window = global;

// Stub DOM minimal : le tuto construit son calque par getElementById et
// createElement/appendChild.
var _els = {};
function fakeEl(tag) {
  return {
    tagName: (tag || "div").toUpperCase(),
    style: {},
    children: [],
    _text: "",
    set textContent(v) { this._text = v; },
    get textContent() { return this._text; },
    set innerHTML(v) { this.children = []; },
    get innerHTML() { return ""; },
    appendChild: function (c) { this.children.push(c); return c; },
    addEventListener: function () {},
    className: ""
  };
}
global.document = {
  getElementById: function (id) {
    if (id === "tutoLayer") return _els.layer || (_els.layer = fakeEl("div"));
    if (id === "hud") return { getBoundingClientRect: function () { return { left: 0, bottom: 120 }; } };
    return fakeEl();
  },
  createElement: function (tag) { return fakeEl(tag); }
};
global.addEventListener = function () {};
global.localStorage = {
  _s: {},
  getItem: function (k) { return (k in this._s) ? this._s[k] : null; },
  setItem: function (k, v) { this._s[k] = v; }
};

var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }

window.GAME = global.GAME = window.GAME || {};
var G = window.GAME;
G.state = {
  player: { x: 100, y: 100 },
  buildings: [
    { x: 40, y: 40, w: 120, h: 120, isMairie: true },
    { x: 300, y: 300, w: 90, h: 90, isChurch: true },
    { x: 900, y: 900, w: 24, h: 24, isTorche: true }
  ]
};
G.viewW = function () { return 800; };
G.viewH = function () { return 600; };
G.proj = function (x, y) { return [x / 10, y / 10]; };

load("tuto.js");

var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// 1) Structure : moins de 10 etapes, chacune complete (le tuto ne doit
// necessiter AUCUNE action de jeu : les etapes sont de purs messages).
var steps = G.tutoSteps();
assert(steps.length > 0, "au moins une etape");
assert(steps.length < 10, "moins de 10 etapes (actuellement " + steps.length + ")");
for (var i = 0; i < steps.length; i++) {
  assert(steps[i].title && steps[i].text, "etape " + i + " : titre + texte");
  assert(!!steps[i].target, "etape " + i + " : cible d'ancrage definie");
}
// Les elements demandes sont couverts : mairie + son menu, eglise, sac,
// torche, minimap.
var keys = steps.map(function (s) { return s.key; }).join(",");
["mairie", "menu", "eglise", "sac", "torche", "minimap", "hud"].forEach(function (k) {
  assert(keys.indexOf(k) >= 0, "le tuto couvre : " + k);
});

// 2) Proposition : pas encore vu -> demarre et devient actif.
assert(!G.tutoSeen(), "tuto non vu au depart");
assert(!G.tutoActive(), "tuto inactif au depart");
assert(G.tutoMaybeStart() === true, "tuto propose au premier demarrage");
assert(G.tutoActive(), "tuto actif apres proposition");

// 3) Espace avance d'une bulle ; apres la derniere, le tuto se termine
// et est marque comme vu.
for (var j = 1; j < steps.length; j++) {
  assert(G.tutoKey("Space") === true, "Espace consomme (bulle " + j + ")");
  assert(G.tutoActive(), "tuto actif a la bulle " + j);
}
assert(G.tutoKey("Space") === true, "Espace final consomme");
assert(!G.tutoActive(), "tuto termine apres la derniere bulle");
assert(G.tutoSeen(), "tuto marque comme vu");

// 4) Deuxieme demarrage : plus propose (localStorage).
assert(G.tutoMaybeStart() === false, "tuto non repropose la 2e fois");

// 5) Echap sort a tout moment, des la premiere bulle.
global.localStorage._s = {};
assert(G.tutoMaybeStart() === true, "tuto repropose apres reset memoire");
assert(G.tutoKey("Escape") === true, "Echap consomme pendant le tuto");
assert(!G.tutoActive(), "Echap termine le tuto immediatement");
assert(G.tutoSeen(), "Echap marque le tuto comme vu");
assert(G.tutoKey("Space") === false, "aucune touche consommee hors tuto");

// 6) Sortie en pleine sequence (bulle 3) : aucune action requise.
global.localStorage._s = {};
G.tutoMaybeStart();
G.tutoKey("Space");
G.tutoKey("Space");
assert(G.tutoActive(), "tuto en cours a la 3e bulle");
assert(G.tutoKey("Escape") === true, "sortie a la 3e bulle");
assert(!G.tutoActive(), "tuto ferme a la 3e bulle");

console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);

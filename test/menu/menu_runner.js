// Runner du menu d'accueil : petit joueur anime en bas de l'ecran.
// Charge src/menu.js avec un stub DOM, verifie :
//   1. le module s'initialise sans erreur et precharge les 10 frames
//   2. la boucle rAF demarre (acteur + sprite anime)
//   3. le personnage avance (translateX croissant) et fait un aller-retour
//      (x atteint un max puis redescend)
//   4. les frames de course utilisees sont bien perso_droite-N / perso_gauche-N
//      (les 5 frames de chaque direction sont vues sur une traversee complete)
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..", "..");
var fails = 0;
function check(c, m) { if (!c) { fails++; console.log("FAIL: " + m); } }

var elements = {};
function el(id) {
  if (elements[id]) return elements[id];
  elements[id] = {
    id: id, hidden: false, style: {}, value: "", textContent: "",
    children: [], firstChild: null, className: "",
    addEventListener: function (ev, fn) { (this._ev = this._ev || {})[ev] = fn; },
    appendChild: function (c) { this.children.push(c); return c; },
    removeChild: function (c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    focus: function () {}, blur: function () {},
    setAttribute: function () {}, getAttribute: function () { return null; }
  };
  return elements[id];
}
global.window = global;
global.devicePixelRatio = 1;
global.document = {
  readyState: "complete",
  getElementById: el,
  createElement: function () { return el("_tmp" + Math.random()); },
  addEventListener: function () {}
};
global.addEventListener = function () {};
global.innerWidth = 800; global.innerHeight = 600;
var rafQueue = [];
global.requestAnimationFrame = function (fn) { rafQueue.push(fn); return rafQueue.length; };
var fakeNow = 100000;
global.performance = { now: function () { return fakeNow; } };
global.Image = function () {
  this.naturalWidth = 15; this.naturalHeight = 20;
  var self = this;
  setTimeout(function () { if (self.onload) self.onload(); }, 0);
};

var code = fs.readFileSync(path.join(ROOT, "src", "menu.js"), "utf8");
(0, eval)(code);
var G = global.GAME;
check(typeof G.initMenuRunner === "function", "G.initMenuRunner expose");
check(!!el("startScreen"), "startScreen present");
check(!!el("menuRunnerActor"), "menuRunnerActor present");
check(!!el("menuRunnerSprite"), "menuRunnerSprite present");

setTimeout(function () {
  check(rafQueue.length > 0, "boucle rAF demarree apres chargement des frames");
  var sprite = el("menuRunnerSprite"), actor = el("menuRunnerActor");
  var seen = {};
  var xs = [];
  for (var i = 0; i < 600; i++) { // ~30 s de simulation
    fakeNow += 50;
    var q = rafQueue; rafQueue = [];
    q.forEach(function (fn) { fn(fakeNow); });
    if (sprite.src) seen[sprite.src] = true;
    var m = (actor.style.transform || "").match(/translateX\((-?\d+)px\)/);
    if (m) xs.push(parseInt(m[1], 10));
  }
  var keys = Object.keys(seen);
  check(keys.length >= 8, "au moins 8 frames distinctes vues (obtenu " + keys.length + ")");
  check(keys.some(function (s) { return s.indexOf("perso_droite-") >= 0; }), "frames perso_droite utilisees");
  check(keys.some(function (s) { return s.indexOf("perso_gauche-") >= 0; }), "frames perso_gauche utilisees");
  check(keys.every(function (s) { return /perso_(droite|gauche)-[0-4]\.png$/.test(s); }),
    "toutes les frames sont des frames de course du joueur");
  check(xs.length > 0, "acteur deplace");
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  check(maxX - minX > 400, "traversee significative (x de " + minX + " a " + maxX + ")");
  var reachedMax = false, wentBack = false;
  for (var j = 0; j < xs.length; j++) {
    if (xs[j] >= maxX - 1) reachedMax = true;
    else if (reachedMax && xs[j] < maxX - 50) { wentBack = true; break; }
  }
  check(reachedMax && wentBack, "aller-retour effectue (max atteint puis retour)");
  console.log(fails === 0 ? "OK menu_runner" : "MENU_RUNNER ECHEC (" + fails + ")");
  process.exit(fails === 0 ? 0 : 1);
}, 100);

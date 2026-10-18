// Mode clavier ZQSD : bouton "Clavier" a cote du bouton Mobile, DESACTIVE
// par defaut. Charge les scripts reels d'index.html avec un stub DOM et
// verifie :
//   1. par defaut le mode clavier est OFF
//   2. le bouton active le mode (texte ON) et l'aide des commandes change
//   3. ZQSD deplace : keys.space + cible souris monde coherente, Q/D/S/Z
//   4. aucune touche = personnage immobile (keys.space coupe)
//   5. Espace maintenu = tir (actionHeld), sans bouger
//   6. mode build : les touches deplacent la cible de pose, Espace pose
//   7. desactivation : retour au mode par defaut intact
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..", "..");
var fails = 0;
function check(cond, m) { if (!cond) { fails++; console.log("FAIL: " + m); } }

// ---- Stub DOM (meme squelette que test/menu/touch_mode.js) ----
var elements = {};
function el(id) {
  if (elements[id]) return elements[id];
  elements[id] = {
    id: id, hidden: false, style: {}, value: "", textContent: "",
    children: [], firstChild: null, tagName: "DIV", className: "",
    addEventListener: function (ev, fn) { (this._ev = this._ev || {})[ev] = fn; },
    appendChild: function (c) { this.children.push(c); this.firstChild = this.children[0]; return c; },
    removeChild: function (c) {
      var i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      this.firstChild = this.children[0] || null;
      return c;
    },
    getAttribute: function () { return this._mode || null; },
    setAttribute: function (k, v) { if (k === "data-mode") this._mode = v; },
    focus: function () {}, blur: function () {},
    scrollTop: 0, scrollHeight: 0,
    getContext: function () {
      return {
        setTransform: function () {}, fillRect: function () {}, strokeRect: function () {},
        clearRect: function () {}, beginPath: function () {}, closePath: function () {},
        moveTo: function () {}, lineTo: function () {}, arc: function () {}, ellipse: function () {},
        fill: function () {}, stroke: function () {}, save: function () {}, restore: function () {},
        translate: function () {}, rotate: function () {}, scale: function () {},
        drawImage: function () {}, fillText: function () {}, strokeText: function () {},
        measureText: function () { return { width: 10 }; },
        getImageData: function () { return { data: new Uint8ClampedArray(4) }; },
        putImageData: function () {},
        createImageData: function () { return { width: 1, height: 1 }; },
        quadraticCurveTo: function () {}, bezierCurveTo: function () {},
        rect: function () {}, clip: function () {}, isPointInPath: function () { return false; },
        imageSmoothingEnabled: false, globalAlpha: 1, fillStyle: "", strokeStyle: "",
        lineWidth: 1, font: "", textAlign: "", textBaseline: ""
      };
    }
  };
  return elements[id];
}
var windowListeners = [];
var documentListeners = [];
global.window = global;
global.devicePixelRatio = 1;
global.document = {
  readyState: "complete",
  getElementById: el,
  createElement: function () { return el("_tmp" + Math.random()); },
  body: { appendChild: function (c) { elements.body = elements.body || { children: [] }; elements.body.children.push(c); } },
  addEventListener: function (ev, fn) { documentListeners.push({ ev: ev, fn: fn }); }
};
global.addEventListener = function (ev, fn) { windowListeners.push({ ev: ev, fn: fn }); };
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
global.sessionStorage = { getItem: function () { return null; }, removeItem: function () {} };
global.innerWidth = 800;
global.innerHeight = 400;
global.Image = function () { return { set src(v) { if (this.onload) this.onload(); }, naturalWidth: 8, naturalHeight: 8 }; };
global.requestAnimationFrame = function () {};
global.performance = { now: function () { return Date.now(); } };
global.alert = function () {};
global.location = { protocol: "http:", host: "127.0.0.1:1", reload: function () {} };
global.WebSocket = function () { this.readyState = 3; };
global.WebSocket.OPEN = 1;
global.XMLHttpRequest = function () {
  this.open = function () {}; this.send = function () {};
  this.setRequestHeader = function () {}; this.abort = function () {};
  this.responseText = "{}"; this.status = 200; this.readyState = 4;
};
global.Audio = function () { this.play = function () { return { catch: function () {} }; }; this.pause = function () {}; };

// Charge les scripts du client dans l'ordre d'index.html.
var html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
var srcs = html.match(/src="[^"]*\.js"/g).map(function (s) { return s.slice(5, -1); })
  .filter(function (s) { return !/^https?:/.test(s); });
srcs.forEach(function (f) {
  var code = fs.readFileSync(path.join(ROOT, f), "utf8");
  try { (0, eval)(code); } catch (e) {
    console.log("FAIL: chargement " + f + " : " + e.message);
    process.exit(1);
  }
});
var G = global.GAME;

// Stub canvas : rect plein ecran pour unproj/getBoundingClientRect.
elements.game.getBoundingClientRect = function () {
  return { left: 0, top: 0, width: global.innerWidth, height: global.innerHeight };
};
G.unproj = function (sx, sy) { return [sx + 1000, sy + 1000]; };

// Etat de jeu minimal : partie en cours, joueur au centre.
G.state.started = true;
G.state.paused = false;
G.state.gameOver = false;
G.state.inBuilding = null;
G.state.bag = { open: false, contents: [] };
G.state.buildings = [];
G.state.player = { x: 1000, y: 1000, face: 1 };
G.state.mouse = { sx: 0, sy: 0, wx: 0, wy: 0, inside: false };
G.state.keys = {};
G.state.chatTyping = false;
G.playMode = "local";

// 1. Par defaut : mode clavier DESACTIVE.
check(G.keyboardEnabled() === false, "mode clavier OFF par defaut");
var hintBlock = el("hudHintBlock");
check(hintBlock.children.length === 0, "avant activation : aide par defaut (HTML statique) intacte");

// 2. Activation via G.setKeyboardMode (le menu deroulant "Commandes" de
//    src/menu.js appelle cette fonction ; l'ancien bouton est retire).
G.setKeyboardMode(true);
check(G.keyboardEnabled() === true, "setKeyboardMode(true) : mode active");
var hintsKb = hintBlock.children.map(function (c) { return c.textContent; });
check(hintsKb.length === 3 && hintsKb[0].indexOf("ZQSD") >= 0 && hintsKb[0].indexOf("Espace = tir") >= 0 &&
  hintsKb[1].indexOf("B = menu") >= 0 && hintsKb[1].indexOf("R = rotation") >= 0,
  "aide mise a jour en mode clavier : " + JSON.stringify(hintsKb));

// 3. Deplacement : ZQSD et fleches.
function keysDown(codes) { codes.forEach(function (c) { G.state.keys[c] = true; }); G.keyboardUpdate(); }
function keysUp(codes) { codes.forEach(function (c) { delete G.state.keys[c]; }); G.keyboardUpdate(); }

// 3b. Z en mode clavier = MONTER (keys.space), pas le mode planche.
G.openBuildMenu = function () { G._buildMenuOpened = true; };
keysDown(["KeyZ"]);
check(G.state.keys.space === true, "Z : le joueur monte (pas le menu planche)");
check(G._buildMenuOpened !== true, "Z en mode clavier n'ouvre PAS le menu planche");
keysUp(["KeyZ"]);

keysDown(["KeyQ"]); // Q = gauche
check(G.state.keys.space === true, "Q enfoncee : le joueur avance (keys.space)");
var px = G.state.player.x, py = G.state.player.y;
check(Math.abs(G.state.mouse.wx - px) > 50 || Math.abs(G.state.mouse.wy - py) > 50,
  "cible de deplacement placee loin du joueur");
keysUp(["KeyQ"]);

keysDown(["ArrowUp"]); // fleche haut = haut
check(G.state.keys.space === true, "Fleche haut : le joueur avance");
keysUp(["ArrowUp"]);
keysDown(["KeyS", "KeyD"]); // deux touches = diagonale
check(G.state.keys.space === true, "S+D : le joueur avance (diagonale)");
keysUp(["KeyS", "KeyD"]);

// 4. Aucune touche : immobile.
G.state.keys = {}; G.keyboardUpdate();
check(G.state.keys.space !== true, "aucune touche : personnage immobile");
check(G.state.player.moving !== true, "player.moving faux a l'arret");

// 5. Espace maintenu : tir, sans bouger.
G.state.keys = {}; G.state.keys.Space = true; G.keyboardUpdate();
check(G.state.actionHeld === true, "Espace : action armee (tir)");
check(G.state.keys.space !== true, "Espace seul : pas de deplacement");
G.keyboardUpdate(); // maintenu : pas de repetition genante
check(G.state.actionHeld === true, "Espace maintenu : tir continue");
delete G.state.keys.Space; G.keyboardUpdate();
check(G.state.actionHeld === false, "Espace relache : tir coupe");

// 6. Mode build : les touches deplacent la cible de pose, Espace pose.
G.tryBuildWall = function (wx, wy) { G._wallPlaced = { wx: wx, wy: wy }; };
G.placeFromBuildMenu = function (wx, wy) { G._buildPlaced = { wx: wx, wy: wy }; };
G.state.buildMode = true;
G.state.buildSel = null;
G.state.planks = 100;
G.state.keys = {};
keysDown(["KeyD"]); // D = droite : le rectangle de pose va a droite
var targetWx = G.state.mouse.wx;
check(Math.abs(targetWx - G.state.player.x) > 50, "mode build : D deplace la cible de pose");
keysUp(["KeyD"]);
G.state.keys = {};
G.state.keys.Space = true; G.keyboardUpdate(); // pose
check(G._wallPlaced && G._wallPlaced.wx === targetWx,
  "mode build : Espace pose la palissade au rectangle pilote par les touches");
check(G.state.actionHeld !== true, "mode build : Espace ne tire pas");
delete G.state.keys.Space; G.keyboardUpdate();
G.state.keys.Space = true; G.keyboardUpdate(); // re-pose : arrete montante
check(G._wallPlaced && G._wallPlaced.wx === targetWx, "nouvelle pression Espace : re-pose possible");
delete G.state.keys.Space;
G.state.buildMode = false;

// 7. Desactivation : retour au mode par defaut, inputs remis a zero.
G.setKeyboardMode(false);
check(G.keyboardEnabled() === false, "setKeyboardMode(false) : mode clavier desactive");
check(G.state.actionHeld === false, "desactivation : actionHeld coupe");
var hintsAfter = hintBlock.children.map(function (c) { return c.textContent; });
check(hintsAfter.length === 3 && hintsAfter[0].indexOf("Espace = avancer") >= 0,
  "aide restauree : " + JSON.stringify(hintsAfter));

console.log(fails === 0 ? "OK: mode clavier ZQSD (desactive par defaut, bouton, aide dynamique, deplacement, tir Espace, pose build, desactivation)"
                       : "MODE CLAVIER ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);

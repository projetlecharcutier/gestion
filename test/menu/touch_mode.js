// Mode mobile : bouton "Mobile" a cote du son, DESACTIVE par defaut.
// Charge les scripts reels d'index.html avec un stub DOM, simule des
// touch events (joystick flottant gauche = deplacement, tap droite =
// tir, pinch = zoom) et verifie :
//   1. par defaut le mode mobile est OFF (controles absents/caches)
//   2. le bouton active les controles (joystick repond au touch)
//   3. le joystick (base fixe bas-droite) traduit un touch DROITE en
//      deplacement (keys.space + direction souris monde coherente)
//   4. un tap moitie gauche arme actionHeld (tir) et pose la cible
//   4b. le BOUTON TIR (bas gauche) arme actionHeld, le relacher coupe
//   4c. ramassage AUTOMATIQUE : un item a proximite est pris par
//       touchUpdate, sans toucher l'ecran (G.pickupItem)
//   5. re-bascule : retour au mode souris+clavier intact
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..", "..");
var fails = 0;
function check(cond, m) { if (!cond) { fails++; console.log("FAIL: " + m); } }

// ---- Stub DOM (meme squelette que test/menu/chat_client.js) ----
var elements = {};
function el(id) {
  if (elements[id]) return elements[id];
  elements[id] = {
    id: id, hidden: false, style: {}, value: "", textContent: "",
    children: [], firstChild: null, tagName: "DIV",
    addEventListener: function (ev, fn) { (this._ev = this._ev || {})[ev] = fn; },
    appendChild: function (c) { this.children.push(c); this.firstChild = this.children[0]; return c; },
    removeChild: function (c) {
      var i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      this.firstChild = this.children[0] || null;
      return c;
    },
    focus: function () { this.focused = true; },
    blur: function () { this.focused = false; },
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
        getBoundingClientRect: undefined,
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
G.playMode = "local";

// 1. Par defaut : mode mobile DESACTIVE.
check(G.touchEnabled() === false, "mode mobile OFF par defaut");

// 2. Activation via G.setTouchMode (le menu deroulant "Commandes" de
//    src/menu.js appelle cette fonction ; l'ancien bouton est retire).
G.setTouchMode(true);
check(G.touchEnabled() === true, "setTouchMode(true) : mode active");

// 3. Le touch-ui est construit et visible en partie.
var touchRoot = null;
Object.keys(elements).forEach(function (k) {
  if (elements[k].className === "touch-ui") touchRoot = elements[k];
});
check(!!touchRoot, "panneau tactile construit");
check(touchRoot.hidden === false, "panneau tactile visible apres activation");

// Simule un touchstart moitie droite (joystick, base bas-droite).
function fire(type, touches, target) {
  documentListeners.forEach(function (l) {
    if (l.ev === type) {
      l.fn({
        changedTouches: touches,
        touches: touches,
        target: target || { closest: function () { return null; } },
        preventDefault: function () {}
      });
    }
  });
}
G.state.mouse = { sx: 0, sy: 0, wx: 0, wy: 0, inside: false };
G.state.keys = {};
var t1 = { identifier: 1, clientX: 700, clientY: 300 };
fire("touchstart", [t1]);
// Le simple poser du doigt ancre le joystick : le deplacement ne demarre
// qu'au glisse (touchmove), comme un vrai stick.
var t1a = { identifier: 1, clientX: 700, clientY: 260 };
fire("touchmove", [t1a]);
check(G.state.keys.space === true, "touch droite + glisse : le joueur avance (keys.space)");
// Direction : le stick pointe vers le haut (300 -> 200) : la cible monde
// doit etre COHERENTE (nx=0, ny=-1 -> wx/wy convertis ecran->monde).
var t1m = { identifier: 1, clientX: 700, clientY: 200 };
fire("touchmove", [t1m]);
var px = G.state.player.x, py = G.state.player.y;
check(Math.abs(G.state.mouse.wx - px) > 50 || Math.abs(G.state.mouse.wy - py) > 50,
  "cible de deplacement placee loin du joueur : " + G.state.mouse.wx + "," + G.state.mouse.wy);
fire("touchend", [{ identifier: 1 }], []);
check(G.state.keys.space === false, "touchend : le joueur s'arrete");

// 4. Tap moitie gauche : tir arme + cible visee.
G.unproj = G.unproj || function (sx, sy) { return [sx, sy]; };
var t2 = { identifier: 2, clientX: 100, clientY: 150 };
fire("touchstart", [t2]);
check(G.state.actionHeld === true, "tap gauche : action armee (tir/hache)");
check(G.state.mouse.inside === true, "tap gauche : souris (viser) activee");
fire("touchend", [{ identifier: 2 }], []);
check(G.state.actionHeld === false, "relache : tir coupe");

// 4b. Bouton TIR : maintenu = actionHeld, relache = arret.
var fireBtn = null;
Object.keys(elements).forEach(function (k) {
  if (elements[k].className === "touch-btn touch-btn--fire") fireBtn = elements[k];
});
check(!!fireBtn, "bouton TIR construit");
check(fireBtn.hidden === false, "bouton TIR visible en partie");
if (fireBtn && fireBtn._ev && fireBtn._ev.touchstart) {
  fireBtn._ev.touchstart({ preventDefault: function () {}, stopPropagation: function () {} });
  check(G.state.actionHeld === true, "bouton TIR maintenu : action armee");
  if (fireBtn._ev.touchend) {
    fireBtn._ev.touchend({ preventDefault: function () {}, stopPropagation: function () {} });
    check(G.state.actionHeld === false, "bouton TIR relache : tir coupe");
  }
} else {
  check(false, "bouton TIR sans listeners tactiles");
}

// 4c. Ramassage automatique : un item a proximite est pris sans clic.
G.state.items = [{ x: G.state.player.x + 40, y: G.state.player.y,
                   taken: false, name: "Potion", kind: "objet", color: "#f00" }];
G.netConnected = function () { return false; };
G.addFloater = G.addFloater || function () {};
G.updateHud = G.updateHud || function () {};
G.touchUpdate();
check(G.state.items[0].taken === true, "ramassage auto : item proche pris");
check(G.state.bag.contents.some(function (b) { return b.name === "Potion"; }),
  "ramassage auto : Potion dans le sac");
G.state.items.push({ x: G.state.player.x + 3000, y: G.state.player.y,
                     taken: false, name: "Loin", kind: "objet", color: "#0f0" });
G.touchUpdate();
check(G.state.items[1].taken === false, "ramassage auto : item loin ignore");

// 5. Pinch (2 doigts a droite) : zoom.
G.state.targetZoom = 8;
var pA = { identifier: 3, clientX: 500, clientY: 100 };
var pB = { identifier: 4, clientX: 620, clientY: 100 };
fire("touchstart", [pA, pB]);
var z1 = G.state.targetZoom;
var pA2 = { identifier: 3, clientX: 450, clientY: 100 };
var pB2 = { identifier: 4, clientX: 680, clientY: 100 };
fire("touchmove", [pA2, pB2]);
var z2 = G.state.targetZoom;
check(z2 > z1, "pinch ecarte : zoom in (" + z1 + " -> " + z2 + ")");
fire("touchend", [{ identifier: 3 }, { identifier: 4 }], []);

// 6. Desactivation : retour au mode clavier/souris, inputs remis a zero.
G.setTouchMode(false);
check(G.touchEnabled() === false, "setTouchMode(false) : mode mobile desactive");
check(G.state.keys.space === false && G.state.actionHeld === false,
  "desactivation : espace et actionHeld remis a zero");
check(touchRoot.hidden === true, "panneau tactile cache apres desactivation");

console.log(fails === 0 ? "OK: mode mobile (desactive par defaut, bouton, joystick bas-droite, bouton TIR, ramassage auto, pinch, desactivation)"
                       : "MODE MOBILE ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);

// Menu deroulant "Commandes" (src/menu.js) : remplace les 2 anciens
// boutons Clavier/Mobile qui se recouvraient. Verifie :
//   1. le bouton Commandes + la liste deroulante existent dans le DOM
//   2. par defaut : mode "Souris + clavier" affiche, liste repliee
//   3. clic sur le bouton = deplie la liste (3 options)
//   4. clic sur "Clavier" = active le mode clavier (G.keyboardEnabled)
//   5. clic sur "Mobile" = active le mode touch (G.touchEnabled)
//   6. retour a "Souris + clavier" = desactive les 2 autres modes
//   7. clic sur le bouton quand ouvert = replie la liste
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..", "..");
var fails = 0;
function check(cond, m) { if (!cond) { fails++; console.log("FAIL: " + m); } }

// ---- Stub DOM ----
var elements = {};
function makeEl(id) {
  var el = {
    id: id, hidden: false, style: {}, value: "", textContent: "",
    children: [], firstChild: null, tagName: "DIV", className: "",
    _ev: {}, _attrs: {},
    _classes: {},
    addEventListener: function (ev, fn) { this._ev[ev] = fn; },
    appendChild: function (c) { this.children.push(c); this.firstChild = this.children[0]; return c; },
    removeChild: function (c) {
      var i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      this.firstChild = this.children[0] || null;
      return c;
    },
    getAttribute: function (k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
    setAttribute: function (k, v) { this._attrs[k] = v; },
    querySelectorAll: function (sel) {
      // Only supports "[data-mode]" selector
      if (sel === "[data-mode]") {
        return this.children.filter(function (c) { return c._attrs["data-mode"] !== undefined; });
      }
      return [];
    },
    contains: function (t) { return this.children.indexOf(t) >= 0; },
    classList: {
      add: function (c) { el._classes[c] = true; },
      remove: function (c) { delete el._classes[c]; },
      contains: function (c) { return !!el._classes[c]; }
    },
    focus: function () {}, blur: function () {},
    scrollTop: 0, scrollHeight: 0
  };
  return el;
}
function el(id) {
  if (elements[id]) return elements[id];
  elements[id] = makeEl(id);
  return elements[id];
}

// Pre-create the controls menu structure (as in index.html)
var controlsMenu = el("controlsMenu");
var controlsBtn = el("controlsBtn");
controlsBtn._attrs["aria-expanded"] = "false";
var controlsList = el("controlsList");
controlsList.hidden = true;

var optDefault = makeEl("optDefault");
optDefault._attrs["data-mode"] = "default";
optDefault.textContent = "Souris + clavier";
var optKeyboard = makeEl("optKeyboard");
optKeyboard._attrs["data-mode"] = "keyboard";
optKeyboard.textContent = "Clavier (ZQSD)";
var optTouch = makeEl("optTouch");
optTouch._attrs["data-mode"] = "touch";
optTouch.textContent = "Mobile (tactile)";
controlsList.children = [optDefault, optKeyboard, optTouch];
controlsList.firstChild = optDefault;

// Chat toggle elements
var chatToggle = el("chatToggle");
chatToggle._attrs["aria-expanded"] = "true";
var chat = el("chat");
chat.hidden = true;

global.window = global;
global.document = {
  readyState: "complete",
  getElementById: el,
  createElement: function () { return makeEl("_tmp" + Math.random()); },
  body: { appendChild: function () {} },
  addEventListener: function (ev, fn) { (this._docEv = this._docEv || {})[ev] = fn; }
};
global.localStorage = {
  _store: {},
  getItem: function (k) { return this._store[k] !== undefined ? this._store[k] : null; },
  setItem: function (k, v) { this._store[k] = String(v); }
};
global.Image = function () { return { set src(v) { if (this.onload) this.onload(); }, naturalWidth: 8, naturalHeight: 8 }; };
global.requestAnimationFrame = function () {};
global.performance = { now: function () { return Date.now(); } };

// Charge uniquement src/menu.js (le module teste)
var code = fs.readFileSync(path.join(ROOT, "src/menu.js"), "utf8");
(0, eval)(code);
var G = global.GAME;

// Stubs pour les modes clavier/touch (normalement dans keyboard.js/touch.js)
var kbEnabled = false, touchEnabled = false;
G.keyboardEnabled = function () { return kbEnabled; };
G.setKeyboardMode = function (on) { kbEnabled = !!on; if (G.refreshControlsBtn) G.refreshControlsBtn(); };
G.touchEnabled = function () { return touchEnabled; };
G.setTouchMode = function (on) { touchEnabled = !!on; if (G.refreshControlsBtn) G.refreshControlsBtn(); };

// Appelle l'init (normalement via boot())
G.initControlsMenu();
G.initChatToggle();

// 1. Elements presents
check(!!controlsBtn, "bouton Commandes present");
check(!!controlsList, "liste deroulante presente");
check(controlsList.hidden === true, "liste repliee par defaut");

// 2. Defaut : Souris + clavier
check(controlsBtn.textContent.indexOf("Souris + clavier") >= 0,
  "bouton affiche 'Souris + clavier' par defaut : " + controlsBtn.textContent);

// 3. Clic sur le bouton = deplie
var btnClick = controlsBtn._ev.click;
check(!!btnClick, "bouton Commandes cliquable");
btnClick({ stopPropagation: function () {} });
check(controlsList.hidden === false, "clic deplie la liste");
check(controlsBtn._attrs["aria-expanded"] === "true", "aria-expanded=true apres ouverture");

// 4. Clic sur "Clavier" = active mode clavier
var kbOptClick = optKeyboard._ev.click;
check(!!kbOptClick, "option Clavier cliquable");
kbOptClick({ stopPropagation: function () {} });
check(kbEnabled === true, "clic Clavier active le mode clavier");
check(controlsBtn.textContent.indexOf("Clavier") >= 0,
  "bouton affiche 'Clavier' : " + controlsBtn.textContent);
check(controlsList.hidden === true, "liste repliee apres selection");

// 5. Ouvrir et clic sur "Mobile" = active mode touch (et coupe clavier)
btnClick({ stopPropagation: function () {} });
var touchOptClick = optTouch._ev.click;
touchOptClick({ stopPropagation: function () {} });
check(touchEnabled === true, "clic Mobile active le mode touch");
// Note: dans le vrai code, setTouchMode(true) appelle setKeyboardMode(false)
// Ici nos stubs ne le font pas, mais le menu deroulant verifie l'etat via
// currentControlMode() qui privilegie touch sur keyboard.
check(controlsBtn.textContent.indexOf("Mobile") >= 0,
  "bouton affiche 'Mobile' : " + controlsBtn.textContent);

// 6. Retour a "Souris + clavier" = desactive les 2 autres
btnClick({ stopPropagation: function () {} });
var defOptClick = optDefault._ev.click;
defOptClick({ stopPropagation: function () {} });
// applyControlMode("default") appelle setKeyboardMode(false) et setTouchMode(false)
check(kbEnabled === false, "retour defaut : clavier desactive");
check(touchEnabled === false, "retour defaut : touch desactive");
check(controlsBtn.textContent.indexOf("Souris + clavier") >= 0,
  "bouton affiche 'Souris + clavier' : " + controlsBtn.textContent);

// 7. Clic sur le bouton quand ouvert = replie
btnClick({ stopPropagation: function () {} });
check(controlsList.hidden === false, "liste ouverte");
btnClick({ stopPropagation: function () {} });
check(controlsList.hidden === true, "clic replie la liste");

// 8. Chat toggle : clic = replie/deplie
check(!!chatToggle, "bouton chat toggle present");
var chatClick = chatToggle._ev.click;
check(!!chatClick, "bouton chat cliquable");
// Simule le chat visible
chat.hidden = false;
chatClick();
check(chat.hidden === true, "clic chat : panneau replie (hidden=true)");
check(chatToggle.textContent.indexOf("\u25b6") >= 0, "fleche repliee apres clic : " + chatToggle.textContent);
chatClick();
check(chat.hidden === false, "2e clic chat : panneau deplie");
check(chatToggle.textContent.indexOf("\u25bc") >= 0, "fleche depliee apres 2e clic : " + chatToggle.textContent);

console.log(fails === 0 ? "OK controls_menu" : fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);

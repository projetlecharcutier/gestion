// Smoke : le module input.js doit s'initialiser avec le menu multijoueur par defaut
// sans erreur, dessiner le zombie du guide et connecter au "serveur".
var fs = require("fs"), path = require("path");
var SRC = path.join(__dirname, "..", "..", "src");
global.window = global;
global.devicePixelRatio = 1;
var elements = {};
function el(id) {
  if (elements[id]) return elements[id];
  elements[id] = {
    id: id, hidden: false, style: {}, value: "", textContent: "",
    addEventListener: function (ev, fn) { this["on" + ev] = fn; },
    getContext: function (kind) {
      var self = this;
      var ctx = {
        fillStyle: "", imageSmoothingEnabled: false,
        fillRect: function (x, y, w, h) { self.drawn = (self.drawn || 0) + 1; },
        setTransform: function () {}, drawImage: function () {}, beginPath: function () {},
        ellipse: function () {}, fill: function () {}, save: function () {}, restore: function () {},
        arc: function () {}, moveTo: function () {}, lineTo: function () {}, stroke: function () {},
        clearRect: function () {}, getImageData: function () { return { data: new Uint8ClampedArray(4) }; },
        translate: function () {}, rotate: function () {}, scale: function () {}
      };
      (self._ctxs = self._ctxs || []).push(ctx);
      return ctx;
    },
    focus: function () {}, blur: function () {}
  };
  return elements[id];
}
global.document = { getElementById: el, createElement: function () { return el("_tmp" + Math.random()); } };
global.addEventListener = function () {};
global.Image = function () { return { set src(v) { if (this.onload) this.onload(); }, naturalWidth: 8, naturalHeight: 8 }; };
global.WebSocket = function (url) {
  console.log("WebSocket construit :", url);
  this.readyState = 0;
  return this;
};
global.requestAnimationFrame = function () {};
global.performance = { now: function () { return 0; } };
var canvas = el("game");
canvas.width = 800; canvas.height = 600;
function load(f) { (0, eval)(fs.readFileSync(path.join(SRC, f), "utf8")); }
["config.js","stats.js","assets.js","state.js","textures/index.js","textures/player.js","textures/zombie.js","textures/building.js","textures/wall.js","textures/item.js","textures/ground.js","textures/fog.js","textures/crosshair.js","textures/projectile.js","textures/hud.js","textures/bag.js","textures/bird.js","projection.js","world.js","flowfield.js","player.js","walls.js","towers.js","chop.js","weapons.js","birds.js","siege.js","zombies.js","bag.js","hud.js","net.js","render.js","input.js","sound.js"].forEach(load);
var G = global.GAME;
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }
assert(G.playMode === "server", "mode par defaut = server (obtenu " + G.playMode + ")");
assert(el("lobbyInfo").hidden === false, "lobbyInfo visible au boot");
assert(el("guideZombie").drawn > 0, "zombie du guide dessine (" + (el("guideZombie").drawn || 0) + " pixels)");
// Le formulaire doit rester fonctionnel : submit declenche netJoin en mode serveur.
G.nameInput = el("nameInput");
el("nameInput").value = "Test";
var joined = false;
G.netJoin = function (name) { joined = true; console.log("netJoin appele :", name); };
el("startForm").onsubmit({ preventDefault: function () {} });
assert(joined, "submit -> netJoin en mode serveur");
// Passage en local : lobby masque, pas de reconnexion.
el("modeChoice").onchange({ target: { value: "local" } });
assert(G.playMode === "local", "changement de mode -> local");
assert(el("lobbyInfo").hidden === true, "lobby masque en local");
console.log(fails ? "ECHEC" : "OK menu : multijoueur par defaut + guide dessine");
process.exit(fails ? 1 : 0);

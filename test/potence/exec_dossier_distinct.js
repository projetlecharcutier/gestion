// Potence : animation d'execution deposee dans un DOSSIER DISTINCT
// (assets/sprites/potence/exec/) au lieu de la racine du batiment.
// Le jeu doit charger la serie depuis ce dossier (conventions standard
// ET Aseprite -0101 acceptees dans le dossier distinct).
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// Stub : AUCUN PNG a la racine de potence/ ; le dossier exec/ contient
// exec-0101.png .. exec-0105.png (convention Aseprite).
function FakeImage() {}
FakeImage.prototype = {
  set src(v) {
    var self = this;
    var name = v.split("/").pop().split("?")[0];
    var base = name.replace(".png", "");
    var mStd = base.match(/^exec-([0-9]+)$/);
    var exists = false;
    if (mStd && +mStd[1] >= 101 && +mStd[1] <= 105) exists = true;
    setTimeout(function () {
      if (exists) {
        self.naturalWidth = 96; self.naturalHeight = 96;
        if (self.onload) self.onload();
      } else {
        if (self.onerror) self.onerror();
      }
    }, 0);
  }
};
global.window = global;
global.document = { createElement: function () { return { getContext: function () { return {}; }, style: {} }; } };
global.Image = FakeImage;
global.navigator = { userAgent: "test" };
global.XMLHttpRequest = function () { this.readyState = 4; this.status = 404; this.onreadystatechange = null; };
global.XMLHttpRequest.prototype.open = function () {};
global.XMLHttpRequest.prototype.send = function () { var self = this; setTimeout(function () { if (self.onreadystatechange) self.onreadystatechange(); }, 0); };

var files = ["src/config.js", "src/projection.js", "src/world.js", "src/player.js",
  "src/walls.js", "src/towers.js", "src/chop.js", "src/weapons.js", "src/birds.js",
  "src/siege.js", "src/zombies.js"];
files.forEach(function (f) { (0, eval)(fs.readFileSync(REPO + "/" + f, "utf8")); });
var G = global.GAME;
(0, eval)(fs.readFileSync(REPO + "/src/assets.js", "utf8"));

G.loadAssets(function () {
  var ex = G.hasSprite("potence", "exec") ? G.SPRITES.potence.exec : null;
  assert(ex && ex.frames && ex.frames.length === 5,
    "exec charge depuis le dossier distinct potence/exec/ (0101..0105, obtenu " +
    (ex && ex.frames ? ex.frames.length : "null") + ")");
  console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
  process.exit(fails === 0 ? 0 : 1);
});

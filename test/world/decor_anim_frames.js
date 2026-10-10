// Test: l'eolienne Dessous possede eolienne-0..7.png -> la sonde des decors
// (probeElementDecor, src/assets.js) doit charger ces frames dans
// sprite.frames et G.animImg doit boucler dessus (rotation 10 FPS).
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

function FakeImage() {}
FakeImage.prototype = {
  set src(v) {
    var self = this;
    var name = v.split("/").pop().split("?")[0];
    var p = path.join(REPO, "assets", v.split("assets/")[1]);
    setTimeout(function () {
      if (fs.existsSync(p)) {
        self.naturalWidth = 53; self.naturalHeight = 98;
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

var files = ["src/config.js", "src/projection.js", "src/world.js"];
files.forEach(function (f) { (0, eval)(fs.readFileSync(REPO + "/" + f, "utf8")); });
var G = global.GAME;
(0, eval)(fs.readFileSync(REPO + "/src/assets.js", "utf8"));

// Preconditions : les PNG existent reellement (frames -0..-7 + base).
for (var i = 0; i < 8; i++) {
  var fp = REPO + "/assets/sprites/elementdecord/Dessous/eolienne-" + i + ".png";
  assert(fs.existsSync(fp), "PNG present: eolienne-" + i + ".png");
}

G.loadAssets(function () {
  var sp = G.hasSprite("elementdecord", "Dessous/eolienne")
    ? G.SPRITES.elementdecord["Dessous/eolienne"] : null;
  assert(sp, "sprite eolienne charge (PNG de base)");
  assert(sp && sp.frames && sp.frames.length === 8,
    "8 frames chargees (obtenu: " + (sp && sp.frames ? sp.frames.length : 0) + ")");
  assert(sp && !sp.frames ? false : true, "frames non nulles");

  // animImg boucle : t=0 -> frame 0, t=0.1 -> frame 1, t=0.75 -> frame 7 (0.75*10=7.5->7)
  if (sp && sp.frames && sp.frames.length === 8) {
    assert(G.animImg(sp, 0) === sp.frames[0], "animImg(0) = frame 0");
    assert(G.animImg(sp, 0.1) === sp.frames[1], "animImg(0.1) = frame 1");
    assert(G.animImg(sp, 0.75) === sp.frames[7], "animImg(0.75) = frame 7");
    assert(G.animImg(sp, 0.85) === sp.frames[0], "animImg(0.85) boucle sur frame 0");
  }

  // Les decors sans frames restent statiques (frames null/absent).
  var cg = G.SPRITES.elementdecord["Dessous/certgeant"];
  assert(cg, "certgeant charge");
  assert(cg && (!cg.frames || !cg.frames.length),
    "certgeant statique (pas de frames -N presentes)");

  console.log("----------------------------------------");
  console.log("PASS: all  FAIL: " + fails);
  process.exit(fails ? 1 : 0);
});

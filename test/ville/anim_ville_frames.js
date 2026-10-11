// Animation des villes PNG : frames ville-0.png, ville-1.png... avec MASQUE
// UNIQUE (ville_mask.png reste statique -- les zones solides ne bougent pas,
// seul le visuel s'anime). Le PNG de base reste la reference (emprise, masque,
// collision) ; les frames doivent avoir la meme taille au pixel pres.
// Le test copie le repo en tmp (comme depot_multi.js), depose 4 frames sur
// une copie de la ville est, charge les assets cote client (probeVilles ->
// probeAnimFrames) et verifie le rendu en bandes par frame.
var fs = require("fs");
var path = require("path");
var os = require("os");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

var TMP = path.join(os.tmpdir(), "flex-ville-anim-test");
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
fs.mkdirSync(TMP, { recursive: true });
["src", "server", "assets"].forEach(function (f) {
  try {
    fs.cpSync(path.join(REPO, f), path.join(TMP, f), { recursive: true });
    fs.rmSync(path.join(TMP, f, "node_modules"), { recursive: true, force: true });
  } catch (e) {}
});
try { fs.symlinkSync(path.join(REPO, "server", "node_modules"), path.join(TMP, "server", "node_modules")); } catch (e) {}

// Depose 4 frames (ville-0..3.png) : copies DUPLICHEES de ville.png de est
// (meme taille au pixel pres, contenu identique -- le test verifie le
// CHARGEMENT et la BOUCLE, pas le pixel art).
var estDir = path.join(TMP, "assets", "sprites", "ville", "est");
var basePng = fs.readFileSync(path.join(estDir, "ville.png"));
for (var i = 0; i < 4; i++) {
  fs.writeFileSync(path.join(estDir, "ville-" + i + ".png"), basePng);
}

// --- Stubs DOM (meme modele que test/buildings/anim_tour_tailles.js) ---
global.window = global;
global.document = { createElement: function () { return { getContext: function () { return {}; }, style: {} }; } };
global.Image = function () {};
// Image charge TOUT fichier existant sous TMP avec sa vraie taille (lue
// dans l'en-tete IHDR du PNG).
global.Image.prototype = {
  set src(v) {
    var self = this;
    var rel = v.split("assets/")[1];
    var p = path.join(TMP, "assets", rel.split("?")[0]);
    setTimeout(function () {
      if (fs.existsSync(p)) {
        var d = fs.readFileSync(p);
        self.naturalWidth = d.readUInt32BE(16);
        self.naturalHeight = d.readUInt32BE(20);
        if (self.onload) self.onload();
      } else {
        if (self.onerror) self.onerror();
      }
    }, 0);
  }
};
global.navigator = { userAgent: "test" };
global.XMLHttpRequest = function () { this.readyState = 4; this.status = 404; this.onreadystatechange = null; };
global.XMLHttpRequest.prototype.open = function () {};
global.XMLHttpRequest.prototype.send = function () { var self = this; setTimeout(function () { if (self.onreadystatechange) self.onreadystatechange(); }, 0); };

function load(f) { (0, eval)(fs.readFileSync(path.join(TMP, "src", f), "utf8")); }
["config.js", "projection.js", "world.js", "ville.js"].forEach(load);
var G = global.GAME;
// assets.js expose loadAssets + probeVilles/probeAnimFrames.
load("assets.js");

G.loadAssets(function () {
  var sp = G.hasSprite("ville", "est") ? G.SPRITES.ville.est : null;
  assert(sp, "ville est chargee (PNG de base)");
  assert(sp && sp.frames && sp.frames.length === 4,
    "4 frames chargees (obtenu " + (sp && sp.frames ? sp.frames.length : 0) + ")");
  // Boucle animImg : t=0 -> frame 0, t=0.1 -> frame 1, t=0.4 -> retour 0.
  if (sp && sp.frames && sp.frames.length === 4) {
    assert(G.animImg(sp, 0) === sp.frames[0], "animImg(0) = frame 0");
    assert(G.animImg(sp, 0.1) === sp.frames[1], "animImg(0.1) = frame 1");
    assert(G.animImg(sp, 0.3) === sp.frames[3], "animImg(0.3) = frame 3");
    assert(G.animImg(sp, 0.4) === sp.frames[0], "animImg(0.4) boucle sur frame 0");
  }
  // Masque UNIQUE : pas de frames sur le masque, une seule image.
  var msk = G.SPRITES.ville["est_mask"];
  assert(msk && (!msk.frames || !msk.frames.length), "masque statique (jamais anime)");

  // Rendu en bandes : villeBands suit la frame courante.
  G.state = { time: 0, zoom: 1, villes: [] };
  var v = { sprite: "est", x: 11210, y: 9900, w: 200, h: 200 };
  G.state.time = 0;
  var e0 = G.villeBands(v);
  assert(e0 && e0.bands && e0.bands.length > 0, "entree de bandes frame 0");
  G.state.time = 0.15;
  var e1 = G.villeBands(v);
  assert(e1 && e1.img === sp.frames[1], "villeBands suit la frame courante (frame 1)");
  G.state.time = 0;
  var e0b = G.villeBands(v);
  assert(e0b.img === sp.frames[0], "retour a t=0 -> frame 0");
  assert(e0b !== e1, "entrees de cache distinctes par frame");
  // Ville SANS frames : rendu statique sur le PNG de base (comportement inchange).
  G.SPRITES.ville.est.frames = null;
  G.state.time = 123.456;
  var eS = G.villeBands(v);
  assert(eS.img === sp.img, "ville sans frames : PNG de base statique");
  G.SPRITES.ville.est.frames = sp.frames;

  console.log("----------------------------------------");
  console.log("PASS: all  FAIL: " + fails);
  process.exit(fails ? 1 : 0);
});

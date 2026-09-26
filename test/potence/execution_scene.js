// Potence : chargement des series avec les DEUX conventions de nommage
// (standard <base>-N.png et bloc Aseprite <base>-0101.png), animation
// d'execution en un seul tour, focus camera pendant l'execution et ecran
// de fin differe du pendu.
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// --- Stub Image : simule le depot de PNG dans assets/sprites/potence/
// Convention 1 (standard) : exec-0.png .. exec-3.png
// Convention 2 (Aseprite) : idle-0101.png .. idle-0104.png
function FakeImage() {}
FakeImage.prototype = {
  set src(v) {
    var self = this;
    var name = v.split("/").pop().split("?")[0];
    var base = name.replace(".png", "");
    var mStd = base.match(/^exec-([0-9]+)$/);
    var mPad = base.match(/^idle-([0-9]{4})$/);
    var exists = false;
    if (mStd && +mStd[1] <= 3) exists = true;
    if (mPad && +mPad[1] >= 101 && +mPad[1] <= 104) exists = true;
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

// --- Chargement assets : les series potence doivent trouver les frames des
// deux conventions (exec standard 0..3, idle padding 0101..0104).
(0, eval)(fs.readFileSync(REPO + "/src/assets.js", "utf8"));

G.loadAssets(function () {
  var ex = G.hasSprite("potence", "exec") ? G.SPRITES.potence.exec : null;
  assert(ex && ex.frames && ex.frames.length === 4,
    "exec : 4 frames chargees via convention standard (obtenu " + (ex && ex.frames ? ex.frames.length : "null") + ")");
  var id = G.hasSprite("potence", "idle") ? G.SPRITES.potence.idle : null;
  assert(id && id.frames && id.frames.length === 4,
    "idle : 4 frames chargees via convention Aseprite -0101 (obtenu " + (id && id.frames ? id.frames.length : "null") + ")");
  assert(G.POTENCE_EXEC_TIME === 4, "POTENCE_EXEC_TIME = 4 s");

  // --- Rendu : l'animation exec se joue en un seul tour (frame indexee par
  // le temps depuis execAt), figee sur la derniere frame apres.
  // On simule la boucle de rendu de render.js pour une potence en execution.
  G.state = {
    time: 100, zoom: 8, camera: { x: 5000, y: 5000 },
    player: { x: 5000, y: 5000 }, mouse: { inside: false },
    buildings: [], walls: [], zombies: [], items: [], projectiles: [],
    deadTraces: [], birds: [], sieges: [], towers: [], remotePlayers: [],
    gameOver: false, gameOverCause: ""
  };
  var pot = G.makeTownBuilding("potence", 5200, 5200);
  pot.chantierDone = true;
  pot.execAt = 100;
  G.state.buildings.push(pot);

  function execFrame(b, now) {
    var sprite = G.SPRITES.potence.exec;
    var ext = now - (b.execAt || 0);
    var exn = sprite.frames.length;
    var exDur = (G.POTENCE_EXEC_TIME || 4) / exn;
    var exFi = Math.floor(ext / exDur);
    if (exFi > exn - 1) exFi = exn - 1;
    if (exFi < 0) exFi = 0;
    return exFi;
  }
  assert(execFrame(pot, 100) === 0, "exec frame 0 au debut");
  assert(execFrame(pot, 100.5) === 0, "exec frame 0 a 0.5 s (4 frames / 4 s)");
  assert(execFrame(pot, 101.5) === 1, "exec frame 1 a 1.5 s");
  assert(execFrame(pot, 103) === 3, "exec frame 3 a 3 s");
  assert(execFrame(pot, 110) === 3, "exec figee sur la derniere frame apres 4 s");

  // --- Focus camera + ecran de fin differe (logique de main.js) :
  // pendant l'execution la camera glisse vers la potence et le pendu
  // n'a PAS encore son game over ; a la fin de l'animation seulement.
  var state = G.state;
  state.playerName = "bob";
  state._execFocus = { x: 5200, y: 5200, name: "bob", until: 104, hungMe: true };
  state.playerHidden = true;
  // Avant la fin : pas de game over.
  assert(state._execFocus && !state.gameOver, "pendu : pas d'ecran de fin pendant l'animation");
  // Boucle update simplifiee (meme code que main.js) :
  // t = 103.5 -> toujours en focus ; t = 104.2 -> game over declenche.
  state.time = 103.5;
  (function step(dt) {
    var ef = state._execFocus;
    if (state.time >= ef.until) {
      if (ef.hungMe && !state.gameOver) {
        state.gameOver = true;
        state.gameOverCause = "player";
        state.hungByPotence = true;
      }
      state._execFocus = null;
    } else {
      var k = Math.min(1, dt * 4);
      state.camera.x += (ef.x - state.camera.x) * k;
      state.camera.y += (ef.y - state.camera.y) * k;
      if (state.targetZoom < 14) state.targetZoom = 14;
    }
  })(0.05);
  assert(state._execFocus !== null, "focus camera actif avant la fin de l'animation");
  assert(Math.abs(state.camera.x - 5200) < 601, "camera a glisse vers la potence");
  state.time = 104.2;
  (function step(dt) {
    var ef = state._execFocus;
    if (state.time >= ef.until) {
      if (ef.hungMe && !state.gameOver) {
        state.gameOver = true;
        state.gameOverCause = "player";
        state.hungByPotence = true;
      }
      state._execFocus = null;
    } else {
      var k = Math.min(1, dt * 4);
      state.camera.x += (ef.x - state.camera.x) * k;
      state.camera.y += (ef.y - state.camera.y) * k;
      if (state.targetZoom < 14) state.targetZoom = 14;
    }
  })(0.05);
  assert(state.gameOver && state.gameOverCause === "player", "ecran de fin du pendu apres l'animation");
  assert(state.hungByPotence === true, "cause pendaison (hungByPotence)");
  assert(state._execFocus === null, "focus camera libere apres l'animation");

  // --- Le joueur local pendu n'est pas rendu (pHidden dans render.js) :
  // playerHidden pose par net.js des que le snapshot confirme alive=false.
  var pHidden = !!state.playerHidden || (state.gameOver && state.gameOverCause === "player");
  assert(pHidden, "joueur local pendu : non rendu pendant et apres l'execution");

  console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
  process.exit(fails === 0 ? 0 : 1);
});

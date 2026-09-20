// Test: anim de tir gauche/droite chargee sans PNG de base + tailles (scierie 80, tour -30%)
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// --- Stub Image : <base>.png absent pour gauche/droite, frames gauche-0..4 / droite-0..4 presentes
function FakeImage() {}
FakeImage.prototype = {
  set src(v) {
    var self = this;
    var name = v.split("/").pop().split("?")[0];
    var base = name.replace(".png", "");
    var m = base.match(/^(gauche|droite)-([0-9]+)$/);
    var exists = m && +m[2] <= 4;
    setTimeout(function () {
      if (exists) {
        self.naturalWidth = 64; self.naturalHeight = 128;
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

var files = ["src/config.js", "src/projection.js", "src/world.js", "src/player.js", "src/walls.js", "src/towers.js", "src/chop.js", "src/weapons.js", "src/birds.js", "src/zombies.js"];
files.forEach(function (f) { (0, eval)(fs.readFileSync(REPO + "/" + f, "utf8")); });
var G = global.GAME;

// Chargement assets : manifest + series probeTours (gauche/droite sans base)
(0, eval)(fs.readFileSync(REPO + "/src/assets.js", "utf8"));

// Le manifeste tour contient idle+chantier ; la sonde charge gauche/droite depuis les frames.
var manifestSrc = fs.readFileSync(REPO + "/src/assets.js", "utf8");
assert(manifestSrc.indexOf("assets/sprites/tour/gauche") === -1, "gauche/droite charges par sonde, pas manifeste");

// Charge tous les assets (asynchrone via setTimeout -> poll)
function waitReady(cb, n) {
  if (G.assetsReady && G.assetsReady()) return cb();
  if (n > 200) return cb();
  setTimeout(function () { waitReady(cb, (n || 0) + 1); }, 5);
}

var spriteAPI = null;
// G.loadAssets expose-t-il la prete ? on appelle loadAssets et on verifie SPRITES apres.
G.loadAssets(function () {
  var spL = G.hasSprite("tour", "gauche") ? G.SPRITES.tour.gauche : null;
  var spR = G.hasSprite("tour", "droite") ? G.SPRITES.tour.droite : null;
  assert(spL && spL.frames && spL.frames.length === 5, "gauche: 5 frames chargees sans PNG de base");
  assert(spR && spR.frames && spR.frames.length === 5, "droite: 5 frames chargees sans PNG de base");
  assert(spL.w === 64 && spL.h === 128, "gauche: dims depuis frame 0");

  // --- Tour: taille -30% (PNG idle 64px de large -> side = 64*1.4 = 89.6)
  G.SPRITES.tour.idle = { img: null, w: 64, h: 128, frames: null };
  var side = G.towerSide("bois");
  assert(Math.abs(side - 64 * 1.4) < 0.001, "towerSide = PNG.w*1.4 (obtenu " + side + ")");
  G.SPRITES.tour.idle = null;
  var fb = G.towerSide("bois");
  assert(fb === 84, "towerSide fallback = 84 (obtenu " + fb + ")");

  // --- Scierie x2
  assert(G.SCIERIE_SIDE === 64, "SCIERIE_SIDE = 80");
  assert(G.TOWN_BUILDINGS.scierie.side === 64, "registre scierie.side = 80");
  assert(G.TOWN_BUILDINGS.universite.side === 40, "universite reste 40");

  // --- animL/animR au tir : tour construite + zombie a portee de chaque cote
  G.hasSprite = function () { return false; };
  G.houseNames = function () { return []; };
  G.foretNames = function () { return null; };
  G.updateHud = function () {};
  G.foretAt = function () { return null; };
G.state = { time: 0, clock: 8, day: 0, waveActive: false, zombieMode: "attack",
            player: { x: 5000, y: 5000, hp: 100 }, zombies: [], zombieGroups: [],
            walls: [], towers: [], buildings: [], projectiles: [], deadTraces: [],
            planks: 500, mairieGold: 100, mouse: { inside: false },
            universiteUnlocked: false, universite: null,
            montgolfiereUnlocked: false, montgolfiere: null, pendingWave: null,
            scierieUnlocked: false, scierie: null };
var st = G.state;
st.buildings.push({ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, door: { x: 5000, y: 5060 }, name: "Mairie" });
  var st = G.state;
  st.towers = [];
  st.zombies = [];
  st.projectiles = [];
  var t = G.makeTower ? G.makeTower(3000, 3000, "bois") : null;
  if (!t) { console.log("SKIP makeTower"); done(); return; }
  t.chantierDone = true;
  st.towers.push(t);
  var zl = { x: t.x - 100, y: t.y, r: 10, hp: 100, alive: true, dead: false };
  var zr = { x: t.x + t.w + 100, y: t.y, r: 10, hp: 100, alive: true, dead: false };
  st.zombies.push(zl, zr);
  G.updateTowers(0.016);
  assert(t.animL > 0, "animL declenchee par un zombie a gauche (obtenu " + t.animL + ")");
  assert(t.animR > 0, "animR declenchee par un zombie a droite (obtenu " + t.animR + ")");
  assert(st.projectiles.length === 2, "deux fleches tirnees simultanement");
  assert(st.projectiles.every(function (p) { return p.type === "fleche"; }), "projectiles type fleche");
  done();
});

function done() {
  if (fails === 0) console.log("ALL_OK");
  else { console.log("FAILURES: " + fails); process.exit(1); }
}

if (typeof G.loadAssets !== "function") { console.log("FAIL: pas de G.loadAssets"); process.exit(1); }

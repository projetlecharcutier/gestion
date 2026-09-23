// Verifie qu'aucun zombie n'est inactif : chaque zombie doit bouger (ou attaquer)
// sur une fenetre glissante de 1 s.
var fs = require("fs"), path = require("path");
global.window = global; global.devicePixelRatio = 1;
var G = {}; global.GAME = G;
global.canvas = G.canvas = { width: 800, height: 600, getContext: function () { return null; } };
G.SPRITES = {}; G.hasSprite = function () { return false; }; G.spriteBounds = function () { return null; };
G.houseNames = function () { return []; }; G.foretNames = function () { return ["foret1", "foret2"]; };
G.updateHud = function () {}; G.addFloater = function () {};
global.document = { getElementById: function () { return { width: 800, height: 600, getContext: function () { return null; }, addEventListener: function () {}, style: {}, hidden: true }; } };
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }
["config.js","state.js","projection.js","world.js","player.js","walls.js","towers.js","chop.js","weapons.js","birds.js","siege.js","zombies.js"].forEach(load);
var G = global.GAME;
G.buildWorld();
var s = G.state;
s.started = true;
// Spawn direct d'une vague (evite d'attendre minuit).
G.spawnWave();
s.waveActive = true;
s.zombieMode = "attack";
console.log("zombies:", s.zombies.length, "groupes:", s.zombieGroups.length);
// Simule 120 s de jeu ; fenetre glissante : chaque zombie doit avoir bouge
// (dx+dy > 0.5 px) ou attaque (wallCd/lunge) au moins une fois par seconde.
var last = {}; // id -> {x, y, t, moved}
var inactiveTicks = 0, totalChecks = 0;
var dt = 0.05;
var zid = 0;
s.zombies.forEach(function (z) { z._id = zid++; last[z._id] = { x: z.x, y: z.y, t: 0, ok: true }; });
for (var t = 0; t < 120; t += dt) {
  G.updateZombies(dt);
  s.time += dt;
  for (var i = 0; i < s.zombies.length; i++) {
    var z = s.zombies[i];
    var L = last[z._id]; if (!L) { L = last[z._id] = { x: z.x, y: z.y, t: s.time, ok: true }; continue; }
    var moved = Math.abs(z.x - L.x) + Math.abs(z.y - L.y);
    totalChecks++;
    if (moved > 0.5 || z.lunge > 0) {
      L.x = z.x; L.y = z.y; L.t = s.time; L.ok = true;
    } else if (s.time - L.t > 1.0) {
      L.ok = false; L.t = s.time;
      inactiveTicks++;
      if (inactiveTicks <= 3) console.log("INACTIF a t=" + s.time.toFixed(1) + "s zombie #" + z._id + " @(" + z.x.toFixed(0) + "," + z.y.toFixed(0) + ")");
    }
  }
}
var pct = (100 * inactiveTicks / Math.max(1, totalChecks)).toFixed(2);
console.log("verifications:", totalChecks, "| fenetres inactives:", inactiveTicks, "(" + pct + "%)");
console.log(pct < 1 ? "TEST PASSE (<1% d'inactivite)" : "TEST ECHEC");
process.exit(pct < 1 ? 0 : 1);

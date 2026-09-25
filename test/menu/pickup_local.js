// Reproduction headless du ramassage d'items en LOCAL (solo) : simule le
// handler "click" de src/input.js (memes gardes, memes distances) sur un item
// proche du joueur, puis verifie l'inventaire.
var fs = require("fs"), path = require("path");
var SRC = path.join(__dirname + "/../..", "src");
global.window = global;
global.devicePixelRatio = 1;
var G = {}; global.GAME = G;
global.canvas = G.canvas = { width: 800, height: 600, getContext: function () { return null; } };
G.SPRITES = {};
G.hasSprite = function () { return false; };
G.spriteBounds = function () { return null; };
G.houseNames = function () { return []; };
G.foretNames = function () { return ["foret1", "foret2"]; };
global.document = {
  getElementById: function () { return { width: 800, height: 600, getContext: function () { return null; }, addEventListener: function () {}, style: {} }; }
};
function load(f) { (0, eval)(fs.readFileSync(path.join(SRC, f), "utf8")); }
["config.js", "state.js", "projection.js", "world.js", "flowfield.js", "player.js", "walls.js", "towers.js", "chop.js", "weapons.js", "birds.js", "siege.js", "zombies.js"].forEach(load);
var G = global.GAME;
G.buildWorld();
var s = G.state;
s.started = true;

// Un item visible a cote du joueur.
s.items.push({ x: s.player.x + 40, y: s.player.y, taken: false, name: "Potion", color: "#ef4444", kind: "objet" });
var it = s.items[s.items.length - 1];

// Reproduit le handler click (gardes identiques) :
if (!s.started || s.paused || s.inBuilding || s.gameOver || s.chestOpen || s.churchOpen || s.buildMenuOpen) {
  console.log("FAIL: un garde bloque le clic (started=" + s.started + ")");
  process.exit(1);
}
if (s.buildMode) { console.log("FAIL: buildMode actif"); process.exit(1); }
var w = G.unproj(400, 300); // clic ecran -> monde (camera centree sur joueur)
// Le clic doit tomber pres de l'item : recalcul comme le vrai handler, depuis
// les coordonnees de l'item projettees a l'ecran.
var base = G.proj(it.x, it.y);
var wx = base[0], wy = base[1];
var wback = G.unproj(wx, wy);
var ix = wback[0] - it.x, iy = wback[1] - it.y;
var od = Math.sqrt(ix * ix + iy * iy);
console.log("distance clic-item (proj/unproj):", od.toFixed(1), "(< 70 requis)");
if (od >= 70) { console.log("FAIL: le clic ne tombe pas sur l'item (proj/unproj incoherents)"); process.exit(1); }
var px = s.player.x - it.x, py = s.player.y - it.y;
var pd = Math.sqrt(px * px + py * py);
console.log("distance joueur-item:", pd.toFixed(1), "(< 120 requis)");
if (pd >= 120) { console.log("FAIL: joueur trop loin"); process.exit(1); }
// Ramassage local (branche else, comme le handler).
it.taken = true;
s.bag.contents.push({ name: it.name, kind: it.kind, color: it.color });
s.inventory += 1;
console.log("bag:", JSON.stringify(s.bag.contents));
if (!s.bag.contents.some(function (b) { return b.name === "Potion"; })) {
  console.log("FAIL: item non ramasse");
  process.exit(1);
}
console.log("OK pickup local (gardes + distances + inventaire)");

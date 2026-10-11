// Regression race condition : le join serveur appelle villeSetup AVANT la fin
// de loadAssets -> les grilles de collision des villes (construites depuis les
// masques) manquaient POUR TOUJOURS (buildVilleGrids ne reessayait jamais) ->
// villeCellInfo retournait null -> l'occlusion mode 1/2 ne s'appliquait jamais
// -> le joueur restait visible par-dessus le PNG de TOUTES les villes.
// villeCellInfo doit re-tenter la construction paresseusement (buildVilleGrids
// est idempotent : seules les grilles MANQUANTES sont construites).
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// 1) Code : le re-essay paresseux est present dans villeCellInfo.
var code = fs.readFileSync(path.join(REPO, "src", "ville.js"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
assert(code.indexOf("if (missing) G.buildVilleGrids();") !== -1,
  "villeCellInfo re-tente la construction des grilles manquantes");
assert(code.indexOf("if (G.villeGrids[v.sprite]) continue;") !== -1,
  "buildVilleGrids idempotent : ne reconstruit pas les grilles presentes");

// 2) Comportement serveur : les grilles RLE chargees de ville-grids.json ne
//    sont JAMAIS ecrasees par le re-essay (villeExtractGrid retourne null
//    sans document -> setVilleGrid jamais appele).
var game = require(path.join(REPO, "server", "game.js"));
var G = game.G;
game.startGame();
var st = G.state;
var before = {};
Object.keys(G.villeGrids).forEach(function (k) { before[k] = G.villeGrids[k]; });
// Simule le cas race : supprime une grille, apelle villeCellInfo, elle doit
// revenir... cote serveur elle ne PEUT pas revenir (pas de canvas) -- mais ne
// doit PAS ecraser les autres.
var motteAvant = G.villeGrids.motte;
delete G.villeGrids.motte;
var info = G.villeCellInfo(st.villes[0].x + 5, st.villes[0].y + 5);
assert(G.villeGrids.est === before.est, "grille est intacte apres re-essay");
assert(G.villeGrids.minas === before.minas, "grille minas intacte apres re-essay");
// restaure
G.villeGrids.motte = motteAvant;

// 3) Comportement client : grille manquante reconstruite des que le masque
//    est charge. Simulation canvas (vrai pixel data du masque motte).
var zlib = require("zlib");
function decodePng(file) {
  var buf = fs.readFileSync(file);
  var w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  var off = 8, idat = [];
  while (off + 8 <= buf.length) {
    var len = buf.readUInt32BE(off);
    var type = buf.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  var raw = zlib.inflateSync(Buffer.concat(idat));
  var bpp = 4, stride = w * bpp;
  var out = new Uint8Array(w * h * bpp);
  var prev = new Uint8Array(stride);
  var pos = 0;
  for (var y = 0; y < h; y++) {
    var filter = raw[pos++];
    var line = raw.subarray(pos, pos + stride); pos += stride;
    var cur = new Uint8Array(stride);
    for (var x = 0; x < stride; x++) {
      var a = x >= bpp ? cur[x - bpp] : 0;
      var b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      var v = line[x];
      if (filter === 0) cur[x] = v;
      else if (filter === 1) cur[x] = (v + a) & 255;
      else if (filter === 2) cur[x] = (v + b) & 255;
      else if (filter === 3) cur[x] = (v + ((a + b) >> 1)) & 255;
      else { var p = a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c); cur[x] = (v + (pa<=pb&&pa<=pc?a:(pb<=pc?b:c))) & 255; }
      out[y*stride+x] = cur[x];
    }
    prev = cur;
  }
  return { w: w, h: h, data: out };
}
var maskData = decodePng(path.join(REPO, "assets/sprites/ville/motte/ville_mask.png"));

// Client isole : modules charges sans serveur (grilles non posees).
global.window = global;
delete require.cache[path.join(REPO, "server", "game.js")];
// nettoie le module game pour recharger vierge
var G2home = {};
function loadFresh(f) {
  var src = fs.readFileSync(path.join(REPO, "src", f), "utf8");
  (0, eval)(src);
}
try { (0, eval)(fs.readFileSync(path.join(REPO, "assets/sprites/ville/villes.js"), "utf8")); } catch (e) {}
global.document = {
  createElement: function () {
    return {
      width: 0, height: 0, style: {},
      getContext: function () {
        return {
          _cur: null,
          drawImage: function (img) { if (img._maskData) this._cur = img._maskData; },
          getImageData: function () { return { data: this._cur ? this._cur.data : new Uint8Array(4) }; }
        };
      }
    };
  }
};
global.Image = function () {};
global.Image.prototype = {
  set src(v) {
    var self = this;
    var rel = v.split("assets/")[1];
    var p = path.join(REPO, "assets", rel.split("?")[0]);
    setTimeout(function () {
      if (fs.existsSync(p)) {
        var d = fs.readFileSync(p);
        self.naturalWidth = d.readUInt32BE(16);
        self.naturalHeight = d.readUInt32BE(20);
        if (p.indexOf("motte/ville_mask") >= 0) self._maskData = maskData;
        if (self.onload) self.onload();
      } else { if (self.onerror) self.onerror(); }
    }, 0);
  }
};
global.navigator = { userAgent: "test" };
global.XMLHttpRequest = function () { this.readyState = 4; this.status = 404; this.onreadystatechange = null; };
global.XMLHttpRequest.prototype.open = function () {};
global.XMLHttpRequest.prototype.send = function () { var s = this; setTimeout(function () { if (s.onreadystatechange) s.onreadystatechange(); }, 0); };
["config.js", "projection.js", "player.js", "walls.js", "world.js", "ville.js"].forEach(loadFresh);
var G2 = global.GAME;
G2.state = { time: 0, zoom: 1, villes: [], buildings: [], walls: [], items: [], zombies: [], zombieGroups: [], players: [], projectiles: [], deadTraces: [], towers: [], birds: [], fauna: [], soldats: [], sieges: [] };

// Ville posee SANS que les grilles soient construites (le cas race) :
// motte aux positions du manifeste.
var defs = G2.VILLE_DEFS.filter(function (d) { return d.sprite === "motte"; });
assert(defs.length === 1, "def motte presente (manifeste fusionne)");
if (defs.length) {
  var d = defs[0];
  var sp = { w: 301, h: 240 };
  var side = G2.villeSideFor(sp.w, d);
  var v = G2.villeNorm({ name: d.name, sprite: d.sprite, x: d.x, y: d.y, w: side, h: side });
  // bbox visuelle (necessaire a villeBoxHits mais pas a villeCellInfo)
  v.vx0 = v.x - side; v.vx1 = v.x + 2 * side; v.vy0 = v.y - side; v.vy1 = v.y + side;
  G2.state.villes = [v];
  assert(!G2.villeGrids || !G2.villeGrids.motte, "grille motte absente au depart (cas race)");
  // charge le masque maintenant (il arrive APRiES le villeSetup)
  loadFresh("assets.js");
  G2.loadAssets(function () {
    // premier appel a villeCellInfo APRES le chargement : la grille doit
    // etre reconstruite paresseusement et l'occlusion fonctionner.
    var g = null, info = null;
    // trouve une cellule verte via la grille reconstruite
    var tries = 0;
    // force le re-essay
    info = G2.villeCellInfo(v.x + side / 2, v.y + side / 2);
    g = G2.villeGrids.motte;
    assert(g, "grille motte RECONSTRUITE paresseusement (fix race condition)");
    if (g) {
      // trouve une cellule verte et verifie le mode
      var vert = null;
      for (var gy = 0; gy < g.rows && !vert; gy += 3) {
        for (var gx = 0; gx < g.cols && !vert; gx += 3) {
          if (g.data[gy * g.cols + gx] === 2) vert = { x: g.ox + gx + 0.5, y: g.oy + gy + 0.5 };
        }
      }
      assert(vert, "cellule verte trouvee dans la grille reconstruite");
      if (vert) {
        var vi2 = G2.villeCellInfo(vert.x, vert.y);
        assert(vi2 && vi2.mode === 1,
          "villeCellInfo -> mode 1 (derriere) sur la cellule verte, occlusion ACTIVE pour toutes les villes");
      }
    }
    console.log("----------------------------------------");
    console.log("PASS: all  FAIL: " + fails);
    process.exit(fails ? 1 : 0);
  });
} else {
  console.log("----------------------------------------");
  console.log("PASS: all  FAIL: " + fails);
  process.exit(fails ? 1 : 0);
}

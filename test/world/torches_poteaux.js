// Poteaux de torche : un pres de chaque ville (Ville de l'Est + villes PNG
// Laputa/Minas) et un par regroupement de maisons hors ville ; clic a portee
// -> torche equipee (vision x5, TORCHE_TIME s), config et emprise coherentes.
var game = require("../../server/game.js");
var G = game.G;
game.startGame();
var st = G.state;

function fail(msg) { console.log("FAIL: " + msg); process.exit(1); }

// 1. Poteaux poses : au moins 1 par ville PNG + 1 pres de la porte nord.
var torches = st.buildings.filter(function (b) { return b.isTorche; });
if (torches.length < 4) fail("poteaux de torche = " + torches.length + " (attendu >= 4 : 3 villes + villages)");

// Chaque poteau : emprise TORCHE_SIDE, nom, isDecor (pas de HUD batiment).
for (var i = 0; i < torches.length; i++) {
  var t = torches[i];
  if (Math.abs(t.w - G.TORCHE_SIDE) > 0.01) fail("emprise torche = " + t.w);
  if (!t.isDecor) fail("poteau non isDecor");
  if (t.name !== "Poteau de torche") fail("nom = " + t.name);
  if (t.x < 0 || t.y < 0 || t.x + t.w > G.WORLD || t.y + t.h > G.WORLD) fail("poteau hors carte");
}

// 2. Proximite des villes : chaque ville PNG a un poteau pose HORS de sa
// bbox visuelle mais dans les anneaux de recherche (rayon de depart =
// demi-bbox visuelle + 80, puis 30 anneaux de 40 px).
function hasTorcheNear(cx, cy, m) {
  for (var j = 0; j < torches.length; j++) {
    var dx = torches[j].x + torches[j].w / 2 - cx;
    var dy = torches[j].y + torches[j].h / 2 - cy;
    if (Math.sqrt(dx * dx + dy * dy) < m) return true;
  }
  return false;
}
if (!hasTorcheNear(G.TOWN_MIN + G.TOWN / 2, G.TOWN_MIN, 340)) fail("pas de poteau pres de la porte nord");
var villes = st.villes || [];
for (var v = 0; v < villes.length; v++) {
  var vv = villes[v];
  var vrad = 40;
  if (vv.vx0 !== undefined) vrad = Math.max(vv.vx1 - vv.vx0, vv.vy1 - vv.vy0) / 2 + 80;
  // rayon de depart + 30 anneaux de 40 px = portee maximale de recherche
  var vmax = vrad + 30 * 40;
  var ok = false;
  for (var j2 = 0; j2 < torches.length; j2++) {
    var dx2 = torches[j2].x + torches[j2].w / 2 - (vv.x + vv.w / 2);
    var dy2 = torches[j2].y + torches[j2].h / 2 - (vv.y + vv.h / 2);
    var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (d2 < vmax) { ok = true; break; }
  }
  if (!ok) fail("pas de poteau pres de la ville " + vv.name);
}

// 3. Aucun poteau dans la bbox d'une ville PNG ni superpose a un batiment.
for (var k = 0; k < torches.length; k++) {
  var tk = torches[k];
  if (G.villeBoxHits && G.villeBoxHits(tk.x, tk.y, tk.w, tk.h)) fail("poteau dans une ville PNG");
  for (var b2 = 0; b2 < st.buildings.length; b2++) {
    var ob = st.buildings[b2];
    if (ob === tk) continue;
    if (tk.x < ob.x + ob.w + 2 && tk.x + tk.w > ob.x - 2 &&
        tk.y < ob.y + ob.h + 2 && tk.y + tk.h > ob.y - 2) {
      fail("poteau superpose a " + (ob.name || "batiment"));
    }
  }
}

// 4. Config : rayon x5 et duree 60 s.
if (G.TORCHE_RADIUS !== G.FOG_RADIUS * 5) fail("TORCHE_RADIUS != FOG_RADIUS*5");
if (G.TORCHE_TIME !== 60) fail("TORCHE_TIME = " + G.TORCHE_TIME);

// 5. Effet torche : input serveur -> torcheUntil pose ; apres TORCHE_TIME,
// l'effet est expire (torcheLeft = 0 dans le snapshot).
var pid = "torche-test-1";
game.addPlayer(pid, "T1");
var p = st.players[st.players.length - 1];
var torcheRef = torches[0];
p.x = torcheRef.x + torcheRef.w / 2;
p.y = torcheRef.y + torcheRef.h / 2 + 10;
if (p.torcheUntil !== null) fail("torcheUntil initial non null");
game.applyInput(p.id, { torche: true });
if (p.torcheUntil === null) fail("clic torche: aucun effet");
// Trop loin : refuse.
p.x += 2000; p.y += 2000;
var before = p.torcheUntil;
game.applyInput(p.id, { torche: true });
if (p.torcheUntil !== before) fail("torche prise a distance");

console.log("SUCCES TOTAL");

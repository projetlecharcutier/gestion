// Test de non-regression : le masque VERT de la ville "nogent" (et des
// autres villes auto) genere bien des cellules "2" (joueur passe derriere)
// dans la grille commitee server/ville-grids.json. Ca echouait quand nogent
// n'avait ni grille ni entree sprite-meta (fichiers generes jamais
// re-committes apres l'ajout de la ville) : le serveur detectait la ville
// (scan disque) mais ne pouvait pas la poser (pas de dimensions dans
// sprite-meta.json -> dom-stub ignore -> villeSetup la saute).
// Verifie aussi que sprite-meta.json declare ville.png + ville_mask.png et
// que villes.js declare nogent (manifeste client).
var fs = require("fs");var path = require("path");var REPO = path.join(__dirname, "..", "..");var fails = 0;function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }// 1. sprite-meta.json declare nogent (ville + masque + frames animees)
var meta = require(path.join(REPO, "server", "sprite-meta.json"));
assert(!!meta["ville/nogent/ville"], "sprite-meta.json declare ville/nogent/ville");
assert(!!meta["ville/nogent/ville_mask"], "sprite-meta.json declare ville/nogent/ville_mask");
var mv = meta["ville/nogent/ville"], mm = meta["ville/nogent/ville_mask"];
assert(mv && mv.w === 515 && mv.h === 483, "nogent ville.png = 515x483 (obtenu " + (mv && mv.w + "x" + mv.h) + ")");
assert(mm && mm.w === mv.w && mm.h === mv.h, "nogent ville_mask.png meme taille que ville.png");
// 2. ville-grids.json contient une grille nogent AVEC des cellules vertes (2)
var grids = require(path.join(REPO, "server", "ville-grids.json"));
var rg = grids.nogent;
assert(!!rg, "ville-grids.json contient la grille nogent");
if (rg) {
  var vals = {};
  for (var i = 0; i + 1 < rg.rle.length; i += 2) vals[rg.rle[i]] = (vals[rg.rle[i]] || 0) + rg.rle[i + 1];
  assert(vals[1] > 0, "grille nogent : cellules rouges (collision) presentes (" + (vals[1] || 0) + ")");
  assert(vals[2] > 0, "grille nogent : cellules VERTES (joueur derriere) presentes (" + (vals[2] || 0) + ") -- le masque vert fonctionne");
  assert(rg.ver === 8, "grille nogent : version courante (ver=8, obtenu " + rg.ver + ")");
}
// 3. Le manifeste client déclare nogent
var villesJs = fs.readFileSync(path.join(REPO, "assets", "sprites", "ville", "villes.js"), "utf8");
assert(villesJs.indexOf('"sprite":"nogent"') >= 0, "villes.js déclare nogent");
// 4. Position persistée (placement auto stable entre redemarrages)
var positions = require(path.join(REPO, "server", "ville-positions.json"));
assert(!!positions.nogent && positions.nogent.x != null, "ville-positions.json persiste la position de nogent");
// 5. Toutes les villes auto du manifeste ont une grille avec du vert ou du rouge
//    (pas de grille null = ville visible sans collision, ou absente = invisible)
var vmMatch = villesJs.match(/VILLE_MANIFEST\s*=\s*(\[[\s\S]*?\]);/);
var manifest = vmMatch ? JSON.parse(vmMatch[1].replace(/,(\s*[\]}])/g, "$1")) : [];
assert(manifest.length > 0, "manifeste client non vide (" + manifest.length + " villes)");
var defSprites = ["est", "laputa", "minas", "camp_romain"]; // VILLE_DEFS manuelles
manifest.forEach(function (m) {
  var g = grids[m.sprite];
  assert(!!g, "grille presente pour " + m.sprite + " (manifeste)");
  if (g) {
    var v2 = {};
    for (var j = 0; j + 1 < g.rle.length; j += 2) v2[g.rle[j]] = (v2[g.rle[j]] || 0) + g.rle[j + 1];
    assert((v2[1] || 0) + (v2[2] || 0) > 0, "grille " + m.sprite + " : masque peint (rouge ou vert) -- pas une ville fantome");
  }
});
console.log(fails === 0 ? "OK masque_vert_nogent" : "MASQUE_VERT_NOGENT ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);

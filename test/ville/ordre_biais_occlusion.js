// Test: villes PNG - occlusion du joueur par la ville, mecanisme v3.
// Historique : v1 = biais +/-1e6 sur toutes les bandes (ville entiere qui
// saute), v2 = departage des bandes chevauchant le corps, v3 = tri naturel
// UNIQUEMENT. Une bande de 1 px image couvre ~8 px monde (la taille du
// joueur) : le tri par profondeur x+y est exact a cette resolution, tout
// mecanisme dedie ne fait que degrader le resultat (approximations, sauts
// visuels quand les pieds changent de cellule).
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

var rsrc = fs.readFileSync(path.join(REPO, "src", "render.js"), "utf8");
var vsrc = fs.readFileSync(path.join(REPO, "src", "ville.js"), "utf8");
var codeNoComments = rsrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// 1) Tri naturel uniquement : ni biais, ni departage dedie dans le code
assert(codeNoComments.indexOf("1e6") === -1, "plus de biais +/-1e6 sur toute la ville");
assert(codeNoComments.indexOf("villePlayerMode") === -1, "plus de departage dedie par corps");

// 2) Bandes a la resolution du masque : VILLE_BAND_H = 1 px image
//    (100 bandes pour un PNG de 100 px ; ~8 px monde par bande)
var m2 = vsrc.match(/G\.VILLE_BAND_H\s*=\s*(\d+)/);
assert(!!m2, "VILLE_BAND_H defini");
if (m2) {
  var bh = parseInt(m2[1], 10);
  assert(bh === 1, "VILLE_BAND_H = 1 px image (obtenu " + bh + ")");
}

// 3) Le joueur est ancre sur sa zone OPAQUE (spriteBoundsOf) : les pieds ne
//    flottent plus au-dessus de la marge transparente du PNG
assert(rsrc.indexOf("G.spriteBoundsOf(sprite)") !== -1,
  "ancrage du sprite joueur via spriteBoundsOf (bas opaque sur le sol)");

// 4) Alignement grille/rendu : les formules d'ancrage du PNG doivent etre
//    strictement identiques des deux cotes (cf. regression du bug hoisting).
assert(vsrc.indexOf("(x - y) / 2") !== -1 && vsrc.indexOf("(x + y + 2 * side) / 4") !== -1,
  "villeGridFromPixels utilise le meme repere que le rendu (cx/groundY)");

console.log(fails ? "FAIL ville/ordre_biais (" + fails + ")" : "PASS ville/ordre_biais");
process.exit(fails ? 1 : 0);

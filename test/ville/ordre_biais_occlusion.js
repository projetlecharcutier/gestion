// Test: villes PNG - occlusion du joueur par la ville, mecanisme v2.
// L'ancien mecanisme appliquait un biais +/-1e6 a TOUTES les bandes de la
// ville selon la cellule du masque sous les pieds : la ville entiere sautait
// d'un bloc devant/derriere le joueur (bas du personnage ave par des bandes
// de 96 px, rendu different a l'arret vs en deplacement). Le nouveau
// mecanisme : bandes fines (VILLE_BAND_H) + departage UNIQUEMENT des bandes
// qui chevauchent le corps du joueur a l'ecran, selon la position de ses
// pieds ; les autres bandes gardent le tri naturel.
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

var rsrc = fs.readFileSync(path.join(REPO, "src", "render.js"), "utf8");
var vsrc = fs.readFileSync(path.join(REPO, "src", "ville.js"), "utf8");

// 1) Plus de biais global : le +/-1e6 doit avoir disparu (hors commentaires)
var codeNoComments = rsrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
assert(codeNoComments.indexOf("1e6") === -1, "plus de biais +/-1e6 sur toute la ville");

// 2) Le departage ne s'applique qu'aux bandes qui chevauchent le CORPS du
//    joueur a l'ecran (test de chevauchement present avant la reaffectation)
var overlapIdx = rsrc.indexOf("pTopY < vBandY1 && pBase[1] > vBandY0");
assert(overlapIdx !== -1, "test de chevauchement bande/corps present");
var reassignIdx = rsrc.indexOf("villePlayerMode === 1");
assert(reassignIdx !== -1 && overlapIdx < reassignIdx,
  "le departage selon la position des pieds se fait APRES le test de chevauchement");

// 3) villeCellInfo echantillonne toujours le joueur local
assert(rsrc.indexOf("G.villeCellInfo(state.player.x, state.player.y)") !== -1,
  "villeCellInfo appelee sur la position du joueur local");

// 4) Bandes fines : VILLE_BAND_H <= 8 px image (le PNG de ville fait 100 px
//    -> au moins 12 bandes ; l'ancienne valeur 96 n'en faisait que 2)
var m2 = vsrc.match(/G\.VILLE_BAND_H\s*=\s*(\d+)/);
assert(!!m2, "VILLE_BAND_H defini");
if (m2) {
  var bh = parseInt(m2[1], 10);
  assert(bh >= 1 && bh <= 8, "VILLE_BAND_H fin (<= 8 px image, obtenu " + bh + ")");
}

// 5) Le joueur est ancre sur sa zone OPAQUE (spriteBoundsOf) : les pieds ne
//    flottent plus au-dessus de la marge transparente du PNG
assert(rsrc.indexOf("G.spriteBoundsOf(sprite)") !== -1,
  "ancrage du sprite joueur via spriteBoundsOf (bas opaque sur le sol)");

console.log(fails ? "FAIL ville/ordre_biais (" + fails + ")" : "PASS ville/ordre_biais");
process.exit(fails ? 1 : 0);

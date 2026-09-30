// Test: villes PNG - occlusion du joueur par la ville, mecanisme v5.
// Historique : v1 = biais +/-1e6 sur toutes les bandes (ville entiere qui
// saute), v2 = departage des bandes chevauchant le corps, v3 = tri naturel
// uniquement (trop grossier : le joueur marchait sur le PNG en zone verte
// et traversait les facades hautes, dont le masque se projette AU-DESSUS de
// l'emprise au sol). v4 = departage par corps avec mode GLOBAL (pieds).
// v5 = departage PAR BANDE : chaque bande qui chevauche le corps
// echantillonne le masque (villeCellAtScreen) a la hauteur de SA bande
// sur l axe ecran du joueur -> seule la partie VERTE du PNG passe devant
// lui, la partie transparente reste derriere (le joueur ne disparait
// plus entierement sous le PNG quand ses pieds touchent une zone verte).
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

var rsrc = fs.readFileSync(path.join(REPO, "src", "render.js"), "utf8");
var vsrc = fs.readFileSync(path.join(REPO, "src", "ville.js"), "utf8");
var codeNoComments = rsrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
var codeNoCommentsV = vsrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// 1) Pas de biais global +/-1e6 (toute la ville ne saute plus d'un bloc),
//    mais un departage dedie par corps est bien present
assert(codeNoComments.indexOf("1e6") === -1, "pas de biais +/-1e6 sur toute la ville");
assert(codeNoComments.indexOf("villeCellAtScreen") !== -1, "departage PAR BANDE : villeCellAtScreen echantillonne par bande");

// 2) Bandes a la resolution du masque : VILLE_BAND_H = 1 px image
//    (100 bandes pour un PNG de 100 px ; ~8 px monde par bande)
var m2 = vsrc.match(/G\.VILLE_BAND_H\s*=\s*(\d+)/);
assert(!!m2, "VILLE_BAND_H defini");
if (m2) {
  var bh = parseInt(m2[1], 10);
  assert(bh === 1, "VILLE_BAND_H = 1 px image (obtenu " + bh + ")");
}

// 3) Le mode du joueur est echantillonne via villeCellInfo (grille + ville)
assert(codeNoComments.indexOf("G.villeCellInfo(state.player.x, state.player.y)") !== -1,
  "ville du joueur identifiee via villeCellInfo(x, y)");

// 4) Le departage ne s'applique qu'aux bandes chevauchant le corps a
//    l'ecran, puis SAMPLING du masque PAR BANDE (villeCellAtScreen) a la
//    hauteur de la bande sur l'axe ecran du joueur
var iOverlap = codeNoComments.indexOf("vTopY < vBandY1 && vBase[1] > vBandY0");
var iSample = codeNoComments.indexOf("G.villeCellAtScreen(vv, vAxisX,");
assert(iOverlap !== -1, "test de chevauchement corps/bande present");
assert(iSample !== -1, "sampling du masque PAR BANDE present");
if (iOverlap !== -1 && iSample !== -1) {
  assert(iOverlap < iSample, "le chevauchement precede le sampling par bande");
}

// 5) Profondeur par bande : cellule VERTE (1) ou ROUGE (2... cell 1=solide,
//    2=derriere) -> bande DEVANT le joueur ; cellule TRANSPARENTE (0) ->
//    bande DERRIERE -> la partie transparente du PNG ne recouvre jamais le
//    joueur, seule la partie peinte passe au-dessus.
assert(codeNoComments.indexOf("vCellBand === 1 || vCellBand === 2") !== -1 &&
       codeNoComments.indexOf("state.player.x + state.player.y + 1") !== -1,
  "bande verte/rouge : devant le joueur (profondeur joueur + 1)");
assert(codeNoComments.indexOf("vCellBand === 0") !== -1 &&
       codeNoComments.indexOf("state.player.x + state.player.y - 1") !== -1,
  "bande transparente : derriere le joueur (profondeur joueur - 1)");

// 6) Le mode ne depend plus du sol (emprise) : villeCellInfo s'applique
//    partout, y compris les cellules d'elevation (nord de l'emprise)
assert(codeNoCommentsV.indexOf("if (cell === 2) mode = 1") !== -1 &&
       codeNoCommentsV.indexOf("else if (cell === 0) mode = 2") !== -1,
  "villeCellInfo : mode applique sans restriction d'emprise");

// 7) Le joueur est ancre sur sa zone OPAQUE (spriteBoundsOf) : les pieds ne
//    flottent plus au-dessus de la marge transparente du PNG
assert(rsrc.indexOf("G.spriteBoundsOf(sprite)") !== -1,
  "ancrage du sprite joueur via spriteBoundsOf (bas opaque sur le sol)");

// 8) Alignement grille/rendu : les formules d'ancrage du PNG doivent etre
//    strictement identiques des deux cotes (cf. regression du bug hoisting).
assert(vsrc.indexOf("(x - y) / 2") !== -1 && vsrc.indexOf("(x + y + 2 * side) / 4") !== -1,
  "villeGridFromPixels utilise le meme repere que le rendu (cx/groundY)");

console.log(fails ? "FAIL ville/ordre_biais (" + fails + ")" : "PASS ville/ordre_biais");
process.exit(fails ? 1 : 0);

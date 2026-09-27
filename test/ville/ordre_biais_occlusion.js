// Test: villes PNG - le biais d'occlusion doit etre calcule AVANT la boucle
// des bandes qui l'utilise. Regresse le bug de hoisting : le calcul etait
// place APRES la boucle -> var hisse -> villeSprite undefined au moment de
// l'usage -> le biais ne s'appliquait jamais (le joueur passait sous les
// zones transparentes au lieu de passer devant).
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

var src = fs.readFileSync(path.join(REPO, "src", "render.js"), "utf8");

// 1) Une seule declaration du biais (pas de bloc duplique apres la boucle)
var declN = (src.match(/var villeBias = villeMode/g) || []).length;
assert(declN === 1, "une seule declaration de villeBias (obtenu " + declN + ")");

// 2) La declaration precede l'usage dans la boucle des bandes
var declIdx = src.indexOf("var villeBias = villeMode");
var useIdx = src.indexOf("? villeBias : 0");
assert(declIdx !== -1 && useIdx !== -1, "declaration et usage presentes");
assert(declIdx < useIdx, "villeBias calcule AVANT son usage (hoisting)");

// 3) La declaration de villeSprite precede aussi son usage
var declSprite = src.indexOf("var villeSprite = villeMode");
var useSprite = src.indexOf("villeSprite === vv.sprite");
assert(declSprite !== -1 && useSprite !== -1 && declSprite < useSprite,
  "villeSprite calcule AVANT la comparaison avec le sprite de la bande");

// 4) villeCellInfo echantillonne bien le joueur local
assert(src.indexOf("G.villeCellInfo(state.player.x, state.player.y)") !== -1,
  "villeCellInfo appelee sur la position du joueur local");

console.log(fails ? "FAIL ville/ordre_biais (" + fails + ")" : "PASS ville/ordre_biais");
process.exit(fails ? 1 : 0);

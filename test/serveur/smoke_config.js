// Smoke test serveur : chargement du module, constantes de config tour/scierie.
var game = require("../../server/game.js");
var G = game.G;
if (!G) { console.log("NO_G"); process.exit(1); }
console.log("MODULES_OK");
console.log("SCIERIE_SIDE=" + (G.TOWN_BUILDINGS.scierie ? G.TOWN_BUILDINGS.scierie.side : "ABSENT"));
console.log("TOWER_STATS.chantierFps=" + (G.TOWER_STATS.bois && G.TOWER_STATS.bois.chantierFps !== undefined ? "ENCORE_PRESENT" : "absent(ok)"));
process.exit(0);

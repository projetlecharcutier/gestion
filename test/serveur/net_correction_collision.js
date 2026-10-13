// Test: net — la correction de position serveur (netCorrectPos) ne traverse
// jamais un obstacle statique (bâtiment). Reproduit le bug rapporté : sous
// latence, la position serveur diverge de la prédiction autour d'un coin de
// bâtiment ; le lerp brut tirait le joueur PAR-DESSUS l'obstacle puis la
// prédiction locale le re-bloquait au frame suivant -> "passe au-dessus puis
// roll back". Contract :
//   1. la correction est bloquée par un bâtiment entre client et serveur,
//   2. la correction glisse le long de l'obstacle (axe libre autorisé),
//   3. téléport (écart > NET_SNAP_FULL_PX) : snap direct, hors du périmètre,
//   4. correction répétée : converge vers la position serveur SANS jamais
//      chevaucher l'obstacle.
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

global.window = global;
global.GAME = {};
function load(f) { (0, eval)(fs.readFileSync(path.join(REPO, f), "utf8")); }
load("src/config.js");
load("src/projection.js");
load("src/assets.js");
load("src/player.js");
load("src/world.js");
load("src/net.js");
var G = global.GAME;
G.state = {
  player: { x: 0, y: 0, hp: 100, face: 1, moving: false },
  buildings: [], walls: [], items: [], zombies: [], sieges: []
};
G.rebuildBuildingGrid();

// Bâtiment solide de (500,500) à (560,560) : le joueur est à gauche, la
// position serveur (sous latence, trajectoire divergente) est à droite.
var b = { x: 500, y: 500, w: 60, h: 60, name: "mur" };
G.state.buildings.push(b);
G.rebuildBuildingGrid();

var HALF = G.PLAYER_HALF;

// 1 : la correction ne traverse pas le bâtiment (écart > NET_SNAP_PX,
// < NET_SNAP_FULL_PX). Client (480, 530), serveur (530, 530) : l'axe X
// traverse le bâtiment.
G.state.player.x = 480; G.state.player.y = 530;
G.netCorrectPos(530, 530);
assert(G.state.player.x < b.x - HALF + 0.01,
  "1. correction bloquee par le batiment (x=" + G.state.player.x.toFixed(1) + " < " + (b.x - HALF) + ")");

// 2 : cible diagonale derrière le coin NW du bâtiment : la correction
// converge en glissant le long des bords (jamais de travers).
G.state.player.x = 480; G.state.player.y = 480;
for (var k = 0; k < 40; k++) G.netCorrectPos(510, 510);
assert(G.state.player.x > 480 && G.state.player.y > 480,
  "2. les deux axes progressent vers la cible (x=" + G.state.player.x.toFixed(1) +
  ", y=" + G.state.player.y.toFixed(1) + ")");
assert(G.state.player.x <= b.x - HALF + 0.01 && G.state.player.y <= b.y - HALF + 0.01,
  "2b. joueur colle au coin du batiment, sans le chevaucher");

// 3 : téléport — snap direct même à travers l'obstacle (respawn, rejoin).
G.state.player.x = 480; G.state.player.y = 530;
G.netCorrectPos(2000, 2000);
assert(G.state.player.x === 2000 && G.state.player.y === 2000,
  "3. teleport (ecart > NET_SNAP_FULL_PX) : snap direct");

// 4 : convergence — répéter la correction ne doit JAMAIS chevaucher le
// bâtiment, et rapprocher le joueur de la cible.
G.state.player.x = 480; G.state.player.y = 530;
var steps = 0;
for (var i = 0; i < 60; i++) {
  G.netCorrectPos(530, 530);
  steps++;
  var overl = G.state.player.x + HALF > b.x && G.state.player.x - HALF < b.x + b.w &&
    G.state.player.y + HALF > b.y && G.state.player.y - HALF < b.y + b.h;
  if (overl) { assert(false, "4. chevauchement du batiment a l'etape " + steps); break; }
}
var finalOverl = G.state.player.x + HALF > b.x && G.state.player.x - HALF < b.x + b.w &&
  G.state.player.y + HALF > b.y && G.state.player.y - HALF < b.y + b.h;
assert(!finalOverl,
  "4. convergence sans chevauchement (x=" + G.state.player.x.toFixed(1) + ", y=" + G.state.player.y.toFixed(1) + ")");
assert(Math.abs(G.state.player.x - (b.x - HALF)) < G.NET_SNAP_PX,
  "4b. joueur colle au bord du batiment, pas de derive (" + steps + " corrections)");

// 5 : pas d'obstacle -> la correction rattrape normalement (pas de régression
// du lerp de dérive).
G.state.buildings.length = 0;
G.rebuildBuildingGrid();
G.state.player.x = 100; G.state.player.y = 100;
for (var j = 0; j < 40; j++) G.netCorrectPos(160, 100);
assert(Math.abs(G.state.player.x - 160) <= G.NET_SNAP_PX,
  "5. hors obstacle la correction converge (x=" + G.state.player.x.toFixed(1) + " vers 160)");

if (fails) process.exit(1);
console.log("net_correction_collision: OK");

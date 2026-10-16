// Test: net — la correction de position serveur ne traverse jamais un
// obstacle statique (batiment), et respecte la fluidite sous latence.
// Nouvelle API temps-reel (anti-rollback) :
//   - netSetCorrection(x, y, vx, vy) : pose la CIBLE (position + vitesse
//     serveur du snapshot) — ne touche PAS a la position locale ;
//   - netCorrectionAdvance(dt) : avance chaque frame vers la cible
//     EXTRAPOLEE (position + vitesse * age du snapshot), avec une zone
//     morte adaptative au RTT (G.netRtt) : sous latence, l'ecart attendu
//     (le serveur decrit le passe) ne doit PAS etre corrige — c'etait la
//     cause des rollbacks remontes par les joueurs ;
//   - netTeleport(x, y) : snap exact demande par le serveur (flag tp),
//     la distance n'est plus une heuristique de teleport.
// Contract :
//   1. la correction est bloquee par un batiment entre client et serveur,
//   2. la correction glisse le long de l'obstacle (axe libre autorise),
//   3. teleport explicite (netTeleport) : snap direct, hors perimetre,
//   4. correction repetee : converge vers la cible SANS jamais
//      chevaucher l'obstacle,
//   5. zone morte RTT : un ecart inferieur a la zone morte (derive de
//      latence attendue) ne bouge JAMAIS le joueur,
//   5b. au-dela de la zone morte, la correction rattrape (vrai desync),
//   6. cible perimee (plus de snapshot) : aucune correction (anti
//      faux-rollback sur etat serveur en retard).
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
// Batiment solide de (500,500) a (560,560) : le joueur est a gauche, la
// position serveur (sous latence, trajectoire divergente) est a droite.
var b = { x: 500, y: 500, w: 60, h: 60, name: "mur" };
G.state.buildings.push(b);
G.rebuildBuildingGrid();
var HALF = G.PLAYER_HALF;
// Sans RTT mesure (netRtt = 0), la zone morte est NET_SNAP_PX.
var SLACK = G.NET_SNAP_PX;
var FRAME = 1 / 60;
// 1 : la correction ne traverse pas le batiment. Client (480, 530),
// serveur (530, 530) : l'axe X traverse le batiment. La cible est posee
// puis avancee sur plusieurs frames (comme en jeu).
G.state.player.x = 480; G.state.player.y = 530;
G.netSetCorrection(530, 530, 0, 0);
for (var f1 = 0; f1 < 120; f1++) G.netCorrectionAdvance(FRAME);
assert(G.state.player.x < b.x - HALF + 0.01,
  "1. correction bloquee par le batiment (x=" + G.state.player.x.toFixed(1) + " < " + (b.x - HALF) + ")");
// 2 : cible diagonale derriere le coin NW du batiment : la correction
// converge en glissant le long des bords (jamais de travers).
G.state.player.x = 480; G.state.player.y = 480;
// Cible au-dela de la zone morte (sqrt(30^2+30^2) = 42 px resterait dans
// la zone morte de derive : c'est le comportement ATTENDU sous latence).
G.netSetCorrection(540, 540, 0, 0);
for (var f2 = 0; f2 < 120; f2++) G.netCorrectionAdvance(FRAME);
assert(G.state.player.x > 480 && G.state.player.y > 480,
  "2. les deux axes progressent vers la cible (x=" + G.state.player.x.toFixed(1) +
  ", y=" + G.state.player.y.toFixed(1) + ")");
var over2 = G.state.player.x + HALF > b.x && G.state.player.x - HALF < b.x + b.w &&
  G.state.player.y + HALF > b.y && G.state.player.y - HALF < b.y + b.h;
assert(!over2,
  "2b. jamais de chevauchement du batiment (glissement autour du coin : x=" +
  G.state.player.x.toFixed(1) + ", y=" + G.state.player.y.toFixed(1) + ")");
// 3 : teleport explicite — snap direct meme a travers l'obstacle
// (respawn, restart : flag tp du snapshot).
G.state.player.x = 480; G.state.player.y = 530;
G.netTeleport(2000, 2000);
assert(G.state.player.x === 2000 && G.state.player.y === 2000,
  "3. teleport explicite (netTeleport) : snap direct");
// 4 : convergence — repeter la correction ne doit JAMAIS chevaucher le
// batiment, et rapproche le joueur de la cible.
G.state.player.x = 480; G.state.player.y = 530;
G.netSetCorrection(530, 530, 0, 0);
var steps = 0;
var overl = false;
for (var f4 = 0; f4 < 180; f4++) {
  G.netCorrectionAdvance(FRAME);
  steps++;
  overl = G.state.player.x + HALF > b.x && G.state.player.x - HALF < b.x + b.w &&
    G.state.player.y + HALF > b.y && G.state.player.y - HALF < b.y + b.h;
  if (overl) { assert(false, "4. chevauchement du batiment a l'etape " + steps); break; }
}
var finalOverl = G.state.player.x + HALF > b.x && G.state.player.x - HALF < b.x + b.w &&
  G.state.player.y + HALF > b.y && G.state.player.y - HALF < b.y + b.h;
assert(!finalOverl,
  "4. convergence sans chevauchement (x=" + G.state.player.x.toFixed(1) + ", y=" + G.state.player.y.toFixed(1) + ")");
// 5 : zone morte — un ecart DANS la zone morte (derive attendue sous
// latence : le serveur decrit le passe) ne bouge JAMAIS le joueur. C'est
// le fix principal des rollbacks : avant, le seuil fixe NET_SNAP_PX
// corrigeait la derive de latence a chaque snapshot (elastique).
G.state.buildings.length = 0;
G.rebuildBuildingGrid();
G.state.player.x = 100; G.state.player.y = 100;
G.netSetCorrection(100 + SLACK - 1, 100, 0, 0);
for (var f5 = 0; f5 < 60; f5++) G.netCorrectionAdvance(FRAME);
assert(G.state.player.x === 100 && G.state.player.y === 100,
  "5. zone morte : ecart inferieur au seuil = aucune correction (x=" + G.state.player.x.toFixed(1) + ")");
// 5b : au-dela de la zone morte, la correction rattrape bien (vrai desync
// — collision manquee, mur pose par un tiers). MAIS la cible extrapolee
// vieillit : en jeu, applyRemoteState re-pose la cible a chaque snapshot
// (10 Hz). On simule ce cycle : re-pose toutes les 100 ms + frames.
G.state.player.x = 100; G.state.player.y = 100;
var cycles = 0;
for (var f5b = 0; f5b < 300; f5b++) {
  if (f5b % 6 === 0) { G.netSetCorrection(100 + SLACK + 60, 100, 0, 0); cycles++; }
  G.netCorrectionAdvance(FRAME);
}
assert(G.state.player.x > 100 + SLACK,
  "5b. hors zone morte la correction converge par cycles de snapshot (x=" + G.state.player.x.toFixed(1) + " > " + (100 + SLACK) + ", " + cycles + " cycles)");
// 6 : cible perimee (plus de snapshot recu, ex. serveur en pause de
// diffusion) : la correction s'arrete — corriger une cible de plus en
// plus en retard creait le faux rollback "elastique permanent".
G.state.player.x = 0; G.state.player.y = 0;
G.netSetCorrection(80, 0, 0, 0);
var staleFrames = Math.ceil((G.NET_STALE_MS || 100) / (FRAME * 1000)) + 10;
for (var f6 = 0; f6 < staleFrames; f6++) G.netCorrectionAdvance(FRAME);
var xBeforeStale = G.state.player.x;
G.netCorrectionAdvance(FRAME);
assert(xBeforeStale === G.state.player.x,
  "6. cible perimee (plus d'un snapshot sans nouvelle position) : aucune correction (anti faux-rollback)");
if (fails) process.exit(1);
console.log("net_correction_collision: OK");

// Statistiques de partie : compteurs par joueur et globals.
// Module PARTAGE local/serveur : les memes fonctions incrementent les compteurs
// en solo (src/main.js appelle update*) et en reseau (server/game.js lit les
// memes champs du joueur swappe). L'ecran de fin (hud.js) affiche le tableau
// au moment du game over.
(function () {
  "use strict";
  var G = typeof window !== "undefined" ? (window.GAME = window.GAME || {}) : (global.GAME = global.GAME || {});

  // Compteurs d'un joueur (tous a zero au depart). stats est attache au
  // joueur : p.stats = G.newPlayerStats() — cote serveur dans addPlayer /
  // startGame, cote local dans initLocalStats().
  G.newPlayerStats = function () {
    return {
      gold: 0,        // pieces d'or recoltees (pickup + depot relique a l'eglise)
      planks: 0,      // planches recoltees a la hache
      built: 0,       // batiments construits (murs/palissades, tours, batiments de ville)
      kills: 0,       // zombies tues (projectiles du joueur)
      shots: 0        // coups de feu tires (toutes armes projectiles)
    };
  };

  // --- Increment locaux (solo) : lisent state.player et l'attribuent au
  // --- "joueur local" (state.localStats). En reseau le client ne simule pas
  // --- le tir ni la coupe : le serveur compte cote serveur (withPlayer).

  // Or recolte (pickup piece ou depot relique). En reseau : server/game.js
  // incremente directement p.stats.gold au pickup serveur.
  G.statsAddGold = function (n) {
    var s = G.state;
    if (s.localStats) s.localStats.gold += (n || 1);
  };

  // Planches recoltees (coupe de foret ou recuperation de palissade). En
  // reseau : le serveur incremente p.stats.planks dans le swap chop (delta
  // de p.planks autour de updateChop).
  G.statsAddPlanks = function (n) {
    var s = G.state;
    if (s.localStats) s.localStats.planks += (n || 1);
  };

  // Batiment construit (mur, tour, batiment de ville). Compte TOUT pose
  // reussi via placeFromBuildMenu / tryBuildWall.
  G.statsAddBuilt = function () {
    var s = G.state;
    if (s.localStats) s.localStats.built += 1;
  };

  // Zombies tues par LE JOUEUR (projectiles du joueur uniquement ; les tues
  // par tours sont comptes separement dans globalStats.towerKills).
  G.statsAddKill = function () {
    var s = G.state;
    if (s.localStats) s.localStats.kills += 1;
    if (!s.globalStats) s.globalStats = G.newGlobalStats();
    s.globalStats.playerKills += 1;
  };

  // Coup de feu tire (projectile emis par le joueur, toutes armes). En
  // reseau : le serveur compte dans withPlayer (opts.tir, delta projectiles).
  G.statsAddShot = function () {
    var s = G.state;
    if (s.localStats) s.localStats.shots += 1;
  };

  // --- Stats globales de la partie (jour, vagues, ameliorations) ---
  G.newGlobalStats = function () {
    return {
      towerKills: 0,    // zombies tues par les tours
      playerKills: 0,   // zombies tues par les joueurs (toutes armes)
      waves: []         // par nuit : { night, count, ramp }
    };
  };

  // Enregistre la vague de la nuit en cours (appel a chaque spawnWave).
  // rawCount : volume demande AVANT plafond ZOMBIE_WAVE_MAX (montre la
  // croissance exponentielle meme quand la vague est cappee).
  G.statsRecordWave = function (night, count, ramp, rawCount) {
    var s = G.state;
    if (!s.globalStats) s.globalStats = G.newGlobalStats();
    s.globalStats.waves.push({ night: night, count: count, ramp: ramp, raw: rawCount });
  };

  // Zombies tues par une tour : appele depuis towers.js (fleche de tour).
  G.statsAddTowerKill = function () {
    var s = G.state;
    if (!s.globalStats) s.globalStats = G.newGlobalStats();
    s.globalStats.towerKills += 1;
    // attribution au joueur : les tours sont communautaires, aucun joueur
    // individuel ne peut reclamer le tue.
  };
})(typeof window !== "undefined" ? window : global);

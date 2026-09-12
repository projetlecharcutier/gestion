// Configuration globale du jeu : dimensions, constantes, armes, cycle jour/nuit.
// Aucune logique ici, uniquement des valeurs. Partagées via window.GAME.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.WORLD = 100000;
  G.TOWN = 5000;
  G.TOWN_MIN = (G.WORLD - G.TOWN) / 2;
  G.TOWN_MAX = G.TOWN_MIN + G.TOWN;

  G.PLAYER_W = 6;
  G.PLAYER_H = 15;
  G.PLAYER_HALF = 3;
  G.SPEED = 260;
  G.FOG_RADIUS = 200;
  G.TS = 1000;

  G.WEAPON_STATS = {
    "Mains nues": { speed: 600,  life: 1.0, cd: 0.30, dmg: 1, color: "#fff7ad", spread: 0.10, label: "poing" },
    "Pistolet":    { speed: 900,  life: 1.2, cd: 0.22, dmg: 2, color: "#fde68a", spread: 0.03, label: "pistolet" },
    "Fusil":       { speed: 1400, life: 1.6, cd: 0.45, dmg: 5, color: "#fb923c", spread: 0.01, label: "fusil" },
    "Arc":         { speed: 1000, life: 1.4, cd: 0.40, dmg: 3, color: "#bbf7d0", spread: 0.02, label: "arc" },
    "Couteau":     { speed: 520,  life: 0.4, cd: 0.25, dmg: 2, color: "#e2e8f0", spread: 0.0,  label: "couteau" },
    "Bâton":       { speed: 680,  life: 0.8, cd: 0.50, dmg: 3, color: "#d6bb89", spread: 0.06, label: "bâton" }
  };

  G.DAY_SECONDS = 300;
  G.NIGHT_SECONDS = 120;
  G.CYCLE_SECONDS = G.DAY_SECONDS * 2;
  G.WAVE_EVERY = 420;
  G.WAVE_LEAVE = 600;
  G.ZOMBIE_SPEED = 130;
  G.ZOMBIE_ATTACK_RANGE = 150;
  G.ZOMBIE_PLAYER_DMG = 20;
  G.ZOMBIE_WALL_DMG = 5;
  G.ZOMBIE_WALL_CD = 20;
  G.WALL_MAX_HP = 100;
  G.PLAYER_MAX_HP = 100;
  G.ZOMBIE_HP = 1;
  G.ZOMBIE_ATTACK_CD = 1.0;
  G.WALL_PLANKS = 4;
  G.WALL_BUILD_RANGE = 180;
  G.ZOMBIE_PER_WAVE_BASE = 40;

  G.GROUP_SIZE = 8;
  G.GROUP_FORMATION = 90;
  G.GROUP_MERGE_DIST = 320;
  G.GROUP_MERGE_INTERVAL = 2.0;

  function isNight(clock) {
    return clock >= 22 || clock < 2;
  }
  G.isNight = isNight;

  G.rand = function (min, max) { return min + Math.random() * (max - min); };
  G.randi = function (min, max) { return Math.floor(G.rand(min, max + 1)); };
  G.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
})();

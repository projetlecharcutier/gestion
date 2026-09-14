// Configuration globale du jeu : dimensions, constantes, armes, cycle jour/nuit.
// Aucune logique ici, uniquement des valeurs. Partagées via window.GAME.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.WORLD = 10000;
  G.TOWN = 1000;
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
  // Cycle jour/nuit des zombies : vague a minuit, retraite a 8h.
  G.NIGHT_WAVE_HOUR = 0;   // heure (jeu) de spawn de la vague
  G.ZOMBIE_RETREAT_HOUR = 8; // heure (jeu) de retraite des zombies
  G.ZOMBIE_RETREAT_DIST = 700; // distance de retraite hors de la ville
  G.ZOMBIE_SPEED = 117;
  // --- Comportement de déplacement (mouvement vivant) ---
  // Variation de vitesse entre zombies (facteur multiplicatif sur ZOMBIE_SPEED).
  G.ZOMBIE_SPEED_VAR = 0.5;   // [0..1] : speedFactor ∈ [1-VAR, 1+VAR]
  // Allure erratique : amplitude (ratio de cap, 0..1) et fréquence (rad/s)
  // de l'oscillation perpendiculaire au déplacement, par zombie, pour un
  // "drunken walk" (cap qui dérive de part et d'autre).
  G.ZOMBIE_WANDER_AMP = 0.5;
  G.ZOMBIE_WANDER_FREQ = 2.4;
  // Hésitations : durée (s) d'une pause aléatoire et intervalle moyen (s)
  // entre deux hésitations (loi exponentielle).
  G.ZOMBIE_HESITATE_TIME = 0.6;
  G.ZOMBIE_HESITATE_RATE = 0.06; // proba/s de démarrer une hésitation
  // Attraction par le bruit des coups de feu : portée (px) et durée (s)
  // pendant laquelle un groupe dévie sa cible vers la position du tir.
  G.ZOMBIE_NOISE_RANGE = 1600;
  G.ZOMBIE_NOISE_TIME = 4.0;
  // Contournement des murs : biais latéral (px/s) appliqué quand le zombie
  // est bloqué, pour longer le mur plutôt que de s'enliser.
  G.ZOMBIE_WALL_SLIDE = 60;
  G.ZOMBIE_W = 6;
  G.ZOMBIE_HALF = 3;
  G.ZOMBIE_ATTACK_RANGE = 150;
  G.ZOMBIE_PLAYER_DMG = 20;
  G.ZOMBIE_WALL_DMG = 1;
  G.ZOMBIE_WALL_CD = 10;
  G.WALL_MAX_HP = 100;
  G.PLAYER_MAX_HP = 100;
  G.MAIRIE_MAX_HP = 1000;
  G.ZOMBIE_HP = 1;
  G.ZOMBIE_ATTACK_CD = 1.0;
  G.WALL_PLANKS = 4;
  G.WALL_BUILD_RANGE = 180;
  G.TREE_CHOP_TIME = 1;
  G.AXE_RANGE = 120;
  G.WALL_AXE_DMG = 10;
  G.WALL_GRACE = 1.5;
  G.ZOMBIE_PER_WAVE_BASE = 50;
  G.ZOMBIE_WAVE_GROWTH = 2;
  G.BIRD_SPEED = 220;
  G.BIRD_HP = 1;
  G.BIRD_W = 10;
  G.BIRD_HALF = 5;
  G.BIRD_COUNT = 20;
  G.BIRD_HIT_R = 14;
  // Objets droppables par les oiseaux.
  G.BIRD_DROPS = [
    { name: "Pistolet", color: "#94a3b8", kind: "arme" },
    { name: "Fusil", color: "#64748b", kind: "arme" },
    { name: "Arc", color: "#a16207", kind: "arme" },
    { name: "Couteau", color: "#cbd5e1", kind: "arme" },
    { name: "Bâton", color: "#7c5e3c", kind: "arme" },
    { name: "Hache", color: "#b45309", kind: "outil" },
    { name: "Pièce", color: "#fbbf24", kind: "objet" },
    { name: "Potion", color: "#ef4444", kind: "objet" },
    { name: "Nourriture", color: "#f59e0b", kind: "objet" },
    { name: "Gemme", color: "#22d3ee", kind: "objet" }
  ];

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

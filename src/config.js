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
  // Multiplicateur global de vitesse d'écoulement du temps de jeu : 3x plus
  // rapide (le cycle jour/nuit et les horloges avancent 3 fois plus vite).
  G.TIME_SCALE = 3;
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
  // --- Comportement d'attaque ---
  // Lunge / télégraphie : durée (s) d'un élan visuel vers l'avant au moment
  // de frapper, et amplitude (px écran) de l'offset de rendu.
  G.ZOMBIE_LUNGE_TIME = 0.15;
  G.ZOMBIE_LUNGE_VIS = 3.0;
  // Harceleurs : fraction des zombies qui ciblent individuellement le joueur
  // de plus loin, et portée (px) de détection du joueur pour ces éclaireurs.
  G.ZOMBIE_HARASS_RATIO = 0.15;
  G.ZOMBIE_HARASS_RANGE = 620;
  // Attaque de meute : bonus de dégâts par assaillant proche (capé), rayon de
  // regroupement (px) pour compter les assaillants autour d'un zombie qui frappe.
  G.ZOMBIE_SWARM_BONUS = 1.0;
  G.ZOMBIE_SWARM_CAP = 5;
  G.ZOMBIE_SWARM_RADIUS = 24;
  // Pilleurs : fraction des zombies qui font que leur groupe cible les
  // planches construites par le joueur (built) à portée (px) plutôt que la mairie.
  G.ZOMBIE_RAIDER_RATIO = 0.20;
  G.ZOMBIE_RAID_RANGE = 520;
  // --- Attaque des murs (nuit) ---
  // Portée (px) de détection d'un mur par zombie individuel : un zombie
  // attaque tout mur à portée même si le groupe vise ailleurs.
  G.ZOMBIE_WALL_SENSE = 60;
  // Rayon d'attaque effective d'un zombie sur un mur (px, distance zombie→bord mur).
  G.ZOMBIE_WALL_HIT = 22;
  // Diversité d'attaque des murs : fraction de zombies "démolisseurs" qui
  // foncent droit sur le mur le plus proche, le reste "fouisseurs" longe le
  // mur jusqu'à trouver une faille (un trou dans la palissade).
  G.ZOMBIE_BREAKER_RATIO = 0.5;
  // Bonus nocturne de cadence d'attaque des murs : la nuit, le cooldown
  // d'attaque est divisé par ce facteur (zombies plus actifs).
  G.ZOMBIE_NIGHT_ATTACK_FASTER = 1.6;
  // Contournement des forêts : portée (px) de réorientation vers le mur le
  // plus proche quand un zombie est bloqué par une forêt.
  G.ZOMBIE_FORET_REORIENT = 360;
  // Vitesse de glissement le long d'un mur pour les fouisseurs (px/s).
  G.ZOMBIE_SEEK_SLIDE = 90;
  // --- Comportement de rassemblement ---
  // Mode horde : seuil de membres pour qu'un groupe devienne une horde, bonus
  // de vitesse en mode horde, et distance de formation dense en horde.
  G.ZOMBIE_HORDE_THRESHOLD = 40;
  G.ZOMBIE_HORDE_SPEED_BONUS = 0.18;
  G.ZOMBIE_HORDE_DENSE = 0.7;   // facteur de resserrement de slotDist en horde
  // Fusion animée : vitesse de convergence des slots vers la nouvelle
  // formation après une fusion (lerp par seconde, 1 = instantané).
  G.ZOMBIE_SLOT_LERP = 4.0;
  // Dispersion à la retraite : facteur d'élargissement des slots en mode
  // retraite et amplitude de bruit ajoutée à slotDist.
  G.ZOMBIE_RETREAT_SLOT_SCALE = 1.6;
  G.ZOMBIE_RETREAT_SLOT_NOISE = 40;
  G.ZOMBIE_W = 6;
  G.ZOMBIE_HALF = 3;
  G.ZOMBIE_ATTACK_RANGE = 150;
  G.ZOMBIE_PLAYER_DMG = 20;
  G.ZOMBIE_WALL_DMG = 1;
  G.ZOMBIE_WALL_CD = 10;
  G.WALL_MAX_HP = 100;
  G.PLAYER_MAX_HP = 100;
  G.FOOD_HEAL = 25;
  G.MAIRIE_MAX_HP = 1000;
  G.ZOMBIE_HP = 1;
  G.ZOMBIE_ATTACK_CD = 1.0;
  G.WALL_PLANKS = 4;
  G.WALL_BUILD_RANGE = 180;
  G.TREE_CHOP_TIME = 1;
  G.AXE_RANGE = 120;
  G.WALL_AXE_DMG = 10;
  // Forêts : 5 états de coupe (s0 = pleine, s4 = entièrement coupée).
  // Un coup de hache récolte 4 planches et fait avancer d'un état. À l'état
  // final (s4) la forêt n'est plus récoltable et devient traversable. Chaque
  // jour écoulé, la forêt regagne un état (remonte vers s0), sauf à s0.
  G.FORET_STAGES = 5;
  G.FORET_PLANKS_PER_CHOP = 4;
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

  // Assombrissement nocturne global : intensité maximale (alpha) de l'overlay
  // sombre et couleur (RGB "r,g,b"). La transition est douce : nulle aux
  // limites 22h/2h, maximale à minuit (0h).
  G.NIGHT_DARK_ALPHA = 0.5;
  G.NIGHT_DARK_COLOR = "2,6,23";
  G.nightDarkness = function (clock) {
    var max = G.NIGHT_DARK_ALPHA;
    if (clock >= 22) return max * (clock - 22) / 2;
    if (clock < 2) return max * (2 - clock) / 2;
    return 0;
  };

  G.rand = function (min, max) { return min + Math.random() * (max - min); };
  G.randi = function (min, max) { return Math.floor(G.rand(min, max + 1)); };
  G.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
})();

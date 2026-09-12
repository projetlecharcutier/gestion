// État global du jeu + références DOM.
// Toutes les fonctions lisent/écrivent G.state et les éléments DOM via G.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.canvas = document.getElementById("game");
  G.ctx = G.canvas.getContext("2d");
  G.hud = document.getElementById("hud");
  G.hudName = document.getElementById("hudName");
  G.hudZone = document.getElementById("hudZone");
  G.hudPos = document.getElementById("hudPos");
  G.hudInv = document.getElementById("hudInv");
  G.hudWeapon = document.getElementById("hudWeapon");
  G.hudHp = document.getElementById("hudHp");
  G.hudPlanks = document.getElementById("hudPlanks");
  G.startScreen = document.getElementById("startScreen");
  G.startForm = document.getElementById("startForm");
  G.nameInput = document.getElementById("nameInput");
  G.pauseScreen = document.getElementById("pauseScreen");
  G.resumeBtn = document.getElementById("resumeBtn");
  G.buildingScreen = document.getElementById("buildingScreen");
  G.buildingName = document.getElementById("buildingName");
  G.buildingMsg = document.getElementById("buildingMsg");
  G.leaveBuildingBtn = document.getElementById("leaveBuildingBtn");

  G.state = {
    started: false,
    paused: false,
    gameOver: false,
    inBuilding: null,
    playerName: "",
    player: { x: 50000, y: 50000, face: 1, moving: false, hp: G.PLAYER_MAX_HP },
    camera: { x: 50000, y: 50000 },
    zoom: 8,
    targetZoom: 8,
    mouse: { sx: 0, sy: 0, wx: 50000, wy: 50000, inside: false },
    inventory: 0,
    planks: 0,
    items: [],
    buildings: [],
    trees: [],
    walls: [],
    zombies: [],
    zombieGroups: [],
    bag: { open: false, contents: [] },
    equipped: null,
    projectiles: [],
    keys: {},
    shootCd: 0,
    buildMode: false,
    clock: 8,
    day: 0,
    elapsed: 0,
    nextWaveAt: G.WAVE_EVERY,
    waveActive: false,
    waveLeaveAt: 0,
    time: 0
  };
})();

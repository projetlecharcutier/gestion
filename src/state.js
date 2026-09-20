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
  G.hudPlayers = document.getElementById("hudPlayers");
  G.hudInv = document.getElementById("hudInv");
  G.hudWeapon = document.getElementById("hudWeapon");
  G.hudAxe = document.getElementById("hudAxe");
  G.hudHp = document.getElementById("hudHp");
  G.hudPlanks = document.getElementById("hudPlanks");
  G.hudMairie = document.getElementById("hudMairie");
  G.hudGold = document.getElementById("hudGold");
  G.startScreen = document.getElementById("startScreen");
  G.startForm = document.getElementById("startForm");
  G.nameInput = document.getElementById("nameInput");
  G.pauseScreen = document.getElementById("pauseScreen");
  G.resumeBtn = document.getElementById("resumeBtn");
  G.buildingScreen = document.getElementById("buildingScreen");
  G.buildingName = document.getElementById("buildingName");
  G.buildingMsg = document.getElementById("buildingMsg");
  G.leaveBuildingBtn = document.getElementById("leaveBuildingBtn");
  G.buildMenuScreen = document.getElementById("buildMenuScreen");
  G.buildMenuList = document.getElementById("buildMenuList");
  G.closeBuildMenuBtn = document.getElementById("closeBuildMenuBtn");
  G.chestScreen = document.getElementById("chestScreen");
  G.chestVault = document.getElementById("chestVault");
  G.chestBag = document.getElementById("chestBag");
  G.chestGold = document.getElementById("chestGold");
  G.chestTech = document.getElementById("chestTech");
  G.closeChestBtn = document.getElementById("closeChestBtn");
  G.churchScreen = document.getElementById("churchScreen");
  G.churchVault = document.getElementById("churchVault");
  G.churchBag = document.getElementById("churchBag");
  G.churchGold = document.getElementById("churchGold");
  G.closeChurchBtn = document.getElementById("closeChurchBtn");
  G.universiteScreen = document.getElementById("universiteScreen");
  G.universiteInfo = document.getElementById("universiteInfo");
  G.closeUniversiteBtn = document.getElementById("closeUniversiteBtn");

  G.state = {
    started: false,
    paused: false,
    gameOver: false,
    inBuilding: null,
    playerName: "",
    player: { x: G.WORLD / 2, y: G.WORLD / 2, face: 1, moving: false, hp: G.PLAYER_MAX_HP },
    camera: { x: G.WORLD / 2, y: G.WORLD / 2 },
    zoom: 8,
    targetZoom: 8,
    mouse: { sx: 0, sy: 0, wx: G.WORLD / 2, wy: G.WORLD / 2, inside: false },
    inventory: 0,
    planks: 0,
    gold: 0,
    mairieGold: 0,
    scierieUnlocked: false,
    scierie: null,
    universiteUnlocked: false,
    universite: null,
    montgolfiereUnlocked: false,
    montgolfiere: null,
    pendingWave: null,
    towers: [],
    buildSel: null,
    buildMenuOpen: false,
    vote: null,
    voteCooldownUntil: 0,
    items: [],
    buildings: [],
    walls: [],
    zombies: [],
    zombieGroups: [],
    deadTraces: [],
    birds: [],
    bag: { open: false, contents: [] },
    chest: [],
    chestOpen: false,
    churchOpen: false,
    gameOverCause: "",
    equipped: null,
    projectiles: [],
    keys: {},
    actionHeld: false,
    shootCd: 0,
    buildMode: false,
    plankRotation: 0,
    axeEquipped: false,
    chopTarget: null,
    chopWall: null,
    chopTimer: 0,
    floaters: [],
    clock: 8,
    day: 0,
    lastDay: 0,
    elapsed: 0,
    nextWaveAt: G.WAVE_EVERY,
    waveActive: false,
    waveCount: 0,
    zombieRamp: 1,
    waveLeaveAt: 0,
    waveSpawnedForDay: false,
    zombieMode: "attack",
    waveMsgTimer: 0,
    hordeMsgTimer: 0,
    time: 0
  };
})();

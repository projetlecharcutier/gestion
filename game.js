(function () {
  "use strict";

  /* ===================== Config ===================== */
  var WORLD = 100000;          // carte 100000 x 100000 px
  var TOWN = 5000;             // ville 5000 x 5000 px
  var TOWN_MIN = (WORLD - TOWN) / 2; // 47500
  var TOWN_MAX = TOWN_MIN + TOWN;    // 52500

  var PLAYER_W = 6;   // personnage : 6 px de large
  var PLAYER_H = 15;  // 15 px de haut (pixelisé)
  var PLAYER_HALF = 3;
  var SPEED = 260;    // px monde / sec
  var FOG_RADIUS = 200; // visibilité hors ville (px monde)
  var TS = 1000;       // taille de tuile (px monde)

  // Armes : chaque arme modifie le tir (vitesse, portée, cadence, dégâts, couleur)
  // kind: arme ; stats = { speed, life, cd, dmg, color, spread }
  var WEAPON_STATS = {
    "Mains nues": { speed: 600,  life: 1.0, cd: 0.30, dmg: 1, color: "#fff7ad", spread: 0.10, label: "poing" },
    "Pistolet":    { speed: 900,  life: 1.2, cd: 0.22, dmg: 2, color: "#fde68a", spread: 0.03, label: "pistolet" },
    "Fusil":       { speed: 1400, life: 1.6, cd: 0.45, dmg: 5, color: "#fb923c", spread: 0.01, label: "fusil" },
    "Arc":         { speed: 1000, life: 1.4, cd: 0.40, dmg: 3, color: "#bbf7d0", spread: 0.02, label: "arc" },
    "Couteau":     { speed: 520,  life: 0.4, cd: 0.25, dmg: 2, color: "#e2e8f0", spread: 0.0,  label: "couteau" },
    "Bâton":       { speed: 680,  life: 0.8, cd: 0.50, dmg: 3, color: "#d6bb89", spread: 0.06, label: "bâton" }
  };

  function equippedStats() {
    var name = state.equipped || "Mains nues";
    return WEAPON_STATS[name] || WEAPON_STATS["Mains nues"];
  }

  /* Cycle jour / nuit : 12h = 5 min (300s) réel.
     Nuit = attaque des zombies pendant 2 min (120s).
     Une vague toutes les 7 min (420s) de nuit, repartent après 10 min (600s). */
  var DAY_SECONDS = 300;          // 12h in-game = 300s réel
  var NIGHT_SECONDS = 120;        // attaque dure 2 min la nuit
  var CYCLE_SECONDS = DAY_SECONDS * 2; // 24h = 600s
  var WAVE_EVERY = 420;           // vague toutes les 7 min
  var WAVE_LEAVE = 600;           // repartent après 10 min
  var ZOMBIE_SPEED = 130;         // moitié de la vitesse joueur (260/2)
  var ZOMBIE_ATTACK_RANGE = 150;  // portée d'attaque zombie
  var ZOMBIE_PLAYER_DMG = 20;      // 5 attaques -> mort (100 PV)
  var ZOMBIE_WALL_DMG = 5;         // mur : -5 PV / attaque
  var ZOMBIE_WALL_CD = 20;         // toutes les 20s
  var WALL_MAX_HP = 100;
  var PLAYER_MAX_HP = 100;
  var ZOMBIE_HP = 1;               // meurt avec un coup de feu
  var ZOMBIE_ATTACK_CD = 1.0;
  var WALL_PLANKS = 4;             // planches par mur (1 planche d'épaisseur = 1 segment)
  var WALL_BUILD_RANGE = 180;     // portée de construction d'un mur
  var ZOMBIE_PER_WAVE_BASE = 40;   // milliers au fil du temps -> on adapte la densité

  function isNight(clock) {
    // nuit entre 22h et 02h (sur 24h) -> attaques
    return clock >= 22 || clock < 2;
  }

  function viewW() { return canvas.width / (window.devicePixelRatio || 1); }
  function viewH() { return canvas.height / (window.devicePixelRatio || 1); }

  /* ===================== DOM ===================== */
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var hud = document.getElementById("hud");
  var hudName = document.getElementById("hudName");
  var hudZone = document.getElementById("hudZone");
  var hudPos = document.getElementById("hudPos");
  var hudInv = document.getElementById("hudInv");
  var hudWeapon = document.getElementById("hudWeapon");
  var hudHp = document.getElementById("hudHp");
  var hudPlanks = document.getElementById("hudPlanks");
  var startScreen = document.getElementById("startScreen");
  var startForm = document.getElementById("startForm");
  var nameInput = document.getElementById("nameInput");
  var pauseScreen = document.getElementById("pauseScreen");
  var resumeBtn = document.getElementById("resumeBtn");
  var buildingScreen = document.getElementById("buildingScreen");
  var buildingName = document.getElementById("buildingName");
  var buildingMsg = document.getElementById("buildingMsg");
  var leaveBuildingBtn = document.getElementById("leaveBuildingBtn");

  /* ===================== State ===================== */
  var state = {
    started: false,
    paused: false,
    gameOver: false,
    inBuilding: null,
    playerName: "",
    player: { x: 50000, y: 50000, face: 1, moving: false, hp: PLAYER_MAX_HP },
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
    bag: { open: false, contents: [] },
    equipped: null,
    projectiles: [],
    keys: {},
    shootCd: 0,
    buildMode: false,
    clock: 8,       // heure in-game (0..24)
    day: 0,         // compteur de jours (commence à 0)
    elapsed: 0,     // temps réel écoulé (s)
    nextWaveAt: WAVE_EVERY, // prochaine vague (s réel)
    waveActive: false,
    waveLeaveAt: 0,
    time: 0
  };

  /* ===================== Buildings ===================== */
  function makeBuilding(x, y, w, h, name, msg, height) {
    return {
      x: x, y: y, w: w, h: h,
      name: name, msg: msg, height: height || 350,
      door: { x: x + w / 2, y: y + h } // porte au centre de la face avant
    };
  }

  function rand(min, max) { return min + Math.random() * (max - min); }
  function randi(min, max) { return Math.floor(rand(min, max + 1)); }

  function buildPerimeterWall() {
    // Mur de 1 planche d'épaisseur tout autour de la ville
    state.walls = [];
    var seg = 250;       // longueur d'un segment de mur
    var pad = 60;        // distance depuis la bordure de ville
    // haut (y = TOWN_MIN - pad), de gauche à droite
    for (var x = TOWN_MIN; x < TOWN_MAX; x += seg) {
      state.walls.push({ x: x, y: TOWN_MIN - pad, w: seg, h: 24, hp: WALL_MAX_HP, orient: "h" });
    }
    // bas (y = TOWN_MAX + pad)
    for (var x = TOWN_MIN; x < TOWN_MAX; x += seg) {
      state.walls.push({ x: x, y: TOWN_MAX + pad - 24, w: seg, h: 24, hp: WALL_MAX_HP, orient: "h" });
    }
    // gauche (x = TOWN_MIN - pad)
    for (var y = TOWN_MIN; y < TOWN_MAX; y += seg) {
      state.walls.push({ x: TOWN_MIN - pad, y: y, w: 24, h: seg, hp: WALL_MAX_HP, orient: "v" });
    }
    // droite (x = TOWN_MAX + pad - 24)
    for (var y = TOWN_MIN; y < TOWN_MAX; y += seg) {
      state.walls.push({ x: TOWN_MAX + pad - 24, y: y, w: 24, h: seg, hp: WALL_MAX_HP, orient: "v" });
    }
  }

  function buildWorld() {
    var c = 50000;
    // Bâtiments dont un Hôpital dans la ville
    state.buildings = [
      makeBuilding(c - 2100, c - 2100, 700, 700, "Mairie", "Vous êtes à la mairie. Tout semble calme.", 380),
      makeBuilding(c + 1400, c - 2000, 650, 650, "Auberge", "L'auberge sent la soupe chaude. Repos bien mérité.", 330),
      makeBuilding(c - 2000, c + 1300, 650, 650, "Forge", "La forge résonne du bruit de l'enclume.", 360),
      makeBuilding(c + 1500, c + 1400, 700, 600, "Marché", "Le marché grouille de marchandises.", 300),
      makeBuilding(c - 750, c + 1600, 550, 450, "Temple", "Le temple est silencieux et frais.", 440),
      makeBuilding(c + 600, c - 1500, 500, 550, "Tour", "La vue depuis la tour couvre toute la ville.", 600),
      makeBuilding(c - 1900, c + 1500, 600, 500, "Hôpital", "Hôpital : payez une pièce d'or pour retrouver toute votre vie.", 420)
    ];

    // Mur de périmètre (1 planche d'épaisseur) entoure la ville
    buildPerimeterWall();

    // Objets : armes UNIQUEMENT en dehors de la ville ; objets en ville
    state.items = [
      // objets en ville (dont pièces d'or pour l'hôpital)
      { x: c - 400, y: c + 100, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c + 450, y: c - 300, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c - 1000, y: c - 900, taken: false, name: "Potion", color: "#ef4444", kind: "objet" },
      { x: c + 200, y: c + 1200, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c - 1600, y: c + 400, taken: false, name: "Gemme", color: "#22d3ee", kind: "objet" },
      { x: c + 1700, y: c - 700, taken: false, name: "Parchemin", color: "#fde68a", kind: "objet" },
      { x: c - 600, y: c - 1300, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c + 1100, y: c + 600, taken: false, name: "Clé", color: "#eab308", kind: "objet" },
      // armes en dehors de la ville (uniquement)
      { x: TOWN_MIN - 2200, y: c + 300, taken: false, name: "Pistolet", color: "#94a3b8", kind: "arme" },
      { x: TOWN_MAX + 1800, y: c - 600, taken: false, name: "Couteau", color: "#cbd5e1", kind: "arme" },
      { x: c - 1100, y: TOWN_MAX + 1900, taken: false, name: "Bâton", color: "#7c5e3c", kind: "arme" },
      { x: c + 1200, y: TOWN_MIN - 2100, taken: false, name: "Arc", color: "#a16207", kind: "arme" },
      { x: TOWN_MIN - 6000, y: TOWN_MIN - 4000, taken: false, name: "Fusil", color: "#64748b", kind: "arme" },
      { x: TOWN_MAX + 7000, y: TOWN_MAX + 5000, taken: false, name: "Pistolet", color: "#94a3b8", kind: "arme" },
      { x: c, y: TOWN_MIN - 8000, taken: false, name: "Fusil", color: "#64748b", kind: "arme" },
      { x: c + 9000, y: c - 12000, taken: false, name: "Arc", color: "#a16207", kind: "arme" },
      { x: TOWN_MIN - 14000, y: c + 15000, taken: false, name: "Couteau", color: "#cbd5e1", kind: "arme" },
      // objets rares hors ville
      { x: TOWN_MIN - 6000, y: TOWN_MIN - 4000, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: TOWN_MAX + 7000, y: TOWN_MAX + 5000, taken: false, name: "Cristal", color: "#38bdf8", kind: "objet" },
      { x: c + 9000, y: c - 12000, taken: false, name: "Potion", color: "#ef4444", kind: "objet" }
    ];

    // Arbres : quelques-uns en ville, beaucoup en dehors de la ville
    state.trees = [];
    var i, tx, ty, tries;
    for (i = 0; i < 25; i++) {
      tries = 0;
      do {
        tx = rand(TOWN_MIN + 200, TOWN_MAX - 200);
        ty = rand(TOWN_MIN + 200, TOWN_MAX - 200);
        tries++;
      } while (nearBuilding(tx, ty, 150) && tries < 12);
      if (tries < 12) state.trees.push({ x: tx, y: ty, r: rand(70, 110), kind: "town", hp: 2 });
    }
    // beaucoup d'arbres hors ville (forêt dense) — abattables pour faire des planches
    for (i = 0; i < 700; i++) {
      var edge = Math.random() < 0.5;
      if (edge) {
        tx = rand(0, WORLD);
        ty = Math.random() < 0.5 ? rand(0, TOWN_MIN - 200) : rand(TOWN_MAX + 200, WORLD);
      } else {
        tx = Math.random() < 0.5 ? rand(0, TOWN_MIN - 200) : rand(TOWN_MAX + 200, WORLD);
        ty = rand(0, WORLD);
      }
      state.trees.push({ x: tx, y: ty, r: rand(90, 180), kind: "wild", hp: 2 });
    }
    // arbres en bordure immédiate de la ville
    for (i = 0; i < 200; i++) {
      var side = randi(0, 3);
      if (side === 0) { tx = rand(TOWN_MIN, TOWN_MAX); ty = rand(TOWN_MIN - 1400, TOWN_MIN - 100); }
      else if (side === 1) { tx = rand(TOWN_MIN, TOWN_MAX); ty = rand(TOWN_MAX + 100, TOWN_MAX + 1400); }
      else if (side === 2) { tx = rand(TOWN_MIN - 1400, TOWN_MIN - 100); ty = rand(TOWN_MIN, TOWN_MAX); }
      else { tx = rand(TOWN_MAX + 100, TOWN_MAX + 1400); ty = rand(TOWN_MIN, TOWN_MAX); }
      state.trees.push({ x: tx, y: ty, r: rand(80, 140), kind: "edge", hp: 2 });
    }

    state.zombies = [];
  }

  function nearBuilding(x, y, pad) {
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
    }
    return false;
  }

  /* ===================== Projection iso ===================== */
  function proj(wx, wy) {
    var z = state.zoom;
    var sx = (wx - wy) * 0.5 * z;
    var sy = (wx + wy) * 0.25 * z;
    var camSX = (state.camera.x - state.camera.y) * 0.5 * z;
    var camSY = (state.camera.x + state.camera.y) * 0.25 * z;
    return [sx - camSX + viewW() / 2, sy - camSY + viewH() / 2];
  }

  function unproj(sx, sy) {
    var z = state.zoom;
    var camSX = (state.camera.x - state.camera.y) * 0.5 * z;
    var camSY = (state.camera.x + state.camera.y) * 0.25 * z;
    var a = sx - viewW() / 2 + camSX;   // (wx-wy)*0.5*z
    var b = sy - viewH() / 2 + camSY;  // (wx+wy)*0.25*z
    var d = a / (0.5 * z);     // wx - wy
    var s = b / (0.25 * z);    // wx + wy
    return [(d + s) / 2, (s - d) / 2];
  }

  function inTown(x, y) {
    return x >= TOWN_MIN && x <= TOWN_MAX && y >= TOWN_MIN && y <= TOWN_MAX;
  }

  /* ===================== Collision (murs) ===================== */
  function aabbHitsBuildings(x, y) {
    var bx = x - PLAYER_HALF, by = y - PLAYER_HALF;
    var bw = PLAYER_W, bh = PLAYER_W;
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (bx < b.x + b.w && bx + bw > b.x && by < b.y + b.h && by + bh > b.y) {
        return true;
      }
    }
    return false;
  }

  function tryMove(nx, ny) {
    var p = state.player;
    var moved = false;
    var testX = p.x;
    var testY = ny;
    if (!aabbHitsBuildings(testX, testY) &&
        testX >= PLAYER_HALF && testX <= WORLD - PLAYER_HALF &&
        testY >= PLAYER_HALF && testY <= WORLD - PLAYER_HALF) {
      p.y = testY;
      moved = true;
    }
    testY = p.y;
    testX = nx;
    if (!aabbHitsBuildings(testX, testY) &&
        testX >= PLAYER_HALF && testX <= WORLD - PLAYER_HALF &&
        testY >= PLAYER_HALF && testY <= WORLD - PLAYER_HALF) {
      p.x = testX;
      moved = true;
    }
    return moved;
  }

  /* ===================== Input ===================== */
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener("resize", resize);
  resize();

  canvas.addEventListener("mousemove", function (e) {
    var rect = canvas.getBoundingClientRect();
    state.mouse.sx = e.clientX - rect.left;
    state.mouse.sy = e.clientY - rect.top;
    state.mouse.inside = true;
    var w = unproj(state.mouse.sx, state.mouse.sy);
    state.mouse.wx = w[0];
    state.mouse.wy = w[1];
  });

  canvas.addEventListener("mouseleave", function () { state.mouse.inside = false; });

  canvas.addEventListener("click", function (e) {
    if (!state.started || state.paused || state.inBuilding || state.gameOver) return;
    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;

    // Sac ouvert : clic pour équiper / déséquiper une arme
    if (state.bag.open) {
      handleBagClick(sx, sy);
      return;
    }

    var w = unproj(sx, sy);
    var p = state.player;

    // Mode construction : placer un mur au point cliqué (si assez de planches + à portée)
    if (state.buildMode) {
      tryBuildWall(w[0], w[1]);
      return;
    }

    // 1) porte de bâtiment
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      var ddx = w[0] - b.door.x, ddy = w[1] - b.door.y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < 80) {
        var pdx = p.x - b.door.x, pdy = p.y - b.door.y;
        if (Math.sqrt(pdx * pdx + pdy * pdy) < 160) {
          // Hôpital : soin contre une pièce d'or
          if (b.name === "Hôpital") {
            tryHealAtHospital();
            return;
          }
          enterBuilding(b);
          return;
        }
      }
    }

    // 2) abattre un arbre (clic sur l'arbre à proximité) -> donne des planches
    for (var ti = 0; ti < state.trees.length; ti++) {
      var t = state.trees[ti];
      var tdx = w[0] - t.x, tdy = w[1] - t.y;
      if (Math.sqrt(tdx * tdx + tdy * tdy) < t.r * 0.6) {
        var pdx2 = p.x - t.x, pdy2 = p.y - t.y;
        if (Math.sqrt(pdx2 * pdx2 + pdy2 * pdy2) < WALL_BUILD_RANGE) {
          t.hp -= 1;
          if (t.hp <= 0) {
            // abattu : donne des planches
            var gain = 2 + randi(0, 2);
            state.planks += gain;
            updateHud();
          }
          return;
        }
      }
    }

    // 3) ramassage d'objet / arme -> va dans le sac
    for (var j = 0; j < state.items.length; j++) {
      var it = state.items[j];
      if (it.taken) continue;
      var ix = w[0] - it.x, iy = w[1] - it.y;
      var od = Math.sqrt(ix * ix + iy * iy);
      if (od < 70) {
        var px = p.x - it.x, py = p.y - it.y;
        if (Math.sqrt(px * px + py * py) < 120) {
          it.taken = true;
          state.bag.contents.push({ name: it.name, kind: it.kind, color: it.color });
          state.inventory += 1;
          updateHud();
        }
      }
    }
  });

  canvas.addEventListener("wheel", function (e) {
    if (!state.started) return;
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    state.targetZoom = clamp(state.targetZoom * factor, 1, 40);
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") {
      e.preventDefault();
      state.keys.space = true;
    }
    if (e.code === "Escape") {
      if (state.started && state.bag.open) { state.bag.open = false; return; }
      if (state.started) togglePause();
    }
    if (e.code === "KeyA" || e.key === "a" || e.key === "A" || e.key === "q" || e.key === "Q") {
      if (state.started && !state.paused && !state.inBuilding && !state.gameOver) {
        state.bag.open = !state.bag.open;
      }
    }
    if (e.code === "KeyB" || e.key === "b" || e.key === "B") {
      if (state.started && !state.paused && !state.inBuilding && !state.bag.open && !state.gameOver) {
        state.buildMode = !state.buildMode;
      }
    }
  });
  window.addEventListener("keyup", function (e) {
    if (e.code === "Space") state.keys.space = false;
  });

  startForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = nameInput.value.trim();
    if (!v) return;
    state.playerName = v;
    startScreen.hidden = true;
    hud.hidden = false;
    state.started = true;
    state.gameOver = false;
    state.player.hp = PLAYER_MAX_HP;
    state.planks = 0;
    state.clock = 8;
    state.day = 0;
    state.elapsed = 0;
    state.nextWaveAt = WAVE_EVERY;
    state.waveActive = false;
    state.zombies = [];
    state.walls = [];
    state.buildMode = false;
    buildWorld();
    updateHud();
    nameInput.blur();
  });

  resumeBtn.addEventListener("click", togglePause);
  leaveBuildingBtn.addEventListener("click", leaveBuilding);

  function togglePause() {
    if (state.inBuilding) return;
    state.paused = !state.paused;
    pauseScreen.hidden = !state.paused;
  }

  function enterBuilding(b) {
    state.inBuilding = b;
    buildingName.textContent = b.name;
    buildingMsg.textContent = b.msg;
    buildingScreen.hidden = false;
  }
  function leaveBuilding() {
    var b = state.inBuilding;
    if (b) {
      state.player.x = b.door.x;
      state.player.y = b.door.y + 140;
      clampPlayer();
    }
    state.inBuilding = null;
    buildingScreen.hidden = true;
  }

  function clampPlayer() {
    var p = state.player;
    p.x = clamp(p.x, PLAYER_HALF, WORLD - PLAYER_HALF);
    p.y = clamp(p.y, PLAYER_HALF, WORLD - PLAYER_HALF);
  }

  function hasGoldPiece() {
    for (var i = 0; i < state.bag.contents.length; i++) {
      if (state.bag.contents[i].name === "Pièce") return i;
    }
    return -1;
  }

  function tryHealAtHospital() {
    if (state.player.hp >= PLAYER_MAX_HP) {
      state.bag.open = true;
      return;
    }
    var idx = hasGoldPiece();
    if (idx < 0) {
      // pas de pièce : on entre juste pour info
      state.bag.open = true;
      return;
    }
    // dépense une pièce d'or
    state.bag.contents.splice(idx, 1);
    state.inventory = Math.max(0, state.inventory - 1);
    state.player.hp = PLAYER_MAX_HP;
    updateHud();
  }

  function tryBuildWall(wx, wy) {
    var p = state.player;
    var dx = wx - p.x, dy = wy - p.y;
    if (Math.sqrt(dx * dx + dy * dy) > WALL_BUILD_RANGE) return;
    if (state.planks < WALL_PLANKS) return;
    // détermine orientation selon la position dominante
    var w = 24, h = 24;
    if (Math.abs(wx - p.x) > Math.abs(wy - p.y)) h = 120; else w = 120;
    var mx = wx - w / 2, my = wy - h / 2;
    // éviter de construire sur un bâtiment ou un mur existant
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (mx < b.x + b.w && mx + w > b.x && my < b.y + b.h && my + h > b.y) return;
    }
    for (var j = 0; j < state.walls.length; j++) {
      var m = state.walls[j];
      if (mx < m.x + m.w && mx + w > m.x && my < m.y + m.h && my + h > m.y) return;
    }
    state.planks -= WALL_PLANKS;
    state.walls.push({ x: mx, y: my, w: w, h: h, hp: WALL_MAX_HP, orient: w > h ? "h" : "v" });
    updateHud();
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ===================== HUD ===================== */
  function updateHud() {
    hudName.textContent = state.playerName;
    var p = state.player;
    hudZone.textContent = inTown(p.x, p.y) ? "Ville" : "Hors ville";
    hudPos.textContent = "(" + Math.round(p.x) + ", " + Math.round(p.y) + ")";
    hudInv.textContent = String(state.inventory);
    hudWeapon.textContent = state.equipped || "Mains nues";
    hudHp.textContent = String(Math.round(state.player.hp));
    hudPlanks.textContent = String(state.planks);
  }

  /* ===================== Update ===================== */
  function update(dt) {
    state.time += dt;
    state.zoom += (state.targetZoom - state.zoom) * Math.min(1, dt * 12);

    if (state.shootCd > 0) state.shootCd -= dt;

    // Cycle jour/nuit : 12h = 5 min réel
    if (!state.paused && !state.gameOver) {
      state.elapsed += dt;
      state.clock += (12 / DAY_SECONDS) * dt; // heures in-game par seconde réelle
      if (state.clock >= 24) {
        state.clock -= 24;
        state.day += 1; // un nouveau cycle jour/nuit complet
      }
    }

    if (!state.gameOver) updateZombies(dt);

    if (!state.inBuilding && !state.paused && !state.bag.open && !state.gameOver) {
      var p = state.player;
      var tx = state.mouse.wx, ty = state.mouse.wy;
      var dx = tx - p.x, dy = ty - p.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (state.mouse.inside && dist > 5) {
        var nx = dx / dist, ny = dy / dist;
        var stepX = p.x + nx * SPEED * dt;
        var stepY = p.y + ny * SPEED * dt;
        tryMove(stepX, stepY);
        p.moving = true;
        if (nx < 0) p.face = -1; else if (nx > 0) p.face = 1;
      } else {
        p.moving = false;
      }

      // tir (les propriétés dépendent de l'arme équipée)
      if (state.keys.space && state.shootCd <= 0) {
        var st = equippedStats();
        state.shootCd = st.cd;
        var ax = tx - p.x, ay = ty - p.y;
        var al = Math.sqrt(ax * ax + ay * ay) || 1;
        var ang = Math.atan2(ay, ax);
        var sp = (Math.random() * 2 - 1) * st.spread;
        ang += sp;
        state.projectiles.push({
          x: p.x, y: p.y - PLAYER_H * 0.5,
          vx: Math.cos(ang) * st.speed,
          vy: Math.sin(ang) * st.speed,
          life: st.life,
          dmg: st.dmg,
          color: st.color,
          trail: []
        });
        if (state.projectiles.length > 120) state.projectiles.shift();
      }
    }

    // projectiles + collisions avec zombies
    for (var i = state.projectiles.length - 1; i >= 0; i--) {
      var pr = state.projectiles[i];
      pr.trail.push([pr.x, pr.y]);
      if (pr.trail.length > 8) pr.trail.shift();
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      var hitZ = false;
      for (var zi = 0; zi < state.zombies.length; zi++) {
        var z = state.zombies[zi];
        var zdx = pr.x - z.x, zdy = pr.y - z.y;
        if (Math.sqrt(zdx * zdx + zdy * zdy) < 14) {
          z.hp -= pr.dmg;
          hitZ = true;
          break;
        }
      }
      if (hitZ || pr.life <= 0 || pr.x < 0 || pr.x > WORLD || pr.y < 0 || pr.y > WORLD) {
        state.projectiles.splice(i, 1);
      }
    }
    // retirer zombies morts
    for (var zj = state.zombies.length - 1; zj >= 0; zj--) {
      if (state.zombies[zj].hp <= 0) state.zombies.splice(zj, 1);
    }
    // retirer murs détruits
    for (var wj = state.walls.length - 1; wj >= 0; wj--) {
      if (state.walls[wj].hp <= 0) state.walls.splice(wj, 1);
    }

    // caméra suit le joueur
    state.camera.x += (state.player.x - state.camera.x) * Math.min(1, dt * 6);
    state.camera.y += (state.player.y - state.camera.y) * Math.min(1, dt * 6);

    // refresh souris monde (zoom change)
    if (state.mouse.inside) {
      var w = unproj(state.mouse.sx, state.mouse.sy);
      state.mouse.wx = w[0];
      state.mouse.wy = w[1];
    }
    updateHud();
  }

  function spawnWave() {
    // des milliers de zombies : on génère une vague dense autour de la ville
    var count = ZOMBIE_PER_WAVE_BASE + state.day * 20;
    for (var i = 0; i < count; i++) {
      var side = randi(0, 3);
      var zx, zy;
      if (side === 0) { zx = rand(TOWN_MIN, TOWN_MAX); zy = TOWN_MIN - rand(200, 2000); }
      else if (side === 1) { zx = rand(TOWN_MIN, TOWN_MAX); zy = TOWN_MAX + rand(200, 2000); }
      else if (side === 2) { zx = TOWN_MIN - rand(200, 2000); zy = rand(TOWN_MIN, TOWN_MAX); }
      else { zx = TOWN_MAX + rand(200, 2000); zy = rand(TOWN_MIN, TOWN_MAX); }
      state.zombies.push({
        x: zx, y: zy, hp: ZOMBIE_HP, atkCd: 0, wallCd: 0, target: null
      });
    }
  }

  function updateZombies(dt) {
    // gestion des vagues
    if (!state.waveActive) {
      if (state.elapsed >= state.nextWaveAt) {
        spawnWave();
        state.waveActive = true;
        state.waveLeaveAt = state.elapsed + WAVE_LEAVE;
      }
    } else {
      // les zombies repartent après 10 min
      if (state.elapsed >= state.waveLeaveAt) {
        state.zombies = [];
        state.waveActive = false;
        state.nextWaveAt = state.elapsed + WAVE_EVERY;
      }
    }

    var p = state.player;
    for (var i = 0; i < state.zombies.length; i++) {
      var z = state.zombies[i];
      // cible : joueur s'il est à portée, sinon le mur le plus proche, sinon se déplace vers la ville
      var cible = null;
      var cdx = p.x - z.x, cdy = p.y - z.y;
      var distP = Math.sqrt(cdx * cdx + cdy * cdy);
      if (distP < ZOMBIE_ATTACK_RANGE) {
        cible = { type: "player", x: p.x, y: p.y };
      } else {
        // cherche un mur à portée
        var best = null, bestD = ZOMBIE_ATTACK_RANGE;
        for (var j = 0; j < state.walls.length; j++) {
          var m = state.walls[j];
          var mx = m.x + m.w / 2, my = m.y + m.h / 2;
          var md = Math.sqrt((mx - z.x) * (mx - z.x) + (my - z.y) * (my - z.y));
          if (md < bestD) { bestD = md; best = m; }
        }
        if (best) cible = { type: "wall", ref: best };
      }

      if (z.atkCd > 0) z.atkCd -= dt;
      if (z.wallCd > 0) z.wallCd -= dt;

      if (cible) {
 var cx, cy;
        if (cible.type === "player") { cx = cible.x; cy = cible.y; }
        else { cx = cible.ref.x + cible.ref.w / 2; cy = cible.ref.y + cible.ref.h / 2; }
        var dx = cx - z.x, dy = cy - z.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d > 8) {
          // avance vers la cible (moitié de la vitesse du joueur)
          z.x += (dx / d) * ZOMBIE_SPEED * dt;
          z.y += (dy / d) * ZOMBIE_SPEED * dt;
        } else {
          // à portée : attaque
          if (cible.type === "player" && z.atkCd <= 0) {
            z.atkCd = ZOMBIE_ATTACK_CD;
            p.hp -= ZOMBIE_PLAYER_DMG;
            if (p.hp <= 0) { p.hp = 0; state.gameOver = true; }
          } else if (cible.type === "wall" && z.wallCd <= 0) {
            z.wallCd = ZOMBIE_WALL_CD;
            cible.ref.hp -= ZOMBIE_WALL_DMG;
          }
        }
      } else {
        // pas de cible : converge vers le centre de la ville
        var tx = 50000 - z.x, ty = 50000 - z.y;
        var td = Math.sqrt(tx * tx + ty * ty) || 1;
        z.x += (tx / td) * ZOMBIE_SPEED * dt;
        z.y += (ty / td) * ZOMBIE_SPEED * dt;
      }
    }
  }

  /* ===================== Rendering ===================== */
  function visibleWorldBounds() {
    var pts = [
      unproj(0, 0),
      unproj(canvas.width / (window.devicePixelRatio || 1), 0),
      unproj(0, canvas.height / (window.devicePixelRatio || 1)),
      unproj(canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))
    ];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i][0] < minX) minX = pts[i][0];
      if (pts[i][1] < minY) minY = pts[i][1];
      if (pts[i][0] > maxX) maxX = pts[i][0];
      if (pts[i][1] > maxY) maxY = pts[i][1];
    }
    return { minX: minX - TS, minY: minY - TS, maxX: maxX + TS, maxY: maxY + TS };
  }

  function fillPoly(points, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  function drawGround() {
    var b = visibleWorldBounds();
    var startTX = Math.floor(b.minX / TS), endTX = Math.ceil(b.maxX / TS);
    var startTY = Math.floor(b.minY / TS), endTY = Math.ceil(b.maxY / TS);
    for (var tx = startTX; tx <= endTX; tx++) {
      for (var ty = startTY; ty <= endTY; ty++) {
        var wx = tx * TS, wy = ty * TS;
        var cx = wx + TS / 2, cy = wy + TS / 2;
        var town = inTown(cx, cy);
        var p1 = proj(wx, wy), p2 = proj(wx + TS, wy),
            p3 = proj(wx + TS, wy + TS), p4 = proj(wx, wy + TS);
        fillPoly([p1, p2, p3, p4], town ? "#3b4a5a" : "#27452a", town ? "#46566a" : "#33543a");
      }
    }
    // bordure de ville
    var c1 = proj(TOWN_MIN, TOWN_MIN), c2 = proj(TOWN_MAX, TOWN_MIN),
        c3 = proj(TOWN_MAX, TOWN_MAX), c4 = proj(TOWN_MIN, TOWN_MAX);
    fillPoly([c1, c2, c3, c4], null, "#8aa0c0");
  }

  function drawItem(it) {
    if (it.taken) return;
    var s = proj(it.x, it.y);
    var z = state.zoom;
    var r = 6 * z * 0.25;
    if (r < 1.5) r = 1.5;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(s[0], s[1], r * 1.2, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    var col = it.color || "#fbbf24";
    if (it.kind === "arme") {
      // arme : petit rectangle pixelisé + poignée
      ctx.fillStyle = col;
      ctx.fillRect(s[0] - r, s[1] - r * 0.6, r * 2, r * 0.7);
      ctx.fillStyle = "#3b2a1a";
      ctx.fillRect(s[0] - r * 0.4, s[1] - r * 0.6 + r * 0.7, r * 0.8, r * 0.5);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1;
      ctx.strokeRect(s[0] - r, s[1] - r * 0.6, r * 2, r * 0.7);
    } else {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(s[0], s[1] - r, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // reflet pixelisé
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(s[0] - r * 0.4, s[1] - r * 1.3, r * 0.4, r * 0.4);
    }
    ctx.restore();
  }

  function drawTree(t) {
    var s = proj(t.x, t.y);
    var z = state.zoom;
    var r = t.r * 0.25 * z;
    if (r < 2) r = 2;
    ctx.save();
    // ombre
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(s[0], s[1], r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // tronc pixelisé
    var trunkW = Math.max(2, r * 0.3);
    var trunkH = Math.max(4, r * 0.9);
    ctx.fillStyle = "#5b3a1f";
    ctx.fillRect(s[0] - trunkW / 2, s[1] - trunkH, trunkW, trunkH);
    // feuillage : blocs pixelisés pour l'effet pixel
    var foliage = t.kind === "town" ? "#2f7d32" : (t.kind === "edge" ? "#3b8a3e" : "#256b2a");
    var dark = t.kind === "town" ? "#22611f" : (t.kind === "edge" ? "#2d6e2f" : "#1c5020");
    var cy = s[1] - trunkH - r * 0.5;
    // forme globale
    ctx.fillStyle = foliage;
    ctx.beginPath();
    ctx.arc(s[0], cy, r, 0, Math.PI * 2);
    ctx.fill();
    // blocs pixels
    var cell = Math.max(2, r * 0.28);
    for (var py = -1; py <= 1; py++) {
      for (var px = -2; px <= 2; px++) {
        if (Math.abs(px) + Math.abs(py) > 2) continue;
        if (((px + py) & 1) === 0) ctx.fillStyle = dark; else ctx.fillStyle = foliage;
        ctx.fillRect(s[0] + px * cell - cell / 2, cy + py * cell - cell / 2, cell, cell);
      }
    }
    ctx.restore();
  }

  function drawBuilding(b) {
    var z = state.zoom;
    var hPx = b.height * 0.25 * z;
    var A = proj(b.x, b.y), B = proj(b.x + b.w, b.y),
        C = proj(b.x + b.w, b.y + b.h), D = proj(b.x, b.y + b.h);
    var At = [A[0], A[1] - hPx], Bt = [B[0], B[1] - hPx],
        Ct = [C[0], C[1] - hPx], Dt = [D[0], D[1] - hPx];

    // murs avant (face +x : B,C,Ct,Bt ; face +y : D,C,Ct,Dt)
    fillPoly([B, C, Ct, Bt], "#5b6b8a", "#3b4860");
    fillPoly([D, C, Ct, Dt], "#6b7c9a", "#46546e");
    // toit
    fillPoly([At, Bt, Ct, Dt], "#8a99b8", "#5a6b88");

    // porte
    var door = proj(b.door.x, b.door.y);
    var dw = 12 * z * 0.25, dh = 26 * z * 0.25;
    if (dw < 3) dw = 3; if (dh < 6) dh = 6;
    ctx.fillStyle = "#3b2a1a";
    ctx.fillRect(door[0] - dw / 2, door[1] - dh, dw, dh);
    ctx.strokeStyle = "#d9a441";
    ctx.lineWidth = 1;
    ctx.strokeRect(door[0] - dw / 2, door[1] - dh, dw, dh);
  }

  /* Sprite joueur pixelisé (6 large x 15 haut) */
  var PLAYER_SPRITE = [
    "..hh..",
    ".hhhh.",
    ".hhhh.",
    ".ssss.",
    ".s..s.",
    ".ssss.",
    "bbbbbb",
    "bbbbbb",
    ".bbbb.",
    ".pppp.",
    ".pppp.",
    ".pppp.",
    ".pppp.",
    ".p..p.",
    ".f..f."
  ];
  var PAL = {
    h: "#3b2a1a", s: "#e8b98a", b: "#6366f1",
    p: "#334155", f: "#1f2937"
  };

  function drawPlayer() {
    var p = state.player;
    var base = proj(p.x, p.y);
    var z = state.zoom;
    var cell = z * 0.5;
    if (cell < 1.2) cell = 1.2;
    var cols = 6, rows = 15;
    var ox = base[0] - (cols / 2) * cell;
    var oy = base[1] - rows * cell;

    // ombre
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], cols / 2 * cell, cell * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (var r = 0; r < rows; r++) {
      var line = PLAYER_SPRITE[r];
      for (var c = 0; c < cols; c++) {
        var ch = line.charAt(c);
        if (ch === "." ) continue;
        var cc = p.face < 0 ? (cols - 1 - c) : c;
        ctx.fillStyle = PAL[ch];
        ctx.fillRect(ox + cc * cell, oy + r * cell, cell + 0.5, cell + 0.5);
      }
    }
  }

  function drawProjectiles() {
    for (var i = 0; i < state.projectiles.length; i++) {
      var pr = state.projectiles[i];
      var col = pr.color || "#fff7ad";
      for (var t = 0; t < pr.trail.length; t++) {
        var s = proj(pr.trail[t][0], pr.trail[t][1]);
        var a = (t / pr.trail.length) * 0.6;
        ctx.globalAlpha = a;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(s[0], s[1], 2 + t * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      var h = proj(pr.x, pr.y);
      var rad = 2 + (pr.dmg || 1) * 0.8;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(h[0], h[1], rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(15,23,42,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawFog() {
    var p = state.player;
    if (inTown(p.x, p.y)) return;
    var s = proj(p.x, p.y);
    var z = state.zoom;
    var rx = FOG_RADIUS * 0.5 * z * 2;
    var ry = FOG_RADIUS * 0.25 * z * 2;
    var W = canvas.width / (window.devicePixelRatio || 1);
    var H = canvas.height / (window.devicePixelRatio || 1);
    var grad = ctx.createRadialGradient(s[0], s[1], Math.min(rx, ry) * 0.5, s[0], s[1], Math.max(rx, ry) * 1.3);
    grad.addColorStop(0, "rgba(2,6,23,0)");
    grad.addColorStop(0.6, "rgba(2,6,23,0.55)");
    grad.addColorStop(1, "rgba(2,6,23,0.97)");
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawCrosshair() {
    if (!state.mouse.inside) return;
    var s = proj(state.mouse.wx, state.mouse.wy);
    ctx.save();
    ctx.strokeStyle = "rgba(129,140,248,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s[0], s[1], 5, 0, Math.PI * 2);
    ctx.moveTo(s[0] - 9, s[1]); ctx.lineTo(s[0] - 3, s[1]);
    ctx.moveTo(s[0] + 3, s[1]); ctx.lineTo(s[0] + 9, s[1]);
    ctx.moveTo(s[0], s[1] - 9); ctx.lineTo(s[0], s[1] - 3);
    ctx.moveTo(s[0], s[1] + 3); ctx.lineTo(s[0], s[1] + 9);
    ctx.stroke();
    ctx.restore();
  }

  function drawWall(m) {
    var z = state.zoom;
    var A = proj(m.x, m.y), B = proj(m.x + m.w, m.y),
        C = proj(m.x + m.w, m.y + m.h), D = proj(m.x, m.y + m.h);
    var hPx = Math.max(8, 18 * 0.25 * z);
    var At = [A[0], A[1] - hPx], Bt = [B[0], B[1] - hPx],
        Ct = [C[0], C[1] - hPx], Dt = [D[0], D[1] - hPx];
    // faces
    fillPoly([B, C, Ct, Bt], "#8a6a3a", "#5a3e1c");
    fillPoly([D, C, Ct, Dt], "#a07a45", "#6b4f24");
    // dessus (planche)
    fillPoly([At, Bt, Ct, Dt], "#caa45f", "#7a5a2c");
    // barre de vie sous le mur
    var hp = m.hp, ratio = hp / WALL_MAX_HP;
    var col = ratio < 0.10 ? "#ef4444" : (ratio < 0.30 ? "#f59e0b" : "#22c55e");
    var cx = (A[0] + C[0]) / 2, by = (A[1] + C[1]) / 2;
    var bw = Math.max(18, m.w * 0.25 * z);
    if (m.orient === "v") bw = Math.max(18, m.h * 0.25 * z);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(cx - bw / 2 - 1, by - 2, bw + 2, 5);
    ctx.fillStyle = col;
    ctx.fillRect(cx - bw / 2, by - 1, bw * ratio, 3);
  }

  var ZOMBIE_SPRITE = [
    "..hh..",
    ".hhhh.",
    ".hhhh.",
    ".ssss.",
    ".s..s.",
    ".ssss.",
    "gggggg",
    "gggggg",
    ".gggg.",
    ".pppp.",
    ".pppp.",
    ".pppp.",
    ".p..p.",
    ".p..p.",
    ".f..f."
  ];
  var ZPAL = {
    h: "#4b6b3a", s: "#9bbf8a", g: "#5b7a4a",
    p: "#3a4a30", f: "#26331f"
  };

  function drawZombie(z) {
    var base = proj(z.x, z.y);
    var zoom = state.zoom;
    var cell = zoom * 0.5;
    if (cell < 1.2) cell = 1.2;
    var cols = 6, rows = 15;
    var ox = base[0] - (cols / 2) * cell;
    var oy = base[1] - rows * cell;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], cols / 2 * cell, cell * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    for (var r = 0; r < rows; r++) {
      var line = ZOMBIE_SPRITE[r];
      for (var c = 0; c < cols; c++) {
        var ch = line.charAt(c);
        if (ch === ".") continue;
        ctx.fillStyle = ZPAL[ch];
        ctx.fillRect(ox + c * cell, oy + r * cell, cell + 0.5, cell + 0.5);
      }
    }
    ctx.restore();
  }

  function drawClock() {
    var W = canvas.width / (window.devicePixelRatio || 1);
    var h = Math.floor(state.clock);
    var m = Math.floor((state.clock - h) * 60);
    var hh = h < 10 ? "0" + h : "" + h;
    var mm = m < 10 ? "0" + m : "" + m;
    var night = isNight(state.clock);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = night ? "#1e293b" : "#fef3c7";
    ctx.font = "bold 22px Segoe UI, system-ui, sans-serif";
    ctx.fillText((night ? "🌙 " : "☀ ") + hh + ":" + mm, W / 2, 12);
    if (state.waveActive) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
      ctx.fillText("⚠ Vague de zombies", W / 2, 40);
    }
    // compteur de jours en haut à droite
    ctx.textAlign = "right";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Jour " + state.day, W - 14, 14);
    ctx.restore();
  }

  function drawPlayerHpBar() {
    var p = state.player;
    var base = proj(p.x, p.y);
    var z = state.zoom;
    var w = 28, h = 4;
    var ratio = p.hp / PLAYER_MAX_HP;
    var col = ratio < 0.30 ? "#ef4444" : (ratio < 0.60 ? "#f59e0b" : "#22c55e");
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(base[0] - w / 2 - 1, base[1] - 24 * z * 0.5 - h - 2, w + 2, h + 2);
    ctx.fillStyle = col;
    ctx.fillRect(base[0] - w / 2, base[1] - 24 * z * 0.5 - h - 1, w * ratio, h);
    ctx.restore();
  }

  function drawBuildHint() {
    if (!state.buildMode || !state.mouse.inside) return;
    var s = proj(state.mouse.wx, state.mouse.wy);
    ctx.save();
    ctx.strokeStyle = state.planks >= WALL_PLANKS ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(s[0] - 30, s[1] - 18, 60, 36);
    ctx.setLineDash([]);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.planks >= WALL_PLANKS ?
      "Construire (" + state.planks + " planches)" :
      "Pas assez de planches (" + state.planks + "/" + WALL_PLANKS + ")", s[0], s[1] - 26);
    ctx.restore();
  }

  function drawGameOver() {
    if (!state.gameOver) return;
    var W = canvas.width / (window.devicePixelRatio || 1);
    var H = canvas.height / (window.devicePixelRatio || 1);
    ctx.save();
    ctx.fillStyle = "rgba(2,6,23,0.8)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 40px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Vous êtes mort", W / 2, H / 2 - 20);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "18px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Vous avez survécu jusqu'au jour " + state.day, W / 2, H / 2 + 20);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Rechargez la page pour recommencer", W / 2, H / 2 + 48);
    ctx.restore();
  }

  function bagLayout() {
    var W = canvas.width / (window.devicePixelRatio || 1);
    var H = canvas.height / (window.devicePixelRatio || 1);
    var pw = Math.min(460, W - 40), ph = Math.min(420, H - 60);
    var px = (W - pw) / 2, py = (H - ph) / 2;
    var listY = py + 96;
    var lineH = 30;
    var maxLines = Math.floor((ph - 112) / lineH);
    return { W: W, H: H, px: px, py: py, pw: pw, ph: ph, listY: listY, lineH: lineH, maxLines: maxLines };
  }

  function drawBag() {
    var L = bagLayout();
    var W = L.W, H = L.H, px = L.px, py = L.py, pw = L.pw, ph = L.ph;
    ctx.save();
    ctx.fillStyle = "rgba(2,6,23,0.7)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    roundRect(px, py, pw, ph, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#818cf8";
    ctx.font = "bold 20px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Sac de " + state.playerName, px + 18, py + 34);

    // arme équipée + stats
    var eq = state.equipped || "Mains nues";
    var st = equippedStats();
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Équipé : " + eq, px + 18, py + 56);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Segoe UI, system-ui, sans-serif";
    ctx.fillText("dégâts " + st.dmg + " · portée " + Math.round(st.speed * st.life) +
                  " · cadence " + (1 / st.cd).toFixed(1) + "/s · dispersion " + Math.round(st.spread * 100) + "%",
                  px + 18, py + 74);
    ctx.textAlign = "right";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Segoe UI, system-ui, sans-serif";
    ctx.fillText("A fermer · clic sur une arme = équiper", px + pw - 18, py + 34);

    // liste des objets
    var listY = L.listY, lineH = L.lineH;
    ctx.font = "15px Segoe UI, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    var n = state.bag.contents.length;
    var shown = Math.min(n, L.maxLines);
    if (n === 0) {
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText("(vide — ramassez des objets et armes au sol)", px + 18, listY + 12);
    }
    for (var i = 0; i < shown; i++) {
      var it = state.bag.contents[i];
      var ly = listY + i * lineH + 14;
      var isEq = (it.kind === "arme") && (it.name === state.equipped);
      // ligne de fond si équipée
      if (isEq) {
        ctx.fillStyle = "rgba(251,191,36,0.16)";
        ctx.fillRect(px + 10, ly - lineH / 2 + 2, pw - 20, lineH - 4);
      }
      // icône pixel
      ctx.fillStyle = it.color || "#fbbf24";
      if (it.kind === "arme") {
        ctx.fillRect(px + 20, ly - 6, 16, 7);
        ctx.fillStyle = "#3b2a1a";
        ctx.fillRect(px + 26, ly + 1, 5, 6);
      } else {
        ctx.beginPath();
        ctx.arc(px + 28, ly - 2, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = isEq ? "#fbbf24" : "#f1f5f9";
      ctx.textAlign = "left";
      ctx.fillText(it.name + (isEq ? "  (équipé)" : ""), px + 50, ly);
      ctx.fillStyle = it.kind === "arme" ? "#818cf8" : "#64748b";
      ctx.textAlign = "right";
      var suffix = it.kind === "arme" ? "arme (clic pour équiper)" : it.kind;
      ctx.fillText(suffix, px + pw - 18, ly);
    }
    ctx.restore();
  }

  function handleBagClick(sx, sy) {
    var L = bagLayout();
    var n = state.bag.contents.length;
    var shown = Math.min(n, L.maxLines);
    for (var i = 0; i < shown; i++) {
      var ly = L.listY + i * L.lineH + 14;
      if (sy >= ly - L.lineH / 2 && sy < ly + L.lineH / 2 &&
          sx >= L.px && sx <= L.px + L.pw) {
        var it = state.bag.contents[i];
        if (it.kind === "arme") {
          state.equipped = (state.equipped === it.name) ? null : it.name;
        }
        return;
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function render() {
    var W = canvas.width / (window.devicePixelRatio || 1);
    var H = canvas.height / (window.devicePixelRatio || 1);
    // fond selon l'heure (jour/nuit)
    var night = isNight(state.clock);
    ctx.fillStyle = night ? "#0a1020" : "#0e1a30";
    ctx.fillRect(0, 0, W, H);

    if (!state.started) return;

    drawGround();

    // objets au sol
    for (var i = 0; i < state.items.length; i++) drawItem(state.items[i]);

    // bâtiments, arbres, murs, zombies triés ensemble (loin -> près)
    var drawables = [];
    for (var bi = 0; bi < state.buildings.length; bi++) {
      var bld = state.buildings[bi];
      drawables.push({ depth: bld.x + bld.y, type: "building", ref: bld });
    }
    var bnds = visibleWorldBounds();
    for (var ti = 0; ti < state.trees.length; ti++) {
      var tr = state.trees[ti];
      if (tr.x < bnds.minX || tr.x > bnds.maxX || tr.y < bnds.minY || tr.y > bnds.maxY) continue;
      drawables.push({ depth: tr.x + tr.y, type: "tree", ref: tr });
    }
    for (var wi = 0; wi < state.walls.length; wi++) {
      var m = state.walls[wi];
      drawables.push({ depth: m.x + m.y, type: "wall", ref: m });
    }
    for (var zi = 0; zi < state.zombies.length; zi++) {
      var zb = state.zombies[zi];
      if (zb.x < bnds.minX || zb.x > bnds.maxX || zb.y < bnds.minY || zb.y > bnds.maxY) continue;
      drawables.push({ depth: zb.x + zb.y, type: "zombie", ref: zb });
    }
    var pDepth = state.player.x + state.player.y;

    drawables.sort(function (a, b) { return a.depth - b.depth; });

    var drewPlayer = false;
    for (var k = 0; k < drawables.length; k++) {
      var d = drawables[k];
      if (!drewPlayer && pDepth < d.depth) {
        drawPlayer();
        drawPlayerHpBar();
        drewPlayer = true;
      }
      if (d.type === "building") drawBuilding(d.ref);
      else if (d.type === "tree") drawTree(d.ref);
      else if (d.type === "wall") drawWall(d.ref);
      else if (d.type === "zombie") drawZombie(d.ref);
    }
    if (!drewPlayer) { drawPlayer(); drawPlayerHpBar(); }

    drawProjectiles();
    drawFog();
    drawCrosshair();
    drawBuildHint();
    drawClock();

    if (state.bag.open) drawBag();

    if (state.paused) {
      ctx.fillStyle = "rgba(2,6,23,0.4)";
      ctx.fillRect(0, 0, W, H);
    }

    drawGameOver();
  }

  /* ===================== Loop ===================== */
  var last = performance.now();
  function loop(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (state.started) update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

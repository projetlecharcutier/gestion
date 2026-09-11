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
  var PROJ_SPEED = 700;
  var PROJ_LIFE = 1.6;
  var SHOOT_COOLDOWN = 0.18;
  var TS = 1000;       // taille de tuile (px monde)

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
    inBuilding: null,
    playerName: "",
    player: { x: 50000, y: 50000, face: 1, moving: false },
    camera: { x: 50000, y: 50000 },
    zoom: 8,
    targetZoom: 8,
    mouse: { sx: 0, sy: 0, wx: 50000, wy: 50000, inside: false },
    inventory: 0,
    items: [],
    buildings: [],
    trees: [],
    bag: { open: false, contents: [] },
    projectiles: [],
    keys: {},
    shootCd: 0,
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

  function buildWorld() {
    var c = 50000;
    // Bâtiments plus petits, échelle réduite à la nouvelle ville (5000x5000)
    state.buildings = [
      makeBuilding(c - 2100, c - 2100, 700, 700, "Mairie", "Vous êtes à la mairie. Tout semble calme.", 380),
      makeBuilding(c + 1400, c - 2000, 650, 650, "Auberge", "L'auberge sent la soupe chaude. Repos bien mérité.", 330),
      makeBuilding(c - 2000, c + 1300, 650, 650, "Forge", "La forge résonne du bruit de l'enclume.", 360),
      makeBuilding(c + 1500, c + 1400, 700, 600, "Marché", "Le marché grouille de marchandises.", 300),
      makeBuilding(c - 750, c + 1600, 550, 450, "Temple", "Le temple est silencieux et frais.", 440),
      makeBuilding(c + 600, c - 1500, 500, 550, "Tour", "La vue depuis la tour couvre toute la ville.", 600)
    ];

    // Objets + armes au sol
    state.items = [
      { x: c - 400, y: c + 100, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c + 450, y: c - 300, taken: false, name: "Gemme", color: "#22d3ee", kind: "objet" },
      { x: c - 1000, y: c - 900, taken: false, name: "Potion", color: "#ef4444", kind: "objet" },
      { x: c + 1100, y: c + 600, taken: false, name: "Clé", color: "#eab308", kind: "objet" },
      { x: c + 200, y: c + 1200, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      { x: c - 1600, y: c + 400, taken: false, name: "Gemme", color: "#22d3ee", kind: "objet" },
      { x: c + 1700, y: c - 700, taken: false, name: "Parchemin", color: "#fde68a", kind: "objet" },
      { x: c - 600, y: c - 1300, taken: false, name: "Pièce", color: "#fbbf24", kind: "objet" },
      // armes dans et autour de la ville
      { x: c - 1900, y: c - 1800, taken: false, name: "Pistolet", color: "#94a3b8", kind: "arme" },
      { x: c + 2000, y: c + 1500, taken: false, name: "Fusil", color: "#64748b", kind: "arme" },
      { x: TOWN_MIN - 2200, y: c + 300, taken: false, name: "Arc", color: "#a16207", kind: "arme" },
      { x: TOWN_MAX + 1800, y: c - 600, taken: false, name: "Couteau", color: "#cbd5e1", kind: "arme" },
      { x: c - 1100, y: TOWN_MAX + 1900, taken: false, name: "Bâton", color: "#7c5e3c", kind: "arme" },
      { x: c + 1200, y: TOWN_MIN - 2100, taken: false, name: "Pistolet", color: "#94a3b8", kind: "arme" },
      // objets rares hors ville
      { x: TOWN_MIN - 6000, y: TOWN_MIN - 4000, taken: false, name: "Relique", color: "#a855f7", kind: "objet" },
      { x: TOWN_MAX + 7000, y: TOWN_MAX + 5000, taken: false, name: "Cristal", color: "#38bdf8", kind: "objet" },
      { x: c, y: TOWN_MIN - 8000, taken: false, name: "Gemme", color: "#22d3ee", kind: "objet" },
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
      if (tries < 12) state.trees.push({ x: tx, y: ty, r: rand(70, 110), kind: "town" });
    }
    // beaucoup d'arbres hors ville (forêt dense)
    for (i = 0; i < 700; i++) {
      var edge = Math.random() < 0.5;
      if (edge) {
        tx = rand(0, WORLD);
        ty = Math.random() < 0.5 ? rand(0, TOWN_MIN - 200) : rand(TOWN_MAX + 200, WORLD);
      } else {
        tx = Math.random() < 0.5 ? rand(0, TOWN_MIN - 200) : rand(TOWN_MAX + 200, WORLD);
        ty = rand(0, WORLD);
      }
      state.trees.push({ x: tx, y: ty, r: rand(90, 180), kind: "wild" });
    }
    // arbres en bordure immédiate de la ville
    for (i = 0; i < 200; i++) {
      var side = randi(0, 3);
      if (side === 0) { tx = rand(TOWN_MIN, TOWN_MAX); ty = rand(TOWN_MIN - 1400, TOWN_MIN - 100); }
      else if (side === 1) { tx = rand(TOWN_MIN, TOWN_MAX); ty = rand(TOWN_MAX + 100, TOWN_MAX + 1400); }
      else if (side === 2) { tx = rand(TOWN_MIN - 1400, TOWN_MIN - 100); ty = rand(TOWN_MIN, TOWN_MAX); }
      else { tx = rand(TOWN_MAX + 100, TOWN_MAX + 1400); ty = rand(TOWN_MIN, TOWN_MAX); }
      state.trees.push({ x: tx, y: ty, r: rand(80, 140), kind: "edge" });
    }
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
    if (!state.started || state.paused || state.inBuilding) return;
    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;
    var w = unproj(sx, sy);
    var p = state.player;

    // 1) porte de bâtiment
    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      var ddx = w[0] - b.door.x, ddy = w[1] - b.door.y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < 80) {
        var pdx = p.x - b.door.x, pdy = p.y - b.door.y;
        if (Math.sqrt(pdx * pdx + pdy * pdy) < 160) {
          enterBuilding(b);
          return;
        }
      }
    }

    // 2) ramassage d'objet / arme -> va dans le sac
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
      if (state.started && !state.paused && !state.inBuilding) {
        state.bag.open = !state.bag.open;
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

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ===================== HUD ===================== */
  function updateHud() {
    hudName.textContent = state.playerName;
    var p = state.player;
    hudZone.textContent = inTown(p.x, p.y) ? "Ville" : "Hors ville";
    hudPos.textContent = "(" + Math.round(p.x) + ", " + Math.round(p.y) + ")";
    hudInv.textContent = String(state.inventory);
  }

  /* ===================== Update ===================== */
  function update(dt) {
    state.time += dt;
    state.zoom += (state.targetZoom - state.zoom) * Math.min(1, dt * 12);

    if (state.shootCd > 0) state.shootCd -= dt;

    if (!state.inBuilding && !state.paused && !state.bag.open) {
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

      // tir
      if (state.keys.space && state.shootCd <= 0) {
        state.shootCd = SHOOT_COOLDOWN;
        var ax = tx - p.x, ay = ty - p.y;
        var al = Math.sqrt(ax * ax + ay * ay) || 1;
        state.projectiles.push({
          x: p.x, y: p.y - PLAYER_H * 0.5,
          vx: (ax / al) * PROJ_SPEED,
          vy: (ay / al) * PROJ_SPEED,
          life: PROJ_LIFE,
          trail: []
        });
        if (state.projectiles.length > 60) state.projectiles.shift();
      }
    }

    // projectiles
    for (var i = state.projectiles.length - 1; i >= 0; i--) {
      var pr = state.projectiles[i];
      pr.trail.push([pr.x, pr.y]);
      if (pr.trail.length > 8) pr.trail.shift();
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0 || pr.x < 0 || pr.x > WORLD || pr.y < 0 || pr.y > WORLD) {
        state.projectiles.splice(i, 1);
      }
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
      for (var t = 0; t < pr.trail.length; t++) {
        var s = proj(pr.trail[t][0], pr.trail[t][1]);
        var a = (t / pr.trail.length) * 0.6;
        ctx.fillStyle = "rgba(250,204,21," + a + ")";
        ctx.beginPath();
        ctx.arc(s[0], s[1], 2 + t * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      var h = proj(pr.x, pr.y);
      ctx.fillStyle = "#fff7ad";
      ctx.beginPath();
      ctx.arc(h[0], h[1], 3, 0, Math.PI * 2);
      ctx.fill();
    }
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

  function drawBag() {
    var W = canvas.width / (window.devicePixelRatio || 1);
    var H = canvas.height / (window.devicePixelRatio || 1);
    ctx.save();
    ctx.fillStyle = "rgba(2,6,23,0.7)";
    ctx.fillRect(0, 0, W, H);

    var pw = Math.min(460, W - 40), ph = Math.min(420, H - 60);
    var px = (W - pw) / 2, py = (H - ph) / 2;
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
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Segoe UI, system-ui, sans-serif";
    ctx.fillText("A pour fermer · " + state.bag.contents.length + " objet(s)", px + 18, py + 54);

    // liste des objets
    var listY = py + 76;
    var lineH = 30;
    ctx.font = "15px Segoe UI, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    var n = state.bag.contents.length;
    var maxLines = Math.floor((ph - 90) / lineH);
    var shown = Math.min(n, maxLines);
    if (n === 0) {
      ctx.fillStyle = "#64748b";
      ctx.fillText("(vide — ramassez des objets et armes au sol)", px + 18, listY + 12);
    }
    for (var i = 0; i < shown; i++) {
      var it = state.bag.contents[i];
      var ly = listY + i * lineH + 14;
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
      ctx.fillStyle = "#f1f5f9";
      ctx.textAlign = "left";
      ctx.fillText(it.name, px + 50, ly);
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "right";
      ctx.fillText(it.kind, px + pw - 18, ly);
    }
    ctx.restore();
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
    ctx.fillStyle = "#0e1a30";
    ctx.fillRect(0, 0, W, H);

    if (!state.started) return;

    drawGround();

    // objets au sol
    for (var i = 0; i < state.items.length; i++) drawItem(state.items[i]);

    // bâtiments et arbres triés ensemble (loin -> près) pour un rendu correct
    var drawables = [];
    for (var bi = 0; bi < state.buildings.length; bi++) {
      var bld = state.buildings[bi];
      drawables.push({ depth: bld.x + bld.y, type: "building", ref: bld });
    }
    // trier et dessiner arbres visibles uniquement
    var bnds = visibleWorldBounds();
    for (var ti = 0; ti < state.trees.length; ti++) {
      var tr = state.trees[ti];
      if (tr.x < bnds.minX || tr.x > bnds.maxX || tr.y < bnds.minY || tr.y > bnds.maxY) continue;
      drawables.push({ depth: tr.x + tr.y, type: "tree", ref: tr });
    }
    // joueur inséré à sa propre profondeur pour cohérence
    var pDepth = state.player.x + state.player.y;

    drawables.sort(function (a, b) { return a.depth - b.depth; });

    var drewPlayer = false;
    for (var k = 0; k < drawables.length; k++) {
      var d = drawables[k];
      if (!drewPlayer && pDepth < d.depth) {
        drawPlayer();
        drewPlayer = true;
      }
      if (d.type === "building") drawBuilding(d.ref);
      else drawTree(d.ref);
    }
    if (!drewPlayer) drawPlayer();

    drawProjectiles();
    drawFog();
    drawCrosshair();

    if (state.bag.open) drawBag();

    if (state.paused) {
      ctx.fillStyle = "rgba(2,6,23,0.4)";
      ctx.fillRect(0, 0, W, H);
    }
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

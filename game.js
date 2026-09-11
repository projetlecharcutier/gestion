(function () {
  "use strict";

  /* ===================== Config ===================== */
  var WORLD = 100000;          // carte 100000 x 100000 px
  var TOWN = 10000;            // ville 10000 x 10000 px
  var TOWN_MIN = (WORLD - TOWN) / 2; // 45000
  var TOWN_MAX = TOWN_MIN + TOWN;    // 55000

  var PLAYER_W = 6;   // personnage : 6 px de large
  var PLAYER_H = 15;  // 15 px de haut (pixelisé)
  var PLAYER_HALF = 3;
  var SPEED = 260;    // px monde / sec
  var FOG_RADIUS = 50; // visibilité hors ville (px monde)
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
    zoom: 4,
    targetZoom: 4,
    mouse: { sx: 0, sy: 0, wx: 50000, wy: 50000, inside: false },
    inventory: 0,
    items: [],
    buildings: [],
    projectiles: [],
    keys: {},
    shootCd: 0,
    time: 0
  };

  /* ===================== Buildings ===================== */
  function makeBuilding(x, y, w, h, name, msg, height) {
    return {
      x: x, y: y, w: w, h: h,
      name: name, msg: msg, height: height || 500,
      door: { x: x + w / 2, y: y + h } // porte au centre de la face avant
    };
  }

  function buildWorld() {
    var c = 50000;
    state.buildings = [
      makeBuilding(c - 4200, c - 4200, 1400, 1400, "Mairie", "Vous êtes à la mairie. Tout semble calme.", 700),
      makeBuilding(c + 2800, c - 4000, 1300, 1300, "Auberge", "L'auberge sent la soupe chaude. Repos bien mérité.", 600),
      makeBuilding(c - 4000, c + 2600, 1300, 1300, "Forge", "La forge résonne du bruit de l'enclume.", 650),
      makeBuilding(c + 3000, c + 2800, 1400, 1200, "Marché", "Le marché grouille de marchandises.", 550),
      makeBuilding(c - 1500, c + 3200, 1100, 900, "Temple", "Le temple est silencieux et frais.", 800),
      makeBuilding(c + 1200, c - 3000, 1000, 1100, "Tour", "La vue depuis la tour couvre toute la ville.", 1100)
    ];

    state.items = [
      { x: c - 800, y: c + 200, taken: false, name: "Pièce" },
      { x: c + 900, y: c - 600, taken: false, name: "Gemme" },
      { x: c - 2000, y: c - 1800, taken: false, name: "Potion" },
      { x: c + 2200, y: c + 1200, taken: false, name: "Clé" },
      { x: c + 400, y: c + 2400, taken: false, name: "Pièce" },
      { x: c - 3200, y: c + 800, taken: false, name: "Gemme" },
      { x: c + 3400, y: c - 1400, taken: false, name: "Parchemin" },
      { x: c - 1200, y: c - 2600, taken: false, name: "Pièce" },
      { x: c + 1800, y: c + 3000, taken: false, name: "Gemme" },
      { x: c - 3600, y: c - 3600, taken: false, name: "Potion" },
      { x: TOWN_MIN - 1400, y: c, taken: false, name: "Relique" },
      { x: TOWN_MAX + 1200, y: c - 400, taken: false, name: "Cristal" },
      { x: c, y: TOWN_MIN - 1600, taken: false, name: "Pièce" },
      { x: c + 600, y: TOWN_MAX + 1300, taken: false, name: "Gemme" }
    ];
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

    // 2) ramassage d'objet
    for (var j = 0; j < state.items.length; j++) {
      var it = state.items[j];
      if (it.taken) continue;
      var ix = w[0] - it.x, iy = w[1] - it.y;
      var od = Math.sqrt(ix * ix + iy * iy);
      if (od < 70) {
        var px = p.x - it.x, py = p.y - it.y;
        if (Math.sqrt(px * px + py * py) < 120) {
          it.taken = true;
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
    state.targetZoom = clamp(state.targetZoom * factor, 0.5, 24);
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") {
      e.preventDefault();
      state.keys.space = true;
    }
    if (e.code === "Escape") {
      if (state.started) togglePause();
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

    if (!state.inBuilding && !state.paused) {
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
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(s[0], s[1] - r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 1;
    ctx.stroke();
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

  function render() {
    var W = canvas.width / (window.devicePixelRatio || 1);
    var H = canvas.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = "#0e1a30";
    ctx.fillRect(0, 0, W, H);

    if (!state.started) return;

    drawGround();

    // objets au sol (avant les bâtiments)
    for (var i = 0; i < state.items.length; i++) drawItem(state.items[i]);

    // bâtiments triés (loin -> près)
    var sorted = state.buildings.slice().sort(function (a, b) {
      return (a.x + a.y) - (b.x + b.y);
    });
    for (var j = 0; j < sorted.length; j++) drawBuilding(sorted[j]);

    drawPlayer();
    drawProjectiles();
    drawFog();
    drawCrosshair();

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

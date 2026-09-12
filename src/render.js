// Rendu : sol, objets, arbres, bâtiments, murs, zombies, joueur, projectiles, brouillard, viseur + render().
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.fillPoly = function (points, fill, stroke) {
    var ctx = G.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };

  G.roundRect = function (x, y, w, h, r) {
    var ctx = G.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  G.drawGround = function () {
    var ctx = G.ctx;
    var tx_ = G.TEXTURES.ground;
    var b = G.visibleWorldBounds();
    var startTX = Math.floor(b.minX / G.TS), endTX = Math.ceil(b.maxX / G.TS);
    var startTY = Math.floor(b.minY / G.TS), endTY = Math.ceil(b.maxY / G.TS);
    for (var tx = startTX; tx <= endTX; tx++) {
      for (var ty = startTY; ty <= endTY; ty++) {
        var wx = tx * G.TS, wy = ty * G.TS;
        var cx = wx + G.TS / 2, cy = wy + G.TS / 2;
        var town = G.inTown(cx, cy);
        var tile = town ? tx_.town : tx_.wild;
        var p1 = G.proj(wx, wy), p2 = G.proj(wx + G.TS, wy),
            p3 = G.proj(wx + G.TS, wy + G.TS), p4 = G.proj(wx, wy + G.TS);
        G.fillPoly([p1, p2, p3, p4], tile.fill, tile.stroke);
      }
    }
    var c1 = G.proj(G.TOWN_MIN, G.TOWN_MIN), c2 = G.proj(G.TOWN_MAX, G.TOWN_MIN),
        c3 = G.proj(G.TOWN_MAX, G.TOWN_MAX), c4 = G.proj(G.TOWN_MIN, G.TOWN_MAX);
    G.fillPoly([c1, c2, c3, c4], null, tx_.border);
  };

  G.drawItem = function (it) {
    if (it.taken) return;
    var ctx = G.ctx;
    var t = G.TEXTURES.item;
    var s = G.proj(it.x, it.y);
    var z = G.state.zoom;
    var r = 6 * z * 0.25;
    if (r < 1.5) r = 1.5;
    ctx.save();
    ctx.fillStyle = t.shadow;
    ctx.beginPath();
    ctx.ellipse(s[0], s[1], r * 1.2, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    var col = it.color || t.defaultColor;
    if (it.kind === "arme") {
      ctx.fillStyle = col;
      ctx.fillRect(s[0] - r, s[1] - r * 0.6, r * 2, r * 0.7);
      ctx.fillStyle = t.weaponHandle;
      ctx.fillRect(s[0] - r * 0.4, s[1] - r * 0.6 + r * 0.7, r * 0.8, r * 0.5);
      ctx.strokeStyle = t.weaponStroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(s[0] - r, s[1] - r * 0.6, r * 2, r * 0.7);
    } else {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(s[0], s[1] - r, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = t.stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = t.shine;
      ctx.fillRect(s[0] - r * 0.4, s[1] - r * 1.3, r * 0.4, r * 0.4);
    }
    ctx.restore();
  };

  G.drawTree = function (t) {
    var ctx = G.ctx;
    var tx_ = G.TEXTURES.tree;
    var s = G.proj(t.x, t.y);
    var z = G.state.zoom;
    var r = t.r * 0.25 * z;
    if (r < 2) r = 2;
    ctx.save();
    ctx.fillStyle = tx_.shadow;
    ctx.beginPath();
    ctx.ellipse(s[0], s[1], r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    var trunkW = Math.max(2, r * 0.3);
    var trunkH = Math.max(4, r * 0.9);
    ctx.fillStyle = tx_.trunk;
    ctx.fillRect(s[0] - trunkW / 2, s[1] - trunkH, trunkW, trunkH);
    var fol = tx_.foliage[t.kind] || tx_.foliage.wild;
    var foliage = fol.light;
    var dark = fol.dark;
    var cy = s[1] - trunkH - r * 0.5;
    ctx.fillStyle = foliage;
    ctx.beginPath();
    ctx.arc(s[0], cy, r, 0, Math.PI * 2);
    ctx.fill();
    var cell = Math.max(2, r * 0.28);
    for (var py = -1; py <= 1; py++) {
      for (var px = -2; px <= 2; px++) {
        if (Math.abs(px) + Math.abs(py) > 2) continue;
        if (((px + py) & 1) === 0) ctx.fillStyle = dark; else ctx.fillStyle = foliage;
        ctx.fillRect(s[0] + px * cell - cell / 2, cy + py * cell - cell / 2, cell, cell);
      }
    }
    ctx.restore();
  };

  G.drawBuilding = function (b) {
    var ctx = G.ctx;
    var z = G.state.zoom;
    var t = G.TEXTURES.building;
    var hPx = b.height * 0.25 * z;
    var A = G.proj(b.x, b.y), B = G.proj(b.x + b.w, b.y),
        C = G.proj(b.x + b.w, b.y + b.h), D = G.proj(b.x, b.y + b.h);
    var At = [A[0], A[1] - hPx], Bt = [B[0], B[1] - hPx],
        Ct = [C[0], C[1] - hPx], Dt = [D[0], D[1] - hPx];

    G.fillPoly([B, C, Ct, Bt], t.faces.sideX.fill, t.faces.sideX.stroke);
    G.fillPoly([D, C, Ct, Dt], t.faces.sideY.fill, t.faces.sideY.stroke);
    G.fillPoly([At, Bt, Ct, Dt], t.roof.fill, t.roof.stroke);

    var door = G.proj(b.door.x, b.door.y);
    var dw = 12 * z * 0.25, dh = 26 * z * 0.25;
    if (dw < 3) dw = 3; if (dh < 6) dh = 6;
    ctx.fillStyle = t.door.fill;
    ctx.fillRect(door[0] - dw / 2, door[1] - dh, dw, dh);
    ctx.strokeStyle = t.door.stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(door[0] - dw / 2, door[1] - dh, dw, dh);
  };

  G.drawPlayer = function () {
    var ctx = G.ctx;
    var p = G.state.player;
    var t = G.TEXTURES.player;
    var base = G.proj(p.x, p.y);
    var z = G.state.zoom;
    var cell = z * 0.5;
    if (cell < 1.2) cell = 1.2;
    var cols = 6, rows = 15;
    var ox = base[0] - (cols / 2) * cell;
    var oy = base[1] - rows * cell;

    ctx.save();
    ctx.fillStyle = t.shadow;
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], cols / 2 * cell, cell * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var sprite = t.sprite;
    var palette = t.palette;
    for (var r = 0; r < rows; r++) {
      var line = sprite[r];
      for (var c = 0; c < cols; c++) {
        var ch = line.charAt(c);
        if (ch === ".") continue;
        var cc = p.face < 0 ? (cols - 1 - c) : c;
        ctx.fillStyle = palette[ch];
        ctx.fillRect(ox + cc * cell, oy + r * cell, cell + 0.5, cell + 0.5);
      }
    }
  };

  G.drawProjectiles = function () {
    var ctx = G.ctx;
    var t = G.TEXTURES.projectile;
    for (var i = 0; i < G.state.projectiles.length; i++) {
      var pr = G.state.projectiles[i];
      var col = pr.color || t.defaultColor;
      for (var k = 0; k < pr.trail.length; k++) {
        var s = G.proj(pr.trail[k][0], pr.trail[k][1]);
        var a = (k / pr.trail.length) * t.trailAlpha;
        ctx.globalAlpha = a;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(s[0], s[1], t.trailSize + k * t.trailSizeStep, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      var h = G.proj(pr.x, pr.y);
      var rad = t.sizeBase + (pr.dmg || 1) * t.sizePerDmg;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(h[0], h[1], rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = t.stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  G.drawFog = function () {
    var ctx = G.ctx;
    var p = G.state.player;
    if (G.inTown(p.x, p.y)) return;
    var t = G.TEXTURES.fog;
    var s = G.proj(p.x, p.y);
    var z = G.state.zoom;
    var rx = G.FOG_RADIUS * 0.5 * z * 2;
    var ry = G.FOG_RADIUS * 0.25 * z * 2;
    var W = G.canvas.width / (window.devicePixelRatio || 1);
    var H = G.canvas.height / (window.devicePixelRatio || 1);
    var grad = ctx.createRadialGradient(s[0], s[1], Math.min(rx, ry) * 0.5, s[0], s[1], Math.max(rx, ry) * 1.3);
    for (var i = 0; i < t.stops.length; i++) {
      grad.addColorStop(t.stops[i].at, "rgba(" + t.color + "," + t.stops[i].alpha + ")");
    }
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  G.drawCrosshair = function () {
    if (!G.state.mouse.inside) return;
    var ctx = G.ctx;
    var t = G.TEXTURES.crosshair;
    var s = G.proj(G.state.mouse.wx, G.state.mouse.wy);
    ctx.save();
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s[0], s[1], t.radius, 0, Math.PI * 2);
    ctx.moveTo(s[0] - t.tick, s[1]); ctx.lineTo(s[0] - t.gap, s[1]);
    ctx.moveTo(s[0] + t.gap, s[1]); ctx.lineTo(s[0] + t.tick, s[1]);
    ctx.moveTo(s[0], s[1] - t.tick); ctx.lineTo(s[0], s[1] - t.gap);
    ctx.moveTo(s[0], s[1] + t.gap); ctx.lineTo(s[0], s[1] + t.tick);
    ctx.stroke();
    ctx.restore();
  };

  G.drawWall = function (m) {
    var ctx = G.ctx;
    var z = G.state.zoom;
    var t = G.TEXTURES.wall;
    var A = G.proj(m.x, m.y), B = G.proj(m.x + m.w, m.y),
        C = G.proj(m.x + m.w, m.y + m.h), D = G.proj(m.x, m.y + m.h);
    var hPx = Math.max(8, 18 * 0.25 * z);
    var At = [A[0], A[1] - hPx], Bt = [B[0], B[1] - hPx],
        Ct = [C[0], C[1] - hPx], Dt = [D[0], D[1] - hPx];
    G.fillPoly([B, C, Ct, Bt], t.faces.sideX.fill, t.faces.sideX.stroke);
    G.fillPoly([D, C, Ct, Dt], t.faces.sideY.fill, t.faces.sideY.stroke);
    G.fillPoly([At, Bt, Ct, Dt], t.top.fill, t.top.stroke);
    var hp = m.hp, ratio = hp / G.WALL_MAX_HP;
    var col = ratio < 0.10 ? t.hpBar.low : (ratio < 0.30 ? t.hpBar.mid : t.hpBar.high);
    var cx = (A[0] + C[0]) / 2, by = (A[1] + C[1]) / 2;
    var bw = Math.max(18, m.w * 0.25 * z);
    if (m.orient === "v") bw = Math.max(18, m.h * 0.25 * z);
    ctx.fillStyle = t.hpBarBg;
    ctx.fillRect(cx - bw / 2 - 1, by - 2, bw + 2, 5);
    ctx.fillStyle = col;
    ctx.fillRect(cx - bw / 2, by - 1, bw * ratio, 3);
  };

  G.drawZombie = function (z) {
    var ctx = G.ctx;
    var t = G.TEXTURES.zombie;
    var base = G.proj(z.x, z.y);
    var zoom = G.state.zoom;
    var cell = zoom * 0.5;
    if (cell < 1.2) cell = 1.2;
    var cols = 6, rows = 15;
    var ox = base[0] - (cols / 2) * cell;
    var oy = base[1] - rows * cell;
    ctx.save();
    ctx.fillStyle = t.shadow;
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], cols / 2 * cell, cell * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    var sprite = t.sprite;
    var palette = t.palette;
    for (var r = 0; r < rows; r++) {
      var line = sprite[r];
      for (var c = 0; c < cols; c++) {
        var ch = line.charAt(c);
        if (ch === ".") continue;
        ctx.fillStyle = palette[ch];
        ctx.fillRect(ox + c * cell, oy + r * cell, cell + 0.5, cell + 0.5);
      }
    }
    ctx.restore();
  };

  G.render = function () {
    var ctx = G.ctx;
    var state = G.state;
    var W = G.canvas.width / (window.devicePixelRatio || 1);
    var H = G.canvas.height / (window.devicePixelRatio || 1);
    var night = G.isNight(state.clock);
    ctx.fillStyle = night ? G.TEXTURES.ground.skyNight : G.TEXTURES.ground.skyDay;
    ctx.fillRect(0, 0, W, H);

    if (!state.started) return;

    G.drawGround();

    for (var i = 0; i < state.items.length; i++) G.drawItem(state.items[i]);

    var drawables = [];
    for (var bi = 0; bi < state.buildings.length; bi++) {
      var bld = state.buildings[bi];
      drawables.push({ depth: bld.x + bld.y, type: "building", ref: bld });
    }
    var bnds = G.visibleWorldBounds();
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
        G.drawPlayer();
        G.drawPlayerHpBar();
        drewPlayer = true;
      }
      if (d.type === "building") G.drawBuilding(d.ref);
      else if (d.type === "tree") G.drawTree(d.ref);
      else if (d.type === "wall") G.drawWall(d.ref);
      else if (d.type === "zombie") G.drawZombie(d.ref);
    }
    if (!drewPlayer) { G.drawPlayer(); G.drawPlayerHpBar(); }

    G.drawProjectiles();
    G.drawFog();
    G.drawCrosshair();
    G.drawBuildHint();
    G.drawChopProgress();
    G.drawClock();

    if (state.bag.open) G.drawBag();

    if (state.paused) {
      ctx.fillStyle = "rgba(2,6,23,0.4)";
      ctx.fillRect(0, 0, W, H);
    }

    G.drawGameOver();
  };
})();

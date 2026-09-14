// Rendu : sol, objets, arbres, bâtiments, murs, zombies, joueur, projectiles, brouillard, viseur + render().
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Texte flottant au-dessus du joueur (ex: "+ Pièce") pendant 3 s.
  G.addFloater = function (name) {
    G.state.floaters.push({ text: "+ " + name, t: 3 });
  };
  G.updateFloaters = function (dt) {
    var f = G.state.floaters;
    for (var i = f.length - 1; i >= 0; i--) {
      f[i].t -= dt;
      if (f[i].t <= 0) f.splice(i, 1);
    }
  };
  G.drawFloaters = function () {
    var ctx = G.ctx;
    var p = G.state.player;
    var base = G.proj(p.x, p.y);
    var z = G.state.zoom;
    var f = G.state.floaters;
    for (var i = 0; i < f.length; i++) {
      var fl = f[i];
      var rise = (3 - fl.t) * 14;
      var alpha = fl.t > 2 ? 1 : Math.max(0, fl.t / 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "bold 16px Segoe UI, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(2,6,23,0.8)";
      ctx.lineWidth = 3;
      var x = base[0], y = base[1] - (28 + rise) * z * 0.5;
      ctx.strokeText(fl.text, x, y);
      ctx.fillText(fl.text, x, y);
      ctx.restore();
    }
  };

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

    G.drawPaths();
  };

  // Dessine la couleur #fffabc sous chaque bâtiment (empreinte au sol,
  // losange iso). Appelé depuis drawGround, avant les bâtiments (décor au
  // fond). Dépasse de 15 px autour du bâtiment avec des bords arrondis.
  G.drawPaths = function () {
    var ctx = G.ctx;
    var state = G.state;
    var PATH_COLOR = "#fffabc";
    var PAD = 15;
    var RADIUS = 12;
    for (var bi = 0; bi < state.buildings.length; bi++) {
      var b = state.buildings[bi];
      // Pas de jaune sous les forêts (éléments naturels, pas des bâtiments).
      if (b.isForet) continue;
      var A = G.proj(b.x, b.y), B = G.proj(b.x + b.w, b.y),
          C = G.proj(b.x + b.w, b.y + b.h), D = G.proj(b.x, b.y + b.h);
      // Bounding box écran du losange, agrandie de PAD px.
      var minX = Math.min(A[0], B[0], C[0], D[0]) - PAD;
      var maxX = Math.max(A[0], B[0], C[0], D[0]) + PAD;
      var minY = Math.min(A[1], B[1], C[1], D[1]) - PAD;
      var maxY = Math.max(A[1], B[1], C[1], D[1]) + PAD;
      ctx.fillStyle = PATH_COLOR;
      G.roundRect(minX, minY, maxX - minX, maxY - minY, RADIUS);
      ctx.fill();
    }
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

  G.drawBuilding = function (b) {
    var ctx = G.ctx;
    var z = G.state.zoom;
    var t = b.isMairie ? G.TEXTURES.mairie : G.TEXTURES.building;
    var hPx = b.height * 0.25 * z;
    var A = G.proj(b.x, b.y), B = G.proj(b.x + b.w, b.y),
        C = G.proj(b.x + b.w, b.y + b.h), D = G.proj(b.x, b.y + b.h);
    var cx = (A[0] + C[0]) / 2, by = (A[1] + C[1]) / 2;

    // Sprite PNG si disponible : forêt, mairie, eglise (church), maison
    // décorative ou bâtiment générique. Le PNG est dessiné à la taille exacte
    // de l'emprise sol du bâtiment (largeur du losange iso), ancré en bas-centre
    // sur le bord SUD du losange au sol (le point le plus bas en Y écran).
    var sprite = null;
    if (b.isForet && b.foretFrame) {
      var stageKey = G.foretStageFrame(b.foretFrame, b.foretStage || 0);
      if (stageKey && G.hasSprite("foret", stageKey)) sprite = G.SPRITES.foret[stageKey];
      else if (G.hasSprite("foret", b.foretFrame)) sprite = G.SPRITES.foret[b.foretFrame];
    }
    else if (b.isDecor && b.houseSprite) sprite = b.houseSprite;
    else if (b.isMairie && G.hasSprite("building", "mairie")) sprite = G.SPRITES.building.mairie;
    else if (b.isChurch && G.hasSprite("church", "church")) sprite = G.SPRITES.church.church;
    else if (G.hasSprite("building", "generic")) sprite = G.SPRITES.building.generic;
    if (sprite) {
      var losangeW = (b.w + b.h) * 0.5 * z;
      var dw = losangeW;
      var dh = dw * sprite.h / sprite.w;
      var groundY = Math.max(C[1], D[1]);
      ctx.drawImage(G.animImg(sprite, G.state.time), cx - dw / 2, groundY - dh, dw, dh);
      // Barre de vie de la mairie au-dessus du sprite (uniquement si endommagée).
      if (b.isMairie && b.hp < b.maxHp) {
        var ratio = b.hp / b.maxHp;
        var col = ratio < 0.10 ? t.hpBar.low : (ratio < 0.30 ? t.hpBar.mid : t.hpBar.high);
        var bw = Math.max(40, dw * 0.7);
        var bby = groundY - dh - 8;
        ctx.fillStyle = t.hpBar.bg;
        ctx.fillRect(cx - bw / 2 - 1, bby - 1, bw + 2, 6);
        ctx.fillStyle = col;
        ctx.fillRect(cx - bw / 2, bby, bw * ratio, 4);
      }
      return;
    }

    var At = [A[0], A[1] - hPx], Bt = [B[0], B[1] - hPx],
        Ct = [C[0], C[1] - hPx], Dt = [D[0], D[1] - hPx];

    G.fillPoly([B, C, Ct, Bt], t.faces.sideX.fill, t.faces.sideX.stroke);
    G.fillPoly([D, C, Ct, Dt], t.faces.sideY.fill, t.faces.sideY.stroke);
    G.fillPoly([At, Bt, Ct, Dt], t.roof.fill, t.roof.stroke);

    // Bandeau blanc pour la mairie.
    if (b.isMairie && t.trim) {
      ctx.strokeStyle = t.trim;
      ctx.lineWidth = Math.max(1.5, z * 0.25);
      ctx.beginPath();
      ctx.moveTo(Bt[0], Bt[1] + hPx * 0.5);
      ctx.lineTo(Ct[0], Ct[1] + hPx * 0.5);
      ctx.moveTo(Dt[0], Dt[1] + hPx * 0.5);
      ctx.lineTo(Ct[0], Ct[1] + hPx * 0.5);
      ctx.stroke();
    }

    var door = G.proj(b.door.x, b.door.y);
    var dw = 12 * z * 0.25, dh = 26 * z * 0.25;
    if (dw < 3) dw = 3; if (dh < 6) dh = 6;
    ctx.fillStyle = t.door.fill;
    ctx.fillRect(door[0] - dw / 2, door[1] - dh, dw, dh);
    ctx.strokeStyle = t.door.stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(door[0] - dw / 2, door[1] - dh, dw, dh);

    // Barre de vie de la mairie (uniquement si endommagée).
    if (b.isMairie && b.hp < b.maxHp) {
      var ratio = b.hp / b.maxHp;
      var col = ratio < 0.10 ? t.hpBar.low : (ratio < 0.30 ? t.hpBar.mid : t.hpBar.high);
      var cx = (A[0] + C[0]) / 2;
      var by = Math.min(At[1], Bt[1], Ct[1], Dt[1]) - 8;
      var bw = Math.max(40, b.w * 0.4 * z);
      ctx.fillStyle = t.hpBar.bg;
      ctx.fillRect(cx - bw / 2 - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = col;
      ctx.fillRect(cx - bw / 2, by, bw * ratio, 4);
    }
  };

  G.drawPlayer = function () {
    var ctx = G.ctx;
    var p = G.state.player;
    var base = G.proj(p.x, p.y);
    var z = G.state.zoom;
    // Direction de marche : vecteur de déplacement si en mouvement, sinon idle.
    var dx = p.moving ? (p.lastDx || 0) : 0;
    var dy = p.moving ? (p.lastDy || 0) : 0;
    // Sprite du joueur : nouveau système (3 états × 3 directions) en priorité,
    // repli sur le système 8-directions si le nouveau sprite manque.
    var sprite = G.playerSprite ? G.playerSprite(G.state.equipped, G.state.axeEquipped, dx, dy) : null;
    if (!sprite) sprite = G.spriteFor("player", dx, dy);
    ctx.save();
    ctx.fillStyle = G.TEXTURES.player.shadow;
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], 9 * z * 0.5, 4 * z * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (sprite) {
      // Sprite PNG : ancré en bas-centre sur la position projetée, mis à l'échelle du zoom.
      var scale = z * 0.5;
      var dw = sprite.w * scale, dh = sprite.h * scale;
      ctx.drawImage(G.animImg(sprite, G.state.time), base[0] - dw / 2, base[1] - dh, dw, dh);
      return;
    }
    // Fallback : sprite pixel art JS (ancien rendu, gauche/droite par miroir).
    var t = G.TEXTURES.player;
    var cell = z * 0.5;
    if (cell < 1.2) cell = 1.2;
    var cols = 6, rows = 15;
    var ox = base[0] - (cols / 2) * cell;
    var oy = base[1] - rows * cell;
    var spr = t.sprite;
    var palette = t.palette;
    for (var r = 0; r < rows; r++) {
      var line = spr[r];
      for (var c = 0; c < cols; c++) {
        var ch = line.charAt(c);
        if (ch === ".") continue;
        var cc = p.face < 0 ? (cols - 1 - c) : c;
        ctx.fillStyle = palette[ch];
        ctx.fillRect(ox + cc * cell, oy + r * cell, cell + 0.5, cell + 0.5);
      }
    }
  };

  // Dessine un autre joueur (multijoueur). Repli simple : ombre + sprite local
  // (mêmes textures que le joueur) + nom au-dessus. Uniquement pour le rendu.
  G.drawRemotePlayer = function (rp) {
    var ctx = G.ctx;
    var base = G.proj(rp.x, rp.y);
    var z = G.state.zoom;
    ctx.save();
    ctx.fillStyle = G.TEXTURES.player.shadow;
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], 9 * z * 0.5, 4 * z * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    var dx = rp.moving ? (rp.lastDx || 0) : 0;
    var dy = rp.moving ? (rp.lastDy || 0) : 0;
    var sprite = G.playerSprite ? G.playerSprite(rp.equipped, rp.axeEquipped, dx, dy) : null;
    if (!sprite) sprite = G.spriteFor("player", dx, dy);
    if (sprite) {
      var scale = z * 0.5;
      var dw = sprite.w * scale, dh = sprite.h * scale;
      if (rp.face < 0) {
        ctx.save();
        ctx.translate(base[0], base[1]);
        ctx.scale(-1, 1);
        ctx.drawImage(G.animImg(sprite, G.state.time), -dw / 2, -dh, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(G.animImg(sprite, G.state.time), base[0] - dw / 2, base[1] - dh, dw, dh);
      }
    }
    // Nom + barre de vie.
    ctx.save();
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    var ny = base[1] - (sprite ? sprite.h * z * 0.5 + 14 : 30);
    ctx.strokeText(rp.name, base[0], ny);
    ctx.fillText(rp.name, base[0], ny);
    if (rp.hp !== undefined && rp.hp < G.PLAYER_MAX_HP) {
      var bw = 28, bh = 4;
      var bx = base[0] - bw / 2, by = ny + 4;
      ctx.fillStyle = "#3a0a0a";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = "#e23b3b";
      ctx.fillRect(bx, by, bw * (rp.hp / G.PLAYER_MAX_HP), bh);
    }
    ctx.restore();
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
    // Sprite PNG si disponible : orient "h" -> palissageNESO (NE-SO),
    // "v" -> palissageNoSe (NO-SE). Dessiné à la taille du mur (losange iso),
    // ancré en bas-centre : la palissade correspond à sa taille de collision.
    var frame = m.orient === "v" ? "palissageNESO" : "palissageNoSe";
    var sprite = G.hasSprite("wall", frame) ? G.SPRITES.wall[frame] : null;
    var A = G.proj(m.x, m.y), C = G.proj(m.x + m.w, m.y + m.h);
    var cx = (A[0] + C[0]) / 2, by = (A[1] + C[1]) / 2;
    if (sprite) {
      var losangeW = (m.w + m.h) * 0.5 * z;
      var dw = losangeW;
      var dh = dw * sprite.h / sprite.w;
      var B = G.proj(m.x + m.w, m.y), D = G.proj(m.x, m.y + m.h);
      var groundY = Math.max(C[1], D[1]);
      ctx.drawImage(G.animImg(sprite, G.state.time), cx - dw / 2, groundY - dh, dw, dh);
      // Barre de vie au-dessus du sprite.
      G.drawWallHpBar(m, cx, groundY - dh - 6, Math.max(18, dw * 0.7));
      return;
    }
    // Fallback : rendu vectoriel iso (faces + toit).
    var B = G.proj(m.x + m.w, m.y), D = G.proj(m.x, m.y + m.h);
    var hPx = Math.max(8, 18 * 0.25 * z);
    var At = [A[0], A[1] - hPx], Bt = [B[0], B[1] - hPx],
        Ct = [C[0], C[1] - hPx], Dt = [D[0], D[1] - hPx];
    G.fillPoly([B, C, Ct, Bt], t.faces.sideX.fill, t.faces.sideX.stroke);
    G.fillPoly([D, C, Ct, Dt], t.faces.sideY.fill, t.faces.sideY.stroke);
    G.fillPoly([At, Bt, Ct, Dt], t.top.fill, t.top.stroke);
    var bw = Math.max(18, m.w * 0.25 * z);
    if (m.orient === "v") bw = Math.max(18, m.h * 0.25 * z);
    G.drawWallHpBar(m, cx, by - 2, bw);
  };

  // Barre de vie commune d une barricade (PNG ou vectorielle).
  G.drawWallHpBar = function (m, cx, by, bw) {
    if (m.hp >= G.WALL_MAX_HP) return; // masquée si pas encore endommagé
    var ctx = G.ctx;
    var t = G.TEXTURES.wall;
    var hp = m.hp, ratio = hp / G.WALL_MAX_HP;
    var col = ratio < 0.10 ? t.hpBar.low : (ratio < 0.30 ? t.hpBar.mid : t.hpBar.high);
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
    // Leader (zombie d'index 0 du groupe) : rendu plus gros et teinté
    // (corps plus sombre/rouge, objectif tactique visible).
    var leader = !!(z.isLeader || z.leader);
    var lcell = leader ? cell * 1.45 : cell;
    // Lunge / télégraphie d'attaque : élan visuel vers l'avant pendant
    // ZOMBIE_LUNGE_TIME après un coup. Le sprite penche dans la direction
    // de la cible, amplitude proportionnelle au temps restant.
    var lungeOX = 0, lungeOY = 0;
    if (z.lunge && z.lunge > 0) {
      var f = (z.lunge / G.ZOMBIE_LUNGE_TIME) * G.ZOMBIE_LUNGE_VIS;
      lungeOX = (z.lungeDx || 0) * f;
      lungeOY = (z.lungeDy || 0) * f;
    }
    var ox = base[0] + lungeOX - (cols / 2) * lcell;
    var oy = base[1] + lungeOY - rows * lcell;
    ctx.save();
    ctx.fillStyle = t.shadow;
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], cols / 2 * lcell, lcell * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    var sprite = t.sprite;
    var palette = t.palette;
    // Palette du leader : corps et cheveux teintés (plus rouge/sang).
    if (leader) {
      palette = {
        h: "#5b2a2a", s: "#bfae8a", g: "#7a3a3a",
        p: "#4a2a2a", f: "#2f1f1f"
      };
    }
    for (var r = 0; r < rows; r++) {
      var line = sprite[r];
      for (var c = 0; c < cols; c++) {
        var ch = line.charAt(c);
        if (ch === ".") continue;
        ctx.fillStyle = palette[ch];
        ctx.fillRect(ox + c * lcell, oy + r * lcell, lcell + 0.5, lcell + 0.5);
      }
    }
    ctx.restore();
  };

  G.drawBird = function (b) {
    var ctx = G.ctx;
    var t = G.TEXTURES.bird;
    var base = G.proj(b.x, b.y);
    var zoom = G.state.zoom;
    // Sprite PNG si disponible : direction selon le vecteur de vol.
    var sprite = G.spriteFor("bird", b.vx, b.vy);
    // Si la direction exacte n'a pas de PNG, on retombe sur idle si dispo.
    if (!sprite && G.hasSprite("bird", "idle")) sprite = G.SPRITES.bird.idle;
    ctx.save();
    ctx.fillStyle = t.shadow;
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], 8 * zoom * 0.5, 4 * zoom * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (sprite) {
      var scale = zoom * 0.5;
      var dw = sprite.w * scale, dh = sprite.h * scale;
      // L'oiseau vole : on l'ancre en bas-centre, légèrement au-dessus du sol.
      ctx.drawImage(G.animImg(sprite, G.state.time), base[0] - dw / 2, base[1] - dh, dw, dh);
      ctx.restore();
      return;
    }
    ctx.restore();
    // Fallback : sprite pixel art JS avec animation d'ailes.
    var cell = zoom * 0.5;
    if (cell < 1.2) cell = 1.2;
    var cols = 8, rows = 8;
    var ox = base[0] - (cols / 2) * cell;
    var oy = base[1] - rows * cell;
    ctx.save();
    ctx.fillStyle = t.shadow;
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], cols / 2 * cell, cell * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    var spr = t.sprite;
    var palette = t.palette;
    var flap = Math.sin(b.wing) > 0;
    for (var r = 0; r < rows; r++) {
      var line = spr[r];
      for (var c = 0; c < cols; c++) {
        var ch = line.charAt(c);
        if (ch === ".") continue;
        ctx.fillStyle = palette[ch];
        var yy = oy + r * cell;
        if (ch === "w" && !flap) yy -= cell * 0.8;
        ctx.fillRect(ox + c * cell, yy, cell + 0.5, cell + 0.5);
      }
    }
    ctx.restore();
  };

  // Boussole : en bas a droite, indique la direction de la mairie au joueur.
  G.drawCompass = function () {
    var ctx = G.ctx;
    var state = G.state;
    var W = G.canvas.width / (window.devicePixelRatio || 1);
    var H = G.canvas.height / (window.devicePixelRatio || 1);
    // Trouve la mairie.
    var mairie = null;
    for (var i = 0; i < state.buildings.length; i++) {
      if (state.buildings[i].isMairie) { mairie = state.buildings[i]; break; }
    }
    if (!mairie) return;
    var p = state.player;
    var mx = mairie.x + mairie.w / 2, my = mairie.y + mairie.h / 2;
    var dx = mx - p.x, dy = my - p.y;
    var ang = Math.atan2(dy, dx);
    var cx = W - 56, cy = H - 56;
    var r = 32;
    ctx.save();
    // Fond de la boussole.
    ctx.fillStyle = "rgba(15,23,42,0.7)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Marqueurs cardinaux.
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", cx, cy - r + 8);
    ctx.fillText("S", cx, cy + r - 8);
    ctx.fillText("E", cx + r - 8, cy);
    ctx.fillText("W", cx - r + 8, cy);
    // Fleche pointant vers la mairie.
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(r - 8, 0);
    ctx.lineTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    // Queue de la fleche.
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(-(r - 8), 0);
    ctx.lineTo(0, -4);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
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
    var bnds = G.visibleWorldBounds();
    for (var bi = 0; bi < state.buildings.length; bi++) {
      var bld = state.buildings[bi];
      // Culling : ignore les bâtiments (forêts, maisons) hors écran.
      if (bld.x + bld.w < bnds.minX || bld.x > bnds.maxX || bld.y + bld.h < bnds.minY || bld.y > bnds.maxY) continue;
      drawables.push({ depth: bld.x + bld.y, type: "building", ref: bld });
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
    for (var bi2 = 0; bi2 < state.birds.length; bi2++) {
      var bd = state.birds[bi2];
      drawables.push({ depth: bd.x + bd.y + 100000, type: "bird", ref: bd });
    }
    // Autres joueurs (multijoueur) : affichés comme le joueur local.
    if (state.remotePlayers) {
      for (var rpi = 0; rpi < state.remotePlayers.length; rpi++) {
        var rp = state.remotePlayers[rpi];
        drawables.push({ depth: rp.x + rp.y, type: "player", ref: rp });
      }
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
      else if (d.type === "wall") G.drawWall(d.ref);
      else if (d.type === "zombie") G.drawZombie(d.ref);
      else if (d.type === "bird") G.drawBird(d.ref);
      else if (d.type === "player") G.drawRemotePlayer(d.ref);
    }
    if (!drewPlayer) { G.drawPlayer(); G.drawPlayerHpBar(); }

    G.drawProjectiles();
    G.drawFloaters();
    G.drawFog();
    var darkness = G.nightDarkness(state.clock);
    if (darkness > 0) {
      ctx.fillStyle = "rgba(" + G.NIGHT_DARK_COLOR + "," + darkness + ")";
      ctx.fillRect(0, 0, W, H);
    }
    G.drawCrosshair();
    G.drawBuildHint();
    G.drawChopProgress();
    G.drawClock();
    G.drawCompass();

    if (state.bag.open) G.drawBag();

    if (state.paused) {
      ctx.fillStyle = "rgba(2,6,23,0.4)";
      ctx.fillRect(0, 0, W, H);
    }

    G.drawGameOver();
  };
})();

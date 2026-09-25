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
    // Taches de couleur (fleurs / pousses) sur chaque tuile visible : ~0.5%
    // de la surface, carres alignes sur les axes ecran, position et couleur
    // deterministes par (tuile, index), aucun scintillement quand la camera
    // bouge ou le zoom change.
    // Garde perf : au zoom minimal presque toute la carte est visible
    // (~100 tuiles), les points seraient sous-px et nombreux (~50k arcs).
    if (tx_.specks && tx_.specks.colors.length > 0 && G.state.zoom >= 2) {
      for (var sx2 = startTX; sx2 <= endTX; sx2++) {
        for (var sy2 = startTY; sy2 <= endTY; sy2++) {
          G.drawGroundSpecks(sx2, sy2);
        }
      }
    }
    var c1 = G.proj(G.TOWN_MIN, G.TOWN_MIN), c2 = G.proj(G.TOWN_MAX, G.TOWN_MIN),
        c3 = G.proj(G.TOWN_MAX, G.TOWN_MAX), c4 = G.proj(G.TOWN_MIN, G.TOWN_MAX);
    G.fillPoly([c1, c2, c3, c4], null, tx_.border);

    G.drawPaths();
  };

  // Hash entier deterministe : meme entree -> meme sortie, independant du
  // Math.random global (stable entre frames et entre parties).
  function speckRand(a, b, n) {
    var h = (a * 374761393 + b * 668265263 + n * 2246822519) | 0;
    h = (h ^ (h >>> 13)) | 0;
    h = (imul(h, 1274126177)) | 0;
    h = (h ^ (h >>> 16)) | 0;
    return (h >>> 0) / 4294967296;
  }
  function imul(x, y) { return (x * y) | 0; }

  // Taches de couleur d'une tuile : positions dans [0,1) et couleur tirees
  // du hash (tx, ty, i). Rendu iso : carres alignes sur les axes ecran
  // (horizontal / vertical), de cote side * z.
  var lastSpeckCi = -1;
  G.drawGroundSpecks = function (tx, ty) {
    var ctx = G.ctx;
    var sp = G.TEXTURES.ground.specks;
    var colors = sp.colors;
    var z = G.state.zoom;
    var wx0 = tx * G.TS, wy0 = ty * G.TS;
    ctx.globalAlpha = sp.alpha;
    ctx.fillStyle = colors[0];
    lastSpeckCi = 0;
    var s = sp.side * z;
    for (var i = 0; i < sp.perTile; i++) {
      var rx = speckRand(tx, ty, i * 2);
      var ry = speckRand(tx, ty, i * 2 + 1);
      var p = G.proj(wx0 + rx * G.TS, wy0 + ry * G.TS);
      var ci = Math.floor(speckRand(tx + 7919, ty + 104729, i) * colors.length);
      if (ci !== lastSpeckCi) { ctx.fillStyle = colors[ci]; lastSpeckCi = ci; }
      ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  };

  // Empreinte de sol sous chaque bâtiment : blob organique (aucune ligne
  // droite). Rayons multiples autour du centre, bruit basse frequence
  // determine par hash du bâtiment (speckRand : stable entre frames,
  // identique pour tous les clients d'un même serveur, different pour
  // chaque bâtiment). Les points sont relis par courbes quadratiques
  // (points de controle au milieu des segments) : courbes lentes.
  // Double couche : halo externe plus large et translucide (bord "usé"
  // qui elimine l'effet pochoir), puis blob interne plein.
  var _pathBlobCache = {};
  function pathBlobAngles(b) {
    var key = Math.round(b.x) + ":" + Math.round(b.y);
    if (_pathBlobCache[key] !== undefined) return _pathBlobCache[key];
    var N = 12;
    var angs = [];
    var phase = speckRand(Math.round(b.x), Math.round(b.y), 977) * Math.PI * 2;
    var freq = 2 + Math.floor(speckRand(Math.round(b.x), Math.round(b.y), 131) * 2);
    for (var i = 0; i < N; i++) {
      var base = (i / N) * Math.PI * 2;
      // Onde lente (2-3 lobes) + jitter individuel par sommet.
      var wave = Math.sin(base * freq + phase) * 0.16;
      var jitter = (speckRand(Math.round(b.x), Math.round(b.y), i * 3 + 5) - 0.5) * 0.12;
      angs.push(base + wave + jitter);
    }
    _pathBlobCache[key] = angs;
    return angs;
  }
  function drawPathBlob(b, scale, alpha, color) {
    var ctx = G.ctx;
    var A = G.proj(b.x, b.y), B = G.proj(b.x + b.w, b.y),
        C = G.proj(b.x + b.w, b.y + b.h), D = G.proj(b.x, b.y + b.h);
    var cx = (A[0] + C[0]) / 2, cy = (A[1] + C[1]) / 2;
    // Rayons de base selon la direction : le losange iso est plus large
    // horizontalement que verticalement (rapport proj), on en derive des
    // rayons elliptiques naturels.
    var rx = Math.max(Math.abs(A[0] - C[0]), Math.abs(B[0] - D[0])) / 2;
    var ry = Math.max(Math.abs(A[1] - C[1]), Math.abs(B[1] - D[1])) / 2;
    // Marge piétinée autour du bâtiment (px ecran) + variation par bâtiment.
    var PAD = 15;
    var padVar = 6 + speckRand(Math.round(b.x), Math.round(b.y), 401) * 10;
    var angs = pathBlobAngles(b);
    var N = angs.length;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    var px = [], py = [];
    for (var i = 0; i < N; i++) {
      var ang = angs[i];
      var wobble = speckRand(Math.round(b.x), Math.round(b.y), i * 3 + 7);
      var r = 1 + (wobble - 0.5) * 0.22;
      px.push(cx + Math.cos(ang) * (rx + PAD + padVar) * scale * r);
      py.push(cy + Math.sin(ang) * (ry + PAD + padVar) * scale * r);
    }
    // Courbes quadratiques : point de controle au milieu de chaque segment
    // (vers le centre -> courbure douce, jamais d'angle vif ni de droite).
    var mx = (px[N - 1] + px[0]) / 2, my = (py[N - 1] + py[0]) / 2;
    ctx.moveTo(mx, my);
    for (var j = 0; j < N; j++) {
      var nx = (px[j] + px[(j + 1) % N]) / 2;
      var ny = (py[j] + py[(j + 1) % N]) / 2;
      ctx.quadraticCurveTo(px[j], py[j], nx, ny);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  G.drawPaths = function () {
    var state = G.state;
    for (var bi = 0; bi < state.buildings.length; bi++) {
      var b = state.buildings[bi];
      // Pas de jaune sous les forêts (éléments naturels, pas des bâtiments).
      if (b.isForet) continue;
      // Halo externe translucide, plus large (bord degradé "usé").
      drawPathBlob(b, 1.18, 0.35, "#e8d99a");
      // Blob interne plein.
      drawPathBlob(b, 1, 1, "#fffabc");
    }
  };

  // Dessine les traces de zombies morts au sol. Appele juste apres drawGround,
  // AVANT les items et tous les autres elements : la trace reste derriere
  // tout (objets, batiments, murs, zombies, joueur), seul le fond vert est en
  // dessous. Chaque trace est un PNG (variante tiree aleatoirement a la mort)
  // ancre bas-centre a la position du zombie mort, avec une legere rotation.
  // Tolerant : si aucun PNG n'est disponible, ne dessine rien.
  G.drawDeadTraces = function () {
    var ctx = G.ctx;
    var z = G.state.zoom;
    var traces = G.state.deadTraces;
    if (!traces || traces.length === 0) return;
    var list = G.SPRITES.zombDead;
    if (!list || list.length === 0) return;
    var bnds = G.visibleWorldBounds();
    for (var i = 0; i < traces.length; i++) {
      var tr = traces[i];
      if (tr.x < bnds.minX || tr.x > bnds.maxX || tr.y < bnds.minY || tr.y > bnds.maxY) continue;
      var sp = list[tr.v % list.length];
      if (!sp || !sp.img) continue;
      var p = G.proj(tr.x, tr.y);
      // Taille : le sprite est ancre bas-centre sur sa position au sol.
      // La largeur en pixels ecran suit le zoom (comme les objets au sol).
      // G.DEAD_TRACES_SCALE grossit la tache de sang (x3 par defaut).
      var dw = sp.w * z * (G.DEAD_TRACES_SCALE || 0.25);
      var dh = dw * sp.h / sp.w;
      if (dw < 6) dw = 6;
      if (dh < 6) dh = 6;
      ctx.save();
      ctx.translate(p[0], p[1]);
      if (tr.r) ctx.rotate(tr.r * Math.PI / 180);
      ctx.drawImage(sp.img, -dw / 2, -dh, dw, dh);
      ctx.restore();
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
    var spriteEnt = null, spriteKey = null;
    if (b.isForet && b.foretFrame) {
      var stageKey = G.foretStageFrame(b.foretFrame, b.foretStage || 0);
      if (stageKey && G.hasSprite("foret", stageKey)) { sprite = G.SPRITES.foret[stageKey]; spriteEnt = "foret"; spriteKey = stageKey; }
      else if (G.hasSprite("foret", b.foretFrame)) { sprite = G.SPRITES.foret[b.foretFrame]; spriteEnt = "foret"; spriteKey = b.foretFrame; }
    }
    else if (b.isDecor && b.houseSprite) sprite = b.houseSprite;
    else if (b.isMairie && G.hasSprite("building", "mairie")) { sprite = G.SPRITES.building.mairie; spriteEnt = "building"; spriteKey = "mairie"; }
    else if (b.isChurch && G.hasSprite("church", "church")) { sprite = G.SPRITES.church.church; spriteEnt = "church"; spriteKey = "church"; }
    else if (b.townBuilding && G.TOWN_BUILDINGS[b.townBuilding]) {
      // Batiment de ville (scierie, universite, montgolfiere...) : frame
      // chantier pendant la construction, idle ensuite.
      var tbEnt = b.townBuilding;
      var scKey = b.chantierDone ? "idle" : "chantier";
      if (G.hasSprite(tbEnt, scKey)) { sprite = G.SPRITES[tbEnt][scKey]; spriteEnt = tbEnt; spriteKey = scKey; }
      else if (G.hasSprite(tbEnt, "idle")) { sprite = G.SPRITES[tbEnt].idle; spriteEnt = tbEnt; spriteKey = "idle"; }
    }
    else if (G.hasSprite("building", "generic")) { sprite = G.SPRITES.building.generic; spriteEnt = "building"; spriteKey = "generic"; }
    if (sprite) {
      var losangeW = (b.w + b.h) * 0.5 * z;
      var dw = losangeW;
      var dh = dw * sprite.h / sprite.w;
      var groundY = Math.max(C[1], D[1]);
      // Ancrage opaque commun (forêt + bâtiment + maison) : le bas de la zone
      // opaque du sprite (pas le bas du PNG) est aligné sur le bord sud (groundY).
      // Pour un PNG plein y1==1 -> opaqueDrop=0 (inchangé) ; pour un PNG aéré
      // (marge transparente en bas) on abaisse le rendu pour ramener le pied
      // opaque au niveau de la collision. Identique pour tous les objets.
      var opaqueDrop = 0;
      if (spriteEnt && spriteKey) {
        var ob = G.spriteBounds(spriteEnt, spriteKey);
        if (ob && ob.y1 < 1) opaqueDrop = (1 - ob.y1) * dh;
      }
      var scImg = G.animImg(sprite, G.state.time);
      if (b.townBuilding && !b.chantierDone) {
        // Chantier : la boucle de frames ne fait qu'UN tour sur TOWER_BUILD_TIME
        // (frame figée sur la dernière si le temps depasse), pas de cycle libre.
        var scFrames = sprite.frames;
        if (scFrames && scFrames.length > 1) {
          var fi2 = G.chantierFrame(sprite, b.builtAt, G.state.time, scFrames.length);
          scImg = scFrames[fi2];
        }
      }
      ctx.drawImage(scImg, cx - dw / 2, groundY - dh + opaqueDrop, dw, dh);
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
    var dx = (p.lastDx || 0);
    var dy = (p.lastDy || 0);
    // Action en cours (tir arme ou coup de hache) : declenche l'animation
    // dediee a l'equipement pendant le cycle (cadence de l'arme).
    var action = null;
    if (G.state.axeEquipped) {
      // remoteChop : cycle de coupe confirme par le serveur (mode en ligne,
      // chopProgress() local est vide car le serveur fait autorite).
      if ((G.chopProgress && G.chopProgress() >= 0) || G.state.remoteChop) {
        action = { anim: true, t: G.state.time - (G.state.lastShotAt || 0) };
      }
    } else if (G.state.equipped && G.state.lastShotAt !== undefined) {
      var stA = G.equippedStats ? G.equippedStats() : null;
      var cdA = stA ? stA.cd : 0.5;
      var sinceShot = G.state.time - G.state.lastShotAt;
      if (sinceShot >= 0 && sinceShot < cdA) action = { anim: true, t: sinceShot };
    }
    // Sprite du joueur : action > mouvement (gauche/droite, jamais face) > immobile (face).
    var sprite = G.playerSprite ? G.playerSprite(G.state.equipped, G.state.axeEquipped, dx, dy, action, p.face) : null;
    if (!sprite) sprite = G.spriteFor("player", dx, dy);
    ctx.save();
    ctx.fillStyle = G.TEXTURES.player.shadow;
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], 9 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (sprite) {
      // Sprite PNG : ancré en bas-centre sur la position projetée, mis à l'échelle du zoom.
      // Les frames d'animation peuvent avoir une taille différente du sprite de
      // base : on utilise la taille réelle de l'image courante (frame ou base).
      var scale = z * 1.0;
      var img;
      if (action && action.anim) {
        // Coupe de hache : boucle a la cadence du cycle serveur (TREE_CHOP_TIME)
        // tant que la coupe est active — les 5 frames d'anim couvrent un cycle
        // complet de frappe. Tir : non bouclant, fige sur la derniere frame
        // jusqu'au prochain tir (cadence de l'arme). 1 frame = 0.1 s.
        if (G.state.axeEquipped) {
          var cyc = (action.t % G.TREE_CHOP_TIME) / G.TREE_CHOP_TIME;
          img = G.animImg(sprite, cyc * G.TREE_CHOP_TIME);
        } else {
          img = G.actionFrame(sprite, action.t);
          if (!img) img = G.animImg(sprite, 0);
        }
      } else {
        // Marche : cycle libre (1 frame = 0.1 s) ; immobile : image de base.
        var ptime = G.state.player.moving ? G.state.time : 0;
        img = G.animImg(sprite, ptime);
      }
      var iw = (img && img.naturalWidth) || sprite.w;
      var ih = (img && img.naturalHeight) || sprite.h;
      var dw = iw * scale, dh = ih * scale;
      ctx.drawImage(img, base[0] - dw / 2, base[1] - dh, dw, dh);
      _drawPlayerName(base, G.state.playerName);
      return;
    }
    // Fallback : sprite pixel art JS (ancien rendu, gauche/droite par miroir).
    var t = G.TEXTURES.player;
    var cell = z;
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
    _drawPlayerName(base, G.state.playerName);
  };

  // Nom affiché sous le sprite du joueur local (comme les joueurs distants).
  function _drawPlayerName(base, name) {
    if (!name) return;
    var ctx = G.ctx;
    ctx.save();
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText(name, base[0], base[1] + 14);
    ctx.fillText(name, base[0], base[1] + 14);
    ctx.restore();
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
    ctx.ellipse(base[0], base[1], 9 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    var dx = (rp.lastDx || 0);
    var dy = (rp.lastDy || 0);
    // Action du joueur distant (anim de tir/hache) depuis le snapshot serveur :
    // shotAge = temps ecoule depuis le dernier tir (s), chop = hache en action.
    var raction = null;
    if (rp.chop && rp.chopAge !== undefined) raction = { anim: true, t: rp.chopAge };
    else if (rp.shotAge !== undefined && rp.shotAge >= 0) {
      var rst = G.WEAPON_STATS[rp.equipped];
      var rcd = rst ? rst.cd : 0.5;
      if (rp.shotAge < rcd) raction = { anim: true, t: rp.shotAge };
    }
    var sprite = G.playerSprite ? G.playerSprite(rp.equipped, rp.axeEquipped, dx, dy, raction, rp.face) : null;
    if (!sprite) sprite = G.spriteFor("player", dx, dy);
    if (sprite) {
      var scale = z * 1.0;
      var img;
      if (raction && raction.anim) {
        img = G.actionFrame(sprite, raction.t);
        if (!img) img = G.animImg(sprite, 0);
      } else {
        var rptime = rp.moving ? G.state.time : 0;
        img = G.animImg(sprite, rptime);
      }
      var iw = (img && img.naturalWidth) || sprite.w;
      var ih = (img && img.naturalHeight) || sprite.h;
      var dw = iw * scale, dh = ih * scale;
      if (rp.face < 0) {
        ctx.save();
        ctx.translate(base[0], base[1]);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -dw / 2, -dh, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(img, base[0] - dw / 2, base[1] - dh, dw, dh);
      }
    }
    // Nom (SOUS le sprite) + barre de vie (au-dessus).
    ctx.save();
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    var ny = base[1] + 14;
    ctx.strokeText(rp.name, base[0], ny);
    ctx.fillText(rp.name, base[0], ny);
    var hy = base[1] - (sprite ? sprite.h * z + 8 : 24);
    if (rp.hp !== undefined && rp.hp < G.PLAYER_MAX_HP) {
      var bw = 28, bh = 4;
      var bx = base[0] - bw / 2, by = hy;
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

            // --- Gestion de la traînette (inchangée) ---
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

            // --- Rendu Personnalisé selon le type d'arme ---

            // Si c'est une flèche d'arc, on dessine un triangle orienté
            if (pr.type === "arc") {
                ctx.save();
                // Positionne le contexte au centre du projectile
                ctx.translate(h[0], h[1]);
                // Calcule l'angle de déplacement et oriente le contexte
                ctx.rotate(Math.atan2(pr.vy, pr.vx));
                var correctionDegres = 30;
                var correctionRadians = correctionDegres * Math.PI / 180;
                ctx.rotate(correctionRadians);

                ctx.fillStyle = col;
                ctx.beginPath();

                // Réglages de taille
                var arrowLength = 12; // Longueur totale de la pointe
                var arrowWidth = 8;   // Largeur totale à la base

                // Optionnel: Décale le dessin pour que le point (0,0) ne soit pas tout à fait au bout de la pointe,
                // mais légèrement à l'intérieur, pour un meilleur rendu visuel lors des collisions.
                var arrowOffsetX = 0;

                // On dessine en partant du principe que la flèche pointe vers la droite (axe X positif)
                ctx.moveTo(arrowOffsetX + arrowLength, 0); // Pointe (à droite)
                ctx.lineTo(arrowOffsetX, arrowWidth / 2);    // Base arrière gauche
                ctx.lineTo(arrowOffsetX, -arrowWidth / 2);   // Base arrière droite

                ctx.closePath();
                ctx.fill();

                // Optionnel : Ajouter un contour fin à la flèche
                if (t.stroke) {
                    ctx.strokeStyle = t.stroke;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                ctx.restore();
            }
            // Flèche de tour : petit trait noir orienté (pas une boule).
            else if (pr.type === "fleche") {
                ctx.save();
                ctx.translate(h[0], h[1]);
                ctx.rotate(Math.atan2(pr.vy, pr.vx));
                ctx.strokeStyle = "#111111";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-6, 0);
                ctx.lineTo(6, 0);
                ctx.stroke();
                ctx.fillStyle = "#111111";
                ctx.beginPath();
                ctx.moveTo(6, 0);
                ctx.lineTo(2, -2);
                ctx.lineTo(2, 2);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            // Flamme (lance-flammes) : boule de feu vive qui grossit puis
            // s'eteint avec la vie restante, coeur clair.
            else if (pr.type === "flamme") {
                var lifeRatio = Math.max(0, Math.min(1, (pr.life || 0) / 0.45));
                var frad = (pr.size || 8) * (0.6 + 0.7 * (1 - lifeRatio));
                var grd = ctx.createRadialGradient(h[0], h[1], 0, h[0], h[1], frad);
                grd.addColorStop(0, "#fef3c7");
                grd.addColorStop(0.4, "#f97316");
                grd.addColorStop(1, "rgba(220,38,3,0)");
                ctx.fillStyle = grd;
                ctx.beginPath();
                ctx.arc(h[0], h[1], frad, 0, Math.PI * 2);
                ctx.fill();
            }
            // Grenade : boule verte avec reflet, rotation du levier.
            else if (pr.type === "grenade") {
                var grad = pr.size || 6;
                ctx.fillStyle = "#4d7c0f";
                ctx.beginPath();
                ctx.arc(h[0], h[1], grad, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#84cc16";
                ctx.beginPath();
                ctx.arc(h[0] - grad * 0.3, h[1] - grad * 0.3, grad * 0.35, 0, Math.PI * 2);
                ctx.fill();
            }
            // Sinon, affichage standard en rond (pour pistolet, fusil, etc.)
            else {
                var rad = pr.size !== undefined ? pr.size : (t.sizeBase + (pr.dmg || 1) * t.sizePerDmg);
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(h[0], h[1], rad, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = t.stroke;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    };

  // Brouillard multi-sources : le joueur + chaque tour construite dégagent
  // une zone de visibilité (union des dégradés radiaux). Uniquement hors
  // ville (la ville est toujours visible). Le joueur "se sent en sécurité"
  // à proximité d'une tour, même hors les murs.
  // Brouillard multi-sources : le joueur + chaque tour construite degagent
  // une zone de visibilite (union des degradees radiaux). Uniquement hors
  // ville (la ville est toujours visible). Le joueur "se sent en securite" a
  // proximite d'une tour, meme hors les murs.
  // Implementation : calque offscreen rempli une fois avec le brouillard
  // maximal, puis chaque source "troue" ce calque en destination-out (les
  // trous s'additionnent : une zone degagee par une source ne peut pas etre
  // rebouchee par une autre). Le calque est ensuite composite sur le canvas.
  var fogCanvas = null, fogCtx = null;
  G.drawFog = function () {
    var ctx = G.ctx;
    var state = G.state;
    var p = state.player;
    var W = G.canvas.width / (window.devicePixelRatio || 1);
    var H = G.canvas.height / (window.devicePixelRatio || 1);
    // Sources : joueur (rayon FOG_RADIUS) + tours construites (fogRadius).
    var sources = [];
    if (!G.inTown(p.x, p.y)) sources.push({ x: p.x, y: p.y, r: G.FOG_RADIUS });
    var towers = state.towers || [];
    for (var ti = 0; ti < towers.length; ti++) {
      var tw = towers[ti];
      if (!tw.chantierDone) continue;
      var stats = G.TOWER_STATS[tw.level] || G.TOWER_STATS.bois;
      sources.push({ x: tw.x + tw.w / 2, y: tw.y + tw.h / 2, r: stats.fogRadius });
    }
    if (sources.length === 0) return;
    var t = G.TEXTURES.fog;
    var z = state.zoom;
    // Le brouillard ne se dessine que si le joueur est hors ville (les tours
    // ne degagent que si le brouillard est actif).
    if (G.inTown(p.x, p.y)) return;
    if (!fogCanvas) {
      fogCanvas = document.createElement("canvas");
      fogCtx = fogCanvas.getContext("2d");
    }
    var dpr = window.devicePixelRatio || 1;
    if (fogCanvas.width !== G.canvas.width || fogCanvas.height !== G.canvas.height) {
      fogCanvas.width = G.canvas.width;
      fogCanvas.height = G.canvas.height;
    }
    fogCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var full = t.stops[t.stops.length - 1];
    // 1) Calque rempli du brouillard maximal (couleur/alpha du stop externe).
    fogCtx.globalCompositeOperation = "source-over";
    fogCtx.clearRect(0, 0, W, H);
    fogCtx.fillStyle = "rgba(" + t.color + "," + full.alpha + ")";
    fogCtx.fillRect(0, 0, W, H);
    // 2) Chaque source troue le calque : union des zones degagees.
    fogCtx.globalCompositeOperation = "destination-out";
    for (var si = 0; si < sources.length; si++) {
      var src = sources[si];
      var s = G.proj(src.x, src.y);
      var rx = src.r * 0.5 * z * 2;
      var ry = src.r * 0.25 * z * 2;
      var grad = fogCtx.createRadialGradient(s[0], s[1], Math.min(rx, ry) * 0.5, s[0], s[1], Math.max(rx, ry) * 1.3);
      // Degrade de trou : meme courbe que TEXTURES.fog.stops (alpha du trou
      // = 1 - alpha de brouillard a chaque arret).
      for (var i = 0; i < t.stops.length; i++) {
        grad.addColorStop(t.stops[i].at, "rgba(0,0,0," + (1 - t.stops[i].alpha) + ")");
      }
      fogCtx.fillStyle = grad;
      fogCtx.fillRect(0, 0, W, H);
    }
    fogCtx.globalCompositeOperation = "source-over";
    // 3) Composite du calque de brouillard sur la scene.
    ctx.drawImage(fogCanvas, 0, 0, W, H);
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

  // Tour d'attaque : rendu en 4 couches (cf. docs/towers.md) —
  // 1. chantier (boucle) pendant TOWER_BUILD_TIME secondes,
  // 2. idle (boucle lente) une fois construite,
  // 3. overlay tir gauche (MOITIE GAUCHE du PNG seulement, pour que les tirs
  //    simultanes gauche/droite ne se recouvrent pas),
  // 4. overlay tir droite (moitie droite).
  // Les overlays sont des PNG complets de la tour : on restreint le rect
  // source a la moitie concernee. Ancrage identique a la base (bas-centre sur
  // le bord sud du losange au sol), donc aucune couture possible.
  G.drawTower = function (t) {
    var ctx = G.ctx;
    var z = G.state.zoom;
    var stats = G.TOWER_STATS[t.level] || G.TOWER_STATS.bois;
    var A = G.proj(t.x, t.y), C = G.proj(t.x + t.w, t.y + t.h);
    var cx = (A[0] + C[0]) / 2, by = (A[1] + C[1]) / 2;
    var groundY = Math.max(G.proj(t.x, t.y + t.h)[1], C[1]);

    // Base : chantier ou idle (meme ancrage, memes dimensions).
    var baseKey = t.chantierDone ? "idle" : "chantier";
    var base = G.hasSprite("tour", baseKey) ? G.SPRITES.tour[baseKey] : null;
    if (!base) base = G.hasSprite("tour", "idle") ? G.SPRITES.tour.idle : null;
    var dw = (t.w + t.h) * 0.5 * z, dh = 0, dx = cx - dw / 2, dy = groundY;
    if (base) {
      dh = dw * base.h / base.w;
      dy = groundY - dh;
      var img = base;
      if (base.frames && base.frames.length > 0) {
        var fi;
        if (t.chantierDone) {
          fi = Math.floor((G.state.time || 0) * (stats.idleFps || 4)) % base.frames.length;
        } else {
          // Chantier : UN seul tour complet sur TOWER_BUILD_TIME, figé sur la
          // derniere frame ensuite (pas de cycle libre).
          fi = G.chantierFrame(base, t.builtAt, G.state.time, base.frames.length);
        }
        img = { img: base.frames[fi], w: base.w, h: base.h };
      } else {
        img = base.img ? base : { img: base, w: base.w, h: base.h };
      }
      ctx.drawImage(img.img || img, dx, dy, dw, dh);
    } else {
      // Repli sans PNG : boite iso simple.
      dh = t.h * 2 * z;
      dy = groundY - dh;
      ctx.fillStyle = "#7c5a3a";
      ctx.fillRect(cx - dw * 0.15, dy, dw * 0.3, dh);
    }

    // Overlays de tir : moitie gauche (gauche) / moitie droite (droite).
    // frame index depuis le timer d'anim restant (animDur -> 0).
    function drawHalf(sideKey, animT, sx0, sx1) {
      if (animT <= 0) return;
      var sp = G.hasSprite("tour", sideKey) ? G.SPRITES.tour[sideKey] : null;
      if (!sp || !sp.frames || sp.frames.length === 0) return;
      var elapsed = (stats.animDur || 0.5) - animT;
      var fi = Math.floor(elapsed * (sp.frames.length / (stats.animDur || 0.5)));
      if (fi >= sp.frames.length) fi = sp.frames.length - 1;
      var img = sp.frames[fi];
      var sh = dh * sp.h / base.h;
      var sw = sp.w * (sx1 - sx0);
      ctx.drawImage(img, sx0 * sp.w, 0, sw, sp.h, dx + sx0 * dw, groundY - sh, dw * (sx1 - sx0), sh);
    }
    if (base) {
      drawHalf("gauche", t.animL || 0, 0, 0.5);
      drawHalf("droite", t.animR || 0, 0.5, 1);
    }

    // Barre de vie (uniquement si endommagee).
    if (t.hp < t.maxHp) {
      var ratio = Math.max(0, t.hp / t.maxHp);
      var bw = Math.max(30, dw * 0.5);
      var bby = groundY - dh - 6;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(cx - bw / 2 - 1, bby - 1, bw + 2, 5);
      ctx.fillStyle = ratio < 0.3 ? "#ef4444" : "#22c55e";
      ctx.fillRect(cx - bw / 2, bby, bw * ratio, 3);
    }
  };

  // Montgolfiere : rendu au premier plan (apres le joueur). Memes regles
  // d'ancrage que drawBuilding (losange iso, bas du PNG sur le bord sud,
  // opaqueDrop pour les PNG aeres). Le PNG ne doit entrer en collision avec
  // rien : seule l'emprise sol (dans la moitie basse du PNG) est solide, le
  // reste du ballon est purement decoratif. Animation idle UN seul tour de
  // 4 s au clic (montgolfiereAnimFrame), frame statique sinon ; message
  // d'annonce de vague au-dessus du batiment apres l'animation.
  G.drawMontgolfiereTop = function () {
    var state = G.state;
    var b = state.montgolfiere;
    if (!b) return;
    var bnds = G.visibleWorldBounds();
    if (b.x + b.w < bnds.minX || b.x > bnds.maxX || b.y + b.h < bnds.minY || b.y > bnds.maxY) return;
    var ctx = G.ctx;
    var z = state.zoom;
    var A = G.proj(b.x, b.y), C = G.proj(b.x + b.w, b.y + b.h),
        D = G.proj(b.x, b.y + b.h);
    var cx = (A[0] + C[0]) / 2;
    var groundY = Math.max(C[1], D[1]);
    var hasIdle = G.hasSprite("montgolfiere", "idle");
    var hasChantier = G.hasSprite("montgolfiere", "chantier");
    var key = b.chantierDone ? "idle" : "chantier";
    var sprite = (key === "idle" && hasIdle) ? G.SPRITES.montgolfiere.idle
      : (key === "chantier" && hasChantier) ? G.SPRITES.montgolfiere.chantier
      : (hasIdle ? G.SPRITES.montgolfiere.idle : null);
    if (sprite) {
      var losangeW = (b.w + b.h) * 0.5 * z;
      var dw = losangeW;
      var img;
      if (b.chantierDone) {
        var fi = G.montgolfiereAnimFrame(b, state.time);
        img = (fi >= 0 && sprite.frames && sprite.frames[fi]) ? sprite.frames[fi] : sprite.img;
      } else {
        var nF = sprite.frames ? sprite.frames.length : 0;
        if (nF > 1) {
          var fi2 = G.chantierFrame(sprite, b.builtAt, state.time, nF);
          img = sprite.frames[fi2];
        } else {
          img = sprite.img;
        }
      }
      // Les frames de la serie idle ont des hauteurs differentes (le ballon
      // gonfle) : chaque image est ancree par le BAS sur le bord sud du
      // losange et mise a l'echelle sur sa propre hauteur.
      var iw = (img && img.naturalWidth) || sprite.w;
      var ih = (img && img.naturalHeight) || sprite.h;
      var dh = dw * ih / iw;
      ctx.drawImage(img, cx - dw / 2, groundY - dh, dw, dh);
      // Message d'annonce de vague : au-dessus du ballon, apres l'animation.
      var lines = G.montgolfiereWaveMessage(b, state.time);
      if (lines) {
        ctx.save();
        ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "rgba(2,6,23,0.8)";
        ctx.lineWidth = 3;
        var my = groundY - dh - 10;
        for (var li = lines.length - 1; li >= 0; li--) {
          ctx.strokeText(lines[li], cx, my);
          ctx.fillText(lines[li], cx, my);
          my -= 17;
        }
        ctx.restore();
      }
    }
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

  // Tour de siège : PNG par direction (déplacement) et état fermé/ouvert.
  // Ancrée bas-centre comme les autres entités : le bas du PNG sur le sol,
  // emprise de collision = losange de base dans les 5 % du bas (cf.
  // siege.js). Repli vectoriel :
  // tour de bois iso sombre + roues.
  G.drawSiegeTower = function (s) {
    var ctx = G.ctx;
    var z = G.state.zoom;
    var base = G.proj(s.x, s.y);
    var stateKey = s.open ? "ouvert" : "ferme";
    var spriteKey = s.dir + "/" + stateKey;
    var sprite = (G.hasSprite("siege", spriteKey)) ? G.SPRITES.siege[spriteKey] : null;
    // Repli : autre direction avec le même état, puis n'importe quel
    // sprite de la direction courante (le PNG "ferme" par défaut).
    if (!sprite && G.hasSprite("siege", s.dir + "/ferme")) sprite = G.SPRITES.siege[s.dir + "/ferme"];
    if (sprite) {
      // Échelle : le PNG est dessiné à la moitié de l'emprise monde
      // (SIEGE_SIDE / 2), cohérent avec les palissades (~40 px) et le
      // joueur (~6 px). Ancré bas-centre : le bas du PNG sur le sol.
      var dw = s.w * 0.5 * z;
      var dh = dw * sprite.h / sprite.w;
      var img = G.animImg(sprite, G.state.time);
      ctx.drawImage(img, base[0] - dw / 2, base[1] - dh, dw, dh);
    } else {
      // Repli vectoriel : masse sombre en forme de tour sur roues.
      var cw = s.w * z * 0.25;
      var chh = s.w * z * 0.45;
      ctx.fillStyle = "#4a3324";
      ctx.fillRect(base[0] - cw / 2, base[1] - chh, cw, chh);
      ctx.fillStyle = "#2f1f14";
      ctx.fillRect(base[0] - cw / 2, base[1] - chh * 0.2, cw, chh * 0.2);
      // Roues.
      ctx.fillStyle = "#1f1410";
      ctx.beginPath();
      ctx.arc(base[0] - cw * 0.5, base[1], cw * 0.25, 0, Math.PI * 2);
      ctx.arc(base[0] + cw * 0.5, base[1], cw * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    // Barre de vie (uniquement si endommagée), au-dessus du sprite rendu.
    if (s.hp < s.maxHp) {
      var ratio = Math.max(0, s.hp / s.maxHp);
      var bw = Math.max(30, s.w * z * 0.5);
      var spriteH = sprite ? (s.w * 0.5 * z) * (sprite.h / sprite.w) : s.w * z * 0.45;
      var topY = base[1] - spriteH - 8;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(base[0] - bw / 2 - 1, topY - 1, bw + 2, 5);
      ctx.fillStyle = ratio < 0.3 ? "#ef4444" : "#22c55e";
      ctx.fillRect(base[0] - bw / 2, topY, bw * ratio, 3);
    }
  };

  // Traces de destruction des tours de siège : dessinées juste après le
  // fond (comme les traces de zombies), jamais collisionnables.
  G.drawSiegeTraces = function () {
    var ctx = G.ctx;
    var z = G.state.zoom;
    var traces = G.state.siegeTraces;
    if (!traces || traces.length === 0) return;
    var list = G.SPRITES.siegeDead;
    if (!list || list.length === 0) return;
    var bnds = G.visibleWorldBounds();
    for (var i = 0; i < traces.length; i++) {
      var tr = traces[i];
      if (tr.x < bnds.minX || tr.x > bnds.maxX || tr.y < bnds.minY || tr.y > bnds.maxY) continue;
      var sp = list[tr.v % list.length];
      if (!sp || !sp.img) continue;
      var p = G.proj(tr.x, tr.y);
      var dw = sp.w * z * 0.5;
      var dh = dw * sp.h / sp.w;
      if (dw < 8) dw = 8;
      ctx.drawImage(sp.img, p[0] - dw / 2, p[1] - dh, dw, dh);
    }
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

    // Traces de zombies morts : tout en bas, derriere tout sauf le fond.
    G.drawDeadTraces();
    // Traces de destruction des tours de siège : même couche que les traces
    // de zombies (juste au-dessus du fond, derrière tout le reste).
    G.drawSiegeTraces();

    var drawables = [];
    var bnds = G.visibleWorldBounds();
    for (var bi = 0; bi < state.buildings.length; bi++) {
      var bld = state.buildings[bi];
      // Culling : ignore les bâtiments (forêts, maisons) hors écran.
      if (bld.x + bld.w < bnds.minX || bld.x > bnds.maxX || bld.y + bld.h < bnds.minY || bld.y > bnds.maxY) continue;
      // La montgolfiere est rendue HORS de la passe triee, en premier plan
      // (cf. drawMontgolfiereTop) : son ballon doit couvrir le joueur.
      if (bld.townBuilding === "montgolfiere") continue;
      // Profondeur : une forêt coupée (stage > 0) se dessine DERIERE ses
      // voisines pleines (s0). refitForet réduit son AABB vers le centre quand
      // on la coupe, ce qui augmentait x+y et la faisait passer DEVANT : les
      // souches (s4) couvraient les forêts pleines. Biais par état de coupe,
      // calibré sur l'écart de profondeur d'un cluster (forêts voisines
      // espacées de moins de ~100 px) : la forêt coupée recule d'un rang par
      // étage sans percer l'ordre des murs/zombies réellement devant elle.
      var depth = bld.x + bld.y;
      if (bld.isForet && (bld.foretStage || 0) > 0) {
        depth -= bld.foretStage * G.FORET_DEPTH_BIAS;
      }
      drawables.push({ depth: depth, type: "building", ref: bld });
    }
    for (var wi = 0; wi < state.walls.length; wi++) {
      var m = state.walls[wi];
      drawables.push({ depth: m.x + m.y, type: "wall", ref: m });
    }
    for (var ti = 0; ti < (state.towers || []).length; ti++) {
      var tw = state.towers[ti];
      if (tw.x + tw.w < bnds.minX || tw.x > bnds.maxX || tw.y + tw.h < bnds.minY || tw.y > bnds.maxY) continue;
      drawables.push({ depth: tw.x + tw.y, type: "tower", ref: tw });
    }
    for (var sgi = 0; sgi < (state.sieges || []).length; sgi++) {
      var sg = state.sieges[sgi];
      if (sg.x + sg.w < bnds.minX || sg.x > bnds.maxX || sg.y + sg.h < bnds.minY || sg.y > bnds.maxY) continue;
      drawables.push({ depth: sg.x + sg.y, type: "siege", ref: sg });
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
      else if (d.type === "tower") G.drawTower(d.ref);
      else if (d.type === "siege") G.drawSiegeTower(d.ref);
      else if (d.type === "zombie") G.drawZombie(d.ref);
      else if (d.type === "bird") G.drawBird(d.ref);
      else if (d.type === "player") G.drawRemotePlayer(d.ref);
    }
    if (!drewPlayer) { G.drawPlayer(); G.drawPlayerHpBar(); }
    // Objets au sol : dessines APRES la passe triee, au-dessus des batiments
    // et des forets — un objet ne doit jamais etre cache par une maison ou un
    // arbre (il reste toujours visible/ramassable).
    for (var ii = 0; ii < state.items.length; ii++) G.drawItem(state.items[ii]);

    // Montgolfiere : au premier plan, apres le joueur et les zombies. Le
    // ballon (moitie haute du PNG) n'a aucune collision : un joueur qui passe
    // "derriere" le ballon est cache par celui-ci.
    G.drawMontgolfiereTop();

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

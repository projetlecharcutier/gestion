// Entrées : resize canvas, souris (mouvement, clic), molette, clavier, formulaire de démarrage.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    G.canvas.width = Math.floor(window.innerWidth * dpr);
    G.canvas.height = Math.floor(window.innerHeight * dpr);
    G.canvas.style.width = window.innerWidth + "px";
    G.canvas.style.height = window.innerHeight + "px";
    G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener("resize", resize);
  resize();

  G.canvas.addEventListener("mousemove", function (e) {
    var rect = G.canvas.getBoundingClientRect();
    G.state.mouse.sx = e.clientX - rect.left;
    G.state.mouse.sy = e.clientY - rect.top;
    G.state.mouse.inside = true;
    var w = G.unproj(G.state.mouse.sx, G.state.mouse.sy);
    G.state.mouse.wx = w[0];
    G.state.mouse.wy = w[1];
  });

  G.canvas.addEventListener("mouseleave", function () { G.state.mouse.inside = false; });

  G.canvas.addEventListener("click", function (e) {
    var state = G.state;
    if (!state.started || state.paused || state.inBuilding || state.gameOver || state.chestOpen) return;
    var rect = G.canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;

    if (state.bag.open) {
      G.handleBagClick(sx, sy);
      return;
    }

    var w = G.unproj(sx, sy);
    var p = state.player;

    if (state.buildMode) {
      // En ligne : on stocke la cible pour que main.js l'envoie au serveur.
      // Hors-ligne : on appelle directement tryBuildWall.
      if (G.netConnected && G.netConnected()) state._buildWall = { wx: w[0], wy: w[1] };
      else G.tryBuildWall(w[0], w[1]);
      return;
    }

    for (var j = 0; j < state.items.length; j++) {
      var it = state.items[j];
      if (it.taken) continue;
      var ix = w[0] - it.x, iy = w[1] - it.y;
      var od = Math.sqrt(ix * ix + iy * iy);
      if (od < 70) {
        var px = p.x - it.x, py = p.y - it.y;
        if (Math.sqrt(px * px + py * py) < 120) {
          if (G.netConnected && G.netConnected()) {
            // Mode multijoueur : le serveur est autorité du ramassage.
            G.netInput({ pickup: { x: Math.round(it.x), y: Math.round(it.y) } });
          } else {
            it.taken = true;
            state.bag.contents.push({ name: it.name, kind: it.kind, color: it.color });
            state.inventory += 1;
            if (G.addFloater) G.addFloater(it.name);
            G.updateHud();
          }
        }
        return; // objet prioritaire sur les bâtiments
      }
    }

    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (b.isDecor) continue; // maisons décoratives : non cliquables
      if (!b.isMairie) continue; // seule la Mairie est cliquable (coffre)
      var clickR = Math.max(b.w, b.h) + 10;
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      var ddx = w[0] - cx, ddy = w[1] - cy;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < clickR) {
        var reach = clickR + 60;
        var pdx = p.x - cx, pdy = p.y - cy;
        if (Math.sqrt(pdx * pdx + pdy * pdy) < reach) {
          G.openMairieChest();
          return;
        }
      }
    }
  });

  G.canvas.addEventListener("wheel", function (e) {
    if (!G.state.started) return;
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    G.state.targetZoom = G.clamp(G.state.targetZoom * factor, 1, 40);
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    var state = G.state;
    if (e.code === "Space") {
      e.preventDefault();
      // En mode pose de planche, Espace fait tourner la planche (pas de tir).
      if (state.started && state.buildMode && !state.paused && !state.inBuilding && !state.bag.open && !state.gameOver) {
        if (G.netConnected && G.netConnected()) G.netInput({ rotate: true });
        G.rotatePlank();
      } else {
        state.keys.space = true;
      }
    }
    if (e.code === "Escape") {
      if (state.started && state.chestOpen) { G.closeChest(); return; }
      if (state.started && state.bag.open) { state.bag.open = false; return; }
      if (state.started && state.buildMode) { state.buildMode = false; return; }
      if (state.started) G.togglePause();
    }
    if (e.code === "KeyA" || e.key === "a" || e.key === "A" || e.key === "q" || e.key === "Q") {
      if (state.started && !state.paused && !state.inBuilding && !state.gameOver) {
        state.bag.open = !state.bag.open;
      }
    }
    // Z : mode pose de planche (activation / désactivation).
    if (e.code === "KeyZ" || e.key === "z" || e.key === "Z" || e.key === "w" || e.key === "W") {
      if (state.started && !state.paused && !state.inBuilding && !state.bag.open && !state.gameOver) {
        state.buildMode = !state.buildMode;
      }
    }
  });
  window.addEventListener("keyup", function (e) {
    if (e.code === "Space") G.state.keys.space = false;
  });

  G.startForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = G.nameInput.value.trim();
    if (!v) v = "Habitant";
    var state = G.state;
    state.playerName = v;
    G.startScreen.hidden = true;
    G.hud.hidden = false;
    state.gameOver = false;
    state.gameOverCause = "";
    state.player.hp = G.PLAYER_MAX_HP;
    state.planks = 0;
    state.clock = 8;
    state.day = 0;
    state.elapsed = 0;
    state.nextWaveAt = G.WAVE_EVERY;
    state.waveActive = false;
    state.waveCount = 0;
    state.zombies = [];
    state.zombieGroups = [];
    state.birds = [];
    state.walls = [];
    state.buildMode = false;
    state.plankRotation = 0;
    state.axeEquipped = false;
    state.chopTarget = null;
    state.chopWall = null;
    state.chopTimer = 0;
    state.chest = [];
    state.chestOpen = false;
    if (G.chestScreen) G.chestScreen.hidden = true;
    // Mode multijoueur : on rejoint la partie hébergée par le serveur. Le
    // serveur construit le monde et pilote la simulation ; le client reçoit la
    // carte au message "joined" (voir net.js).
    if (G.netConnected && G.netConnected()) {
      G.netJoin(v);
      state.started = true; // le rendu démarre ; l'état réel arrive via net.
      G.nameInput.blur();
      return;
    }
    // Fallback hors-ligne : on construit le monde localement.
    function doBuild() {
      G.buildWorld();
      G.spawnBirds();
      var p = state.player;
      p.x = G.WORLD / 2; p.y = G.WORLD / 2 + 140;
      var tries = 0;
      while (G.aabbHitsBuildings(p.x, p.y)) {
        p.x = G.rand(G.TOWN_MIN + 40, G.TOWN_MAX - 40);
        p.y = G.rand(G.TOWN_MIN + 40, G.TOWN_MAX - 40);
        if (++tries > 200) break;
      }
      state.camera.x = p.x; state.camera.y = p.y;
      G.updateHud();
      state.started = true;
    }
    if (G.assetsReady()) doBuild();
    else G.loadAssets(doBuild);
    G.nameInput.blur();
  });

  G.resumeBtn.addEventListener("click", G.togglePause);
  G.leaveBuildingBtn.addEventListener("click", G.leaveBuilding);
  G.closeChestBtn.addEventListener("click", G.closeChest);
})();

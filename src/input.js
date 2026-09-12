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
    if (!state.started || state.paused || state.inBuilding || state.gameOver) return;
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
      G.tryBuildWall(w[0], w[1]);
      return;
    }

    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      var ddx = w[0] - b.door.x, ddy = w[1] - b.door.y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < 80) {
        var pdx = p.x - b.door.x, pdy = p.y - b.door.y;
        if (Math.sqrt(pdx * pdx + pdy * pdy) < 160) {
          if (b.name === "Hôpital") {
            G.tryHealAtHospital();
            return;
          }
          G.enterBuilding(b);
          return;
        }
      }
    }

    for (var ti = 0; ti < state.trees.length; ti++) {
      var t = state.trees[ti];
      var tdx = w[0] - t.x, tdy = w[1] - t.y;
      if (Math.sqrt(tdx * tdx + tdy * tdy) < t.r * 0.6) {
        var pdx2 = p.x - t.x, pdy2 = p.y - t.y;
        if (Math.sqrt(pdx2 * pdx2 + pdy2 * pdy2) < G.WALL_BUILD_RANGE) {
          t.hp -= 1;
          if (t.hp <= 0) {
            var gain = 2 + G.randi(0, 2);
            state.planks += gain;
            G.updateHud();
          }
          return;
        }
      }
    }

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
          G.updateHud();
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
      state.keys.space = true;
    }
    if (e.code === "Escape") {
      if (state.started && state.bag.open) { state.bag.open = false; return; }
      if (state.started) G.togglePause();
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
    if (e.code === "Space") G.state.keys.space = false;
  });

  G.startForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = G.nameInput.value.trim();
    if (!v) return;
    var state = G.state;
    state.playerName = v;
    G.startScreen.hidden = true;
    G.hud.hidden = false;
    state.started = true;
    state.gameOver = false;
    state.player.hp = G.PLAYER_MAX_HP;
    state.planks = 0;
    state.clock = 8;
    state.day = 0;
    state.elapsed = 0;
    state.nextWaveAt = G.WAVE_EVERY;
    state.waveActive = false;
    state.zombies = [];
    state.zombieGroups = [];
    state.walls = [];
    state.buildMode = false;
    G.buildWorld();
    G.updateHud();
    G.nameInput.blur();
  });

  G.resumeBtn.addEventListener("click", G.togglePause);
  G.leaveBuildingBtn.addEventListener("click", G.leaveBuilding);
})();

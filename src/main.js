// Point d'entrée : logique par frame (update) + boucle de rendu (loop).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  function update(dt) {
    var state = G.state;
    state.time += dt;
    state.zoom += (state.targetZoom - state.zoom) * Math.min(1, dt * 12);

    if (state.shootCd > 0) state.shootCd -= dt;

    if (!state.paused && !state.gameOver) {
      state.elapsed += dt;
      state.clock += (12 / G.DAY_SECONDS) * dt;
      if (state.clock >= 24) {
        state.clock -= 24;
        state.day += 1;
      }
    }

    if (!state.gameOver) G.updateZombies(dt);

    if (!state.inBuilding && !state.paused && !state.bag.open && !state.chestOpen && !state.gameOver && !state.buildMode) {
      var p = state.player;
      var tx = state.mouse.wx, ty = state.mouse.wy;
      var dx = tx - p.x, dy = ty - p.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (state.mouse.inside && dist > G.PLAYER_W * 3) {
        var nx = dx / dist, ny = dy / dist;
        var stepX = p.x + nx * G.SPEED * dt;
        var stepY = p.y + ny * G.SPEED * dt;
        G.tryMove(stepX, stepY);
        p.moving = true;
        p.lastDx = nx; p.lastDy = ny;
        if (nx < 0) p.face = -1; else if (nx > 0) p.face = 1;
      } else {
        p.moving = false;
      }
    } else {
      // En mode build : le personnage est fige (immobile).
      if (state.buildMode) state.player.moving = false;
    }

    G.handleShooting();
    G.updateProjectiles(dt);
    G.cleanupZombies();
    G.cleanupBirds();
    G.cleanupWalls();
    G.updateBirds(dt);
    G.updateChop(dt);
    G.updateFloaters(dt);

    state.camera.x += (state.player.x - state.camera.x) * Math.min(1, dt * 6);
    state.camera.y += (state.player.y - state.camera.y) * Math.min(1, dt * 6);

    if (state.mouse.inside) {
      var w = G.unproj(state.mouse.sx, state.mouse.sy);
      state.mouse.wx = w[0];
      state.mouse.wy = w[1];
    }
    G.updateHud();
    G.updateMusic();
  }
  G.update = update;

  var last = performance.now();
  function loop(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (G.state.started) update(dt);
    G.render();
    requestAnimationFrame(loop);
  }
  // Lance le chargement asynchrone des sprites PNG (tolérant aux images manquantes).
  G.loadAssets(function () { /* sprites prêts ou manquants : le rendu fait fallback */ });
  requestAnimationFrame(loop);
})();

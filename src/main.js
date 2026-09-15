// Point d'entrée : logique par frame (update) + boucle de rendu (loop).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Construit et envoie un input au serveur multijoueur (déplacement, tir, build).
  // Renvoie true si l'input a été envoyé (le client ne doit pas simuler localement).
  function sendNetInput(dt) {
    if (!G.netConnected || !G.netConnected()) return false;
    var state = G.state;
    var p = state.player;
    var dx = 0, dy = 0, fire = false, build = false, buildWall = null;
    // Déplacement : Espace maintenu + souris dirige (autorisé en mode build).
    if (!state.inBuilding && !state.paused && !state.bag.open && !state.chestOpen && !state.churchOpen && !state.gameOver) {
      if (state.keys.space && state.mouse.inside) {
        var tx = state.mouse.wx, ty = state.mouse.wy;
        var ddx = tx - p.x, ddy = ty - p.y;
        var dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist > 0.001) { dx = ddx / dist; dy = ddy / dist; }
      }
      // Action (clic gauche maintenu) : tir si arme équipée, sinon la hache.
      // Bloqué en mode build (le clic gauche pose la palissade).
      if (!state.buildMode) fire = !!state.actionHeld;
    }
    if (state.buildMode) build = true;
    if (state._buildWall) { buildWall = state._buildWall; state._buildWall = null; }
    G.netInput({
      dx: dx, dy: dy, fire: fire, build: build, buildWall: buildWall,
      aimX: state.mouse.wx, aimY: state.mouse.wy
    });
    return true;
  }

  function update(dt) {
    var state = G.state;
    state.time += dt;
    state.zoom += (state.targetZoom - state.zoom) * Math.min(1, dt * 12);

    if (state.shootCd > 0) state.shootCd -= dt;

    // Mode multijoueur : le serveur est autorité. On envoie les inputs et on
    // consomme l'état distant (applyRemoteState dans net.js). On ne simule pas.
    var online = sendNetInput(dt);

    if (!online) {
      if (!state.paused && !state.gameOver) {
        state.elapsed += dt;
        state.clock += (12 / G.DAY_SECONDS) * dt;
        if (state.clock >= 24) { state.clock -= 24; state.day += 1; }
        if (state.day !== state.lastDay) { G.regenForets(); state.lastDay = state.day; }
      }
      if (!state.gameOver) G.updateZombies(dt);
      if (!state.inBuilding && !state.paused && !state.bag.open && !state.chestOpen && !state.churchOpen && !state.gameOver) {
        var p = state.player;
        // Déplacement : Espace maintenu + souris dirige (autorisé en mode build).
        if (state.keys.space && state.mouse.inside) {
          var tx = state.mouse.wx, ty = state.mouse.wy;
          var dx = tx - p.x, dy = ty - p.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.001) {
            var nx = dx / dist, ny = dy / dist;
            // La direction du sprite (lastDx/lastDy/face) suit la souris meme si
            // le mouvement reel est minuscule ou bloque : l'image reflete la
            // direction visee, independamment de la distance souris.
            p.lastDx = nx; p.lastDy = ny;
            if (nx < 0) p.face = -1; else if (nx > 0) p.face = 1;
            var stepX = p.x + nx * G.SPEED * dt;
            var stepY = p.y + ny * G.SPEED * dt;
            p.moving = G.tryMove(stepX, stepY);
          } else { p.moving = false; p.lastDx = 0; p.lastDy = 0; }
        } else { p.moving = false; p.lastDx = 0; p.lastDy = 0; }
      } else {
        state.player.moving = false;
      }
      G.handleShooting();
      G.updateProjectiles(dt);
      G.cleanupZombies();
      G.cleanupBirds();
      G.cleanupWalls();
      G.updateBirds(dt);
      G.updateChop(dt);
      G.updateFloaters(dt);
    } else {
      // Hors-ligne les floaters/chop ne tournent pas ; en ligne ils restent côté serveur.
      G.updateFloaters(dt);
    }

    state.camera.x += (state.player.x - state.camera.x) * Math.min(1, dt * 6);
    state.camera.y += (state.player.y - state.camera.y) * Math.min(1, dt * 6);

    if (state.mouse.inside) {
      var w = G.unproj(state.mouse.sx, state.mouse.sy);
      state.mouse.wx = w[0]; state.mouse.wy = w[1];
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
  // La connexion au serveur multijoueur n'est plus automatique : elle est
  // déclenchée par l'utilisateur via le choix "Jouer sur le serveur" du menu
  // (voir src/input.js). En local, aucun serveur n'est contacté.
  requestAnimationFrame(loop);
})();

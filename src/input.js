// Entrées : resize canvas, souris (mouvement, clic gauche=action, clic droit=sac),
// clavier (Espace=avancer), formulaire de démarrage.
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

  // Clic gauche = action (tir si arme équipée, OU utiliser la hache si
  // hache équipée). On gère l'état maintenu (mousedown/mouseup) pour que le
  // tir/hache se répète tant que le bouton est enfoncé.
  G.canvas.addEventListener("mousedown", function (e) {
    var state = G.state;
    if (!state.started || state.paused || state.inBuilding || state.gameOver || state.chestOpen || state.churchOpen || state.buildMenuOpen) return;
    if (e.button === 0) {
      // Clic gauche : action.
      if (state.buildMode) {
        // En build, le clic gauche pose le batiment selectionne (palissade,
        // scierie, tour) ou une planche si aucune selection.
        var rect = G.canvas.getBoundingClientRect();
        var w = G.unproj(e.clientX - rect.left, e.clientY - rect.top);
        if (state.buildSel && state.buildSel !== "palissade") {
          if (G.netConnected && G.netConnected()) state._placeBuild = { wx: w[0], wy: w[1] };
          else G.placeFromBuildMenu(w[0], w[1]);
        } else {
          if (G.netConnected && G.netConnected()) state._buildWall = { wx: w[0], wy: w[1] };
          else G.tryBuildWall(w[0], w[1]);
        }
        return;
      }
      // On n'arme pas l'action (tir/hache) tant qu'un menu (sac/coffre/eglise)
      // est ouvert : evite un tir accidentel au moment ou le double-clic ferme
      // le sac et equipe une arme.
      if (!state.bag.open && !state.chestOpen && !state.churchOpen) {
        state.actionHeld = true;
      }
      e.preventDefault();
    } else if (e.button === 2) {
      // Clic droit : en mode build = sortir du mode construction, sinon = sac.
      if (state.buildMode && !state.paused && !state.inBuilding && !state.gameOver) {
        state.buildMode = false;
        state.buildSel = null;
      } else if (!state.bag.open) {
        state.bag.open = true;
      } else if (state.bag.open) {
        state.bag.open = false;
      }
      e.preventDefault();
    }
  });
  G.canvas.addEventListener("mouseup", function (e) {
    if (e.button === 0) G.state.actionHeld = false;
  });
  G.canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  // Clic gauche gère aussi le ramassage d'objets et la mairie (clic simple).
  G.canvas.addEventListener("click", function (e) {
    var state = G.state;
    if (!state.started || state.paused || state.inBuilding || state.gameOver || state.chestOpen || state.churchOpen || state.buildMenuOpen) return;
    if (state.buildMode) return; // géré par mousedown
    var rect = G.canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;

    if (state.bag.open) {
      G.handleBagClick(sx, sy);
      return;
    }

    var w = G.unproj(sx, sy);
    var p = state.player;

    for (var j = 0; j < state.items.length; j++) {
      var it = state.items[j];
      if (it.taken) continue;
      var ix = w[0] - it.x, iy = w[1] - it.y;
      var od = Math.sqrt(ix * ix + iy * iy);
      if (od < 70) {
        var px = p.x - it.x, py = p.y - it.y;
        if (Math.sqrt(px * px + py * py) < 120) {
          // Pièce d'or : crédit direct au coffre de la mairie (pas de sac).
          if (it.kind === "or") {
            if (G.netConnected && G.netConnected()) {
              G.netInput({ pickup: { x: Math.round(it.x), y: Math.round(it.y) } });
              // Message optimiste : le serveur est autorite, mais l'aller-retour
              // de confirmation n'apporte rien au joueur. Le snapshot retirera
              // l'item de l'affichage.
              if (G.addFloater) G.addFloater("+1 pièce");
            } else {
              it.taken = true;
              state.mairieGold = (state.mairieGold || 0) + 1;
              if (G.addFloater) G.addFloater("+1 pièce");
              G.updateHud();
            }
            return;
          }
          if (G.netConnected && G.netConnected()) {
            G.netInput({ pickup: { x: Math.round(it.x), y: Math.round(it.y) } });
            // Message optimiste (le serveur valide et retire l'item du snapshot).
            if (G.addFloater) G.addFloater(it.name);
          } else {
            it.taken = true;
            state.bag.contents.push({ name: it.name, kind: it.kind, color: it.color });
            state.inventory += 1;
            if (G.addFloater) G.addFloater(it.name);
            G.updateHud();
          }
        }
        return;
      }
    }

    for (var i = 0; i < state.buildings.length; i++) {
      var b = state.buildings[i];
      if (b.isDecor) continue;
      if (b.isChurch) {
        // L'eglise est cliquable : depot de relique (+100 or) + son church.mp3.
        var clickRc = Math.max(b.w, b.h) / 2 + 10;
        var cxc = b.x + b.w / 2, cyc = b.y + b.h / 2;
        var ddxc = w[0] - cxc, ddyc = w[1] - cyc;
        if (Math.sqrt(ddxc * ddxc + ddyc * ddyc) < clickRc) {
          var reachc = clickRc + 60;
          var pdxc = p.x - cxc, pdyc = p.y - cyc;
          if (Math.sqrt(pdxc * pdxc + pdyc * pdyc) < reachc) {
            G.openChurch();
            return;
          }
        }
        continue;
      }
      if (b.townBuilding && G.TOWN_BUILDINGS[b.townBuilding]) {
        // Batiment de ville (scierie, universite, montgolfiere...) cliquable
        // selon le champ onClick du registre : buildMenu (scierie),
        // universite, montgolfiere.
        var clickRs = Math.max(b.w, b.h) / 2 + 10;
        // Montgolfiere : le ballon (moitie haute du PNG, dessinee au premier
        // plan et SANS collision) est bien plus grand que l'emprise sol. Le
        // clic accepte aussi le rect ecran du PNG : cliquer sur le ballon
        // declenche l'observation.
        var mgSprite = null;
        if (b.townBuilding === "montgolfiere" && G.hasSprite && G.hasSprite("montgolfiere", "idle")) {
          mgSprite = G.SPRITES.montgolfiere.idle;
        }
        var cxs = b.x + b.w / 2, cys = b.y + b.h / 2;
        var ddxs = w[0] - cxs, ddys = w[1] - cys;
        var inClickR = Math.sqrt(ddxs * ddxs + ddys * ddys) < clickRs;
        if (!inClickR && mgSprite) {
          var zmg = G.state.zoom;
          var Aw = G.proj(b.x, b.y), Cw = G.proj(b.x + b.w, b.y + b.h),
              Dw = G.proj(b.x, b.y + b.h);
          var cxm = (Aw[0] + Cw[0]) / 2, groundYm = Math.max(Cw[1], Dw[1]);
          var dwm = (b.w + b.h) * 0.5 * zmg;
          var dhm = dwm * mgSprite.h / mgSprite.w;
          var sm = G.proj(w[0], w[1]);
          inClickR = sm[0] > cxm - dwm / 2 && sm[0] < cxm + dwm / 2 &&
                     sm[1] > groundYm - dhm && sm[1] < groundYm;
        }
        if (inClickR) {
          var reachs = clickRs + 60;
          var pdxs = p.x - cxs, pdys = p.y - cys;
          if (Math.sqrt(pdxs * pdxs + pdys * pdys) < reachs) {
            var tdef = G.TOWN_BUILDINGS[b.townBuilding];
            if (tdef.onClick === "buildMenu") G.openBuildMenu();
            else if (tdef.onClick === "montgolfiere") G.triggerMontgolfiere(b);
            else if (tdef.onClick === "universite") G.openUniversite();
            return;
          }
        }
        continue;
      }
      if (!b.isMairie) continue;
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
    // En mode build : la molette tourne la palissade (pas de zoom).
    if (G.state.buildMode && !G.state.paused && !G.state.inBuilding && !G.state.gameOver) {
      if (G.netConnected && G.netConnected()) G.netInput({ rotate: true });
      G.rotatePlank();
      return;
    }
    var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    G.state.targetZoom = G.clamp(G.state.targetZoom * factor, 1, 40);
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    var state = G.state;
    if (e.code === "Space") {
      e.preventDefault();
      // Espace = avancer (vers la souris), y compris en mode build.
      state.keys.space = true;
    }
    if (e.code === "Escape") {
      if (state.started && state.buildMenuOpen) { G.closeBuildMenu(); return; }
      if (state.started && state.churchOpen) { G.closeChurch(); return; }
      if (G.universiteScreen && !G.universiteScreen.hidden) { G.closeUniversite(); return; }
      if (state.started && state.chestOpen) { G.closeChest(); return; }
      if (state.started && state.bag.open) { state.bag.open = false; return; }
      if (state.started && state.buildMode) { state.buildMode = false; state.buildSel = null; return; }
      if (state.started) G.togglePause();
    }
    // Z : ouvre le menu de construction (liste des bâtiments). Si un
    // bâtiment est déjà sélectionné, Z bascule simplement le mode pose.
    if (e.code === "KeyZ" || e.key === "z" || e.key === "Z" || e.key === "w" || e.key === "W") {
      if (state.started && !state.paused && !state.inBuilding && !state.bag.open && !state.gameOver) {
        if (state.buildSel && state.buildMode) {
          state.buildMode = false;
        } else if (state.buildSel) {
          state.buildMode = true;
        } else {
          G.openBuildMenu();
        }
      }
    }
  });
  window.addEventListener("keyup", function (e) {
    if (e.code === "Space") G.state.keys.space = false;
  });

  // État du mode de jeu choisi dans le menu : "local" (défaut) ou "server".
  // En local, aucun serveur n'est contacté et la simulation tourne côté client.
  // En serveur, on déclenche la connexion WebSocket et on affiche le lobby.
  G.playMode = "local";
  var modeChoice = document.getElementById("modeChoice");
  var lobbyInfo = document.getElementById("lobbyInfo");
  if (modeChoice) {
    modeChoice.addEventListener("change", function (e) {
      var chosen = e.target.value;
      G.playMode = chosen;
      if (chosen === "server") {
        // Lance la connexion au serveur (idempotente) et montre le lobby.
        if (G.netConnect) G.netConnect();
        if (lobbyInfo) lobbyInfo.hidden = false;
        if (!G.lobbyInfo && lobbyInfo) lobbyInfo.textContent = "Connexion au serveur…";
      } else {
        if (lobbyInfo) lobbyInfo.hidden = true;
      }
    });
  }

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
    state.waveSpawnedForDay = false;
    state.zombieMode = "attack";
    state.waveMsgTimer = 0;
    state.zombies = [];
    state.zombieGroups = [];
    state.deadTraces = [];
    state.birds = [];
    state.walls = [];
    state.buildMode = false;
    state.buildSel = null;
    state.plankRotation = 0;
    state.axeEquipped = false;
    state.chopTarget = null;
    state.chopWall = null;
    state.chopTimer = 0;
    state.chest = [];
    state.chestOpen = false;
    state.churchOpen = false;
    if (G.chestScreen) G.chestScreen.hidden = true;
    if (G.churchScreen) G.churchScreen.hidden = true;
    // Mode serveur : on rejoint la partie hébergée par le serveur. Le serveur
    // construit le monde et pilote la simulation ; le client reçoit la carte
    // au message "joined" (voir net.js). On ne démarre la simulation locale que
    // si la connexion est établie.
    if (G.playMode === "server" && G.netConnected && G.netConnected()) {
      G.netJoin(v);
      state.started = true; // le rendu démarre ; l'état réel arrive via net.
      G.nameInput.blur();
      return;
    }
    // Mode local (ou serveur injoignable) : on construit le monde localement.
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
  if (G.closeBuildMenuBtn) G.closeBuildMenuBtn.addEventListener("click", G.closeBuildMenu);
  if (G.closeChurchBtn) G.closeChurchBtn.addEventListener("click", G.closeChurch);
  if (G.closeUniversiteBtn) G.closeUniversiteBtn.addEventListener("click", G.closeUniversite);
})();

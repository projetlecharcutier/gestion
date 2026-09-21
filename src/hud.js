// HUD : mise à jour des éléments DOM + overlays canvas (horloge, barre de vie, hint build, game over).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.updateHud = function () {
    var state = G.state;
    G.hudName.textContent = state.playerName;
    var p = state.player;
    G.hudZone.textContent = G.inTown(p.x, p.y) ? "Ville" : "Hors ville";
    G.hudPos.textContent = "(" + Math.round(p.x) + ", " + Math.round(p.y) + ")";
    // Compteur de joueurs connectés : uniquement en mode serveur (le lobby
    // d'accueil affiche déjà l'info avant le join).
    if (G.hudPlayers) {
      if (G.playMode === "server") {
        G.hudPlayers.hidden = false;
        G.hudPlayers.textContent = "Joueurs : " + (state.playersOnline || 0) + "/" + (G.MAX_PLAYERS || 20);
      } else {
        G.hudPlayers.hidden = true;
      }
    }
    // Liste des joueurs connectés (panneau droit, mode serveur uniquement).
    // Le DOM n'est reconstruit que si la liste change (noms/ordre/état mort) :
    // updateHud tourne à chaque frame, inutile de toucher au DOM sinon.
    if (G.hudPlayerList && G.hudPlayerListNames && G.hudPlayerListCount) {
      if (G.playMode === "server") {
        var names = [];
        // Mort du joueur local : gameOver individuel reserve au joueur mort
        // (net.js), le serveur continue la partie pour les survivants.
        var meDead = state.gameOver && state.gameOverCause === "player";
        if (state.playerName) names.push(state.playerName + (meDead ? " †" : "") + " (vous)");
        var rp = state.remotePlayers || [];
        for (var pli = 0; pli < rp.length; pli++) names.push(rp[pli].name + (rp[pli].alive === false ? " †" : ""));
        var sig = names.join("|");
        G.hudPlayerList.hidden = false;
        G.hudPlayerListCount.textContent = String(names.length);
        if (sig !== state._lastPlayerListSig) {
          state._lastPlayerListSig = sig;
          while (G.hudPlayerListNames.firstChild) G.hudPlayerListNames.removeChild(G.hudPlayerListNames.firstChild);
          var li0 = document.createElement("li");
          li0.className = "is-me";
          if (meDead) li0.className += " is-dead";
          li0.textContent = state.playerName ? state.playerName + (meDead ? " †" : "") + " (vous)" : "";
          if (li0.textContent) G.hudPlayerListNames.appendChild(li0);
          for (var plj = 0; plj < rp.length; plj++) {
            var li = document.createElement("li");
            if (rp[plj].alive === false) li.className = "is-dead";
            li.textContent = rp[plj].name + (rp[plj].alive === false ? " †" : "");
            G.hudPlayerListNames.appendChild(li);
          }
        }
      } else {
        G.hudPlayerList.hidden = true;
      }
    }
    G.hudInv.textContent = String(state.inventory);
    // Un seul objet equipe a la fois : arme OU hache.
    if (state.axeEquipped) G.hudWeapon.textContent = "Hache";
    else G.hudWeapon.textContent = state.equipped || "Mains nues";
    if (G.hudAxe) G.hudAxe.textContent = state.axeEquipped ? "oui" : "non";
    G.hudHp.textContent = String(Math.round(state.player.hp));
    G.hudPlanks.textContent = String(state.planks);
    if (G.hudGold) G.hudGold.textContent = String(state.mairieGold || 0);
    if (G.hudMairie) {
      var mairie = null;
      for (var i = 0; i < state.buildings.length; i++) { if (state.buildings[i].isMairie) { mairie = state.buildings[i]; break; } }
      G.hudMairie.textContent = mairie ? String(Math.round(mairie.hp)) : "—";
    }
    // Coffre ouvert avec un vote en cours : le decompte affiche dans la
    // section Technologies doit avancer en temps reel (redessine seulement
    // quand la seconde affichee change, pas a chaque frame).
    if (state.chestOpen && state.vote && G.drawChest) {
      var secLeft = Math.max(0, Math.ceil((state.vote.endsAt || 0) - state.time));
      if (secLeft !== state._lastVoteSecShown) {
        state._lastVoteSecShown = secLeft;
        G.drawChest();
      }
    }
  };

  G.drawClock = function () {
    var ctx = G.ctx;
    var t = G.TEXTURES.clock;
    var W = G.canvas.width / (window.devicePixelRatio || 1);
    var h = Math.floor(G.state.clock);
    var m = Math.floor((G.state.clock - h) * 60);
    var hh = h < 10 ? "0" + h : "" + h;
    var mm = m < 10 ? "0" + m : "" + m;
    var night = G.isNight(G.state.clock);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = night ? t.night : t.day;
    ctx.font = "bold 22px Segoe UI, system-ui, sans-serif";
    ctx.fillText((night ? "🌙 " : "☀ ") + hh + ":" + mm, W / 2, 12);
    if (G.state.waveMsgTimer > 0) {
      ctx.fillStyle = t.waveColor;
      ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
      ctx.fillText("⚠ Vague de zombies !", W / 2, 40);
    }
    if (G.state.hordeMsgTimer > 0) {
      ctx.fillStyle = t.waveColor;
      ctx.font = "bold 16px Segoe UI, system-ui, sans-serif";
      ctx.fillText("☠ La horde arrive !", W / 2, 60);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = t.dayColor;
    ctx.font = "bold 16px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Jour " + G.state.day, W - 14, 52);
    var live = G.state.zombies.length;
    if (G.state.waveActive) {
      ctx.fillStyle = t.waveColor;
      ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
      ctx.fillText("Zombies : " + live + " / " + (G.state.waveCount || live), W - 14, 72);
    }
    ctx.restore();
  };

  G.drawPlayerHpBar = function () {
    var ctx = G.ctx;
    var p = G.state.player;
    var t = G.TEXTURES.playerHpBar;
    var base = G.proj(p.x, p.y);
    var z = G.state.zoom;
    var w = t.width, h = t.height;
    var ratio = p.hp / G.PLAYER_MAX_HP;
    var col = ratio < 0.30 ? t.color.low : (ratio < 0.60 ? t.color.mid : t.color.high);
    ctx.save();
    ctx.fillStyle = t.bg;
    ctx.fillRect(base[0] - w / 2 - 1, base[1] - 26 * z - h - 2, w + 2, h + 2);
    ctx.fillStyle = col;
    ctx.fillRect(base[0] - w / 2, base[1] - 26 * z - h - 1, w * ratio, h);
    ctx.restore();
  };

  G.drawBuildHint = function () {
    if (!G.state.buildMode || !G.state.mouse.inside) return;
    var ctx = G.ctx;
    var t = G.TEXTURES.buildHint;
    var state = G.state;
    var sel = state.buildSel;
    // Emprise + libellé selon la sélection (palissade par défaut).
    var w, h, label, ok;
    if (sel && G.TOWN_BUILDINGS[sel]) {
      var tdef = G.TOWN_BUILDINGS[sel];
      w = tdef.side; h = tdef.side;
      label = tdef.label;
      ok = !state[tdef.stateField] && G.inTown(state.mouse.wx, state.mouse.wy);
    } else if (sel && sel.indexOf("tour:") === 0) {
      var tSide = G.towerSide(sel.slice(5));
      w = tSide; h = tSide;
      label = (G.TOWER_STATS[sel.slice(5)] || {}).label || "Tour";
      var ts = G.TOWER_STATS[sel.slice(5)] || { cost: { gold: 0, planks: 0 } };
      ok = (state.mairieGold || 0) >= ts.cost.gold && (state.planks || 0) >= ts.cost.planks;
    } else {
      var dims = G.plankDims();
      w = dims.w; h = dims.h;
      label = "Palissade";
      ok = state.planks >= G.WALL_PLANKS;
    }
    // Centre en coords monde.
    var cxw = state.mouse.wx, cyw = state.mouse.wy;
    // Losange iso : projette les 4 coins de l'emprise (comme drawWall).
    var A = G.proj(cxw - w / 2, cyw - h / 2),
        B = G.proj(cxw + w / 2, cyw - h / 2),
        C = G.proj(cxw + w / 2, cyw + h / 2),
        D = G.proj(cxw - w / 2, cyw + h / 2);
    ctx.save();
    ctx.strokeStyle = ok ? t.ok : t.nok;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.lineTo(C[0], C[1]);
    ctx.lineTo(D[0], D[1]);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = t.textColor;
    ctx.font = "12px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    var by = Math.min(A[1], B[1]);
    ctx.fillText(label + (ok ? "" : " (emplacement ou ressources invalides)") +
      " · Z = menu · Clic droit = annuler", (A[0] + C[0]) / 2, by - 8);
    ctx.restore();
  };

  G.drawChopProgress = function () {
    var prog = G.chopProgress();
    if (prog < 0) return;
    var ctx = G.ctx;
    var t = G.TEXTURES.chopProgress;
    var p = G.state.player;
    var base = G.proj(p.x, p.y);
    var z = G.state.zoom;
    var r = t.radius;
    var cx = base[0] + 18 + r;
    var cy = base[1] - 24 * z * 0.5 - r;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = t.bg;
    ctx.lineWidth = t.lineWidth;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.strokeStyle = t.ringDone;
    ctx.lineWidth = t.lineWidth;
    ctx.stroke();
    ctx.fillStyle = t.ring;
    ctx.font = "bold 12px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.ceil((1 - prog) * G.TREE_CHOP_TIME) + "s", cx, cy);
    ctx.restore();
  };

  G.drawGameOver = function () {
    if (!G.state.gameOver) return;
    var ctx = G.ctx;
    var t = G.TEXTURES.gameOver;
    var W = G.canvas.width / (window.devicePixelRatio || 1);
    var H = G.canvas.height / (window.devicePixelRatio || 1);
    ctx.save();
    ctx.fillStyle = t.veil;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = t.title;
    ctx.font = "bold 40px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var dead = G.state.gameOverCause === "mairie";
    ctx.fillText(dead ? "La Mairie est détruite" : "Vous êtes mort", W / 2, H / 2 - 20);
    ctx.fillStyle = t.text;
    ctx.font = "18px Segoe UI, system-ui, sans-serif";
    ctx.fillText((dead ? "Les zombies ont rasé la ville. " : "") + "Vous avez survécu jusqu'au jour " + G.state.day, W / 2, H / 2 + 20);
    ctx.fillStyle = t.hint;
    ctx.font = "14px Segoe UI, system-ui, sans-serif";
    // En ligne, la partie redemarre toute seule (serveur autoritaire, nouvelle
    // carte diffusee) : "rechargez la page" etait faux et remettait au menu.
    var online = G.netConnected && G.netConnected();
    ctx.fillText(dead && online
      ? "Nouvelle partie dans quelques secondes..."
      : (dead ? "Rechargez la page pour recommencer"
              : (online ? "Vous êtes spectateur : la partie continue pour les survivants"
                        : "Rechargez la page pour recommencer")),
      W / 2, H / 2 + 48);
    ctx.restore();
  };
})();

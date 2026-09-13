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
    G.hudInv.textContent = String(state.inventory);
    // Un seul objet equipe a la fois : arme OU hache.
    if (state.axeEquipped) G.hudWeapon.textContent = "Hache";
    else G.hudWeapon.textContent = state.equipped || "Mains nues";
    if (G.hudAxe) G.hudAxe.textContent = state.axeEquipped ? "oui" : "non";
    G.hudHp.textContent = String(Math.round(state.player.hp));
    G.hudPlanks.textContent = String(state.planks);
    if (G.hudGold) G.hudGold.textContent = String(state.gold);
    if (G.hudMairie) {
      var mairie = null;
      for (var i = 0; i < state.buildings.length; i++) { if (state.buildings[i].isMairie) { mairie = state.buildings[i]; break; } }
      G.hudMairie.textContent = mairie ? String(Math.round(mairie.hp)) : "—";
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
    if (G.state.waveActive) {
      ctx.fillStyle = t.waveColor;
      ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
      ctx.fillText("⚠ Vague de zombies", W / 2, 40);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = t.dayColor;
    ctx.font = "bold 16px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Jour " + G.state.day, W - 14, 14);
    var live = G.state.zombies.length;
    if (G.state.waveActive) {
      ctx.fillStyle = t.waveColor;
      ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
      ctx.fillText("Zombies : " + live + " / " + (G.state.waveCount || live), W - 14, 34);
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
    ctx.fillRect(base[0] - w / 2 - 1, base[1] - 24 * z * 0.5 - h - 2, w + 2, h + 2);
    ctx.fillStyle = col;
    ctx.fillRect(base[0] - w / 2, base[1] - 24 * z * 0.5 - h - 1, w * ratio, h);
    ctx.restore();
  };

  G.drawBuildHint = function () {
    if (!G.state.buildMode || !G.state.mouse.inside) return;
    var ctx = G.ctx;
    var t = G.TEXTURES.buildHint;
    var s = G.proj(G.state.mouse.wx, G.state.mouse.wy);
    var dims = G.plankDims();
    var z = G.state.zoom;
    var pw = dims.w * 0.25 * z, ph = dims.h * 0.25 * z;
    ctx.save();
    ctx.strokeStyle = G.state.planks >= G.WALL_PLANKS ? t.ok : t.nok;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(s[0] - pw / 2, s[1] - ph / 2, pw, ph);
    ctx.setLineDash([]);
    ctx.fillStyle = t.textColor;
    ctx.font = "12px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(G.state.planks >= G.WALL_PLANKS ?
      "Poser une planche (" + G.state.planks + " planches) · Clic droit = rotation" :
      "Pas assez de planches (" + G.state.planks + "/" + G.WALL_PLANKS + ")", s[0], s[1] - ph / 2 - 8);
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
    ctx.fillText("Rechargez la page pour recommencer", W / 2, H / 2 + 48);
    ctx.restore();
  };
})();

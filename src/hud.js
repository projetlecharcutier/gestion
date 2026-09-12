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
    G.hudWeapon.textContent = state.equipped || "Mains nues";
    G.hudHp.textContent = String(Math.round(state.player.hp));
    G.hudPlanks.textContent = String(state.planks);
  };

  G.drawClock = function () {
    var ctx = G.ctx;
    var W = G.canvas.width / (window.devicePixelRatio || 1);
    var h = Math.floor(G.state.clock);
    var m = Math.floor((G.state.clock - h) * 60);
    var hh = h < 10 ? "0" + h : "" + h;
    var mm = m < 10 ? "0" + m : "" + m;
    var night = G.isNight(G.state.clock);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = night ? "#1e293b" : "#fef3c7";
    ctx.font = "bold 22px Segoe UI, system-ui, sans-serif";
    ctx.fillText((night ? "🌙 " : "☀ ") + hh + ":" + mm, W / 2, 12);
    if (G.state.waveActive) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
      ctx.fillText("⚠ Vague de zombies", W / 2, 40);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Jour " + G.state.day, W - 14, 14);
    ctx.restore();
  };

  G.drawPlayerHpBar = function () {
    var ctx = G.ctx;
    var p = G.state.player;
    var base = G.proj(p.x, p.y);
    var z = G.state.zoom;
    var w = 28, h = 4;
    var ratio = p.hp / G.PLAYER_MAX_HP;
    var col = ratio < 0.30 ? "#ef4444" : (ratio < 0.60 ? "#f59e0b" : "#22c55e");
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(base[0] - w / 2 - 1, base[1] - 24 * z * 0.5 - h - 2, w + 2, h + 2);
    ctx.fillStyle = col;
    ctx.fillRect(base[0] - w / 2, base[1] - 24 * z * 0.5 - h - 1, w * ratio, h);
    ctx.restore();
  };

  G.drawBuildHint = function () {
    if (!G.state.buildMode || !G.state.mouse.inside) return;
    var ctx = G.ctx;
    var s = G.proj(G.state.mouse.wx, G.state.mouse.wy);
    ctx.save();
    ctx.strokeStyle = G.state.planks >= G.WALL_PLANKS ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(s[0] - 30, s[1] - 18, 60, 36);
    ctx.setLineDash([]);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(G.state.planks >= G.WALL_PLANKS ?
      "Construire (" + G.state.planks + " planches)" :
      "Pas assez de planches (" + G.state.planks + "/" + G.WALL_PLANKS + ")", s[0], s[1] - 26);
    ctx.restore();
  };

  G.drawGameOver = function () {
    if (!G.state.gameOver) return;
    var ctx = G.ctx;
    var W = G.canvas.width / (window.devicePixelRatio || 1);
    var H = G.canvas.height / (window.devicePixelRatio || 1);
    ctx.save();
    ctx.fillStyle = "rgba(2,6,23,0.8)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 40px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Vous êtes mort", W / 2, H / 2 - 20);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "18px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Vous avez survécu jusqu'au jour " + G.state.day, W / 2, H / 2 + 20);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Rechargez la page pour recommencer", W / 2, H / 2 + 48);
    ctx.restore();
  };
})();

// Sac : disposition, rendu du sac, clic pour équiper une arme.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.bagLayout = function () {
    var W = G.canvas.width / (window.devicePixelRatio || 1);
    var H = G.canvas.height / (window.devicePixelRatio || 1);
    var pw = Math.min(460, W - 40), ph = Math.min(420, H - 60);
    var px = (W - pw) / 2, py = (H - ph) / 2;
    var listY = py + 96;
    var lineH = 30;
    var maxLines = Math.floor((ph - 112) / lineH);
    return { W: W, H: H, px: px, py: py, pw: pw, ph: ph, listY: listY, lineH: lineH, maxLines: maxLines };
  };

  G.handleBagClick = function (sx, sy) {
    var L = G.bagLayout();
    var n = G.state.bag.contents.length;
    var shown = Math.min(n, L.maxLines);
    for (var i = 0; i < shown; i++) {
      var ly = L.listY + i * L.lineH + 14;
      if (sy >= ly - L.lineH / 2 && sy < ly + L.lineH / 2 &&
          sx >= L.px && sx <= L.px + L.pw) {
        var it = G.state.bag.contents[i];
        if (it.kind === "arme") {
          G.state.equipped = (G.state.equipped === it.name) ? null : it.name;
        }
        return;
      }
    }
  };

  G.drawBag = function () {
    var ctx = G.ctx;
    var L = G.bagLayout();
    var W = L.W, H = L.H, px = L.px, py = L.py, pw = L.pw, ph = L.ph;
    ctx.save();
    ctx.fillStyle = "rgba(2,6,23,0.7)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    G.roundRect(px, py, pw, ph, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#818cf8";
    ctx.font = "bold 20px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Sac de " + G.state.playerName, px + 18, py + 34);

    var eq = G.state.equipped || "Mains nues";
    var st = G.equippedStats();
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Équipé : " + eq, px + 18, py + 56);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Segoe UI, system-ui, sans-serif";
    ctx.fillText("dégâts " + st.dmg + " · portée " + Math.round(st.speed * st.life) +
                  " · cadence " + (1 / st.cd).toFixed(1) + "/s · dispersion " + Math.round(st.spread * 100) + "%",
                  px + 18, py + 74);
    ctx.textAlign = "right";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Segoe UI, system-ui, sans-serif";
    ctx.fillText("A fermer · clic sur une arme = équiper", px + pw - 18, py + 34);

    var listY = L.listY, lineH = L.lineH;
    ctx.font = "15px Segoe UI, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    var n = G.state.bag.contents.length;
    var shown = Math.min(n, L.maxLines);
    if (n === 0) {
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText("(vide — ramassez des objets et armes au sol)", px + 18, listY + 12);
    }
    for (var i = 0; i < shown; i++) {
      var it = G.state.bag.contents[i];
      var ly = listY + i * lineH + 14;
      var isEq = (it.kind === "arme") && (it.name === G.state.equipped);
      if (isEq) {
        ctx.fillStyle = "rgba(251,191,36,0.16)";
        ctx.fillRect(px + 10, ly - lineH / 2 + 2, pw - 20, lineH - 4);
      }
      ctx.fillStyle = it.color || "#fbbf24";
      if (it.kind === "arme") {
        ctx.fillRect(px + 20, ly - 6, 16, 7);
        ctx.fillStyle = "#3b2a1a";
        ctx.fillRect(px + 26, ly + 1, 5, 6);
      } else {
        ctx.beginPath();
        ctx.arc(px + 28, ly - 2, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = isEq ? "#fbbf24" : "#f1f5f9";
      ctx.textAlign = "left";
      ctx.fillText(it.name + (isEq ? "  (équipé)" : ""), px + 50, ly);
      ctx.fillStyle = it.kind === "arme" ? "#818cf8" : "#64748b";
      ctx.textAlign = "right";
      var suffix = it.kind === "arme" ? "arme (clic pour équiper)" : it.kind;
      ctx.fillText(suffix, px + pw - 18, ly);
    }
    ctx.restore();
  };
})();

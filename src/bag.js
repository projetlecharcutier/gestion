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

  // Regroupe les objets identiques (meme nom + type) avec leur nombre.
  // Retourne [{ name, kind, color, count, first }] ou first = index du
  // premier exemplaire dans contents (pour l'equiper/deposer).
  G.groupItems = function (list) {
    var out = [];
 var seen = {};
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var key = it.name + "|" + it.kind;
      if (seen[key] !== undefined) { out[seen[key]].count++; }
      else { seen[key] = out.length; out.push({ name: it.name, kind: it.kind, color: it.color, count: 1, first: i }); }
    }
    return out;
  };

  // Detecte le double-clic : si deux clics sur la meme ligne en < 350 ms,
  // on force l'equipement de l'arme (sans bascule) et on ferme le sac.
  var _bagLastClick = { idx: -1, time: 0 };

  G.handleBagClick = function (sx, sy) {
    var L = G.bagLayout();
    var groups = G.groupItems(G.state.bag.contents);
    var n = groups.length;
    var shown = Math.min(n, L.maxLines);
    for (var i = 0; i < shown; i++) {
      var ly = L.listY + i * L.lineH + 14;
      if (sy >= ly - L.lineH / 2 && sy < ly + L.lineH / 2 &&
          sx >= L.px && sx <= L.px + L.pw) {
        var it = groups[i];
        var now = (typeof performance !== "undefined" ? performance.now() : Date.now());
        var isDbl = (_bagLastClick.idx === i && (now - _bagLastClick.time) < 350);
        _bagLastClick = { idx: i, time: now };
        if (it.kind === "arme") {
          var newEq;
          if (isDbl) {
            // Double-clic : force l'equipement (pas de bascule) + ferme le sac.
            newEq = it.name;
            G.state.bag.open = false;
          } else {
            newEq = (G.state.equipped === it.name) ? null : it.name;
          }
          if (G.netConnected && G.netConnected()) G.netInput({ equip: newEq });
          G.state.equipped = newEq;
          if (G.state.equipped) G.state.axeEquipped = false;
        } else if (it.kind === "objet" && it.name === "Nourriture") {
          var contents = G.state.bag.contents;
          if (G.netConnected && G.netConnected()) {
            G.netInput({ eat: true });
          } else if (G.state.player.hp < G.PLAYER_MAX_HP) {
            var fi = -1;
            for (var ci = 0; ci < contents.length; ci++) {
              if (contents[ci].name === "Nourriture" && contents[ci].kind === "objet") { fi = ci; break; }
            }
            if (fi >= 0) {
              contents.splice(fi, 1);
              G.state.inventory = contents.length;
              G.state.player.hp = Math.min(G.PLAYER_MAX_HP, G.state.player.hp + G.FOOD_HEAL);
              if (G.addFloater) G.addFloater("Nourriture (Soin)");
              if (G.playSfx) G.playSfx("eat");
              G.updateHud();
            }
          }
        } else if (it.kind === "outil" && it.name === "Hache") {
          if (isDbl) {
            // Double-clic : force l'equipement de la hache + ferme le sac.
            if (!G.state.axeEquipped) {
              if (G.netConnected && G.netConnected()) G.netInput({ toggleAxe: true });
              G.state.axeEquipped = true;
              G.state.equipped = null;
            }
            G.state.bag.open = false;
          } else {
            if (G.netConnected && G.netConnected()) G.netInput({ toggleAxe: true });
            G.state.axeEquipped = !G.state.axeEquipped;
            if (G.state.axeEquipped) G.state.equipped = null;
          }
        }
        return;
      }
    }
  };

  G.drawBag = function () {
    var ctx = G.ctx;
    var t = G.TEXTURES.bag;
    var L = G.bagLayout();
    var W = L.W, H = L.H, px = L.px, py = L.py, pw = L.pw, ph = L.ph;
    ctx.save();
    ctx.fillStyle = t.overlay;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = t.panelFill;
    ctx.strokeStyle = t.panelStroke;
    ctx.lineWidth = 2;
    G.roundRect(px, py, pw, ph, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = t.title;
    ctx.font = "bold 20px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Sac de " + G.state.playerName, px + 18, py + 34);

    var eq = G.state.equipped || "Mains nues";
    var st = G.equippedStats();
    ctx.fillStyle = t.equipped;
    ctx.font = "bold 14px Segoe UI, system-ui, sans-serif";
    ctx.fillText("Équipé : " + eq, px + 18, py + 56);
    ctx.fillStyle = t.stats;
    ctx.font = "12px Segoe UI, system-ui, sans-serif";
    ctx.fillText("dégâts " + st.dmg + " · portée " + Math.round(st.speed * st.life) +
                  " · cadence " + (1 / st.cd).toFixed(1) + "/s · dispersion " + Math.round(st.spread * 100) + "%",
                  px + 18, py + 74);
    ctx.textAlign = "right";
    ctx.fillStyle = t.hint;
    ctx.font = "13px Segoe UI, system-ui, sans-serif";
    ctx.fillText("A fermer · clic sur une arme = équiper", px + pw - 18, py + 34);

    var listY = L.listY, lineH = L.lineH;
    ctx.font = "15px Segoe UI, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    var groups = G.groupItems(G.state.bag.contents);
    var n = groups.length;
    var shown = Math.min(n, L.maxLines);
    if (n === 0) {
      ctx.fillStyle = t.empty;
      ctx.textAlign = "left";
      ctx.fillText("(vide — ramassez des objets et armes au sol)", px + 18, listY + 12);
    }
    for (var i = 0; i < shown; i++) {
      var it = groups[i];
      var ly = listY + i * lineH + 14;
      var isEq = ((it.kind === "arme") && (it.name === G.state.equipped)) ||
                 ((it.kind === "outil") && (it.name === "Hache") && G.state.axeEquipped);
      if (isEq) {
        ctx.fillStyle = t.equippedHighlight;
        ctx.fillRect(px + 10, ly - lineH / 2 + 2, pw - 20, lineH - 4);
      }
      ctx.fillStyle = it.color || t.defaultColor;
      if (it.kind === "arme") {
        ctx.fillRect(px + 20, ly - 6, 16, 7);
        ctx.fillStyle = t.weaponHandle;
        ctx.fillRect(px + 26, ly + 1, 5, 6);
      } else if (it.kind === "outil" && it.name === "Hache") {
        // Icône hache : tête + manche.
        ctx.fillRect(px + 22, ly - 7, 12, 6);
        ctx.fillStyle = t.weaponHandle;
        ctx.fillRect(px + 27, ly - 1, 4, 9);
      } else {
        ctx.beginPath();
        ctx.arc(px + 28, ly - 2, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = isEq ? t.equipped : t.itemText;
      ctx.textAlign = "left";
      var label = it.name;
      if (it.count > 1) label += " ×" + it.count;
      if (isEq) label += "  (équipé)";
      ctx.fillText(label, px + 50, ly);
      ctx.fillStyle = it.kind === "arme" ? t.weaponTag : (it.kind === "outil" ? t.weaponTag : t.objectTag);
      ctx.textAlign = "right";
      var suffix = it.kind === "arme" ? "arme (clic pour équiper)" :
                   (it.kind === "outil" && it.name === "Hache") ? "outil (clic pour équiper)" :
                   (it.kind === "objet" && it.name === "Nourriture") ? "objet (clic pour manger)" :
                   it.kind;
      ctx.fillText(suffix, px + pw - 18, ly);
    }
    ctx.restore();
  };
})();

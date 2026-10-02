// L'Anneau Unique : objet unique pose sur la tache #5a944a la plus au nord
// du PNG de Minas. Ramassable comme tout item ; au ramassage, un poeme en
// or, italique, style manuscrit s'affiche 5 secondes SANS bloquer le jeu.
// Vendable au monastere (l'eglise) pour 1000 pieces d'or.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Position monde de la tache #5a944a la plus au nord du PNG de Minas
  // (pixel 380,166 du sprite 667x682, emprise 1334 a (15500,15500)), calculee
  // par la projection inverse de ville.js. Constante : le PNG est stable.
  G.ANNEAU_POS = { x: 14863, y: 14677 };
  G.ANNEAU_PRICE = 1000;
  G.ANNEAU_POEME = [
    "Trois Anneaux pour les rois elfes sous le ciel,",
    "Sept pour les seigneurs nains dans leurs demeures de pierre,",
    "Neuf pour les hommes mortels destinés au trépas,",
    "Un pour le Seigneur des Ténèbres sur son sombre trône,",
    "Au pays de Mordor où s'étendent les ombres.",
    "",
    "Un Anneau pour les gouverner tous,",
    "Un Anneau pour les trouver,",
    "Un Anneau pour les amener tous,",
    "Et dans les ténèbres les lier",
    "Au pays de Mordor où s'étendent les ombres."
  ].join("\n");

  // Pose l'anneau au debut de partie (appele depuis buildWorld). Idempotent :
  // un seul anneau existe par partie (jamais re-pose apres ramassage).
  G.placeAnneauUnique = function (state) {
    var st = state || G.state;
    for (var i = 0; i < st.items.length; i++) {
      if (st.items[i].name === "Anneau unique") return;
    }
    st.items.push({
      x: G.ANNEAU_POS.x, y: G.ANNEAU_POS.y, taken: false,
      name: "Anneau unique", color: "#f5c542", kind: "objet",
      anneau: true
    });
  };

  // Poeme : declenche l'affichage 5 s. Non bloquant (aucun etat paused/menu).
  G.showAnneauPoeme = function () {
    G.state.anneauPoemeT = 5;
  };

  G.updateAnneauPoeme = function (dt) {
    var st = G.state;
    if (st.anneauPoemeT === undefined) return;
    st.anneauPoemeT -= dt;
    if (st.anneauPoemeT <= 0) st.anneauPoemeT = undefined;
  };

  // Dessine le poeme : or, italique, style ecriture ancienne a la main,
  // centre sur l'ecran, fondu d'entree/sortie, SANS jamais masquer le jeu
  // (aucun fond opaque, pointer-events none par construction : dessin canvas).
  G.drawAnneauPoeme = function () {
    var st = G.state;
    if (st.anneauPoemeT === undefined) return;
    var ctx = G.ctx;
    var t = st.anneauPoemeT;
    var alpha = t > 4.5 ? (5 - t) / 0.5 : (t < 1 ? t : 1);
    var cx = G.viewW() / 2, cy = G.viewH() / 2;
    var lines = G.ANNEAU_POEME.split("\n");
    var fontSize = Math.max(15, Math.min(22, G.viewH() / 28));
    var lh = fontSize * 1.5;
    var y0 = cy - (lines.length - 1) * lh / 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = "italic " + fontSize + "px 'Segoe Script', 'Brush Script MT', 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Legere ombre portee sombre pour la lisibilite sur tout decor.
    ctx.fillStyle = "rgba(2,6,23,0.55)";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 3;
    for (var i = 0; i < lines.length; i++) {
      var y = y0 + i * lh;
      if (lines[i] === "") continue;
      ctx.strokeText(lines[i], cx + 1, y + 1);
      ctx.fillText(lines[i], cx + 1, y + 1);
    }
    ctx.fillStyle = "#f5c542";
    ctx.shadowColor = "rgba(245,197,66,0.6)";
    ctx.shadowBlur = 8;
    for (var j = 0; j < lines.length; j++) {
      var yy = y0 + j * lh;
      if (lines[j] === "") continue;
      ctx.fillText(lines[j], cx, yy);
    }
    ctx.restore();
  };

  // Dessin de l'anneau au sol : petit anneau d'or (disque + trou), avec un
  // reflet scintillant pour le distinguer des autres objets.
  G.drawAnneauUnique = function (it) {
    var ctx = G.ctx;
    var s = G.proj(it.x, it.y);
    var z = G.state.zoom;
    var r = Math.max(3, 7 * z * 0.5);
    ctx.save();
    ctx.fillStyle = "rgba(2,6,23,0.3)";
    ctx.beginPath();
    ctx.ellipse(s[0], s[1], r * 1.3, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    var t = (G.state.time || 0) % 2;
    var pulse = t < 1 ? t : 2 - t;
    ctx.strokeStyle = "#f5c542";
    ctx.lineWidth = Math.max(2, r * 0.4);
    ctx.shadowColor = "rgba(245,197,66,0.8)";
    ctx.shadowBlur = 6 + pulse * 8;
    ctx.beginPath();
    ctx.arc(s[0], s[1] - r * 0.4, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  // Vend l'anneau (index dans le sac) : +1000 or. En reseau, le serveur est
  // autorite (anneauSell) ; en solo, application directe.
  G.sellAnneau = function (index) {
    var state = G.state;
    if (index < 0 || index >= state.bag.contents.length) return;
    var it = state.bag.contents[index];
    if (it.name !== "Anneau unique") return;
    if (G.netConnected && G.netConnected()) {
      G.netInput({ anneauSell: true });
      state.bag.contents.splice(index, 1);
      state.inventory = state.bag.contents.length;
      G.drawChurch();
      G.updateHud();
      return;
    }
    state.bag.contents.splice(index, 1);
    state.inventory = state.bag.contents.length;
    state.mairieGold = (state.mairieGold || 0) + G.ANNEAU_PRICE;
    if (G.statsAddGold) G.statsAddGold(G.ANNEAU_PRICE);
    if (G.addFloater) G.addFloater(G.ANNEAU_PRICE + " pièces d'or");
    G.drawChurch();
    G.updateHud();
  };
})();

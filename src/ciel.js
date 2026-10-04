// Couche ciel : nuages, montgolfières, oiseaux et avions (Porco).
// Éléments purement visuels, côté client uniquement : aucune collision,
// dessinés au-dessus de tout (y compris l'obscurité de nuit).
// Espace écran : chaque élément circule lentement et réapparaît au bord
// opposé de la carte vue quand il en sort (jamais au milieu).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  var CLOUD_N = 50;      // ~50 nuages en permanence
  var MONTGOLF_N = 20;   // montgolfières lentes, direction quelconque
  var OISEAU_N = 10;     // oiseaux NE -> SO (cap ~250°)
  var PORCO_N = 5;       // avions rapides S -> NO (cap ~330°)
  var MARGIN = 420;      // marge hors écran avant réapparition
  // Échelle de dessin par type (les PNG du dossier ciel sont petits).
  var SCALES = { nuage: 3, montgolfiere: 4, oiseau: 2.5, porco: 2 };
  function sp(key) { return (G.SPRITES.ciel && G.SPRITES.ciel[key]) || null; }
  function viewW() { return G.canvas.width / (window.devicePixelRatio || 1); }
  function viewH() { return G.canvas.height / (window.devicePixelRatio || 1); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // Cap boussole (0° = nord, sens horaire) -> vecteur écran (y vers le bas).
  function bearingVec(deg) {
    var r = deg * Math.PI / 180;
    return [Math.sin(r), -Math.cos(r)];
  }
  function mk(kind, keys, speed, dir) {
    var key = keys[Math.floor(Math.random() * keys.length)];
    var s = sp(key);
    return {
      kind: kind, key: key,
      x: rnd(-MARGIN, viewW() + MARGIN), y: rnd(0, viewH()),
      speed: speed, dx: dir[0], dy: dir[1],
      w: s ? s.w : 64, h: s ? s.h : 64,
      scale: SCALES[kind] || 2
    };
  }
  // Remplit state.ciel. Tolérant : sans sprites ciel (dossier absent),
  // state.ciel reste vide et rien ne se dessine.
  G.cielInit = function () {
    var st = G.state;
    st.ciel = [];
    if (!G.SPRITES.ciel) return;
    var i;
    for (i = 0; i < CLOUD_N; i++)
      st.ciel.push(mk("nuage", ["nuage1", "nuage2"], rnd(10, 26), [1, 0]));
    for (i = 0; i < MONTGOLF_N; i++) {
      var a = Math.random() * Math.PI * 2;
      st.ciel.push(mk("montgolfiere", ["montoglfiere"], rnd(6, 14), [Math.cos(a), Math.sin(a)]));
    }
    for (i = 0; i < OISEAU_N; i++)
      st.ciel.push(mk("oiseau", ["oiseau"], rnd(38, 55), bearingVec(250)));
    for (i = 0; i < PORCO_N; i++)
      st.ciel.push(mk("porco", ["PORCO"], rnd(120, 170), bearingVec(330)));
  };
  // Mesure son propre dt : appelé depuis render() qui n'a pas de dt réel.
  var _last = null;
  G.updateCiel = function (dt) {
    if (dt === undefined || dt === null) {
      var now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      dt = _last === null ? 0.016 : Math.min(0.1, (now - _last) / 1000);
      _last = now;
    }
    var st = G.state;
    if (!st.ciel) { G.cielInit(); return; }
    var W = viewW(), H = viewH();
    for (var i = 0; i < st.ciel.length; i++) {
      var c = st.ciel[i];
      c.x += c.dx * c.speed * dt;
      c.y += c.dy * c.speed * dt;
      var sw = c.w * c.scale, sh = c.h * c.scale;
      // Sortie de carte : réapparaît au bord opposé (extrémité uniquement),
      // à une nouvelle position sur l'autre axe.
      if (c.dx > 0 && c.x - sw / 2 > W + MARGIN) { c.x = -MARGIN; c.y = rnd(0, H); }
      else if (c.dx < 0 && c.x + sw / 2 < -MARGIN) { c.x = W + MARGIN; c.y = rnd(0, H); }
      if (c.dy > 0 && c.y - sh / 2 > H + MARGIN) { c.y = -MARGIN; c.x = rnd(-MARGIN, W + MARGIN); }
      else if (c.dy < 0 && c.y + sh / 2 < -MARGIN) { c.y = H + MARGIN; c.x = rnd(-MARGIN, W + MARGIN); }
    }
  };
  function drawOne(c) {
    var s = sp(c.key);
    if (!s || !s.img) return;
    var w = c.w * c.scale, h = c.h * c.scale;
    G.ctx.drawImage(s.img, c.x - w / 2, c.y - h / 2, w, h);
  }
  // Nuages toujours AU-DESSUS des autres éléments du ciel en cas de
  // croisement : montgolfières/oiseaux/avions d'abord, nuages en dernier.
  G.drawCiel = function () {
    var list = G.state.ciel;
    if (!list || !G.SPRITES.ciel) return;
    var clouds = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].kind === "nuage") clouds.push(list[i]);
      else drawOne(list[i]);
    }
    for (var j = 0; j < clouds.length; j++) drawOne(clouds[j]);
  };
})();

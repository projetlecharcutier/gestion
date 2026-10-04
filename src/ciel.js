// Couche ciel : nuages, montgolfières, oiseaux et avions (Porco).
// Éléments purement visuels, côté client uniquement : aucune collision,
// dessinés au-dessus de tout (y compris l'obscurité de nuit).
// Position en COORDONNÉES MONDE (comme le sol) : les éléments du ciel sont
// projetés à l'écran via G.proj, ils ne bougent pas quand la caméra se
// déplace ni quand le zoom change — le personnage se déplace au sol avec
// le ciel au-dessus de lui, comme les maisons et les forêts.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  var CLOUD_N = 50;      // ~50 nuages en permanence
  var MONTGOLF_N = 20;   // montgolfières lentes, direction quelconque
  var OISEAU_N = 10;     // oiseaux NE -> SO (cap ~250°)
  var PORCO_N = 5;       // avions rapides S -> NO (cap ~330°)
  // Marge monde hors carte avant réapparition (px monde) : les éléments
  // peuvent déborder un peu au-delà des bords de la carte.
  var MARGIN = 600;
  // Échelle de dessin par type (les PNG du dossier ciel sont petits).
  var SCALES = { nuage: 3, montgolfiere: 4, oiseau: 2.5, porco: 2 };
  function sp(key) { return (G.SPRITES.ciel && G.SPRITES.ciel[key]) || null; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // Cap boussole (0° = nord, sens horaire) -> vecteur écran (y vers le bas).
  function bearingVec(deg) {
    var r = deg * Math.PI / 180;
    return [Math.sin(r), -Math.cos(r)];
  }
  function mk(kind, keys, speed, dir) {
    var key = keys[Math.floor(Math.random() * keys.length)];
    var s = sp(key);
    // Élévation : les objets du ciel volent à une altitude visuelle fixe
    // (px écran au zoom 1) au-dessus de leur position au sol projetée.
    var ALT = { nuage: 320, montgolfiere: 240, oiseau: 280, porco: 340 };
    return {
      kind: kind, key: key,
      x: rnd(-MARGIN, G.WORLD + MARGIN), y: rnd(-MARGIN, G.WORLD + MARGIN),
      speed: speed, dx: dir[0], dy: dir[1],
      alt: ALT[kind] || 280,
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
    // Initialisation paresseuse : en mode serveur la carte arrive du réseau
    // (pas de doBuild local), la couche ciel se remplit au premier rendu.
    // [] est truthy en JS : tester la longueur, pas l'existence.
    if (!G.state.ciel || G.state.ciel.length === 0) G.cielInit();
    if (!G.state.ciel || G.state.ciel.length === 0) return;
    if (dt === undefined || dt === null) {
      var now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      dt = _last === null ? 0.016 : Math.min(0.1, (now - _last) / 1000);
      _last = now;
    }
    var list = G.state.ciel;
    var W = G.WORLD;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      c.x += c.dx * c.speed * dt;
      c.y += c.dy * c.speed * dt;
      // Sortie de la carte (extrémités) : réapparaît au bord opposé, à une
      // nouvelle position sur l'autre axe — jamais au milieu de la carte.
      if (c.dx > 0 && c.x > W + MARGIN) { c.x = -MARGIN; c.y = rnd(0, W); }
      else if (c.dx < 0 && c.x < -MARGIN) { c.x = W + MARGIN; c.y = rnd(0, W); }
      if (c.dy > 0 && c.y > W + MARGIN) { c.y = -MARGIN; c.x = rnd(0, W); }
      else if (c.dy < 0 && c.y < -MARGIN) { c.y = W + MARGIN; c.x = rnd(0, W); }
    }
  };
  function drawOne(c) {
    var s = sp(c.key);
    if (!s || !s.img) return;
    // Projection monde -> écran (comme le sol), avec l'altitude visuelle
    // décalée vers le haut. Le zoom est appliqué naturellement par proj
    // via le monde : la taille suit le même zoom que le reste de la carte.
    var p = G.proj(c.x, c.y);
    var z = G.state.zoom;
    var w = c.w * c.scale * z * 0.5;
    var h = c.h * c.scale * z * 0.5;
    G.ctx.drawImage(s.img, p[0] - w / 2, p[1] - c.alt * z * 0.25 - h / 2, w, h);
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

// Chargement asynchrone des sprites PNG depuis assets/manifest.json.
// Expose G.SPRITES.<entite>.<frame> = { img, w, h } et G.assetsReady().
// Tolérant : si une image manque (404), le rendu fait fallback sur les
// textures JS existantes (G.TEXTURES). Le jeu démarre même sans assets.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  G.SPRITES = {};
  var _loaded = 0;
  var _total = 0;
  var _ready = false;

  // Charge le manifeste puis toutes les images listées.
  G.loadAssets = function (onReady) {
    var req = new XMLHttpRequest();
    req.open("GET", "assets/manifest.json", true);
    req.onreadystatechange = function () {
      if (req.readyState !== 4) return;
      if (req.status !== 200 && req.status !== 0) {
        // Manifeste indisponible : on démarre sans sprites PNG.
        _ready = true;
        if (onReady) onReady();
        return;
      }
      var manifest;
      try {
        manifest = JSON.parse(req.responseText);
      } catch (e) {
        _ready = true;
        if (onReady) onReady();
        return;
      }
      var entries = [];
      for (var ent in manifest) {
        if (!manifest.hasOwnProperty(ent)) continue;
        G.SPRITES[ent] = {};
        for (var frame in manifest[ent]) {
          if (!manifest[ent].hasOwnProperty(frame)) continue;
          entries.push({ ent: ent, frame: frame, def: manifest[ent][frame] });
        }
      }
      _total = entries.length;
      if (_total === 0) { _ready = true; if (onReady) onReady(); return; }
      for (var i = 0; i < entries.length; i++) {
        (function (e) {
          var img = new Image();
          img.onload = function () {
            G.SPRITES[e.ent][e.frame] = { img: img, w: e.def.w, h: e.def.h };
            _loaded++;
            if (_loaded >= _total) { _ready = true; if (onReady) onReady(); }
          };
          img.onerror = function () {
            // Image manquante : on n'enregistre pas le sprite (fallback JS).
            _loaded++;
            if (_loaded >= _total) { _ready = true; if (onReady) onReady(); }
          };
          img.src = e.def.src;
        })(entries[i]);
      }
    };
    req.send();
  };

  G.assetsReady = function () { return _ready; };

  // Indique si un sprite PNG donné est disponible (sinon fallback JS).
  G.hasSprite = function (ent, frame) {
    return !!(G.SPRITES[ent] && G.SPRITES[ent][frame]);
  };

  // Convertit un angle de déplacement (radians, atan2(dy,dx)) en nom de direction.
  // Retourne "idle" si immobile, sinon une des 8 directions tous les 45°.
  // Convention : N = vers y décroissant (haut), E = vers x croissant (droite).
  G.dirFromAngle = function (dx, dy) {
    if (dx === 0 && dy === 0) return "idle";
    var ang = Math.atan2(dy, dx); // [-PI, PI], 0 = +x (E)
    // 8 secteurs de 45° centrés sur les directions cardinales.
    var deg = ang * 180 / Math.PI;
    if (deg >= -22.5 && deg < 22.5) return "E";
    if (deg >= 22.5 && deg < 67.5) return "SE";
    if (deg >= 67.5 && deg < 112.5) return "S";
    if (deg >= 112.5 && deg < 157.5) return "SW";
    if (deg >= 157.5 || deg < -157.5) return "W";
    if (deg >= -157.5 && deg < -112.5) return "NW";
    if (deg >= -112.5 && deg < -67.5) return "N";
    return "NE";
  };

  // Retourne l'objet sprite {img,w,h} pour une entité et un vecteur de déplacement.
  // Retourne null si le sprite PNG n'est pas disponible.
  G.spriteFor = function (ent, dx, dy) {
    var frame = G.dirFromAngle(dx, dy);
    if (G.hasSprite(ent, frame)) return G.SPRITES[ent][frame];
    return null;
  };
})();

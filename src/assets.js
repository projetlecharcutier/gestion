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
  // Manifeste embarqué : repli quand assets/manifest.json est inaccessible
  // (par ex. ouverture du jeu en file://, ouù XMLHttpRequest est bloqué par CORS).
  // Les <img> restent utilisables en file://, donc les sprites se chargent quand même.
  var FALLBACK_MANIFEST = {
    player: {
      idle: { src: "assets/sprites/player/idle.png", w: 32, h: 48 },
      N: { src: "assets/sprites/player/N.png", w: 32, h: 48 },
      NE: { src: "assets/sprites/player/NE.png", w: 32, h: 48 },
      E: { src: "assets/sprites/player/E.png", w: 32, h: 48 },
      SE: { src: "assets/sprites/player/SE.png", w: 32, h: 48 },
      S: { src: "assets/sprites/player/S.png", w: 32, h: 48 },
      SW: { src: "assets/sprites/player/SW.png", w: 32, h: 48 },
      W: { src: "assets/sprites/player/W.png", w: 32, h: 48 },
      NW: { src: "assets/sprites/player/NW.png", w: 32, h: 48 }
    },
    bird: {
      idle: { src: "assets/sprites/bird/idle.png", w: 64, h: 64 },
      N: { src: "assets/sprites/bird/N.png", w: 64, h: 64 },
      NE: { src: "assets/sprites/bird/NE.png", w: 64, h: 64 },
      E: { src: "assets/sprites/bird/E.png", w: 64, h: 64 },
      SE: { src: "assets/sprites/bird/SE.png", w: 64, h: 64 },
      S: { src: "assets/sprites/bird/S.png", w: 64, h: 64 },
      SW: { src: "assets/sprites/bird/SW.png", w: 64, h: 64 },
      W: { src: "assets/sprites/bird/W.png", w: 64, h: 64 },
      NW: { src: "assets/sprites/bird/NW.png", w: 64, h: 64 }
    },
    building: {
      mairie: { src: "assets/sprites/building/mairie.png", w: 128, h: 128 },
      generic: { src: "assets/sprites/building/generic.png", w: 96, h: 96 }
    },
    church: {
      church: { src: "assets/sprites/church/church.png", w: 128, h: 128 }
    },
    wall: {
      palissageNESO: { src: "assets/sprites/wall/palissageNESO.png", w: 80, h: 60 },
      palissageNoSe: { src: "assets/sprites/wall/palissageNoSe.png", w: 60, h: 80 }
    }
  };
  // Sonde les maisons house/H1.png, H2.png, ... jusqu'au premier fichier
  // manquant. Permet d'ajouter des PNG en incrémentant le numéro sans
  // toucher au manifeste : tous les H1..Hn trouvés sont chargés automatiquement.
  // La dimension w/h est lue sur l'image réellement chargée (donne la taille de
  // l'objet sur la carte). Appelle onDone(frames) avec la liste des frames OK.
  function probeHouses(onDone) {
    var frames = {};
    var n = 1;
    var dir = "assets/sprites/house/";
    G.SPRITES.house = {};
    function next() {
      var name = "H" + n;
      var img = new Image();
      img.onload = function () {
        frames[name] = { src: dir + name + ".png", w: img.naturalWidth || 96, h: img.naturalHeight || 96 };
        G.SPRITES.house[name] = { img: img, w: frames[name].w, h: frames[name].h };
        n++;
        next();
      };
      img.onerror = function () { onDone(frames); };
      img.src = dir + name + ".png";
    }
    next();
  }

  // Sonde les forêts foret/foret1.png, foret2.png, ... (casse insensible :
  // Foret2.png est aussi accepté). Permet d'ajouter des PNG en incrémentant le
  // numéro. La dimension w/h est lue sur l'image chargée (donne la taille de
  // l'objet sur la carte, comme les maisons).
  function probeForets(onDone) {
    var frames = {};
    var n = 0;
    var dir = "assets/sprites/tree/";
    G.SPRITES.foret = {};
    // Charge en séquence : foret (ou Foret, sans numéro), puis foret1, foret2,
    // ... avec variantes de casse. S'arrête dès qu'un numéro n'a AUCUNE
    // variante de casse disponible (2 échecs consécutifs sur le même numéro).
    // Le n=0 ("foret.png") est optionnel : s'il manque, on passe au n=1.
    function next() {
      var candidates = [];
      if (n === 0) candidates = ["foret.png", "Foret.png"];
      else candidates = ["foret" + n + ".png", "Foret" + n + ".png", "FORET" + n + ".png"];
      var ci = 0;
      var found = false;
      function tryCand() {
        if (ci >= candidates.length) {
          // Aucune variante pour ce numéro : si on a déjà trouvé au moins une
          // forêt avant, on s'arrête. Sinon et n==0, on tente le n=1.
          if (n === 0) { n = 1; next(); return; }
          onDone(frames);
          return;
        }
        var name = candidates[ci];
        var lowerName = name.toLowerCase().replace(".png", "");
        var img = new Image();
        img.onload = function () {
          if (img.naturalWidth > 0) {
            frames[lowerName] = { src: dir + name, w: img.naturalWidth, h: img.naturalHeight };
            G.SPRITES.foret[lowerName] = { img: img, w: img.naturalWidth, h: img.naturalHeight };
          }
          n++; next();
        };
        img.onerror = function () {
          ci++; tryCand();
        };
        img.src = dir + name;
      }
      tryCand();
    }
    next();
  }
  // Sonde les sprites du personnage joueur : 3 états d'équipement
  // (perso / persoHache / persoPistolet) × 3 directions (face / gauche / droite)
  // = 9 PNG. Tolérant : charge ceux qui existent, ignore les 404.
  // Stocke dans G.SPRITES.player sous les clés "perso_face", "persoHache_droite", etc.
  // La taille w/h est lue sur l'image réellement chargée.
  function probePlayer(onDone) {
    var states = ["perso", "persoHache", "persoPistolet"];
    var dirs = ["face", "gauche", "droite"];
    var dir = "assets/sprites/player/";
    G.SPRITES.player = G.SPRITES.player || {};
    var toLoad = [];
    for (var s = 0; s < states.length; s++)
      for (var d = 0; d < dirs.length; d++) toLoad.push(states[s] + "_" + dirs[d]);
    var loaded = 0;
    function done() { loaded++; if (loaded >= toLoad.length) onDone(); }
    for (var i = 0; i < toLoad.length; i++) {
      (function (key) {
        var img = new Image();
        img.onload = function () {
          G.SPRITES.player[key] = { img: img, w: img.naturalWidth || 32, h: img.naturalHeight || 48 };
          done();
        };
        img.onerror = function () { done(); };
        img.src = dir + key + ".png";
      })(toLoad[i]);
    }
  }
  // Calcule la bounding box des pixels opaques d'un PNG (alpha > seuil).
  // Retourne {x0,y0,x1,y1} en pixels relatifs (0..w, 0..h) ou null si erreur.
  // Permet de baser les collisions sur le contenu visible réel plutôt que
  // sur la boîte totale du PNG (souvent très aérée en pixel art : 2% opaque).
  function opaqueBounds(img) {
    try {
      var cv = document.createElement("canvas");
      cv.width = img.naturalWidth || img.width;
      cv.height = img.naturalHeight || img.height;
      if (!cv.width || !cv.height) return null;
      var cx = cv.getContext("2d");
      cx.drawImage(img, 0, 0);
      var d = cx.getImageData(0, 0, cv.width, cv.height);
      var data = d.data;
      var w = cv.width, h = cv.height;
      var minx = w, maxx = -1, miny = h, maxy = -1;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 10) {
            if (x < minx) minx = x; if (x > maxx) maxx = x;
            if (y < miny) miny = y; if (y > maxy) maxy = y;
          }
        }
      }
      if (maxx < 0) return null;
      return { x0: minx, y0: miny, x1: maxx, y1: maxy };
    } catch (e) { return null; }
  }
  // Renvoie la bounding box opaque (en fraction 0..1 du PNG) d'un sprite,
  // ou {x0:0,y0:0,x1:1,y1:1} si indisponible (repli sur boîte totale).
  G.spriteBounds = function (ent, frame) {
    if (!G.hasSprite(ent, frame)) return null;
    var sp = G.SPRITES[ent][frame];
    if (!sp.bounds) {
      var b = opaqueBounds(sp.img);
      sp.bounds = b ?
        { x0: b.x0 / sp.w, y0: b.y0 / sp.h, x1: (b.x1 + 1) / sp.w, y1: (b.y1 + 1) / sp.h } :
        { x0: 0, y0: 0, x1: 1, y1: 1 };
    }
    return sp.bounds;
  };

  function loadManifest(manifest, onReady) {
    var entries = [];
    for (var ent in manifest) {
      if (!manifest.hasOwnProperty(ent)) continue;
      if (ent === "house") continue; // maisons chargées dynamiquement par probeHouses
      if (ent === "player") continue; // perso chargé par probePlayer (3 états × 3 dirs)
      G.SPRITES[ent] = {};
      for (var frame in manifest[ent]) {
        if (!manifest[ent].hasOwnProperty(frame)) continue;
        entries.push({ ent: ent, frame: frame, def: manifest[ent][frame] });
      }
    }
    function finish() { _ready = true; if (onReady) onReady(); }
    function afterHouses() { probeForets(finish); }
    function afterPlayer() { probeHouses(afterHouses); }
    _total = entries.length;
    if (_total === 0) { probePlayer(afterPlayer); return; }
    for (var i = 0; i < entries.length; i++) {
      (function (e) {
        var img = new Image();
        img.onload = function () {
          G.SPRITES[e.ent][e.frame] = { img: img, w: img.naturalWidth || e.def.w, h: img.naturalHeight || e.def.h };
          _loaded++;
          if (_loaded >= _total) probePlayer(afterPlayer);
        };
        img.onerror = function () {
          _loaded++;
          if (_loaded >= _total) probePlayer(afterPlayer);
        };
        img.src = e.def.src;
      })(entries[i]);
    }
  }
  G.loadAssets = function (onReady) {
    var req = new XMLHttpRequest();
    req.open("GET", "assets/manifest.json", true);
    req.onreadystatechange = function () {
      if (req.readyState !== 4) return;
      if (req.status !== 200 && req.status !== 0) {
        // Manifeste indisponible (ex. file://) : repli sur le manifeste embarqué.
        loadManifest(FALLBACK_MANIFEST, onReady);
        return;
      }
      var manifest;
      try {
        manifest = JSON.parse(req.responseText);
      } catch (e) {
        loadManifest(FALLBACK_MANIFEST, onReady);
        return;
      }
      loadManifest(manifest, onReady);
    };
    req.send();
  };
  // Liste les noms de maisons disponibles (H1, H2, ...). Vide tant que les
  // assets ne sont pas chargés.
  G.houseNames = function () {
    var out = [];
 if (G.SPRITES.house) for (var k in G.SPRITES.house) if (G.SPRITES.house.hasOwnProperty(k)) out.push(k);
    return out;
  };

  // Liste les noms de forêts disponibles (foret, foret1, foret2, ...). Vide tant
  // que les assets ne sont pas chargés.
  G.foretNames = function () {
    var out = [];
    if (G.SPRITES.foret) for (var k in G.SPRITES.foret) if (G.SPRITES.foret.hasOwnProperty(k)) out.push(k);
    return out;
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

  // Choisi le sprite du joueur selon l'équipement (hache / pistolet / mains nues)
  // et la direction de déplacement (face / gauche / droite).
  // dx,dy = vecteur de déplacement (0,0 = statique -> face).
  // Retourne null si aucun sprite nouveau n'est disponible (le rendu fait alors
  // repli sur le système 8-directions ou le fallback pixel art).
  G.playerSprite = function (equipped, axeEquipped, dx, dy) {
    // État d'équipement : hache > pistolet > perso.
    var state = axeEquipped ? "persoHache" : (equipped ? "persoPistolet" : "perso");
    // Direction : gauche (W, NW, SW) / droite (E, NE, SE) / face (immobile, N, S).
    var dir = "face";
    if (dx !== 0 || dy !== 0) {
      var ang = Math.atan2(dy, dx) * 180 / Math.PI;
      if (ang > 45 && ang < 135) dir = "face";       // vers le bas (S)
      else if (ang < -45 && ang > -135) dir = "face"; // vers le haut (N)
      else if (ang >= -45 && ang <= 45) dir = "droite"; // vers la droite (E)
      else dir = "gauche";                              // vers la gauche (W)
    }
    var key = state + "_" + dir;
    if (G.hasSprite("player", key)) return G.SPRITES.player[key];
    return null;
  };
})();

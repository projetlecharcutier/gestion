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

  // Cache-buster des sprites : un parametre de version (stable le temps d'une
  // session) ajoute a l'URL de chaque PNG. Force le navigateur a recharger les
  // images a chaque chargement de page, ce qui evite qu'un PNG ajoute apès coup
  // reste en cache comme 404 (frames d'animation non detectees). En production
  // (serveur redémarré à chaque commit via deploy.sh), la valeur change à
  // chaque redémarrage.
  var ASSET_V = "v" + Date.now();
  function bust(url) { return url + (url.indexOf("?") >= 0 ? "&" : "?") + ASSET_V; }

  // Animation par frames : convention <base>-0.png, <base>-1.png, ...
  // Si un sprite de base possede des frames -N (depuis 0), il est anime :
  // le rendu les parcourt en boucle selon le temps. Une seule image = statique.
  var ANIM_FPS = 10; // vitesse du cycle d'animation : 1 frame = 0.1 s exactement

  // Renvoie l'image (HTMLImageElement) a dessiner pour un sprite donne,
  // en parcourant les frames d'animation si elles existent, sinon l'image
  // statique. `sprite` = { img, w, h, frames?: [img,...] }, `time` = secondes.
  G.animImg = function (sprite, time) {
    if (!sprite) return null;
    if (sprite.frames && sprite.frames.length > 1) {
      var i = Math.floor((time || 0) * ANIM_FPS) % sprite.frames.length;
      return sprite.frames[i];
    }
    return sprite.img;
  };

  // Frame d'une animation d'action (tir/hache) : NE BOUCLE PAS. L'animation
  // demarre au declenchement de l'action (t = temps ecoule depuis le tir en
  // secondes). 1 frame = 0.1 s. Apres la derniere frame, reste fige dessus (le
  // prochain tir relancera le cycle). Retourne null si pas de frames.
  G.actionFrame = function (sprite, t) {
    if (!sprite || !sprite.frames || sprite.frames.length === 0) return null;
    var n = sprite.frames.length;
    var fi = Math.floor((t || 0) * ANIM_FPS);
    if (fi > n - 1) fi = n - 1;
    if (fi < 0) fi = 0;
    return sprite.frames[fi];
  };

  // Renvoie le nombre de frames d'animation d'un sprite (1 = statique).
  G.animCount = function (sprite) {
    if (!sprite) return 0;
    return (sprite.frames && sprite.frames.length) ? sprite.frames.length : 1;
  };

  // Sonde les frames d'animation dans `dir` en acceptant LES DEUX
  // conventions de nommage des animations :
  //   1. Standard du jeu : <base>-0.png, <base>-1.png, ... (derniere frame
  //      = premier numero manquant).
  //   2. Bloc padding 4 chiffres : <base>-0101.png, <base>-0102.png, ...
  //      (les DEUX derniers numeros incrementent pour chaque frame, format
  //      d'export Aseprite "Sprite-0101").
  // Les deux modes doivent fonctionner : on tente d'abord le standard, et si
  // aucune frame n'est trouvee on tente le bloc padding. Une serie peut
  // melanger les deux (les frames sont concatenees dans l'ordre de sonde,
  // standard d'abord puis padding a partir de 0101).
  function probeAnimFrames(sprite, dir, base, onDone) {
    probeAnimFramesStd(sprite, dir, base, 0, function (stdFrames) {
      probeAnimFramesPadded(sprite, dir, base, function (padFrames) {
        var all = (stdFrames || []).concat(padFrames || []);
        sprite.frames = all.length > 0 ? all : null;
        onDone(all);
      });
    });
  }
  // Convention standard : <base>-N.png a partir de N = startAt.
  function probeAnimFramesStd(sprite, dir, base, startAt, onDone) {
    var frames = [];
    var n = startAt;
    function next() {
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth > 0) {
          frames.push(img);
          n++;
          next();
        } else onDone(frames);
      };
      img.onerror = function () { onDone(frames); };
      img.src = bust(dir + base + "-" + n + ".png");
    }
    next();
  }
  // Convention padding (export Aseprite "Sprite-0101") : <base>-0101.png,
  // -0102.png... Les DEUX DERNIERS chiffres incrementent pour chaque frame,
  // les deux premiers ("01") sont un prefixe fixe. S'arrete a la premiere
  // frame absente.
  function probeAnimFramesPadded(sprite, dir, base, onDone) {
    var frames = [];
    var n = 1;
    function next() {
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth > 0) {
          frames.push(img);
          n++;
          next();
        } else onDone(frames);
      };
      img.onerror = function () { onDone(frames); };
      var last = String(n);
      while (last.length < 2) last = "0" + last;
      img.src = bust(dir + base + "-01" + last + ".png");
    }
    next();
  }

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
    },
    tour: {
      idle: { src: "assets/sprites/tour/idle.png", w: 96, h: 128 }
    },
    scierie: {
      idle: { src: "assets/sprites/scierie/idle.png", w: 96, h: 96 }
    },
    universite: {
      idle: { src: "assets/sprites/universite/idle.png", w: 96, h: 96 }
    },
    marche: {
      idle: { src: "assets/sprites/marche/idle.png", w: 96, h: 96 }
    },
    montgolfiere: {
      idle: { src: "assets/sprites/montgolfiere/idle.png", w: 96, h: 96 }
    }
  };
  // Sonde les maisons house/H1.png, H2.png, ... jusqu'au premier fichier
  // manquant. Permet d'ajouter des PNG en incrémentant le numéro sans
  // toucher au manifeste : tous les H1..Hn trouvés sont chargés automatiquement.
  // La dimension w/h est lue sur l'image réellement chargée (donne la taille de
  // l'objet sur la carte). Appelle onDone(frames) avec la liste des frames OK.
  function probeHouses(onDone) {
    var frames = {};
    var dir = "assets/sprites/house/";
    G.SPRITES.house = {};
    var n = 1;
    var consecMiss = 0;
    var MAX_MISS = 3; // tolere jusqu'a 3 numeros consecutifs manquants
    function next() {
      var name = "H" + n;
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth > 0) {
          frames[name] = { src: dir + name + ".png", w: img.naturalWidth, h: img.naturalHeight };
          var sp = { img: img, w: frames[name].w, h: frames[name].h };
          G.SPRITES.house[name] = sp;
          consecMiss = 0;
          probeAnimFrames(sp, dir, name, function () {
            n++;
            if (consecMiss >= MAX_MISS) { onDone(frames); return; }
            next();
          });
        } else {
          consecMiss++;
          n++;
          if (consecMiss >= MAX_MISS) { onDone(frames); return; }
          next();
        }
      };
      img.onerror = function () {
        consecMiss++;
        n++;
        if (consecMiss >= MAX_MISS) { onDone(frames); return; }
        next();
      };
      img.src = bust(dir + name + ".png");
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
          if (n >= 1) { tryStageRef(0); return; }
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
            var sp = { img: img, w: img.naturalWidth, h: img.naturalHeight };
            G.SPRITES.foret[lowerName] = sp;
            probeAnimFrames(sp, dir, lowerName, function () {
              probeForetStages(dir, lowerName, function () { n++; next(); });
            });
          } else {
            n++; next();
          }
        };
        img.onerror = function () {
          ci++; tryCand();
        };
        img.src = bust(dir + name);
      }
      tryCand();
      function tryStageRef(sci) {
        var stageCandidates = ["foret" + n + "s0.png", "Foret" + n + "s0.png", "FORET" + n + "s0.png"];
        if (sci >= stageCandidates.length) {
          onDone(frames);
          return;
        }
        var sname = stageCandidates[sci];
        var slowerName = sname.toLowerCase().replace("s0.png", "");
        var simg = new Image();
        simg.onload = function () {
          if (simg.naturalWidth > 0) {
            frames[slowerName] = { src: dir + sname, w: simg.naturalWidth, h: simg.naturalHeight };
            G.SPRITES.foret[slowerName] = { img: simg, w: simg.naturalWidth, h: simg.naturalHeight };
            probeForetStages(dir, slowerName, function () { n++; next(); }, 1);
          } else {
            sci++; tryStageRef(sci);
          }
        };
        simg.onerror = function () { sci++; tryStageRef(sci); };
        simg.src = bust(dir + sname);
      }
    }
    next();
  }

  // Charge les états de coupe d'une forêt : <base>s0.png, <base>s1.png, ...
  // <base>s<FORET_STAGES-1>.png. Convention de nommage distincte de
  // l'animation (<base>-N.png) : le suffixe 's' + index évite tout conflit
  // avec probeAnimFrames (qui cherche <base>-N.png). Stocke le sprite sous
  // la clé "<base>s<index>" dans G.SPRITES.foret. Tolérant : charge ceux qui
  // existent, ignore les manquants (repli sur le sprite de base).
  function probeForetStages(dir, base, onDone, startFrom) {
    var stages = G.FORET_STAGES || 5;
    var i = startFrom || 0;
    function next() {
      if (i >= stages) { onDone(); return; }
      var key = base + "s" + i;
      var name = key + ".png";
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth > 0) {
          G.SPRITES.foret[key] = { img: img, w: img.naturalWidth, h: img.naturalHeight };
        }
        i++; next();
      };
      img.onerror = function () { i++; next(); };
      img.src = bust(dir + name);
    }
    next();
  }

  // Sonde les sprites du personnage joueur : 3 états d'équipement
  // (perso / persoHache / persoPistolet) × 3 directions (face / gauche / droite)
  // = 9 PNG. Tolérant : charge ceux qui existent, ignore les 404.
  // Stocke dans G.SPRITES.player sous les clés "perso_face", "persoHache_droite", etc.
  // La taille w/h est lue sur l'image réellement chargée.
  function probePlayer(onDone) {
    // 5 etats d'equipement x 3 directions. persoFusil/persoArc sont sondés
    // tolerant : si les PNG manquent (arc pas encore dessiné), le rendu fait
    // repli sur perso. Les series sans PNG de base (ex: persoFusil_droite-0..6
    // sans persoFusil_droite.png) sont chargees depuis la frame 0.
    var states = ["perso", "persoHache", "persoPistolet", "persoFusil", "persoArc"];
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
          var sp = { img: img, w: img.naturalWidth || 32, h: img.naturalHeight || 48 };
          G.SPRITES.player[key] = sp;
          probeAnimFrames(sp, dir, key, function () { done(); });
        };
        img.onerror = function () {
          // Pas de PNG de base : la serie <base>-N.png peut exister seule.
          // La frame 0 tient lieu d'image de base (comme probeTours).
          var stub = { img: null, w: 0, h: 0, frames: null };
          probeAnimFrames(stub, dir, key, function (frames) {
            if (frames && frames.length > 0) {
              stub.img = frames[0];
              stub.w = frames[0].naturalWidth || 32;
              stub.h = frames[0].naturalHeight || 48;
              G.SPRITES.player[key] = stub;
            }
            done();
          });
        };
        img.src = bust(dir + key + ".png");
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
    function afterSiege() { probeSiege(finish); }
    function afterTraces() { probeDeadTraces(afterSiege); }
    function afterHouses() { probeForets(afterTraces); }
    function afterTours() { probeHouses(afterHouses); }
    function afterPlayer() { probeTours(afterTours); }
    function probeTours(onDone) {
      // Tour : series chantier / idle (deja dans le manifeste) + gauche / droite
      // (overlays de tir, PNG complets). Sondage de frames <base>-0.png, -1.png...
      G.SPRITES.tour = G.SPRITES.tour || {};
      var series = [
        { ent: "tour", dir: "assets/sprites/tour/", base: "idle" },
        { ent: "tour", dir: "assets/sprites/tour/", base: "chantier" },
        { ent: "tour", dir: "assets/sprites/tour/", base: "gauche" },
        { ent: "tour", dir: "assets/sprites/tour/", base: "droite" },
        { ent: "scierie", dir: "assets/sprites/scierie/", base: "idle" },
        { ent: "scierie", dir: "assets/sprites/scierie/", base: "chantier" },
        { ent: "universite", dir: "assets/sprites/universite/", base: "idle" },
        { ent: "universite", dir: "assets/sprites/universite/", base: "chantier" },
        { ent: "marche", dir: "assets/sprites/marche/", base: "idle" },
        { ent: "marche", dir: "assets/sprites/marche/", base: "chantier" },
        { ent: "montgolfiere", dir: "assets/sprites/montgolfiere/", base: "idle" },
        { ent: "montgolfiere", dir: "assets/sprites/montgolfiere/", base: "chantier" },
        { ent: "potence", dir: "assets/sprites/potence/", base: "idle" },
        { ent: "potence", dir: "assets/sprites/potence/", base: "chantier" },
        { ent: "potence", dir: "assets/sprites/potence/", base: "exec" },
        // Dossier DISTINCT pour l'animation d'execution : si aucun PNG exec
        // n'est trouve a la racine, on sonde assets/sprites/potence/exec/
        // (exec.png ou frames exec-0.png / exec-0101.png dans ce dossier).
        { ent: "potence", dir: "assets/sprites/potence/exec/", base: "exec", alt: true }
      ];
      var si = 0;
      function nextSeries() {
        if (si >= series.length) { onDone(); return; }
        var s = series[si++];
        G.SPRITES[s.ent] = G.SPRITES[s.ent] || {};
        // Serie alternative (dossier distinct) : seulement si la serie
        // standard n'a rien trouve (pas de PNG, pas de frames).
        if (s.alt && G.hasSprite(s.ent, s.base)) { nextSeries(); return; }
        if (G.hasSprite(s.ent, s.base) && s.base !== "chantier" && s.base !== "gauche" && s.base !== "droite") {
          // idle tour/scierie : anime les frames du sprite manifeste deja charge.
          nextSeries();
          return;
        }
        // Base statique (premiere frame) puis frames animees. Si le PNG de
        // base est absent mais que des frames <base>-0.png... existent, la
        // serie est quand meme chargee (base = premiere frame).
        var img = new Image();
        img.onload = function () {
          if (img.naturalWidth > 0) {
            var sp = { img: img, w: img.naturalWidth, h: img.naturalHeight };
            G.SPRITES[s.ent][s.base] = sp;
            probeAnimFrames(sp, s.dir, s.base, function () { nextSeries(); });
            return;
          }
          nextSeries();
        };
        img.onerror = function () {
          var stub = { frames: null };
          probeAnimFrames(stub, s.dir, s.base, function (frames) {
            if (frames && frames.length > 0) {
              stub.img = frames[0];
              stub.w = frames[0].naturalWidth;
              stub.h = frames[0].naturalHeight;
              G.SPRITES[s.ent][s.base] = stub;
            }
            nextSeries();
          });
        };
        img.src = bust(s.dir + s.base + ".png");
      }
      nextSeries();
    }
    _total = entries.length;
    if (_total === 0) { probePlayer(afterPlayer); return; }
    for (var i = 0; i < entries.length; i++) {
      (function (e) {
        var img = new Image();
        img.onload = function () {
          var sp = { img: img, w: img.naturalWidth || e.def.w, h: img.naturalHeight || e.def.h };
          G.SPRITES[e.ent][e.frame] = sp;
          var dir = e.def.src.substring(0, e.def.src.lastIndexOf("/") + 1);
          var base = e.frame;
          probeAnimFrames(sp, dir, base, function () {
            _loaded++;
            if (_loaded >= _total) probePlayer(afterPlayer);
          });
        };
        img.onerror = function () {
          _loaded++;
          if (_loaded >= _total) probePlayer(afterPlayer);
        };
        img.src = bust(e.def.src);
      })(entries[i]);
    }
  }
  // Sonde les traces de zombies morts : assets/sprites/zomb/dead/deadzomb1.png,
  // deadzomb2.png, ... jusqu'a 3 numeros consecutifs manquants. Charge tous les
  // PNG trouves dans G.SPRITES.zombDead (tableau de sprites {img,w,h}). Un PNG
  // est choisi au hasard parmi eux a chaque mort de zombie. Tolerant : si aucun
  // PNG n'est present, le tableau reste vide (aucune trace laissee).
  function probeDeadTraces(onDone) {
    G.SPRITES.zombDead = [];
    var dir = "assets/sprites/zomb/dead/";
    var n = 1;
    var consecMiss = 0;
    var MAX_MISS = 3;
    function next() {
      if (consecMiss >= MAX_MISS) { onDone(); return; }
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth > 0) {
          G.SPRITES.zombDead.push({ img: img, w: img.naturalWidth, h: img.naturalHeight });
          consecMiss = 0;
        } else {
          consecMiss++;
        }
        n++;
        next();
      };
      img.onerror = function () {
        consecMiss++;
        n++;
        next();
      };
      img.src = bust(dir + "deadzomb" + n + ".png");
    }
    next();
  }

  // Sonde les sprites de la tour de siège dans assets/sprites/siege/ :
  // 4 directions (sud-est-vers-nord-ouest, ...) × 2 états
  // (ferme = déplacement, ouvert = collée à un mur) + le PNG de
  // destruction (trace au sol). Tolérant : charge ceux qui existent, ignore
  // les 404 (repli dessin vectoriel dans render.js).
  // Stocke dans G.SPRITES.siege sous les clés "<dir>/ferme", "<dir>/ouvert"
  // et G.SPRITES.siegeDead (trace de destruction).
  function probeSiege(onDone) {
    var base = "assets/sprites/siege/";
    G.SPRITES.siege = {};
    G.SPRITES.siegeDead = [];
    var dirs = G.SIEGE_DIRS || [];
    var states = ["ferme", "ouvert"];
    var toLoad = [];
    for (var di = 0; di < dirs.length; di++) {
      for (var st = 0; st < states.length; st++) {
        toLoad.push({ key: dirs[di].key + "/" + states[st], dir: base + dirs[di].key + "/", base: states[st] });
      }
    }
    var loaded = 0;
    function done() { loaded++; if (loaded >= toLoad.length) probeSiegeDead(onDone); }
    function loadOne(job) {
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth > 0) {
          var sp = { img: img, w: img.naturalWidth, h: img.naturalHeight };
          G.SPRITES.siege[job.key] = sp;
          probeAnimFrames(sp, job.dir, job.base, function () { done(); });
          return;
        }
        done();
      };
      img.onerror = function () {
        // La série <base>-0.png peut exister seule : la frame 0 tient lieu
        // de sprite de base (comme probeTours).
        var stub = { frames: null };
        probeAnimFrames(stub, job.dir, job.base, function (frames) {
          if (frames && frames.length > 0) {
            stub.img = frames[0];
            stub.w = frames[0].naturalWidth;
            stub.h = frames[0].naturalHeight;
            G.SPRITES.siege[job.key] = stub;
          }
          done();
        });
      };
      img.src = bust(job.dir + job.base + ".png");
    }
    for (var i = 0; i < toLoad.length; i++) loadOne(toLoad[i]);
  }
  // Traces de destruction : assets/sprites/siege/destruction/
  // destruction1.png, destruction2.png, ... (numérotation depuis 1, sonde
  // jusqu'à 3 numéros manquants consécutifs). Un PNG choisi au hasard
  // à chaque destruction.
  function probeSiegeDead(onDone) {
    var dir = "assets/sprites/siege/destruction/";
    // destruction.png seul (nom simple documenté dans le README), puis la
    // série numérotée destruction1.png, destruction2.png, ...
    var names = [dir + "destruction.png"];
    var n = 1;
    var consecMiss = 0;
    function next() {
      if (names.length === 0 && consecMiss >= 3) { onDone(); return; }
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth > 0) {
          G.SPRITES.siegeDead.push({ img: img, w: img.naturalWidth, h: img.naturalHeight });
          consecMiss = 0;
        } else consecMiss++;
        n++;
        next();
      };
      img.onerror = function () { consecMiss++; n++; next(); };
      img.src = bust(names.length > 0 ? names.shift() : dir + "destruction" + n + ".png");
    }
    next();
  }

  // Renvoie un sprite de trace de zombie mort au hasard, ou null si aucun
  // PNG n'est disponible.
  G.randomDeadTraceSprite = function () {
    var list = G.SPRITES.zombDead;
    if (!list || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  };

  // Nombre de traces de zombies morts disponibles (0 = aucun PNG).
  G.deadTraceCount = function () {
    return (G.SPRITES.zombDead && G.SPRITES.zombDead.length) || 0;
  };

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
    if (G.SPRITES.foret) for (var k in G.SPRITES.foret) {
      if (!G.SPRITES.foret.hasOwnProperty(k)) continue;
      // Exclut les sprites d'état de coupe (<base>s<index>) : ce sont des
      // variantes d'affichage, pas des forêts de base distinctes.
      if (/s[0-9]+$/.test(k)) continue;
      out.push(k);
    }
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

  // Préfixe de série PNG pour l'arme équipée (type dans WEAPON_STATS -> serie).
  // Retourne null si l'arme n'a pas de série dédiée (couteau, bâton, mains nues).
  G.playerWeaponPrefix = function (equipped) {
    if (!equipped || !G.WEAPON_STATS) return null;
    var st = G.WEAPON_STATS[equipped];
    var type = st && st.type;
    if (type === "pistolet") return "persoPistolet";
    if (type === "fusil") return "persoFusil";
    if (type === "arc") return "persoArc";
    return null;
  };

  // Choisi le sprite du joueur :
  // - action en cours (clic gauche) + arme/hache : série liée à l'équipement
  //   (persoPistolet_/persoHache_/persoFusil_/persoArc_ + direction), animée
  //   au rythme des tirs/coups.
  // - mouvement (sans action) : perso_gauche / perso_droite (jamais perso_face).
  // - immobile : perso_face, quel que soit l'équipement.
  // action = { anim: true, t: temps d'animation (s) } ou null.
  // Retourne null si aucun sprite disponible (repli pixel art).
  G.playerSprite = function (equipped, axeEquipped, dx, dy, action, face) {
    var moving = (dx !== 0 || dy !== 0);
    var dir = "face";
    if (moving || (action && action.anim)) {
      // Direction visuelle gauche/droite : composante x du mouvement, sinon le
      // sens du personnage (face). Jamais "face" pendant une action : le tir
      // est lateral (persoPistolet_gauche/droite...).
      if (dx > 0) dir = "droite";
      else if (dx < 0) dir = "gauche";
      else dir = (face === undefined || face >= 0) ? "droite" : "gauche";
    }
    // Action : sprite de l'arme équipée (tir) ou de la hache (coupe), prioritaire.
    if (action && action.anim) {
      var st = axeEquipped ? "persoHache" : G.playerWeaponPrefix(equipped);
      if (st) {
        var akey = st + "_" + dir;
        if (G.hasSprite("player", akey)) return G.SPRITES.player[akey];
      }
    }
    // Défaut : mouvement -> perso_gauche/droite ; immobile -> perso_face.
    var key = "perso_" + dir;
    if (G.hasSprite("player", key)) return G.SPRITES.player[key];
    return null;
  };
})();

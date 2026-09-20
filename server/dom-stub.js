// Stub DOM pour exécuter les modules de simulation (config, world, zombies,
// walls, chop, weapons, birds, projection) côté serveur sans navigateur.
//
// PARITÉ SERVEUR/CLIENT : le serveur doit construire EXACTEMENT le même monde
// que le client (mêmes AABB de collision, mêmes bâtiments). Le client tire les
// dimensions des objets des PNG chargés (largeur du PNG * 2, zone opaque via
// shrinkToOpaque) ; le serveur n'a pas d'images mais dispose de
// sprite-meta.json (généré par server/gen-sprite-meta.js) qui contient, pour
// chaque PNG : la taille (w, h) et la bounding box des pixels opaques
// (bounds). On remplit G.SPRITES avec ces dimensions et on fait renvoyer à
// houseNames()/foretNames() les vraies listes : buildWorld() produit ainsi
// la même carte que le client (mairie, église, maisons décoratives, forêts,
// périmètre de palissades), sans écart de collision.
function setupStub() {
  // window === global : les modules écrivent window.GAME (=== global.GAME)
  // et lisent window.devicePixelRatio. En Node, on expose global via `window`.
  global.window = global;
  global.devicePixelRatio = 1;

  var G = {};
  global.GAME = G;

  // Canvas factice : projection.js lit G.canvas.width/height au rendu uniquement
  // (jamais côté serveur), mais on le définit pour éviter un ReferenceError.
  global.canvas = G.canvas = { width: 800, height: 600, getContext: function () { return null; } };

  // --- Sprites : dimensions réelles des PNG (cf. sprite-meta.json) ---
  var meta = {};
  try {
    meta = require("./sprite-meta.json");
  } catch (e) {
    meta = {};
  }

  // Remplit G.SPRITES[ent][frame] = { w, h, bounds } pour chaque entrée du
  // méta. `bounds` (bounding box opaque en pixels) est exposé via
  // G.spriteBounds pour que shrinkToOpaque (monde) produise côté serveur les
  // MÊMES AABB que le client.
  G.SPRITES = {};
  for (var key in meta) {
    if (!meta.hasOwnProperty(key)) continue;
    var slash = key.lastIndexOf("/");
    var ent = key.slice(0, slash);
    var frame = key.slice(slash + 1);
    // Parité client : probeForets (src/assets.js) charge les PNG du dossier
    // tree/ sous l'entité "foret", clés en minuscules, et le stade s0 tient
    // lieu de sprite de base quand foretN.png n'existe pas (clé "foretN").
    if (ent === "tree") {
      ent = "foret";
      frame = frame.toLowerCase();
      if (/s0$/.test(frame)) frame = frame.slice(0, -2);
    }
    G.SPRITES[ent] = G.SPRITES[ent] || {};
    var m = meta[key];
    var sp = { w: m.w, h: m.h, img: null, frames: null };
    if (m.bounds) {
      sp.bounds = {
        x0: m.bounds.x0 / m.w, y0: m.bounds.y0 / m.h,
        x1: (m.bounds.x1 + 1) / m.w, y1: (m.bounds.y1 + 1) / m.h
      };
    }
    G.SPRITES[ent][frame] = sp;
  }

  // Frames d'animation <base>-N.png : le client les groupe dans sprite.frames
  // (probeAnimFrames). On recompte ici par (ent, base) pour que animCount()
  // (chantier : un seul tour sur TOWER_BUILD_TIME) et montgolfiereAnimFrame
  // trouvent le même nombre de frames que le client. Les frames sont
  // simplement référencées (pas d'images) : le serveur ne rend rien.
  for (var ent2 in G.SPRITES) {
    if (!G.SPRITES.hasOwnProperty(ent2)) continue;
    for (var fr in G.SPRITES[ent2]) {
      if (!G.SPRITES[ent2].hasOwnProperty(fr)) continue;
      var dash = fr.lastIndexOf("-");
      if (dash < 0) continue;
      var base = fr.slice(0, dash);
      var idx = parseInt(fr.slice(dash + 1), 10);
      if (isNaN(idx)) continue;
      // Parité client (probeTours) : si le PNG de base <base>.png n'existe
      // pas mais que des frames <base>-N existent, le client crée la clé
      // <base> avec les w/h de la frame 0. On reproduit ce comportement.
      var b = G.SPRITES[ent2][base];
      if (!b && idx === 0) {
        var mf0 = meta[ent2 + "/" + fr];
        if (mf0) {
          b = { w: mf0.w, h: mf0.h, img: null, frames: null };
          if (mf0.bounds) {
            b.bounds = {
              x0: mf0.bounds.x0 / mf0.w, y0: mf0.bounds.y0 / mf0.h,
              x1: (mf0.bounds.x1 + 1) / mf0.w, y1: (mf0.bounds.y1 + 1) / mf0.h
            };
          }
          G.SPRITES[ent2][base] = b;
        }
      }
      if (!b) continue;
      b.frames = b.frames || [];
      var metaKey = ent2 + "/" + fr;
      var mf = meta[metaKey];
      if (mf) b.frames[idx] = { w: mf.w, h: mf.h, img: null };
    }
  }
  // Compacte les tableaux de frames (trous éventuels si numérotation
  // non contiguë) : animCount/frames.length doit refléter les frames réelles.
  for (var ent3 in G.SPRITES) {
    if (!G.SPRITES.hasOwnProperty(ent3)) continue;
    for (var fr3 in G.SPRITES[ent3]) {
      if (!G.SPRITES[ent3].hasOwnProperty(fr3)) continue;
      var sp3 = G.SPRITES[ent3][fr3];
      if (sp3.frames && sp3.frames.length) {
        var compact = [];
        for (var fi = 0; fi < sp3.frames.length; fi++) {
          if (sp3.frames[fi]) compact.push(sp3.frames[fi]);
        }
        sp3.frames = compact.length > 0 ? compact : null;
      }
    }
  }

  G.hasSprite = function (ent, frame) {
    return !!(G.SPRITES[ent] && G.SPRITES[ent][frame]);
  };
  // Bornes opaques (fraction 0..1 du PNG) : même contrat que src/assets.js.
  G.spriteBounds = function (ent, frame) {
    if (!G.hasSprite(ent, frame)) return null;
    var sp = G.SPRITES[ent][frame];
    return sp.bounds || { x0: 0, y0: 0, x1: 1, y1: 1 };
  };

  // Maisons décoratives : le client liste les clés de G.SPRITES.house
  // (H1, H2, ... chargés par probeHouses). Le serveur a les mêmes clés via le
  // méta -> buildWorld() place les mêmes maisons.
  G.houseNames = function () {
    var out = [];
    if (G.SPRITES.house) for (var k in G.SPRITES.house) {
      if (G.SPRITES.house.hasOwnProperty(k)) out.push(k);
    }
    return out;
  };

  // Forêts : le client charge foret.png (optionnel), foret1.png, ... et les
  // états de coupe foretNsM. foretNames() exclut les <base>s<index>.
  G.foretNames = function () {
    var out = [];
    if (G.SPRITES.foret) for (var k in G.SPRITES.foret) {
      if (!G.SPRITES.foret.hasOwnProperty(k)) continue;
      if (/s[0-9]+$/.test(k)) continue;
      out.push(k);
    }
    return out;
  };

  // Dimensions des palissades : le client déduit longueur/épaisseur des PNG
  // (wallSpriteDims dans src/walls.js). Le serveur a les mêmes PNG -> même
  // résultat via le même code chargé depuis src/walls.js. On n'écrase plus
  // PLANK_LONG/PLANK_THICK : les constantes de config restent le repli.
  G.PLANK_LONG = 120;
  G.PLANK_THICK = 24;
  G.wallSpriteDims = function () { return { longW: G.PLANK_LONG, thick: G.PLANK_THICK }; };

  // Aucune dépendance au rendu/HUD/audio côté serveur.
  G.updateHud = function () {};
  G.addFloater = function () {};
  G.updateFloaters = function () {};
  G.playSfx = function () {};
  G.render = function () {};

  return G;
}

module.exports = { setupStub: setupStub };

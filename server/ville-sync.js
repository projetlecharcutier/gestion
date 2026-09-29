// Synchronisation automatique des villes decoratives PNG au demarrage du
// serveur. Verifie le dossier assets/sprites/ville/ et :
//
//   1. NORMALISE les emplacements : une ville peut etre deposee soit en
//      sous-dossier ville/<nom>/ville.png + ville_mask.png (convention
//      documentee), soit a la racine ville/ville.png + ville_mask.png
//      (depot direct, upload) -> dans ce cas un dossier "default" est
//      cree et les fichiers y sont deplaces.
//   2. DETECTE les nouvelles villes : tout sous-dossier contenant un
//      ville.png est une ville candidate. Les villes sans entree dans
//      VILLE_DEFS (config.js) recoivent un placement AUTOMATIQUE :
//      ancrage sur un cercle autour de la ville principale, ordre
//      anti-horaire, distance VILLE_AUTO_DIST px, en evitant la ville de
//      depart et les autres villes PNG.
//   3. REGENERERE les grilles : server/ville-grids.json est regenere
//      (meme fonction pure que le client) pour toute ville dont le
//      masque est nouveau ou a change (taille/date).
//
// Les positions automatiques et vues par le client sont serialisees dans
// server/ville-positions.json pour rester stables entre les redemarrages.
(function () {
  "use strict";
  var fs = require("fs");
  var path = require("path");
  var zlib = require("zlib");
  var crypto = require("crypto");

  var ROOT = path.join(__dirname, "..");
  var ASSETS = path.join(ROOT, "assets", "sprites", "ville");
  var GRIDS_PATH = path.join(__dirname, "ville-grids.json");
  var POSITIONS_PATH = path.join(__dirname, "ville-positions.json");
  var SIGS_PATH = path.join(__dirname, "ville-grids-sigs.json");
  var META_PATH = path.join(__dirname, "sprite-meta.json");
  var MANIFEST_PATH = path.join(ASSETS, "villes.js");

  function readJson(p) {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return {}; }
  }

  // Ecriture tolerante : sur un deploiement en lecture seule (production
  // /opt/flex sans droit d'ecriture pour l'utilisateur du service), les
  // writeFileSync echouent avec EACCES. La donnee calculee reste VALABLE
  // pour ce demarrage : on log, on continue, et l'appelant conserve tout
  // en memoire (cf. sync -> G._villeGridsRaw / G.VILLE_MANIFEST recupere
  // par dom-stub). Retourne false si l'ecriture a echoue.
  function safeWrite(p, data) {
    try {
      fs.writeFileSync(p, data);
      return true;
    } catch (e) {
      console.warn("[ville-sync] ecriture impossible (depot en lecture seule ?) : " + p +
                   " -- donnees conservees en memoire pour ce demarrage (" + e.code + ")");
      return false;
    }
  }

  // Decode RGBA complet d'un PNG non entrelace 8-bit couleur+alpha.
  function pngRGBA(p) {
    var d = fs.readFileSync(p);
    var w = d.readUInt32BE(16), h = d.readUInt32BE(20);
    var bd = d[24], ct = d[25], interlace = d[28];
    if (bd !== 8 || ct !== 6 || interlace !== 0) return null;
    var off = 8, idat = [];
    while (off + 8 <= d.length) {
      var len = d.readUInt32BE(off);
      var type = d.toString("ascii", off + 4, off + 8);
      if (type === "IDAT") idat.push(d.subarray(off + 8, off + 8 + len));
      off += 12 + len;
      if (type === "IEND") break;
    }
    var raw = zlib.inflateSync(Buffer.concat(idat));
    var stride = w * 4;
    var line = new Uint8Array(stride);
    var prevLine = new Uint8Array(stride);
    var rgba = new Uint8Array(w * h * 4);
    var pos = 0;
    for (var y = 0; y < h; y++) {
      var f = raw[pos++];
      for (var x = 0; x < stride; x++) {
        var v = raw[pos++];
        var a = x >= 4 ? line[x - 4] : 0;
        var b = prevLine[x];
        var c = x >= 4 ? prevLine[x - 4] : 0;
        if (f === 1) v = (v + a) & 255;
        else if (f === 2) v = (v + b) & 255;
        else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
        else if (f === 4) {
          var pp = a + b - c;
          var pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = (v + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 255;
        }
        line[x] = v;
      }
      rgba.set(line, y * stride);
      prevLine.set(line);
    }
    return { w: w, h: h, rgba: rgba };
  }

  // Liste les villes presentes sur le disque : [{ name, dir, png, mask }].
  // Accepte les deux emplacements (sous-dossier <nom>/ ou racine "default").
  function scanVilles() {
    var out = [];
    if (!fs.existsSync(ASSETS)) return out;
    // 1. Depot racine : ville.png + ville_mask.png directement dans ville/.
    if (fs.existsSync(path.join(ASSETS, "ville.png")) &&
        fs.existsSync(path.join(ASSETS, "ville_mask.png"))) {
      out.push({ name: "default", dir: ASSETS, png: "ville.png", mask: "ville_mask.png" });
    }
    // 2. Sous-dossiers : chaque dossier avec ville.png (+ mask tolerate).
    var dirs = fs.readdirSync(ASSETS).sort();
    for (var i = 0; i < dirs.length; i++) {
      var f = dirs[i];
      var p = path.join(ASSETS, f);
      if (!fs.statSync(p).isDirectory()) continue;
      if (!fs.existsSync(path.join(p, "ville.png"))) continue;
      out.push({
        name: f,
        dir: p,
        png: "ville.png",
        mask: fs.existsSync(path.join(p, "ville_mask.png")) ? "ville_mask.png" : null
      });
    }
    // 3. DEDOUBLONNAGE par CONTENU : le meme depot (meme PNG, copie ou
    // renomme) ne doit jamais poser deux fois la meme ville sur la carte.
    // On hash ville.png + ville_mask.png. Les defs MANUELLES de config.js
    // (ex. "est") gagnent toujours (position explicite) ; sinon la premiere
    // occurrence par ordre alphabetique gagne, les doublons sont IGNORES
    // avec un log clair.
    var defs = (global.GAME && global.GAME.VILLE_DEFS) || [];
    function isManual(name) {
      for (var k = 0; k < defs.length; k++) {
        if (defs[k].sprite === name || defs[k].name === name) return true;
      }
      return false;
    }
    function hashVille(v) {
      try {
        return crypto.createHash("sha256")
          .update(fs.readFileSync(path.join(v.dir, v.png)))
          .update(v.mask ? fs.readFileSync(path.join(v.dir, v.mask)) : Buffer.alloc(0))
          .digest("hex");
      } catch (e) { return null; }
    }
    var seen = {};
    var unique = [];
    for (var j = 0; j < out.length; j++) {
      var v = out[j];
      var h = hashVille(v);
      if (!h) { unique.push(v); continue; }
      if (seen[h]) {
        var winner = seen[h];
        var vManual = isManual(v.name), wManual = isManual(winner.name);
        if (vManual && !wManual) {
          // La def manuelle arrive apres une copie detectee avant elle :
          // la def REMPLACE la copie (la copie est retree plus bas).
        } else {
          console.warn("[ville-sync] doublon ignore : " + v.name + " (meme PNG que " +
                       winner.name + ") -- une ville identique ne peut pas etre posee deux fois");
          continue;
        }
        // Retire la copie precedemment acceptee au profit de la def.
        for (var u = 0; u < unique.length; u++) {
          if (unique[u].name === winner.name) { unique.splice(u, 1); break; }
        }
        seen[h] = v;
        unique.push(v);
        continue;
      }
      seen[h] = v;
      unique.push(v);
    }
    return unique;
  }

  // Deplace un depot racine (ville/ville.png) vers un sous-dossier
  // ville/<name>/ pour revenir a la convention documentee. Tolere un depot
  // en lecture seule : si le deplacement echoue, la ville reste servie
  // depuis la racine (meme PNG, meme masque) -- seule la persistance de la
  // convention echoue, pas la ville.
  function normalizeRootDeposit(name) {
    try {
      var dir = path.join(ASSETS, name);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      ["ville.png", "ville_mask.png"].forEach(function (f) {
        var src = path.join(ASSETS, f);
        if (fs.existsSync(src)) fs.renameSync(src, path.join(dir, f));
      });
      return path.join(ASSETS, name);
    } catch (e) {
      console.warn("[ville-sync] normalisation impossible (depot en lecture seule ?) -- " +
                   "la ville racine reste servie telle quelle (" + e.code + ")");
      return ASSETS;
    }
  }

  // Charge le module client (config + ville) par eval pour reutiliser
  // villeGridFromPixels / villeRLEEncode -> parite exacte.
  function loadShared() {
    global.window = global;
    var G = global.GAME = global.GAME || {};
    (0, eval)(fs.readFileSync(path.join(ROOT, "src", "config.js"), "utf8"));
    (0, eval)(fs.readFileSync(path.join(ROOT, "src", "ville.js"), "utf8"));
    return G;
  }

  // Signature d'un PNG (taille + date de modification) pour detecter les
  // changements sans redecoder systematiquement.
  function pngSignature(p) {
    try {
      var st = fs.statSync(p);
      var d = fs.readFileSync(p);
      return d.readUInt32BE(16) + "x" + d.readUInt32BE(20) + "@" + Math.floor(st.mtimeMs);
    } catch (e) {
      return null;
    }
  }

  // Signature d'une ville COMPLETE (PNG visible + masque) : la grille de
  // collision est derivee du masque mais son emprise depend aussi du PNG
  // visible (taille -> cote du losange). Un changement de l'un ou l'autre
  // doit declencher la regeneration de la grille serveur.
  function villeSignature(dir, png, mask) {
    var a = pngSignature(path.join(dir, png));
    var b = mask ? pngSignature(path.join(dir, mask)) : "";
    return a + "|" + b;
  }

  // Placement automatique d'une nouvelle ville : 8 creneaux, soit DEUX
  // par direction diagonale (SE, SO, NE, NO), sur deux anneaux autour de
  // la ville principale (centre TOWN). L'anneau 1 (proche) prend SE puis
  // NE puis SO puis NO ; l'anneau 2 (loin, VILLE_AUTO_DIST * 1.8) reprend
  // SE puis NE... dans le meme ordre -> les villes arrivent en paires par
  // direction, sans jamais se superposer entre elles ni avec la ville de
  // depart. boxes = emprises deja posees [{x, y, side}] : defs MANUELLES de
  // config.js + positions persistees ; le creneau occupe est ecarte de la
  // liste des candidats.
  // Ordre des directions (x+y SIGNES de l'offset, echelle isometrique) :
  // 0 = sud-est, 1 = nord-est, 2 = sud-ouest, 3 = nord-ouest.
  var AUTO_DIRS = [
    { dx: Math.SQRT1_2, dy: Math.SQRT1_2 },  // sud-est (x+, y+)
    { dx: Math.SQRT1_2, dy: -Math.SQRT1_2 }, // nord-est (x+, y-)
    { dx: -Math.SQRT1_2, dy: Math.SQRT1_2 }, // sud-ouest (x-, y+)
    { dx: -Math.SQRT1_2, dy: -Math.SQRT1_2 }  // nord-ouest (x-, y-)
  ];
  // Un creneau est-il LIBRE (dans la carte, hors ville de depart, sans
  // recouvrement avec une emprise existante) ? Comme l'emprise est un
  // carre monde, le test AABB est exact cote collision ; le debord
  // visuel d'elevation (vers le nord de l'emprise) est couvert par le
  // MARGE (pad) qui agrandit la boite testee de MARGE px de chaque cote.
  var AUTO_MARGE = 300;
  function slotLibre(x, y, side, boxes) {
    var G = global.GAME;
    var ox = x - side / 2, oy = y - side / 2;
    if (ox < 60 || oy < 60 || ox + side > G.WORLD - 60 || oy + side > G.WORLD - 60) return false;
    if (x + side / 2 + AUTO_MARGE > G.TOWN_MIN && x - side / 2 - AUTO_MARGE < G.TOWN_MAX &&
        y + side / 2 + AUTO_MARGE > G.TOWN_MIN && y - side / 2 - AUTO_MARGE < G.TOWN_MAX) return false;
    for (var bi = 0; bi < boxes.length; bi++) {
      var b = boxes[bi];
      if (x + side / 2 + AUTO_MARGE > b.x && x - side / 2 - AUTO_MARGE < b.x + b.side + AUTO_MARGE &&
          y + side / 2 + AUTO_MARGE > b.y && y - side / 2 - AUTO_MARGE < b.y + b.side + AUTO_MARGE) return false;
    }
    return true;
  }
  function autoPosition(side, boxes) {
    var G = global.GAME;
    var cx = G.WORLD / 2, cy = G.WORLD / 2;
    var d1 = G.VILLE_AUTO_DIST || 1500;
    var d2 = d1 * 1.8;
    // Deux anneaux x quatre directions diagonales, dans l'ordre SE, NE,
    // SO, NO (anneau proche d'abord, puis loin).
    for (var ring = 0; ring < 2; ring++) {
      var dist = ring === 0 ? d1 : d2;
      for (var di = 0; di < 4; di++) {
        var dir = AUTO_DIRS[di];
        var x = cx + dir.dx * dist, y = cy + dir.dy * dist;
        if (slotLibre(x, y, side, boxes)) {
          return { x: Math.round(x - side / 2), y: Math.round(y - side / 2) };
        }
      }
    }
    // Tous les creneaux pris : on s'eloigne par pas de 25% de d1 en gardant
    // les memes directions, jusqu'a trouver de la place (limite 12 pas).
    for (var step = 1; step <= 12; step++) {
      var dd = d2 * (1 + 0.25 * step);
      for (var di2 = 0; di2 < 4; di2++) {
        var dir2 = AUTO_DIRS[di2];
        var x2 = cx + dir2.dx * dd, y2 = cy + dir2.dy * dd;
        if (x2 > side && y2 > side && x2 < G.WORLD - side && y2 < G.WORLD - side &&
            slotLibre(x2, y2, side, boxes)) {
          return { x: Math.round(x2 - side / 2), y: Math.round(y2 - side / 2) };
        }
      }
    }
    // Repli : ancrage est simple, cadre dans la carte.
    return {
      x: Math.round(Math.min(G.WORLD - side - 60, Math.max(60, cx + d1 - side / 2))),
      y: Math.round(Math.min(G.WORLD - side - 60, Math.max(60, cy - side / 2)))
    };
  }

  // Trouve la definition manuelle (config.js VILLE_DEFS) d'une ville.
  function findDef(defs, name) {
    for (var i = 0; i < defs.length; i++) {
      if ((defs[i].sprite || defs[i].name) === name) return defs[i];
    }
    return null;
  }

  // Cote serveur, sprite-meta.json peut manquer une nouvelle ville (genere
  // manuellement) : on injecte ses dimensions depuis le PNG lui-meme pour
  // que dom-stub (hasSprite("ville", <sprite>)) et villeSetup fonctionnent
  // meme si gen-sprite-meta.js n'a pas ete relance.
  function ensureSpriteMeta(found, meta) {
    var changed = false;
    for (var i = 0; i < found.length; i++) {
      var key = "ville/" + found[i].name + "/ville";
      if (meta[key]) continue;
      var d = fs.readFileSync(path.join(found[i].dir, found[i].png));
      meta[key] = {
        w: d.readUInt32BE(16), h: d.readUInt32BE(20),
        bounds: null
      };
      changed = true;
    }
    return changed;
  }

  // Manifeste JS partage client/serveur : declare chaque ville detectee au
  // navigateur. Le client fusionne ce tableau dans VILLE_DEFS
  // (src/ville.js, via villes.js en script statique OU via la reponse
  // "joined" du serveur) ; les defs manuelles restent prioritaires.
  // Retourne le tableau du manifeste (ecrit sur disque si possible).
  function buildManifest(found, defs, positions) {
    var manifest = [];
    for (var i = 0; i < found.length; i++) {
      var v = found[i];
      var def = findDef(defs, v.name);
      var pos = (!def && positions[v.name]) || null;
      var name = def ? (def.name || v.name) : v.name;
      var o = { name: name, sprite: v.name };
      if (def) {
        if (def.x != null) o.x = def.x;
        if (def.y != null) o.y = def.y;
        if (def.w != null) o.w = def.w;
      } else if (pos) {
        o.x = pos.x; o.y = pos.y;
      }
      manifest.push(o);
    }
    return manifest;
  }

  function writeManifest(manifest) {
    var lines = ["// Fichier genere par server/ville-sync.js au demarrage du serveur.",
                 "// Toutes les villes detectees dans assets/sprites/ville/ : le",
                 "// client les fusionne dans VILLE_DEFS (src/ville.js) et charge",
                 "// <sprite>/ville.png + <sprite>/ville_mask.png.",
                 "window.VILLE_MANIFEST = ["];
    for (var i = 0; i < manifest.length; i++) {
      lines.push("  " + JSON.stringify(manifest[i]) + ",");
    }
    lines.push("];");
    safeWrite(MANIFEST_PATH, lines.join("\n") + "\n");
  }

  // Point d'entree : verifie les villes, normalise, regenere les grilles,
  // met a jour ville-positions.json + le manifeste client villes.js.
  // Retourne un resume loggable.
  function sync() {
    var G = loadShared();
    // 1. Normalise un depot racine eventuel.
    if (fs.existsSync(path.join(ASSETS, "ville.png"))) {
      normalizeRootDeposit("default");
      console.log("[ville-sync] depot racine normalise vers ville/default/");
    }
    // 2. Scan des villes.
    var found = scanVilles();
    // 3. Positions persistees (stabilite entre redemarrages).
    var positions = readJson(POSITIONS_PATH);
    // 4. Grilles existantes + signatures pour ne regenerer que le necessaire.
    var grids = readJson(GRIDS_PATH);
    var sigs = readJson(SIGS_PATH);
    // 5. Emprises connues (defs manuelles + positions persistees) pour le
    //    placement auto sans recouvrement.
    var defs = G.VILLE_DEFS || [];
    var boxes = [];
    for (var di = 0; di < defs.length; di++) {
      if (defs[di].x == null || defs[di].y == null) continue;
      boxes.push({ x: defs[di].x, y: defs[di].y, side: defs[di].w || 0 });
    }
    for (var pk in positions) {
      if (!positions.hasOwnProperty(pk)) continue;
      if (findDef(defs, pk)) continue;
      boxes.push({ x: positions[pk].x, y: positions[pk].y, side: positions[pk].side || 0 });
    }

    var placed = 0, nGrids = 0;
    var names = [];
    var meta = readJson(META_PATH);
    if (ensureSpriteMeta(found, meta)) safeWrite(META_PATH, JSON.stringify(meta));
    for (var i = 0; i < found.length; i++) {
      var v = found[i];
      names.push(v.name);
      // Def manuelle (config.js) prioritaire ; sinon placement auto.
      var def = findDef(defs, v.name);
      var sig = villeSignature(v.dir, v.png, v.mask);
      // Grille : regeneree si nouvelle, masque change ou POSITION changee
      // (la grille encode l'origine monde ox/oy calculee depuis x/y).
      var posKey = null;
      if (def) {
        posKey = (def.x || 0) + "," + (def.y || 0) + "," + (def.w || 0);
      } else if (positions[v.name]) {
        posKey = positions[v.name].x + "," + positions[v.name].y + "," + (positions[v.name].side || 0);
      }
      var needGrid = !grids[v.name] || sigs[v.name] !== sig ||
                     (grids[v.name] && grids[v.name].pos !== posKey) ||
                     (grids[v.name] && grids[v.name].cell !== G.VILLE_GRID_CELL) ||
                     (grids[v.name] && grids[v.name].ver !== (G.VILLE_GRID_VERSION || 1));
      if (v.mask && needGrid) {
        var dec = pngRGBA(path.join(v.dir, v.mask));
        if (dec) {
          var d2 = def || positions[v.name] || {};
          var side = G.villeSideFor(dec.w, { w: d2.w, x: (d2.x != null ? d2.x : 0), y: (d2.y != null ? d2.y : 0) });
          // Placement auto si pas de def ET pas de position persistee.
          if (!def && !positions[v.name]) {
            var auto = autoPosition(side, boxes);
            positions[v.name] = { x: auto.x, y: auto.y, side: side };
            boxes.push({ x: auto.x, y: auto.y, side: side });
            placed++;
            d2 = positions[v.name];
            side = G.villeSideFor(dec.w, { w: d2.w, x: d2.x, y: d2.y });
          }
          var grid = G.villeGridFromPixels(dec.w, dec.h, dec.rgba, (d2.x || 0), (d2.y || 0), side, G.VILLE_GRID_CELL);
          if (grid) {
            grids[v.name] = {
              cell: grid.cell, cols: grid.cols, rows: grid.rows,
              ox: grid.ox, oy: grid.oy,
              rle: Array.prototype.slice.call(G.villeRLEEncode(grid.data)),
              pos: posKey,
              ver: G.VILLE_GRID_VERSION || 1
            };
            nGrids++;
          }
        }
      } else if (!v.mask && !grids[v.name]) {
        // Pas de masque : ville visible sans collision (grille vide).
        grids[v.name] = null;
      }
      if (sig) sigs[v.name] = sig;
    }
    // 6. Purge les villes DISPARUES du disque : grilles, signatures et
    //    positions orphelines ne doivent pas rester (une ville retiree doit
    //    disparaitre totalement au redemarrage suivant).
    var nameSet = {};
    for (var fi = 0; fi < found.length; fi++) nameSet[found[fi].name] = true;
    for (var gk in grids) {
      if (grids.hasOwnProperty(gk) && !nameSet[gk]) delete grids[gk];
    }
    for (var sk in sigs) {
      if (sigs.hasOwnProperty(sk) && !nameSet[sk]) delete sigs[sk];
    }
    for (var ppk in positions) {
      if (positions.hasOwnProperty(ppk) && !nameSet[ppk]) delete positions[ppk];
    }
    // 7. Ecrit les fichiers generes : grilles, positions, signatures,
    //    manifeste client. Chaque ecriture est tolerante (depot en lecture
    //    seule) : les donnees restent valables pour CE demarrage via le
    //    stash memoire ci-dessous.
    var wroteAll = true;
    wroteAll = safeWrite(GRIDS_PATH, JSON.stringify(grids)) && wroteAll;
    wroteAll = safeWrite(POSITIONS_PATH, JSON.stringify(positions)) && wroteAll;
    wroteAll = safeWrite(SIGS_PATH, JSON.stringify(sigs)) && wroteAll;
    var manifest = buildManifest(found, defs, positions);
    writeManifest(manifest);
    // 8. Stash MEMOIRE pour ce demarrage : dom-stub (charge ensuite par
    //    server/game.js) lit ces donnees EN PRIORITE sur les fichiers du
    //    disque. Sur un depot en lecture seule, les fichiers generes ne
    //    peuvent pas etre mis a jour, mais le serveur doit quand meme
    //    poser les villes detectees (grilles fraiches + manifeste).
    global.__VILLE_SYNC = { grids: grids, manifest: manifest, wroteAll: wroteAll };
    return { found: found.length, grids: nGrids, placed: placed, names: names, positions: positions, wroteAll: wroteAll };
  }

  module.exports = { sync: sync, scanVilles: scanVilles };
})();

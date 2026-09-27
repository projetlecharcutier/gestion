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
    fs.readdirSync(ASSETS).forEach(function (f) {
      var p = path.join(ASSETS, f);
      if (!fs.statSync(p).isDirectory()) return;
      if (f === "est" || f === "default") { /* deja la convention */ }
      if (!fs.existsSync(path.join(p, "ville.png"))) return;
      out.push({
        name: f,
        dir: p,
        png: "ville.png",
        mask: fs.existsSync(path.join(p, "ville_mask.png")) ? "ville_mask.png" : null
      });
    });
    return out;
  }

  // Deplace un depot racine (ville/ville.png) vers un sous-dossier
  // ville/<name>/ pour revenir a la convention documentee.
  function normalizeRootDeposit(name) {
    var dir = path.join(ASSETS, name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    ["ville.png", "ville_mask.png"].forEach(function (f) {
      var src = path.join(ASSETS, f);
      if (fs.existsSync(src)) fs.renameSync(src, path.join(dir, f));
    });
    return dir;
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

  // Placement automatique d'une nouvelle ville : ancree sur un cercle
  // autour de la ville principale (centre TOWN), ordre anti-horaire en
  // partant de l'est, distance VILLE_AUTO_DIST. boxes = emprises deja
  // posees [{x, y, side}] : defs MANUELLES de config.js + positions
  // persistees -> evite aussi le recouvrement avec la ville de depart.
  function autoPosition(side, boxes) {
    var G = global.GAME;
    var cx = G.WORLD / 2, cy = G.WORLD / 2;
    var dist = G.VILLE_AUTO_DIST || 1500;
    // Demarre a l'est (angle 0) et tourne anti-horaire : 1re ville ~est,
    // 2e ~nord, 3e ~ouest, 4e ~sud...
    var angle = -(boxes.length || 0) * (Math.PI / 2);
    var x, y;
    // Essaie jusqu'a 16 positions sur le cercle, s'eloigne si recouvrement.
    for (var attempt = 0; attempt < 16; attempt++) {
      var ang = angle - attempt * (Math.PI / 4);
      x = cx + Math.cos(ang) * dist;
      y = cy + Math.sin(ang) * dist;
      var ok = true;
      // Coin nord-ouest de l'emprise : la ville tient-elle dans la carte ?
      var ox = x - side / 2, oy = y - side / 2;
      if (ox < 60 || oy < 60 || ox + side > G.WORLD - 60 || oy + side > G.WORLD - 60) ok = false;
      // Pas de recouvrement avec la ville de depart (TOWN).
      if (ok && x + side / 2 > G.TOWN_MIN && x - side / 2 < G.TOWN_MAX &&
          y + side / 2 > G.TOWN_MIN && y - side / 2 < G.TOWN_MAX) ok = false;
      // Pas de recouvrement avec une autre ville PNG (defs + positions).
      if (ok) {
        for (var bi = 0; bi < boxes.length; bi++) {
          var b = boxes[bi];
          if (x + side / 2 > b.x && x - side / 2 < b.x + b.side &&
              y + side / 2 > b.y && y - side / 2 < b.y + b.side) { ok = false; break; }
        }
      }
      if (ok) return { x: Math.round(x - side / 2), y: Math.round(y - side / 2) };
    }
    // Repli : ancrage est simple, cadre dans la carte.
    return {
      x: Math.round(Math.min(G.WORLD - side - 60, Math.max(60, cx + dist - side / 2))),
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
  // navigateur (script statique, pas de fetch). Le client fusionne ce
  // tableau dans VILLE_DEFS (src/ville.js) ; les defs manuelles restent
  // prioritaires.
  function writeManifest(found, defs, positions) {
    var lines = ["// Fichier genere par server/ville-sync.js au demarrage du serveur.",
                 "// Toutes les villes detectees dans assets/sprites/ville/ : le",
                 "// client les fusionne dans VILLE_DEFS (src/ville.js) et charge",
                 "// <sprite>/ville.png + <sprite>/ville_mask.png.",
                 "window.VILLE_MANIFEST = ["];
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
      lines.push("  " + JSON.stringify(o) + ",");
    }
    lines.push("];");
    fs.writeFileSync(MANIFEST_PATH, lines.join("\n") + "\n");
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
    if (ensureSpriteMeta(found, meta)) fs.writeFileSync(META_PATH, JSON.stringify(meta));
    for (var i = 0; i < found.length; i++) {
      var v = found[i];
      names.push(v.name);
      // Def manuelle (config.js) prioritaire ; sinon placement auto.
      var def = findDef(defs, v.name);
      var pngPath = path.join(v.dir, v.png);
      var sig = pngSignature(pngPath);
      // Grille : regeneree si nouvelle, masque change ou POSITION changee
      // (la grille encode l'origine monde ox/oy calculee depuis x/y).
      var posKey = null;
      if (def) {
        posKey = (def.x || 0) + "," + (def.y || 0) + "," + (def.w || 0);
      } else if (positions[v.name]) {
        posKey = positions[v.name].x + "," + positions[v.name].y + "," + (positions[v.name].side || 0);
      }
      var needGrid = !grids[v.name] || sigs[v.name] !== sig ||
                     (grids[v.name] && grids[v.name].pos !== posKey);
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
              pos: posKey
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
    //    manifeste client.
    fs.writeFileSync(GRIDS_PATH, JSON.stringify(grids));
    fs.writeFileSync(POSITIONS_PATH, JSON.stringify(positions));
    fs.writeFileSync(SIGS_PATH, JSON.stringify(sigs));
    writeManifest(found, defs, positions);
    return { found: found.length, grids: nGrids, placed: placed, names: names, positions: positions };
  }

  module.exports = { sync: sync, scanVilles: scanVilles };
})();

// Villes decoratives PNG : grandes villes pre-dessinees posees sur la carte,
// avec collisions par zones (grille extraite du PNG masque) et occlusion
// correcte du joueur (rendu en bandes horizontales inserees dans le tri de
// profondeur x+y). Chaque ville = 2 PNG de MEME taille :
//   assets/sprites/ville/<sprite>.png        ville visible (pixel art)
//   assets/sprites/ville/<sprite>_mask.png  masque rouge/vert/transparent
//
// Convention du masque (couleurs PLEINES, sans anti-aliasing) :
//   transparent / blanc : libre (le personnage circule)
//   rouge pur (255,0,0)  : collision (bloque joueur ET zombies)
//   vert pur  (0,255,0)  : libre, le personnage passe DERRIERE le PNG
//
// Geometrie : le PNG suit la meme convention d'ancrage que les bâtiments
// (drawBuilding) -- emprise sol = losange iso de cote sprite.w * 2, PNG
// ancre bas-centre sur le bord sud du losange, dessine sur toute sa largeur.
// Un pixel du masque correspond au point de SOL situe "sous" lui a l'ecran
// (unprojection iso) : peindre en rouge la facade d'une tour rend solide
// toute sa projection au sol, vu du joueur.
//
// Parite client/serveur : la grille est calculee par la meme fonction pure
// (villeGridFromPixels) des deux cotes -- le client depuis le masque charge
// (canvas getImageData), le serveur depuis server/ville-grids.json genere
// par server/gen-sprite-meta.js (a relancer apres toute modification des
// PNG, comme sprite-meta.json). Encodage RLE pour le JSON.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Taille d'une cellule de la grille de collision d'une ville (px monde).
  // Doit rester PETITE devant le joueur (PLAYER_W = 6) : le mode
  // d'occlusion (villeCellInfo) est echantillonne a la position du joueur,
  // une cellule plus grosse que lui decalait les bascules devant/derriere
  // par rapport au masque peint. 1 px = precision du masque lui-meme.
  G.VILLE_GRID_CELL = 1;
  // Version de l'algorithme d'extraction de la grille : incrementee quand
  // la geometrie du filtre de sol change (le losange L1 -> carre d'emprise
  // a fixe le bas du PNG ignore). ville-sync regenere les grilles stockees
  // quand cette version differe de celle encodee dans ville-grids.json.
  G.VILLE_GRID_VERSION = 8;

  // Hauteur d'une bande de rendu (px image). Les bandes doivent rester
  // fines pour une occlusion precise du joueur par les façades.
  G.VILLE_BAND_H = 1;

  // Definitions des villes posees (config.js) : { name, sprite, x, y [, w] }.
  // (x, y) = coin nord-ouest de l'emprise sol ; w/h = cote du losange
  // (defaut : largeur du PNG * 2, convention bâtiments).
  G.VILLE_DEFS = G.VILLE_DEFS || [];

  // Manifeste genere par le serveur (assets/sprites/ville/villes.js) :
  // toutes les villes DETECTEES sur le disque, y compris celles poseees
  // automatiquement (server/ville-positions.json). Fusionnees ici pour que
  // client et serveur posent exactement les memes villes. Les defs de
  // config.js restent prioritaires (position manuelle conservee).
  (function mergeManifest() {
    var manifest = (typeof window !== "undefined" && window.VILLE_MANIFEST) ||
                   G.VILLE_MANIFEST;
    if (!manifest || !manifest.length) return;
    for (var i = 0; i < manifest.length; i++) {
      var m = manifest[i];
      if (!m || !m.sprite) continue;
      var dup = false;
      for (var d = 0; d < G.VILLE_DEFS.length; d++) {
        if ((G.VILLE_DEFS[d].sprite || G.VILLE_DEFS[d].name) === m.sprite) { dup = true; break; }
      }
      if (!dup) G.VILLE_DEFS.push(m);
    }
  })();

  // ------------------------------------------------------------------
  // Helpers de definition
  // ------------------------------------------------------------------
  // Cote du losange d'emprise d'une ville : defaut largeur du PNG * 2
  // (meme convention que makeBuilding), borne pour rester dans la carte.
  G.villeSideFor = function (pngW, def) {
    var side = (def && def.w) || pngW * 2;
    var maxSide = G.WORLD - 60 - Math.max(def.x || 0, def.y || 0);
    if (side > maxSide) side = maxSide;
    if (side < 1) side = 0;
    return side;
  };

  // Normalise une definition : ajoute x2/y2/cx/cy. Retourne null si invalide.
  G.villeNorm = function (v) {
    if (!v) return null;
    var side = v.w || 0;
    var out = {
      name: v.name || "Ville",
      sprite: v.sprite || v.name,
      x: v.x || 0,
      y: v.y || 0,
      w: side,
      h: v.h || side
    };
    if (out.w <= 0 || out.h <= 0) return null;
    out.x2 = out.x + out.w;
    out.y2 = out.y + out.h;
    out.cx = out.x + out.w / 2;
    out.cy = out.y + out.h / 2;
    return out;
  };

  // Villes actives : VILLE_DEFS normalisees, posees dans state.villes.
  // Appele par buildWorld (solo/serveur) et apres le chargement des assets
  // (mode serveur, le client ne lance pas buildWorld). Une ville sans PNG
  // charge est ignoree : le PNG est la source de verite de l'emprise.
  G.villeSetup = function (state) {
    var st = state || G.state;
    var defs = G.VILLE_DEFS || [];
    var out = [];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      if (!G.hasSprite("ville", d.sprite || d.name)) continue;
      var sp = G.SPRITES.ville[d.sprite || d.name];
      var side = G.villeSideFor(sp.w, d);
      if (side <= 0) continue;
      var v = G.villeNorm({ name: d.name, sprite: d.sprite, x: d.x, y: d.y, w: side, h: side });
      if (!v) continue;
      // Bbox VISUELLE du PNG (projete en monde) : le PNG est ancre bas-centre
      // sur le bord sud de l'emprise et dessine sur toute sa hauteur -- son
      // contenu en elevation deborde largement au nord/ouest/est de l'emprise
      // sol. La generation (villeAt/villeBoxHits) doit ecarter cette zone,
      // sinon les forets/maisons apparaissent DEVANT le decor du PNG.
      // Projection des 4 coins du PNG (zoom 1, cf. villeGridFromPixels).
      var iw = sp.w, ih = sp.h;
      var cx0 = (v.x - v.y) / 2;
      var groundY0 = (v.x + v.y + v.w + v.h) / 2 / 2;
      var losW = (v.w + v.h) / 2;
      var drawnH = losW * ih / iw;
      var pW = [], pH = [];
      for (var ci = 0; ci < 4; ci++) {
        var px = (ci % 2) * iw, py = (ci < 2 ? 0 : ih);
        var sx = cx0 - losW / 2 + (px / iw) * losW;
        var sy = groundY0 - drawnH + (py / ih) * drawnH;
        pW.push(sx + 2 * sy);
        pH.push(2 * sy - sx);
      }
      v.vx0 = Math.min.apply(null, pW); v.vx1 = Math.max.apply(null, pW);
      v.vy0 = Math.min.apply(null, pH); v.vy1 = Math.max.apply(null, pH);
      out.push(v);
    }
    st.villes = out;
    G.buildVilleGrids();
    return out;
  };

  // Une BOITE monde (bx, by, bw, bh) chevauche-t-elle une ville ? Test
  // boite-contre-boite (pas juste le centre) sur la bbox VISUELLE du PNG
  // (emprise sol + debord d'elevation vers le nord/ouest/est), plus pad.
  // Sert a ecarter la generation (forets, maisons, objets) des villes : une
  // foret centree juste hors de l'emprise avait auparavant la moitie de son
  // AABB DANS la ville, et le haut du PNG ville deborde loin au nord sans
  // qu'aucune emprise sol ne le couvre.
  G.villeBoxHits = function (bx, by, bw, bh, pad) {
    var villes = (G.state && G.state.villes) || [];
    var m = pad || 0;
    for (var i = 0; i < villes.length; i++) {
      var v = villes[i];
      var vx0 = (v.vx0 != null) ? v.vx0 : v.x;
      var vx1 = (v.vx1 != null) ? v.vx1 : v.x2;
      var vy0 = (v.vy0 != null) ? v.vy0 : v.y;
      var vy1 = (v.vy1 != null) ? v.vy1 : v.y2;
      if (bx < vx1 + m && bx + bw > vx0 - m && by < vy1 + m && by + bh > vy0 - m) return true;
    }
    return false;
  };
  // Une position est-elle dans l'emprise VISUELLE d'une ville (marge pad) ?
  // Sert a ecarter la generation (forets, maisons, objets) des villes.
  G.villeAt = function (x, y, pad) {
    return G.villeBoxHits(x, y, 0, 0, pad);
  };

  // ------------------------------------------------------------------
  // Grilles de collision (partagees client/serveur)
  // ------------------------------------------------------------------
  G.villeGrids = null; // { <sprite>: { cell, cols, rows, ox, oy, data } }

  G.setVilleGrid = function (sprite, grid) {
    if (!G.villeGrids) G.villeGrids = {};
    G.villeGrids[sprite] = grid;
  };

  // Fonction PURE (sans DOM) : construit la grille monde depuis les pixels
  // RGBA du masque. Utilisee par le client (canvas) ET par
  // server/gen-sprite-meta.js (decodeur PNG Node) -> parite exacte.
  //   iw, ih : taille du masque ; rgba : Uint8Array/Array iw*ih*4 ;
  //   x, y   : coin nord-ouest de l'emprise monde ; side : cote du losange.
  // Mapping : pixel (px, py) -> position ecran locale (zoom 1, sans camera)
  // -> unprojection iso -> coordonnees sol monde. La region couverte est un
  // parallelogramme (transformee affine) : la bbox des 4 coins donne
  // l'origine et la taille de la grille.
  G.villeGridFromPixels = function (iw, ih, rgba, x, y, side, cell) {
    if (!iw || !ih || !rgba || side <= 0) return null;
    cell = cell || G.VILLE_GRID_CELL;
    // Repere ecran local (zoom 1, camera origine) : le losange d'emprise
    // (x, y, side, side) a son coin sud sur le bord sud ; le PNG est dessine
    // sur la largeur du losange, ancre en bas (cf. drawVilleBand/drawBuilding).
    var losangeW0 = side;                    // (w + h) * 0.5 avec w = h = side
    var cx0 = (x - y) / 2;                   // centre ecran du losange
    var groundY0 = (x + y + 2 * side) / 4;    // coin sud (bas du PNG)
    var drawnH0 = losangeW0 * ih / iw;       // hauteur ecran du PNG (zoom 1)
    function groundOf(px, py) {
      var sx = cx0 - losangeW0 / 2 + (px / iw) * losangeW0;
      var sy = groundY0 - drawnH0 + (py / ih) * drawnH0;
      return [sx + 2 * sy, 2 * sy - sx];
    }
    // Bbox des 4 coins du masque -> origine/taille de la grille.
    var corners = [groundOf(0, 0), groundOf(iw, 0), groundOf(0, ih), groundOf(iw, ih)];
    var minWx = Infinity, maxWx = -Infinity, minWy = Infinity, maxWy = -Infinity;
    for (var c = 0; c < 4; c++) {
      if (corners[c][0] < minWx) minWx = corners[c][0];
      if (corners[c][0] > maxWx) maxWx = corners[c][0];
      if (corners[c][1] < minWy) minWy = corners[c][1];
      if (corners[c][1] > maxWy) maxWy = corners[c][1];
    }
    var ox = Math.floor(minWx / cell) * cell;
    var oy = Math.floor(minWy / cell) * cell;
    var cols = Math.ceil((maxWx - ox) / cell) + 1;
    var rows = Math.ceil((maxWy - oy) / cell) + 1;
    // Plafond de cellules : une grande ville (Minas 667x682 -> emprise 1334)
    // couvre ~16,5 M de cellules de 1 px ; l'ancien plafond de 4 M la rejetait
    // SILENCIEUSEMENT (aucune collision, aucun effet au clic). 25 M = ~25 Mo
    // de Uint8Array, calcule UNE fois au chargement.
    if (cols <= 0 || rows <= 0 || cols * rows > 25 * 1024 * 1024) return null;
    var data = new Uint8Array(cols * rows);
    // ECHANTILLONNAGE INVERSE : pour chaque cellule monde de la BBOX de la
    // grille (projection ecran du PNG ENTIER, y compris l'elevation), on
    // projette son centre en position ECRAN (zoom 1) puis on relit le pixel
    // du masque a cet endroit. C'est la reciproque EXACTE du rendu
    // (drawVilleBand/drawBuilding projettent le masque avec les memes
    // formules) : la grille represente donc ce que le joueur voit.
    //   - Couverture INTEGRALE : aucune trou dans un mur rouge (les
    //     marquages centre-seulement laissaient des trous de 1-2 px, les
    //     remplissages bbox soudaient les portes de 2-3 px image et
    //     rendaient les zones vertes inaccessibles alors qu'elles sont
    //     reliees sur le masque).
    //   - Une porte etroite du masque reste une porte.
    //   - Les bords anti-aliases (255,128,128...) ne passent pas les seuils
    //     -> libres (tolerance du cote traversable).
    //   - TOUTE la surface peinte du masque compte : la moitie haute du PNG
    //     (tours, hautes facades) se projette au NORD du carre d'emprise --
    //     les y exclure (ancien filtre "elevation") laissait le joueur
    //     marcher SUR ces facades sans collision et devant leur rendu.
    //     Un joueur au pied d'une tour peinte rouge est bloque ; une zone
    //     peinte verte le cache (mode derriere) ; transparente, libre.
    var bx0 = ox, bx1 = ox + cols * cell, by0 = oy, by1 = oy + rows * cell;
    // Le carre monde [x..x+side]x[y..y+side] se projette en un losange
    // ecran : son centre et son coin sud.
    // proj(wx, wy) a zoom 1, camera origine : sx = (wx-wy)/2, sy = (wx+wy)/4
    // Reciproque : wx = sx + 2*sy, wy = 2*sy - sx.
    // Une cellule monde (wx, wy) -> ecran (sx, sy) -> pixel masque :
    //   sxF = (sx - (cx0 - losangeW0/2)) / losangeW0 * iw
    //   pyF = (sy - (groundY0 - drawnH0)) / drawnH0 * ih
    function sampleMask(wx, wy) {
      var sx = (wx - wy) * 0.5;
      var sy = (wx + wy) * 0.25;
      var fx = (sx - (cx0 - losangeW0 / 2)) / losangeW0 * iw;
      var fy = (sy - (groundY0 - drawnH0)) / drawnH0 * ih;
      var px = Math.floor(fx), py = Math.floor(fy);
      if (px < 0 || py < 0 || px >= iw || py >= ih) return 0;
      var k = (py * iw + px) * 4;
      if (rgba[k + 3] < 128) return 0;
      var r = rgba[k], gch = rgba[k + 1], b = rgba[k + 2];
      if (r > 180 && gch < 90 && b < 90) return 1;
      if (gch > 180 && r < 90 && b < 90) return 2;
      return 0;
    }
    var gx0 = 0, gx1 = cols - 1, gy0 = 0, gy1 = rows - 1;
    for (var gy = gy0; gy <= gy1; gy++) {
      var wyC = oy + (gy + 0.5) * cell;
      var rowOff = gy * cols;
      for (var gx = gx0; gx <= gx1; gx++) {
        if (gx < 0 || gx >= cols) continue;
        var wxC = ox + (gx + 0.5) * cell;
        var val = sampleMask(wxC, wyC);
        if (!val) continue;
        if (val === 1) data[rowOff + gx] = 1;
        else if (data[rowOff + gx] === 0) data[rowOff + gx] = 2;
      }
    }
    return { cell: cell, cols: cols, rows: rows, ox: ox, oy: oy, data: data };
  };

  // RLE compact pour ville-grids.json : [valeur, longueur, ...] plats.
  G.villeRLEEncode = function (data) {
    var out = [];
    var i = 0;
    while (i < data.length) {
      var v = data[i], n = 1;
      while (i + n < data.length && data[i + n] === v && n < 0xFFFFFF) n++;
      out.push(v, n);
      i += n;
    }
    return out;
  };

  G.villeRLEDecode = function (rle, len) {
    var out = new Uint8Array(len);
    var p = 0;
    for (var i = 0; i + 1 < rle.length; i += 2) {
      var v = rle[i], n = rle[i + 1];
      for (var k = 0; k < n && p < len; k++) out[p++] = v;
    }
    return out;
  };

  // Grilles brutes fournies par le stub serveur (server/ville-grids.json,
  // lu par dom-stub.js AVANT le chargement des modules) : decodees ici car
  // setVilleGrid n'existe qu'a partir de ce module.
  if (G._villeGridsRaw) {
    var rawNames = Object.keys(G._villeGridsRaw);
    for (var ri = 0; ri < rawNames.length; ri++) {
      var rn = rawNames[ri];
      var rg = G._villeGridsRaw[rn];
      var cols = rg.cols, rows = rg.rows;
      var grid = {
        cell: rg.cell, cols: cols, rows: rows, ox: rg.ox, oy: rg.oy,
        data: G.villeRLEDecode(rg.rle, cols * rows)
      };
      G.setVilleGrid(rn, grid);
    }
    G._villeGridsRaw = null;
  }

  // Client : extrait la grille d'une ville depuis son masque PNG charge
  // (G.SPRITES.ville["<sprite>_mask"]). Retourne la grille ou null.
  G.villeExtractGrid = function (sprite) {
    if (typeof document === "undefined") return null;
    var def = null;
    var defs = G.VILLE_DEFS || [];
    for (var i = 0; i < defs.length; i++) {
      if ((defs[i].sprite || defs[i].name) === sprite) { def = defs[i]; break; }
    }
    if (!def) return null;
    var sp = G.hasSprite("ville", sprite + "_mask") ? G.SPRITES.ville[sprite + "_mask"] : null;
    if (!sp || !sp.img) return null;
    var side = G.villeSideFor(sp.w, def);
    if (side <= 0) return null;
    try {
      var cv = document.createElement("canvas");
      cv.width = sp.w; cv.height = sp.h;
      var cx = cv.getContext("2d");
      cx.drawImage(sp.img, 0, 0);
      var id = cx.getImageData(0, 0, sp.w, sp.h);
      return G.villeGridFromPixels(sp.w, sp.h, id.data, def.x, def.y, side, G.VILLE_GRID_CELL);
    } catch (e) {
      return null;
    }
  };

  // Construit les grilles des villes actives (client : depuis les masques).
  // Les grilles deja presentes (serveur : stash JSON) sont conservees.
  G.buildVilleGrids = function () {
    var villes = (G.state && G.state.villes) || [];
    for (var i = 0; i < villes.length; i++) {
      var v = villes[i];
      if (G.villeGrids && G.villeGrids[v.sprite]) continue;
      var grid = G.villeExtractGrid(v.sprite);
      if (grid) G.setVilleGrid(v.sprite, grid);
    }
  };

  // Valeur de grille a (x, y) monde : 1 = solide, 2 = derriere, 0 = libre,
  // -1 = hors de toute ville. Sert au pathfinding (villeBlockNav) et au
  // debug.
  G.villeCell = function (x, y) {
    var grids = G.villeGrids;
    if (!grids) return -1;
    var villes = (G.state && G.state.villes) || [];
    for (var i = 0; i < villes.length; i++) {
      var g = grids[villes[i].sprite];
      if (!g) continue;
      var gx = Math.floor((x - g.ox) / g.cell);
      var gy = Math.floor((y - g.oy) / g.cell);
      if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) continue;
      return g.data[gy * g.cols + gx];
    }
    return -1;
  };

  // Info d'occlusion du joueur par les villes : { sprite, cell, ground, mode }
  // ou null si (x, y) n'est dans la bbox d'aucune grille de ville.
  //   cell  : valeur de la cellule (0 libre, 1 solide, 2 derriere) ;
  //   ground: vrai si le point est dans le losange de SOL de la ville — la
  //           bande basse du PNG. Les cellules hors losange viennent du
  //           contenu en elevation (haut du PNG) : le joueur y est deja
  //           naturellement derriere la ville au tri par profondeur ;
  //   mode  : 0 = tri naturel, 1 = joueur DERRIERE le PNG (cellule verte
  //           au sol), 2 = joueur DEVANT le PNG (cellule transparente au
  //           sol). Utilise par render() pour reordonner les bandes de la
  //           ville par rapport au joueur : sans cela, la bande basse le
  //           cachait aussi sur les zones transparentes du masque.
  G.villeCellInfo = function (x, y) {
    var grids = G.villeGrids;
    if (!grids) return null;
    var villes = (G.state && G.state.villes) || [];
    for (var i = 0; i < villes.length; i++) {
      var v = villes[i];
      var g = grids[v.sprite];
      if (!g) continue;
      var gx = Math.floor((x - g.ox) / g.cell);
      var gy = Math.floor((y - g.oy) / g.cell);
      if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) continue;
      var cell = g.data[gy * g.cols + gx];
      var ground = x >= v.x && x <= v.x2 && y >= v.y && y <= v.y2;
      // Le mode s'applique a TOUTE la bbox de la grille (emprise sol +
      // elevation au nord) : la grille couvre la projection ecran du PNG
      // entier, une cellule verte y signifie "le sol ici est DERRIERE le
      // PNG" et une cellule transparente "le joueur est DEVANT la ville".
      // L'ancien test ground (carre d'emprise seul) ignorait la moitie
      // haute : le joueur au pied d'une facade haute etait en mode 0
      // (tri naturel) et apparaissait SUR le PNG.
      var mode = 0;
      if (cell === 2) mode = 1;
      else if (cell === 0) mode = 2;
      return { sprite: v.sprite, cell: cell, ground: ground, mode: mode };
    }
    return null;
  };

  // Cellule de grille d une ville au point ECRAN (sx, sy) : unproj le
  // point, puis lit la grille de la ville v. La grille ayant ete construite
  // par echantillonnage inverse (cellule monde -> pixel masque), la cellule
  // en unproj(sx, sy) est EXACTEMENT le pixel du masque dessine a l ecran
  // en (sx, sy). Sert au departage PAR BANDE du rendu : chaque bande qui
  // chevauche le corps du joueur echantillonne le masque a SA hauteur ->
  // seule la partie VERTE du PNG passe devant lui, la partie transparente
  // reste derriere. Retourne -1 si le point n est pas dans la grille.
  G.villeCellAtScreen = function (v, sx, sy) {
    var grids = G.villeGrids;
    if (!grids || !v || !grids[v.sprite] || !G.unproj) return -1;
    var g = grids[v.sprite];
    var w = G.unproj(sx, sy);
    var gx = Math.floor((w[0] - g.ox) / g.cell);
    var gy = Math.floor((w[1] - g.oy) / g.cell);
    if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return -1;
    return g.data[gy * g.cols + gx];
  };

  // Direction de fuite (dx, dy, non normalisee) vers le bord le plus proche
  // de l'emprise de la ville contenant (x, y), ou null si hors de toute
  // ville. Sert a extraire un zombie pris dans une cellule solide (spawn
  // bord de carte, separation) : il marche droit vers l'exterieur.
  G.villeEscape = function (x, y) {
    var villes = (G.state && G.state.villes) || [];
    for (var i = 0; i < villes.length; i++) {
      var v = villes[i];
      if (x < v.x || x > v.x2 || y < v.y || y > v.y2) continue;
      var dl = x - v.x, dr = v.x2 - x, dt = y - v.y, db = v.y2 - y;
      var m = Math.min(dl, dr, dt, db);
      if (m === dl) return { dx: -1, dy: 0 };
      if (m === dr) return { dx: 1, dy: 0 };
      if (m === dt) return { dx: 0, dy: -1 };
      return { dx: 0, dy: 1 };
    }
    return null;
  };

  // Test AABB contre les cellules solides des villes : la boite monde
  // (bx, by, bw, bh) touche-t-elle une cellule rouge ? Meme esprit que
  // aabbHitsBuildings, sur la grille ville.
  G.aabbHitsVilles = function (bx, by, bw, bh) {
    var grids = G.villeGrids;
    if (!grids) return false;
    var villes = (G.state && G.state.villes) || [];
    for (var i = 0; i < villes.length; i++) {
      var g = grids[villes[i].sprite];
      if (!g) continue;
      if (bx + bw <= g.ox || bx >= g.ox + g.cols * g.cell) continue;
      if (by + bh <= g.oy || by >= g.oy + g.rows * g.cell) continue;
      var cell = g.cell;
      var minCx = Math.max(0, Math.floor((bx - g.ox) / cell));
      var maxCx = Math.min(g.cols - 1, Math.floor((bx + bw - g.ox) / cell));
      var minCy = Math.max(0, Math.floor((by - g.oy) / cell));
      var maxCy = Math.min(g.rows - 1, Math.floor((by + bh - g.oy) / cell));
      for (var cy = minCy; cy <= maxCy; cy++) {
        var base = cy * g.cols;
        for (var cxx = minCx; cxx <= maxCx; cxx++) {
          if (g.data[base + cxx] === 1) return true;
        }
      }
    }
    return false;
  };

  // Variante centree (meme contrat que aabbHitsForets : demi-cote half).
  G.aabbHitsVillesCenter = function (x, y, half) {
    return G.aabbHitsVilles(x - half, y - half, half * 2, half * 2);
  };

  // Pathfinding zombies : marque les cellules nav (32 px) dont le centre
  // tombe sur une cellule solide de ville. Appele par rebuildNavGrid.
  G.villeBlockNav = function (blocked, cols, rows, cell) {
    var grids = G.villeGrids;
    if (!grids) return;
    var villes = (G.state && G.state.villes) || [];
    for (var i = 0; i < villes.length; i++) {
      var g = grids[villes[i].sprite];
      if (!g) continue;
      var minCx = Math.floor(g.ox / cell), maxCx = Math.ceil((g.ox + g.cols * g.cell) / cell);
      var minCy = Math.floor(g.oy / cell), maxCy = Math.ceil((g.oy + g.rows * g.cell) / cell);
      for (var ncx = minCx; ncx < maxCx; ncx++) {
        for (var ncy = minCy; ncy < maxCy; ncy++) {
          if (ncx < 0 || ncx >= cols || ncy < 0 || ncy >= rows) continue;
          if (G.villeCell(ncx * cell + cell / 2, ncy * cell + cell / 2) === 1) {
            blocked[ncy * cols + ncx] = 1;
          }
        }
      }
    }
  };

  // ------------------------------------------------------------------
  // Rendu en bandes : le PNG est decoupe en rubans horizontaux, chaque
  // ruban insere dans le tri x+y. Une ligne horizontale de l'ecran iso est
  // une ligne de profondeur constante (wx + wy = 4 * sy / z) : le bas d'une
  // bande (fraction t1 de la hauteur du PNG) correspond a la ligne de sol de
  // profondeur (x + w + y + h) - 2 (w + h) (ih/iw) (1 - t1). Les bandes plus
  // au sud sont dessinees apres -> couvrent le joueur qui est derriere.
  // ------------------------------------------------------------------
  var _bandCache = {}; // sprite + dims -> { img, iw, ih, bands }

  G.villeBands = function (v) {
    if (!G.hasSprite("ville", v.sprite)) return null;
    var sp = G.SPRITES.ville[v.sprite];
    if (!sp || !sp.img) return null;
    var img = sp.img;
    var iw = img.naturalWidth || sp.w;
    var ih = img.naturalHeight || sp.h;
    if (!iw || !ih) return null;
    var key = v.sprite + ":" + iw + "x" + ih + ":" + v.x + "," + v.y;
    if (_bandCache[key]) return _bandCache[key];
    var bands = [];
    var nb = Math.max(1, Math.ceil(ih / G.VILLE_BAND_H));
    for (var b = 0; b < nb; b++) {
      var sy = Math.floor(b * ih / nb);
      var sy2 = (b + 1 === nb) ? ih : Math.floor((b + 1) * ih / nb);
      var t1 = sy2 / ih;
      bands.push({
        sy: sy, sh: sy2 - sy, t1: t1,
        depth: (v.x + v.w + v.y + v.h) - 2 * (v.w + v.h) * (ih / iw) * (1 - t1)
      });
    }
    var entry = { img: img, iw: iw, ih: ih, bands: bands };
    _bandCache[key] = entry;
    return entry;
  };

  // Dessine une bande (appele depuis la passe triee de render()).
  // d.ref = { v: ville, band: bande, entry: villeBands() }.
  G.drawVilleBand = function (v, band, entry) {
    var ctx = G.ctx;
    if (!ctx || !entry) return;
    var z = G.state.zoom;
    var A = G.proj(v.x, v.y), C = G.proj(v.x + v.w, v.y + v.h);
    var D = G.proj(v.x, v.y + v.h);
    var cx = (A[0] + C[0]) / 2;
    var groundY = Math.max(C[1], D[1]);
    var losangeW = (v.w + v.h) * 0.5 * z;
    var fullDh = losangeW * entry.ih / entry.iw;
    var dh = fullDh * band.sh / entry.ih;
    var dy = groundY - fullDh + (band.sy / entry.ih) * fullDh;
    if (dy >= G.viewH() || dy + dh <= 0) return;
    ctx.drawImage(entry.img, 0, band.sy, entry.iw, band.sh,
                  cx - losangeW / 2, dy, losangeW, dh);
  };
})();

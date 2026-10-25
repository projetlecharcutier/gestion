// Grille de construction : snap des poses (G.snapToGrid, src/config.js) +
// rendu du quadrillage en pointilles visible en mode construction (Z).
// Le snap est applique dans tryBuildWall / placeFromBuildMenu (src/walls.js,
// src/towers.js) cote client ET serveur : la grille est une constante pure
// (G.BUILD_GRID, src/config.js), identique des deux cotes. Ce fichier ne
// porte que le rendu (client) : aucun etat, aucune logique de pose.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Quadrillage en pointilles des cellules de la grille de construction,
  // dessine sur la zone visible. Uniquement en mode build (Z) : la grille
  // guide le placement, elle ne s'affiche pas hors construction. Couleurs
  // dans G.TEXTURES.buildGrid (src/textures/hud.js).
  // Perf : on projette les 4 coins monde de la vue puis on balaie les
  // cellules couvertes ; le nombre de cellules reste faible meme au zoom
  // minimal (la grille fait 120 px monde = 90 px ecran au zoom 1).
  G.drawBuildGrid = function () {
    var state = G.state;
    if (!state.buildMode || !G.TEXTURES || !G.TEXTURES.buildGrid) return;
    var ctx = G.ctx;
    var t = G.TEXTURES.buildGrid;
    var g = G.BUILD_GRID;
    var b = G.visibleWorldBounds();
    // Marge d'une cellule : les cellules partiellement visibles au bord
    // doivent etre dessinees aussi.
    var x0 = Math.floor(b.minX / g) * g - g, x1 = Math.ceil(b.maxX / g) * g + g;
    var y0 = Math.floor(b.minY / g) * g - g, y1 = Math.ceil(b.maxY / g) * g + g;
    // Hors monde : pas de grille (le fond etoile reste visible).
    x0 = Math.max(x0, 0); y0 = Math.max(y0, 0);
    x1 = Math.min(x1, G.WORLD); y1 = Math.min(y1, G.WORLD);
    ctx.save();
    ctx.strokeStyle = t.line;
    ctx.lineWidth = t.lineWidth;
    ctx.setLineDash(t.dash);
    ctx.globalAlpha = t.alpha;
    // Les lignes de la grille suivent les 2 axes monde (iso) : on projette
    // les extremites de chaque segment pour rester exact a tout zoom.
    var i, p;
    ctx.beginPath();
    for (i = x0; i <= x1; i += g) {
      p = G.proj(i, y0);
      ctx.moveTo(p[0], p[1]);
      p = G.proj(i, y1);
      ctx.lineTo(p[0], p[1]);
    }
    for (i = y0; i <= y1; i += g) {
      p = G.proj(x0, i);
      ctx.moveTo(p[0], p[1]);
      p = G.proj(x1, i);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    // Cellule sous le curseur : contour plein (accentue), meme couleur que
    // le hint de pose (drawBuildHint dessine l'emprise exacte du batiment).
    if (state.mouse.inside) {
      var cell = G.buildCellAt(state.mouse.wx, state.mouse.wy);
      var A = G.proj(cell.x, cell.y), B = G.proj(cell.x + cell.w, cell.y),
          C = G.proj(cell.x + cell.w, cell.y + cell.h), D = G.proj(cell.x, cell.y + cell.h);
      ctx.setLineDash([]);
      ctx.strokeStyle = t.cell;
      ctx.lineWidth = t.cellWidth;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(B[0], B[1]);
      ctx.lineTo(C[0], C[1]);
      ctx.lineTo(D[0], D[1]);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  };
})();

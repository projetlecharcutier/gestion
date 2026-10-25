# Grille de construction — `src/grid.js` + `src/config.js`

> Système : **snap de toutes les poses joueur** (palissades, tours, bâtiments de
> ville) sur une grille monde carrée, et **affichage d'un quadrillage en
> pointillés** en mode construction (touche **Z**). Objectif : des jointures
> précises entre palissades (murs continus sans trou), base pour de futurs PNG
> contextuels (apparence selon les briques adjacentes).

## 1. Vue d'ensemble

- **Cellule** : `G.BUILD_GRID` = **120 px monde**, origine (0,0). 120 = longueur
  nominale d'une palissade (`PLANK_LONG`) : une palissade occupe exactement une
  cellule en longueur, deux palissades dans des cellules adjacentes se touchent
  sans trou ni chevauchement.
- **Snap** : `G.snapToGrid(wx, wy)` (`src/config.js`, fonction pure, **partagée
  client/serveur**) arrondit le point cliqué au **centre de la cellule la plus
  proche**. Appliqué dans `tryBuildWall` (`src/walls.js`) et
  `placeFromBuildMenu` (`src/towers.js`) — donc automatiquement côté serveur en
  multijoueur (mêmes fichiers chargés par `server/game.js`), pas de divergence
  client/serveur possible.
- **Rendu** : `G.drawBuildGrid()` (`src/grid.js`, client uniquement) dessine les
  lignes de la grille en **pointillés** sur la zone visible, **uniquement en
  mode construction** (`state.buildMode`, touche Z), plus un **contour plein de
  la cellule sous le curseur**. Couleurs dans `G.TEXTURES.buildGrid`
  (`src/textures/hud.js`).
- **Aperçu de pose** : `drawBuildHint` (`src/hud.js`) snappe aussi le centre de
  son losange : l'aperçu dessine exactement la cellule où le bâtiment sera posé.

## 2. Exposé sur `G`

| Fonction | Rôle |
|----------|------|
| `G.BUILD_GRID` | Cote d'une cellule de grille (120 px monde) — `src/config.js` |
| `G.snapToGrid(wx, wy)` | Centre de la cellule la plus proche — pur, client+serveur |
| `G.buildCellAt(wx, wy)` | `{ cx, cy, x, y, w, h }` de la cellule contenant le point |
| `G.drawBuildGrid()` | Quadrillage pointillé (mode build uniquement) — `src/grid.js` |

## 3. Points d'application du snap

| Pose | Fichier | Comportement |
|------|---------|--------------|
| Palissade | `tryBuildWall` (`src/walls.js`) | Centre snappé **avant** les gardes (portée, planches, chevauchement bâtiments/villes) : la cellule visée est testée, pas le pixel cliqué |
| Tour | `placeFromBuildMenu` (`src/towers.js`) | Centre snappé en tête de fonction (toutes les branches : bâtiment de ville, tour) |
| Bâtiment de ville | `placeFromBuildMenu` (`src/towers.js`) | Idem (scierie, université, montgolfièze, marché, potence) |

**Non snappés** (intentionnel) : les entités générées par le monde
(`buildWorld`, `src/world.js`) — maisons, forêts, décor, mur de périmètre — et
les usines/fabrications (`makeTower`, `makeScierie`, `makeTownBuilding` appelées
directement, ex. tests). Seules les **poses joueur** entrent dans la grille.

## 4. Affichage

- **Activation** : `state.buildMode` (touche **Z**, sélection dans le menu de
  construction, ou mode clavier/touch). La grille disparaît en quittant le mode
  (clic droit / Échap / Z).
- **Appel** : `render()` (`src/render.js`), juste avant `drawBuildHint` — la
  grille est sous l'aperçu de pose.
- **Géométrie** : les lignes suivent les 2 axes monde (projection iso), les
  extrémités sont projetées à chaque frame (exact à tout zoom). Hors monde
  (`[0, WORLD]`) : pas de grille (fond étoilé).
- **Cellule curseur** : contour plein (`TEXTURES.buildGrid.cell`) quand la
  souris est dans le canvas.

## 5. Étendre

- **Taille de cellule** : changer `G.BUILD_GRID` (`src/config.js`). Le snap est
  multiplicatif (origine 0,0) : toute valeur divise le monde en cellules.
- **Grille décalée** (origine ≠ 0) : ajouter un offset dans `G.snapToGrid` —
  penser à le garder identique client/serveur (constante pure).
- **PNG contextuels (briques adjacentes)** : énumérer les cellules voisines
  d'une palissade posée (`G.buildCellAt` sur les 8 voisins), lire
  `state.walls`/`state.towers`/`state.buildings` pour savoir lesquelles sont
  occupées, et choisir le PNG en fonction (rendu `drawWall`, `src/render.js`).
- **Nouvelle texture de grille** : modifier `G.TEXTURES.buildGrid`
  (`src/textures/hud.js`) uniquement.

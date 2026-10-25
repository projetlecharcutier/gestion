# Murs & construction — `src/walls.js`

## Contrat
Construction de planches/murs (mode pose de planche : Z + clic) avec rotation, et nettoyage des murs détruits. Dépend de `config.js` (`WALL_PLANKS`, `WALL_BUILD_RANGE`, `WALL_MAX_HP`), `state.js` (`planks`, `walls`, `buildings`, `plankRotation`). Les dégâts sur murs sont appliqués par les zombies (`src/zombies.js`).

## Exposé sur `G`
- `PLANK_LONG` (= `G.BUILD_GRID`, 120), `PLANK_THICK` (24) — dimensions d'une planche posée (px). **La palissade est la référence de la grille** : sa longueur = la cellule, une palissade occupe exactement une cellule en longueur.
- `plankDims()` — `{ w, h }` selon `state.plankRotation` (0 = direction **A** = NESO, 1 = direction **B** = NOSE).
- `WALL_VARIANTS` — `["A","B","C","H","K","X","Z"]`, les 7 PNG de palissade.
- `wallSpriteDims()` — `{ longW, thick }` (longW = `PLANK_LONG` = `BUILD_GRID`).
- `wallEndpoints(m)` — les 2 extrémités monde d'une palissade selon sa direction (`dir: "A"` joint les coins NE/SO de sa cellule, `"B"` joint NO/SE).
- `computeWallVariant(m, walls?)` — calcule la variante ("A".."Z") d'une palissade à partir des **contacts de coins** avec les murs voisins (voir § Variantes).
- `refreshWallVariant(m)` / `refreshAllWallVariants()` — (re)calcule et stocke `m.variant`.
- `tryBuildWall(wx, wy)` — pose une planche si : à portée du joueur, assez de planches, pas sur bâtiment. Le point est **snappé sur la grille de construction** (`G.snapToGrid`, `BUILD_GRID` = 120, voir [grid.md](grid.md)) avant les gardes : la palissade est centrée sur sa cellule. Le joueur ne choisit que la **direction** (`state.plankRotation` → `wall.dir` "A"/"B") ; la **variante** (PNG) est calculée automatiquement. Consomme `WALL_PLANKS` planches. La planche est marquée `built: true`. Les planches **peuvent se superposer** (pas de test mur-vs-mur). Après la pose, les variantes de la nouvelle palissade et de ses voisins sont rafraîchies.
- `aabbHitsWalls(cx, cy, cw, ch)` — teste si une boîte chevauche une planche **posée par le joueur** (`wall.built`). Les murs de périmètre (sans `built`) ne bloquent pas.
- `rotatePlank()` — bascule `state.plankRotation` entre 0 et 1 (rotation 90°).
- `cleanupWalls()` — retire les murs à `hp <= 0`. Appelé chaque frame.

## Structure d'un mur
`{ x, y, w, h, hp, orient, dir, variant, built? }` — `orient` "h" ou "v" (dérivé de `w>h` au moment de la pose, détermine la largeur de la barre de vie au rendu). `dir` "A" (NESO) ou "B" (NOSE) = direction choisie par le joueur. `variant` "A".."Z" = PNG affiché, calculé automatiquement (voir § Variantes), **sérialisé dans les snapshots** (tous les clients voient le même PNG). `built: true` uniquement pour les planches **posées par le joueur** ; absent pour le mur de périmètre. **Seules les planches `built` bloquent le déplacement** (joueur et zombies, via `aabbHitsWalls`).

## Variantes de palissade (PNG A/B/C/H/K/X/Z)

Le joueur ne choisit que la **direction** (A = NESO, B = NOSE) via `state.plankRotation` (touche Espace/R en mode pose). La **variante** (le PNG affiché) est calculée automatiquement à partir des murs voisins : chaque **coin** du losange de la cellule teste s'il est en contact avec un mur voisin (une extrémité d'un mur `built` coïncide avec le coin à 0.2 cellule près).

Convention des coins (cote monde) : `NO` = haut, `NE` = droit, `SE` = bas, `SO` = gauche.

| Variante | Coins en contact | Forme |
|----------|------------------|-------|
| **A** | aucun | mur droit, direction NESO |
| **B** | aucun | mur droit, direction NOSE |
| **C** | SE + NE | branchement côté droit |
| **H** | SE + SO + NE | T (bas + côté droit) |
| **K** | NE + NO + SE | T (haut + côté droit) |
| **X** | les 4 coins | croix |
| **Z** | SO + NO | branchement côté gauche (dir. B) |

Toute autre combinaison retombe sur la direction de base (A ou B). Les murs du périmètre de ville (non `built`) ne comptent pas comme contacts. Le contact est aussi testé par AABB élargie pour les segments du périmètre (alignés sur les bords de ville, pas sur la grille).

**Rafraîchissement** : à la pose (`tryBuildWall`) et à la destruction (`cleanupWalls`), les variantes des murs concernés et de leurs voisins sont recalculées. La variante est sérialisée dans les snapshots serveur (delta + join) et le checksum `trackMutations` la prend en compte (un changement de PNG sans changement de PV est quand même envoyé).

## Contraintes
- Activation du mode pose : touche **Z** (avec `w`/`W` comme fallback AZERTY) gérée dans `src/input.js`. En mode pose, un **quadrillage pointillé** de la grille de construction s'affiche (`G.drawBuildGrid`, `src/grid.js`, appelé dans `render()`).
- Rotation : touche **Espace** en mode pose (gérée dans `src/input.js`, appelle `rotatePlank()`). Hors mode pose, Espace = tir.
- Portée de construction : `WALL_BUILD_RANGE` (180 px) autour du joueur.
- Coût : 4 planches par planche posée.
- Anti-chevauchement : pas de construction **sur bâtiment** ; la superposition de planches entre elles est autorisée.
- **Blocage** : seules les planches posées par le joueur (`built: true`) bloquent le joueur (`tryMove`) et les zombies (`updateZombies`). Le mur de périmètre reste traversable.

## Étendre
- **Réparer un mur** : ajouter une fonction qui incrémente `wall.hp` (borné à `WALL_MAX_HP`) contre des planches.
- **Mur renforcé** : ajouter un champ `wall.armor` et le soustraire aux dégâts dans `updateZombies`.
- **Matériaux variés** : ajouter un `wall.material` lu par le rendu (`src/render.js`).
- **Désactiver la superposition** : réintroduire un test mur-vs-mur dans `tryBuildWall`.

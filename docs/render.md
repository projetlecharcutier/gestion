# Rendu — `src/render.js`

## Contrat
Dessine tout (sol, objets, arbres, bâtiments, murs, zombies, joueur, projectiles, brouillard, viseur) et orchestre `render()`. Dépend de `config.js`, `state.js`, `projection.js`, `hud.js`, `bag.js`, **et des textures `G.TEXTURES`** (`src/textures/`). C'est le plus gros fichier : à ne modifier que pour du dessin. Les sprites et couleurs ne sont **pas** définis ici — ils viennent de `G.TEXTURES`.

## Exposé sur `G`
- Helpers : `fillPoly(points, fill, stroke)`, `roundRect(x,y,w,h,r)`
- `drawGround()` — tuiles iso (ville vs hors ville) + bordure de ville
- `drawItem(it)`, `drawTree(t)`, `drawBuilding(b)` (texture mairie bleu/blanc/rouge + barre de vie si `b.isMairie`), `drawWall(m)`, `drawZombie(z)`, `drawPlayer()`, `drawProjectiles()`, `drawFog()`, `drawCrosshair()`
- `render()` — cycle de dessin complet (appelé par `loop`)

## Ordre de `render()`
1. Fond (couleur jour/nuit)
2. Si non démarré → retour
3. `drawGround` + objets au sol
4. Drawables (bâtiments, arbres visibles, murs, zombies visibles) triés par profondeur `x+y`, joueur inséré à sa profondeur
5. Projectiles, brouillard, viseur, hint build, **cercle de décompte hache** (`drawChopProgress`), horloge
6. Sac (si ouvert), voile pause, game over

## Sprites
- `PLAYER_SPRITE`/`PAL` et `ZOMBIE_SPRITE`/`ZPAL` ont été déplacés vers `G.TEXTURES.player` et `G.TEXTURES.zombie` (`src/textures/`). Voir `docs/textures.md`.
- Rendu pixelisé : `cell = zoom*0.5`, `imageSmoothingEnabled=false`.

## Culling
Arbres et zombies hors de `visibleWorldBounds()` ne sont pas dessinés (perf).

## Étendre
- **Nouveau drawable** : ajouter au tableau `drawables` dans `render` + une fonction `drawX`.
- **Effet visuel** (sang, impact) : ajouter une `drawX` appelée au bon endroit de `render`.
- **Niveaux de zoom** : ajuster `cell` et les bornes de `clamp(targetZoom,1,40)`.

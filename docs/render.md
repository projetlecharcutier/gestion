# Rendu — `src/render.js`

## Contrat
Dessine tout (sol, objets, arbres, bâtiments, murs, zombies, joueur, projectiles, brouillard, viseur) et orchestre `render()`. Dépend de `config.js`, `state.js`, `projection.js`, `hud.js`, `bag.js`. C'est le plus gros fichier : à ne modifier que pour du dessin.

## Exposé sur `G`
- Helpers : `fillPoly(points, fill, stroke)`, `roundRect(x,y,w,h,r)`
- `drawGround()` — tuiles iso (ville vs hors ville) + bordure de ville
- `drawItem(it)`, `drawTree(t)`, `drawBuilding(b)`, `drawWall(m)`, `drawZombie(z)`, `drawPlayer()`, `drawProjectiles()`, `drawFog()`, `drawCrosshair()`
- `render()` — cycle de dessin complet (appelé par `loop`)

## Ordre de `render()`
1. Fond (couleur jour/nuit)
2. Si non démarré → retour
3. `drawGround` + objets au sol
4. Drawables (bâtiments, arbres visibles, murs, zombies visibles) triés par profondeur `x+y`, joueur inséré à sa profondeur
5. Projectiles, brouillard, viseur, hint build, horloge
6. Sac (si ouvert), voile pause, game over

## Sprites
- `PLAYER_SPRITE` / `PAL` (6×15) : h=cheveux, s=peau, b=corps, p=pantalons, f=pieds. Flip horizontal si `face<0`.
- `ZOMBIE_SPRITE` / `ZPAL` (6×15) : palette verte.
- Rendu pixelisé : `cell = zoom*0.5`, `imageSmoothingEnabled=false`.

## Culling
Arbres et zombies hors de `visibleWorldBounds()` ne sont pas dessinés (perf).

## Étendre
- **Nouveau drawable** : ajouter au tableau `drawables` dans `render` + une fonction `drawX`.
- **Effet visuel** (sang, impact) : ajouter une `drawX` appelée au bon endroit de `render`.
- **Niveaux de zoom** : ajuster `cell` et les bornes de `clamp(targetZoom,1,40)`.

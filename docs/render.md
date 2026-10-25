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
4. Drawables (bâtiments, arbres visibles, murs, zombies visibles) triés par profondeur `x+y`, joueur inséré à sa profondeur. **Forêts coupées** : une forêt à un état de coupe `foretStage > 0` reçoit un biais négatif (`FORET_DEPTH_BIAS` par étage) pour se dessiner **derrière** ses voisines pleines (s0) — le rétrécissement de son AABB par `refitForet` la faisait sinon passer devant
5. Projectiles, brouillard, viseur, **grille de construction** (`drawBuildGrid`, `src/grid.js`, mode pose uniquement), hint build, **cercle de décompte hache** (`drawChopProgress`), horloge
6. Sac (si ouvert), voile pause, game over

## Sprites
- `PLAYER_SPRITE`/`PAL` et `ZOMBIE_SPRITE`/`ZPAL` ont été déplacés vers `G.TEXTURES.player` et `G.TEXTURES.zombie` (`src/textures/`). Voir `docs/textures.md`.
- Rendu pixelisé : `cell = zoom*0.5`, `imageSmoothingEnabled=false`.

## Échelle de pixels commune (`G.SPRITE_PX`, `src/config.js`)

Tous les objets PNG du jeu (hors joueur) sont dessinés à la même échelle de
pixels : **1 pixel Aseprite = `G.SPRITE_PX` (= 2) pixels écran au zoom 1**.
Le PNG n'est PAS étiré sur l'emprise sol (losange iso) : il garde sa taille
Aseprite réelle (image courante : frame d'anim ou PNG de base), ancré
bas-centre. Référence historique = le rendu des maisons/églises/décors
(emprise `sprite.w * 2`). `decorRenderScale` (église de Lisieux) reste
multiplicatif. Le joueur garde son échelle propre (`z * 1.0`).

Sites concernés (`src/render.js`, `src/ciel.js`) : `drawBuilding` (mairie,
église, forêts, maisons, décors, torches, potence, bâtiments de ville),
`drawTower`, `drawMontgolfiereTop`, `drawWall`, `drawSiegeTower`,
`drawSiegeTraces`, `drawBird`, `drawOne` (ciel : nuages/PORCO/oiseaux).
Les emprises de collision restent inchangées (seul le rendu change).

## Palissades (variantes A/B/C/H/K/X/Z)
`drawWall(m)` choisit le PNG via `m.variant` (repli : `m.dir` "A"/"B", puis rendu vectoriel). **Le sprite est étiré sur l'emprise réelle du mur** (losange iso de sa collision), ancré bas-centre : deux palissades adjacentes se joignent visuellement sans trou ni chevauchement. La variante est calculée côté serveur (voir [walls.md § Variantes](walls.md#variantes-de-palissade-png-ahkxz)) et arrive dans les snapshots.

## Sprites de décors & miroir

Les décors PNG (`elementdecord`) suivent l'ancrage commun bas-centre du losange.
Décors `nonbloquant`/`dessous` avec `decorFlip` : rendus en **miroir vertical**
(`ctx.scale(-1,1)` autour du centre du sprite) — transform entier, pixels carrés
préservés (style pixel art iso). Le flip est décidé à la pose (`src/world.js`,
`makeDecor`) et arrive via le snapshot serveur ; les décors `bloquant` ne sont
jamais retournés (hitbox calée sur le PNG d'origine).

## Culling
Arbres et zombies hors de `visibleWorldBounds()` ne sont pas dessinés (perf).

## Étendre
- **Nouveau drawable** : ajouter au tableau `drawables` dans `render` + une fonction `drawX`.
- **Effet visuel** (sang, impact) : ajouter une `drawX` appelée au bon endroit de `render`.
- **Niveaux de zoom** : ajuster `cell` et les bornes de `clamp(targetZoom,1,40)`.

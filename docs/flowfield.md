# Flow field (navigation zombies) — `src/flowfield.js`

## Contrat

Navigation globale des zombies : BFS depuis la ville vers toute la carte, précalculant une **flèche** (direction optimale) par cellule. Consommé par `updateZombies` (`G.navStep`/`G.navAngle`) — les zombies suivent la flèche de leur cellule au lieu de chercher un chemin individuel. Reconstruit à chaque changement de la grille de bâtiments (`rebuildBuildingGrid`, `src/world.js`).

## Exposé sur `G`

- `NAV_CELL` (32 px) — taille de cellule du champ
- `navGrid` / `navDirX` / `navDirY` / `navCols` / `navRows` — structures précalculées (distances BFS, direction par cellule)
- `rebuildNavGrid()` — reconstruit le champ (BFS depuis la zone ville, marge de 80 px)
- `navStep(x, y)` — position suivante conseillée depuis un point monde
- `navAngle(x, y)` — direction de la flèche en radians
- `ensureForetConnectivity()` — retire les forêts qui referment des enclaves libres inaccessibles depuis la ville (appelé en fin de `buildWorld` et après repousse)

## Contraintes

- Coût mémoire : `WORLD/NAV_CELL` au carré cellules — passer `WORLD` de 10000 à 20000 a quadruplé la grille, le BFS reste amorti car reconstruit **seulement** quand les bâtiments changent.
- Les forêts sont des obstacles de navigation comme les bâtiments : toute forêt ajoutée doit passer par `makeForet` (AABB cohérente client/serveur, voir `docs/world.md`) sinon elle crée des poches dont les zombies ne sortent pas.
- Le flow field doit rester en parité avec les collisions réelles du joueur (villes PNG incluses via `villeBlockNav`) : une divergence = zombies coincés ou traversant les murs.

## Étendre

- **Changer la précision** : `NAV_CELL` (plus petit = plus fin mais plus lourd à reconstruire).
- **Nouvelle source de blocage** : l'ajouter à la construction du champ (comme `villeBlockNav` pour les villes PNG).
- **Nouvelle cible** : le BFS vise la zone ville ; viser ailleurs = changer la source du BFS.

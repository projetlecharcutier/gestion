# Monde (génération) — `src/world.js`

## Contrat
Construit le monde initial dans `G.state` : bâtiments, mur de périmètre, objets au sol, arbres. Appelé au démarrage (`src/input.js`) et au redémarrage. Dépend de `config.js` (dimensions, constantes), `projection.js` non requis.

## Exposé sur `G`
- `makeBuilding(x, y, w, h, name, msg, height)` → objet bâtiment `{ x, y, w, h, name, msg, height, door:{x,y} }`
- `nearBuilding(x, y, pad)` → bool — un bâtiment à `pad` px près (utilisé pour le placement d'arbres)
- `buildPerimeterWall()` — remplit `state.walls` d'un mur de 1 planche autour de la ville
- `buildWorld()` — remplit `state.buildings`, `state.walls`, `state.items`, `state.trees`, vide `state.zombies`

## Données générées
- 7 bâtiments (Mairie, Auberge, Forge, Marché, Temple, Tour, **Hôpital**), chacun ≤ `PLAYER_W*20` (120 px). La **Mairie** (`isMairie: true`) a `hp = MAIRIE_MAX_HP` (1000) et fonctionne comme coffre.
- Mur de périmètre : segments de 25 px, épaisseur 4 px, à 6 px de la bordure ville
- ~23 objets : pièces/potions/objets **en ville**, armes **hors ville uniquement**, objets rares hors ville
- **3 haches** (objet `kind:"outil"`, `name:"Hache"`) **hors ville uniquement** : équipables via le sac (`state.axeEquipped`) pour la récolte de planches (voir `src/chop.js`)
- ~110 arbres : 5 en ville, 80 en forêt (hors ville), 25 en bordure

## Forêts & navigation zombies

- `spawnForets(state, total, inTown)` génère les forêts en clusters (jusqu'à 10 par cluster) ; chaque forêt est un bâtiment `isForet`/`isDecor`/`isChoppable` construit par `makeForet(x, y, frame)` (AABB = largeur du PNG × 2, réduite à la zone opaque par `shrinkToOpaque` côté client). Côté serveur, `dom-stub.js` fournit des dimensions factices **calées sur les PNG réels** (52×37, 40×30) — ne pas y remettre 128, cela créait des massifs 256×256 bloquant les 3/4 de la carte en simulation.
- `foretDepleted(b)` : forêt entièrement coupée (non bloquante). `refitForet(b)` recalcule l'AABB à l'état de coupe courant.
- `rebuildBuildingGrid()` construit la grille spatiale O(1) des bâtiments puis **recalcule le champ de navigation** `rebuildNavGrid()` (BFS vers la ville, `G.NAV_CELL` = 32 px) consommé par les zombies (`G.navStep`, voir `docs/zombies.md`).
- `ensureForetConnectivity()` retire les forêts qui referment des enclaves libres inaccessibles depuis la ville (appelé en fin de `buildWorld` et après repousse).

## Contraintes
- Les armes ne spawnent **que hors ville** (règle de jeu). Les haches aussi.
- Le nom `"Hôpital"` est testé en dur dans le clic (`src/input.js`) pour le soin — ne pas renommer sans MAJ ce test.
- La **Mairie** est la cible des zombies (centre-ville) : si ses PV tombent à 0 → game over.
- Le centre du monde est `G.WORLD / 2` (plus de 50000 codé en dur).

## Étendre
- **Nouveau bâtiment** : ajouter un `makeBuilding(...)` dans `buildWorld` (respecter la limite ≤ `PLAYER_W*20`).
- **Nouvel objet** : ajouter à `state.items[]` avec `{ x, y, taken:false, name, color, kind:"objet"|"arme"|"outil" }`.
- **Plus d'arbres** : ajuster les compteurs de boucles.

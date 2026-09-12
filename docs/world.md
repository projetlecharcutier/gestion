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

## Contraintes
- Les armes ne spawnent **que hors ville** (règle de jeu). Les haches aussi.
- Le nom `"Hôpital"` est testé en dur dans le clic (`src/input.js`) pour le soin — ne pas renommer sans MAJ ce test.
- La **Mairie** est la cible des zombies (centre-ville) : si ses PV tombent à 0 → game over.
- Le centre du monde est `G.WORLD / 2` (plus de 50000 codé en dur).

## Étendre
- **Nouveau bâtiment** : ajouter un `makeBuilding(...)` dans `buildWorld` (respecter la limite ≤ `PLAYER_W*20`).
- **Nouvel objet** : ajouter à `state.items[]` avec `{ x, y, taken:false, name, color, kind:"objet"|"arme"|"outil" }`.
- **Plus d'arbres** : ajuster les compteurs de boucles.

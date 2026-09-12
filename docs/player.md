# Joueur — `src/player.js`

## Contrat
Déplacement + collisions bâtiments et planches posées, entrée/sortie de bâtiment, soin à l'hôpital, pause. Dépend de `config.js`, `state.js`, `walls.js` (`aabbHitsWalls`).

## Exposé sur `G`
- `aabbHitsBuildings(x, y)` → bool — AABB joueur (PLAYER_W) contre un bâtiment
- `tryMove(nx, ny)` → bool — déplacement axe par axe (glisse le long des murs/bâtiments/planches), borne au monde. Teste `aabbHitsBuildings` **et** `aabbHitsWalls` (planches posées par le joueur).
- `clampPlayer()` — borne le joueur dans le monde
- `enterBuilding(b)` — ouvre l'écran bâtiment, fige `state.inBuilding`
- `leaveBuilding()` — repositionne le joueur devant la porte, ferme l'écran
- `togglePause()` — bascule `state.paused` + écran pause (sauf si dans un bâtiment)
- `hasGoldPiece()` → index d'une "Pièce" dans `state.bag.contents` (ou -1)
- `tryHealAtHospital()` — soigne contre 1 pièce, ou ouvre le sac si PV max / pas de pièce

## Contraintes
- `tryMove` déplace en Y puis en X séparément (permet de longer les murs).
- Bornes : `PLAYER_HALF` .. `WORLD - PLAYER_HALF`.
- Le soin remet `player.hp` à `PLAYER_MAX_HP` et consomme une "Pièce" du sac.

## Étendre
- **Sprint / stamina** : ajouter une garde dans `tryMove` ou un champ `state.stamina`.
- **Autre bâtiment à effet** : ajouter un test par `b.name` dans le clic (`src/input.js`), comme l'Hôpital.

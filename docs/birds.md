# Oiseaux — `src/birds.js`

## Contrat

Oiseaux volants décoratifs/ramassables : volent en ligne droite, rebondissent à 90° sur les bords de la carte, ne sont bloqués par aucun objet, tués par les projectiles, droppent un objet aléatoire (`G.BIRD_DROPS`, dont une pièce d'or avec probabilité `BIRD_GOLD_CHANCE`). Spawnés à la fois en pleine carte (`spawnBird`, 4 directions diagonales) et depuis les bords vers l'intérieur (`spawnBirdFromEdge`).

## Exposé sur `G`

- `spawnBird()` / `spawnBirdFromEdge()` / `spawnBirds()` — création (`BIRD_COUNT` oiseaux)
- `updateBirds(dt)` — vol, rebonds, suppression à la mort

## Constantes (`src/config.js`)

`BIRD_SPEED` (220), `BIRD_HP` (1), `BIRD_W` (10), `BIRD_HALF` (5), `BIRD_COUNT` (20), `BIRD_HIT_R` (14), `BIRD_DROPS` (table des objets droppés), `BIRD_GOLD_CHANCE` (0.5).

## Contraintes

- Les oiseaux ne sont bloqués par **aucun obstacle** (pas de collision bâtiments/villes) — par conception.
- Les sprites de direction disponibles sont limités (8 directions cardinales, `idle`) : la direction de vol est arrondie à la direction cardinale la plus proche pour l'affichage, et les spawns aléatoires sont alignés sur les 4 diagonales (45/135/225/315°) pour matcher les PNG existants.

## Étendre

- **Nouveau drop** : ajouter à `BIRD_DROPS` (`src/config.js`).
- **Nouvelle direction de spawn** : les 4 axes cardinaux sont déjà couverts par `spawnBirdFromEdge` ; pour un autre pattern, ajouter une fonction `spawnBird<Pattern>` ici.
- **Nouveau sprite** : `assets/sprites/bird/<direction>.png` (N, S, E, W, NE, NW, SE, SW, idle), animables via `<direction>-N.png`.

# Murs & construction — `src/walls.js`

## Contrat
Construction de planches/murs (mode pose de planche : Z + clic) avec rotation, et nettoyage des murs détruits. Dépend de `config.js` (`WALL_PLANKS`, `WALL_BUILD_RANGE`, `WALL_MAX_HP`), `state.js` (`planks`, `walls`, `buildings`, `plankRotation`). Les dégâts sur murs sont appliqués par les zombies (`src/zombies.js`).

## Exposé sur `G`
- `PLANK_LONG` (120), `PLANK_THICK` (24) — dimensions d'une planche posée (px).
- `plankDims()` — `{ w, h }` selon `state.plankRotation` (0 = horizontale `w>h`, 1 = verticale `h>w`).
- `tryBuildWall(wx, wy)` — pose une planche si : à portée du joueur, assez de planches, pas sur bâtiment. Consomme `WALL_PLANKS` planches. Les planches **peuvent se superposer** (pas de test mur-vs-mur).
- `rotatePlank()` — bascule `state.plankRotation` entre 0 et 1 (rotation 90°).
- `cleanupWalls()` — retire les murs à `hp <= 0`. Appelé chaque frame.

## Structure d'un mur
`{ x, y, w, h, hp, orient }` — `orient` \"h\" ou \"v\" (dérivé de `w>h` au moment de la pose, détermine la largeur de la barre de vie au rendu).

## Contraintes
- Activation du mode pose : touche **Z** (avec `w`/`W` comme fallback AZERTY) gérée dans `src/input.js`.
- Rotation : touche **Espace** en mode pose (gérée dans `src/input.js`, appelle `rotatePlank()`). Hors mode pose, Espace = tir.
- Portée de construction : `WALL_BUILD_RANGE` (180 px) autour du joueur.
- Coût : 4 planches par planche posée.
- Anti-chevauchement : pas de construction **sur bâtiment** ; la superposition de planches entre elles est autorisée.

## Étendre
- **Réparer un mur** : ajouter une fonction qui incrémente `wall.hp` (borné à `WALL_MAX_HP`) contre des planches.
- **Mur renforcé** : ajouter un champ `wall.armor` et le soustraire aux dégâts dans `updateZombies`.
- **Matériaux variés** : ajouter un `wall.material` lu par le rendu (`src/render.js`).
- **Désactiver la superposition** : réintroduire un test mur-vs-mur dans `tryBuildWall`.

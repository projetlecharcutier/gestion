# Murs & construction — `src/walls.js`

## Contrat
Construction de murs (mode B + clic) et nettoyage des murs détruits. Dépend de `config.js` (`WALL_PLANKS`, `WALL_BUILD_RANGE`, `WALL_MAX_HP`), `state.js`. Les dégâts sur murs sont appliqués par les zombies (`src/zombies.js`).

## Exposé sur `G`
- `tryBuildWall(wx, wy)` — construit un mur si : à portée du joueur, assez de planches, pas sur bâtiment/mur existant. Consomme `WALL_PLANKS` planches.
- `cleanupWalls()` — retire les murs à `hp <= 0`. Appelé chaque frame.

## Structure d'un mur
`{ x, y, w, h, hp, orient }` — `orient` "h" ou "v" (détermine la largeur de la barre de vie au rendu).

## Contraintes
- Portée de construction : `WALL_BUILD_RANGE` (180 px) autour du joueur.
- Coût : 4 planches/mur. Orientation auto selon l'axe dominant du clic.
- Anti-chevauchement : pas de construction sur bâtiment ni mur existant.

## Étendre
- **Réparer un mur** : ajouter une fonction qui incrémente `wall.hp` (borné à `WALL_MAX_HP`) contre des planches.
- **Mur renforcé** : ajouter un champ `wall.armor` et le soustraire aux dégâts dans `updateZombies`.
- **Matériaux variés** : ajouter un `wall.material` lu par le rendu (`src/render.js`).
